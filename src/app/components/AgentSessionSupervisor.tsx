import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Context, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { Task, TimelineSwimlane } from '../types';
import { TaskExecutionAction } from './TaskExecutionAction';
import { agentRuntimeTurnState, isAgentRuntimeTurnInFlight, projectAgentRuntimeSession, resolveAgentTaskAttention, type AgentRuntimeDockState, type AgentRuntimeTurnProjection, type AgentTaskPendingRequest } from '../utils/agentRuntimeActivity';
import { primaryDeliveryAttention } from '../utils/agentRuntimeDelivery.ts';
import type { AttentionState } from '../utils/attention';
import { useAgentRuntimeDelivery } from '../hooks/useAgentRuntimeDelivery.ts';
import { measurePerformanceOperation } from '../services/performanceLogging.ts';
import { areSerializedValuesEqual } from '../store/workspaceSelectors.ts';

export const CONNECTED_SESSION_STATES = new Set(['starting', 'ready']);
const HISTORY_SESSION_STATES = new Set(['interrupted', 'failed', 'closed', 'complete', 'completed']);

export interface SessionBinding {
  id: string;
  state: string;
  workspacePath?: string;
  scope?: { kind?: string; taskId?: string; goalId?: string; goalElementId?: string };
  taskExecution?: { state?: string; batchNumber?: number; reason?: string; updatedAt?: string };
  turn?: AgentRuntimeTurnProjection & { updatedAt?: string };
  updatedAt?: string;
}

export interface SessionDockItem {
  binding: SessionBinding;
  task?: Task;
  pendingRequest?: AgentTaskPendingRequest;
  attention?: AttentionState;
}

const STORAGE_BLOCKED_REASON = 'Agent history could not be saved. Cancel and pending input remain available; new work is paused.';
const ACTIVE_SESSION_BLOCKED_REASON = 'Another task is using the agent right now. Open it from Agent tasks or wait for it to finish.';

async function readPendingRequest(bindingId: string): Promise<AgentTaskPendingRequest | undefined> {
  const requests = await measurePerformanceOperation('acp', 'supervisor.requests.list', async () => (
    window.electron?.agentRuntime?.sessions?.requests?.(bindingId)
  ));
  const request = Array.isArray(requests) ? requests[0] : undefined;
  if (!request || typeof request.message !== 'string') return undefined;
  // Same classification as the main delivery projection: elicitation asks for input, everything else for permission.
  return { requestId: request.requestId, message: request.message, kind: request.responseKind === 'elicitation' ? 'input' : 'permission' };
}

interface AgentSessionRequest {
  task: Task;
  repositoryFolder?: string;
  startOnRequest: boolean;
  requestId: number;
}

interface AgentSessionSupervisorContextValue {
  requestTask: (task: Task, options?: { repositoryFolder?: string; startOnRequest?: boolean }) => void;
  sessionDock: SessionDockProjection;
  openSession: (binding: SessionBinding) => void;
}

interface AgentSessionLauncherContextValue {
  requestTask: AgentSessionSupervisorContextValue['requestTask'];
}

export interface SessionDockProjection {
  state: AgentRuntimeDockState;
  binding?: SessionBinding;
  task?: Task;
  historyCount: number;
  items: SessionDockItem[];
  pendingRequest?: SessionDockItem['pendingRequest'];
  /** Resolved once here so the Agent tasks area and task details never disagree. */
  attention?: AttentionState;
}

type AgentSessionSupervisorGlobal = typeof globalThis & {
  __omvraAgentSessionSupervisorContext?: Context<AgentSessionSupervisorContextValue | null>;
  __omvraAgentSessionLauncherContext?: Context<AgentSessionLauncherContextValue | null>;
};

// Vite can refresh this module while preserving mounted children. Keep the
// context identity stable so those children do not lose access to the provider.
const agentSessionSupervisorGlobal = globalThis as AgentSessionSupervisorGlobal;
const AgentSessionSupervisorContext = agentSessionSupervisorGlobal.__omvraAgentSessionSupervisorContext
  || (agentSessionSupervisorGlobal.__omvraAgentSessionSupervisorContext = createContext<AgentSessionSupervisorContextValue | null>(null));
const AgentSessionLauncherContext = agentSessionSupervisorGlobal.__omvraAgentSessionLauncherContext
  || (agentSessionSupervisorGlobal.__omvraAgentSessionLauncherContext = createContext<AgentSessionLauncherContextValue | null>(null));

export function useAgentSessionSupervisor() {
  const context = useContext(AgentSessionSupervisorContext);
  if (!context) throw new Error('AgentSessionSupervisor must be rendered above its launch surfaces.');
  return context;
}

export function useAgentSessionLauncher() {
  const context = useContext(AgentSessionLauncherContext);
  if (!context) throw new Error('AgentSessionSupervisor must be rendered above its launch surfaces.');
  return context;
}

export function AgentSessionSupervisorProvider({ children, tasks, projects }: { children: ReactNode; tasks: Task[]; projects: TimelineSwimlane[] }) {
  const [request, setRequest] = useState<AgentSessionRequest | null>(null);
  const [bindings, setBindings] = useState<SessionBinding[]>([]);
  const [pendingRequestsByBinding, setPendingRequestsByBinding] = useState<Record<string, SessionDockItem['pendingRequest']>>({});
  const [supervisionVisible, setSupervisionVisible] = useState(false);
  const [supervisedBindingId, setSupervisedBindingId] = useState<string | undefined>();
  const [storageBlocked, setStorageBlocked] = useState(false);
  // The one renderer subscription for supervision; the modal and dock consume its projection.
  const delivery = useAgentRuntimeDelivery(supervisedBindingId, supervisionVisible && Boolean(request));
  const deliveryAttention = primaryDeliveryAttention(delivery.control);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    let disposed = false;
    let refreshRunning = false;
    const refreshPendingRequest = async (binding: SessionBinding) => {
      if (agentRuntimeTurnState(binding) !== 'waiting-input') {
        if (!disposed) setPendingRequestsByBinding(current => {
          if (!(binding.id in current)) return current;
          const next = { ...current };
          delete next[binding.id];
          return next;
        });
        return;
      }
      const nextRequest = await readPendingRequest(binding.id);
      if (!disposed) setPendingRequestsByBinding(current => {
        if (areSerializedValuesEqual(current[binding.id], nextRequest)) return current;
        const next = { ...current };
        if (nextRequest) next[binding.id] = nextRequest;
        else delete next[binding.id];
        return next;
      });
    };
    const refresh = async () => {
      if (refreshRunning || disposed) return;
      refreshRunning = true;
      try {
        const runtimeState = await window.electron?.agentRuntime?.getState?.();
        if (runtimeState?.ok && runtimeState.value?.defaults?.acpRuntimeAccessEnabled === false) return;
        const result = await measurePerformanceOperation('acp', 'supervisor.sessions.list', async () => (
          window.electron?.agentRuntime?.sessions?.list?.({ limit: 100, includeEvents: false })
        ));
        if (!result?.ok || !Array.isArray(result.bindings)) return;
        const nextBindings = result.bindings as SessionBinding[];
        const requestEntries = await Promise.all(nextBindings
          .filter(binding => agentRuntimeTurnState(binding) === 'waiting-input')
          .map(async binding => {
            return [binding.id, await readPendingRequest(binding.id)] as const;
          }));
        if (!disposed) {
          setBindings(current => areSerializedValuesEqual(current, nextBindings) ? current : nextBindings);
          const nextRequests = Object.fromEntries(requestEntries);
          setPendingRequestsByBinding(current => areSerializedValuesEqual(current, nextRequests) ? current : nextRequests);
        }
      } finally {
        refreshRunning = false;
      }
    };
    void refresh();
    // Keep a bounded recovery poll for missed runtime events; live events update only their binding/request below.
    const timer = window.setInterval(() => void refresh(), 10000);
    const unsubscribe = window.electron?.agentRuntime?.sessions?.onEvent?.((payload) => {
      if (payload?.kind === 'notification' && payload.notification) {
        const n = payload.notification;
        const show = n.category === 'completed' ? toast.success : n.category === 'failure' ? toast.error : toast;
        show(n.safeSummary, {id:'agent-runtime-notification', duration:4000, action:{label:'Open',onClick:()=>{
          const task = tasksRef.current.find(candidate=>candidate.id===n.taskId);
          if (task) setRequest(current=>({task,startOnRequest:false,requestId:(current?.requestId || 0)+1}));
        }}});
        return;
      }
      if(payload?.kind === 'storage-failure') {
        setStorageBlocked(true);
        toast.error(STORAGE_BLOCKED_REASON, {id:'agent-work-storage-failure'});
        return;
      }
      if (payload?.kind === 'storage-recovered') { setStorageBlocked(false); toast.dismiss('agent-work-storage-failure'); return; }
      if (!payload?.binding) return;
      const nextBinding = payload.binding as SessionBinding;
      setBindings(current => {
        const index = current.findIndex(binding => binding.id === nextBinding.id);
        const next = index < 0 ? [...current, nextBinding] : current.map(binding => binding.id === nextBinding.id ? nextBinding : binding);
        return areSerializedValuesEqual(current, next) ? current : next;
      });
      void refreshPendingRequest(nextBinding);
    });
    return () => {
      disposed = true;
      window.clearInterval(timer);
      unsubscribe?.();
    };
  }, []);

  // A request reference can reach the projection before the binding update; fetch its details once per request.
  const deliveryRequestKey = deliveryAttention?.request ? `${delivery.bindingId}:${deliveryAttention.id}:${deliveryAttention.pendingCount ?? 1}` : null;
  useEffect(() => {
    const bindingId = delivery.bindingId;
    if (!deliveryRequestKey || !bindingId) return;
    let disposed = false;
    void readPendingRequest(bindingId).then(nextRequest => {
      if (disposed) return;
      setPendingRequestsByBinding(current => {
        if (areSerializedValuesEqual(current[bindingId], nextRequest)) return current;
        const next = { ...current };
        if (nextRequest) next[bindingId] = nextRequest;
        else delete next[bindingId];
        return next;
      });
    }).catch(() => {});
    return () => { disposed = true; };
  }, [delivery.bindingId, deliveryRequestKey]);

  useEffect(() => {
    // Visibility only tunes toast suppression; a main process without the handler must not surface errors.
    window.electron?.agentRuntime?.sessions?.setNotificationVisibility?.({taskId:request?.task.id,visible:supervisionVisible && Boolean(request)})?.catch(() => {});
    return () => { window.electron?.agentRuntime?.sessions?.setNotificationVisibility?.({visible:false})?.catch(() => {}); };
  }, [request?.task.id, supervisionVisible]);

  const requestTask = useCallback((task: Task, options: { repositoryFolder?: string; startOnRequest?: boolean } = {}) => {
    setRequest(current => ({
      task,
      repositoryFolder: options.repositoryFolder,
      startOnRequest: options.startOnRequest ?? true,
      requestId: (current?.requestId || 0) + 1,
    }));
  }, []);
  const newestFirst = useCallback((items: SessionBinding[]) => [...items].sort((left, right) => Date.parse(right.updatedAt || '') - Date.parse(left.updatedAt || '')), []);
  const openBinding = useCallback((binding: SessionBinding) => {
    const task = binding.scope?.taskId ? tasks.find(candidate => candidate.id === binding.scope?.taskId) : undefined;
    if (!task) return;
    const currentBinding = newestFirst(bindings.filter(candidate => candidate.scope?.kind === 'task' && candidate.scope?.taskId === task.id && (isAgentRuntimeTurnInFlight(candidate) || CONNECTED_SESSION_STATES.has(candidate.state))))[0] || binding;
    const project = projects.find(candidate => task.projectIds?.includes(candidate.id) || candidate.id === task.swimlaneId);
    setRequest(current => ({
      task,
      repositoryFolder: currentBinding.workspacePath || task.repositoryFolder || project?.repositoryFolder,
      startOnRequest: false,
      requestId: (current?.requestId || 0) + 1,
    }));
  }, [bindings, newestFirst, projects, tasks]);
  const activeBinding = newestFirst(bindings.filter(isAgentRuntimeTurnInFlight))[0];
  const readyBinding = newestFirst(bindings.filter(binding => binding.state === 'ready' && !isAgentRuntimeTurnInFlight(binding)))[0];
  const historyBinding = [...bindings].reverse().find(binding => HISTORY_SESSION_STATES.has(binding.state));
  const dockBinding = activeBinding || readyBinding || historyBinding;
  const dockTask = dockBinding?.scope?.taskId ? tasks.find(task => task.id === dockBinding.scope?.taskId) : undefined;
  // TODO: cap persisted historical runs in the runtime service; this eight-item UI limit only bounds rendering.
  // Dates are deliberately not consulted: unscheduled tasks are supervised exactly like scheduled ones.
  const attentionFor = (binding: SessionBinding, task?: Task) => resolveAgentTaskAttention({
    binding,
    taskStatus: task?.status,
    pendingRequest: pendingRequestsByBinding[binding.id],
    deliveryAttention: binding.id === delivery.bindingId ? deliveryAttention : undefined,
  });
  const dockItems = [...bindings]
    .filter(binding => binding.scope?.kind === 'task' && tasks.some(task => task.id === binding.scope?.taskId))
    .sort((left, right) => Date.parse(right.updatedAt || '') - Date.parse(left.updatedAt || ''))
    .slice(0, 8)
    .map(binding => {
      const task = tasks.find(candidate => candidate.id === binding.scope?.taskId);
      return { binding, task, pendingRequest: pendingRequestsByBinding[binding.id], attention: attentionFor(binding, task) };
    });
  const blockedByActiveSession = Boolean(activeBinding && request && activeBinding.scope?.taskId !== request.task.id);
  const blockedReason = blockedByActiveSession ? ACTIVE_SESSION_BLOCKED_REASON : storageBlocked ? STORAGE_BLOCKED_REASON : undefined;
  const dockAttention = blockedReason
    ? resolveAgentTaskAttention({ blockedReason })
    : dockBinding ? attentionFor(dockBinding, dockTask) : undefined;
  const activeSessionProjection = projectAgentRuntimeSession(activeBinding, [], {
    blocked: blockedByActiveSession,
    supervisionVisible,
  });
  const sessionDock = useMemo<SessionDockProjection>(() => ({
    state: activeBinding ? activeSessionProjection.dockState : projectAgentRuntimeSession(readyBinding || historyBinding).dockState,
    binding: dockBinding,
    task: dockTask,
    historyCount: bindings.filter(binding => HISTORY_SESSION_STATES.has(binding.state)).length,
    items: dockItems,
    pendingRequest: dockBinding ? pendingRequestsByBinding[dockBinding.id] : undefined,
    attention: dockAttention,
  }), [activeBinding, activeSessionProjection.dockState, bindings, dockAttention, dockBinding, dockItems, dockTask, historyBinding, pendingRequestsByBinding, readyBinding]);
  const value = useMemo(() => ({ requestTask, sessionDock, openSession: openBinding }), [openBinding, requestTask, sessionDock]);
  const launcherValue = useMemo(() => ({ requestTask }), [requestTask]);
  return (
    <AgentSessionLauncherContext.Provider value={launcherValue}>
      <AgentSessionSupervisorContext.Provider value={value}>
        {children}
        {request && (
          <TaskExecutionAction
            key={request.requestId}
            task={request.task}
            repositoryFolder={request.repositoryFolder}
            openRequest={request.requestId}
            startOnOpenRequest={request.startOnRequest}
            onVisibilityChange={setSupervisionVisible}
            onBindingChange={setSupervisedBindingId}
            delivery={delivery}
            onBlockedByBinding={openBinding}
            trigger={null}
          />
        )}
      </AgentSessionSupervisorContext.Provider>
    </AgentSessionLauncherContext.Provider>
  );
}
