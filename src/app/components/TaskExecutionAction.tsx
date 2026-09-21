import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Folder, Info, Play, Server, Minimize2, ShieldCheck, LoaderCircle, Hourglass } from 'lucide-react';
import { toast } from 'sonner';
import type { Task } from '../types';
import { agentRuntimeTurnState, hasAgentRuntimeTaskStarted, isAgentRuntimeTurnInFlight, projectAgentRuntimeSession, selectCurrentAgentRuntimeTurnEvents, summarizeAgentRuntimeActivity, type AgentRuntimeActivityEvent, type AgentRuntimeTurnProjection } from '../utils/agentRuntimeActivity';
import {
  agentRuntimeWorkspaceSourceLabel,
  resolveAgentRuntimeWorkspace,
  type AgentRuntimeWorkspaceResolution,
} from '../utils/agentRuntimeWorkspace';
import {
  ContextMenuItem,
} from './ui/context-menu';
import { getLatestTaskAgentOutput, getTaskExecutionPresentation, taskNeedsProviderSignIn } from '../utils/taskExecutionPresentation.ts';
import { TaskSessionComposer } from './TaskSessionComposer';
import { RuntimePermissionCard, requestValueKey, type RuntimePermissionField, type RuntimePermissionRequest } from './RuntimePermissionCard';
import { buildPermissionResponse } from './runtimePermissionResponse';
import { ExecutionNotice } from './ExecutionNotice';
import { getAttentionState } from '../utils/attention';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { measurePerformanceOperation } from '../services/performanceLogging.ts';

interface RuntimeState {
  profiles?: Array<{ id: string; name: string; integrationMode: string; enabled: boolean }>;
  defaults?: { globalProfileId?: string | null; globalWorkspacePath?: string | null; projectProfileIds?: Record<string, string> };
  observations?: Record<string, { availability?: string; authentication?: string; state?: string; error?: string }>;
}

interface RuntimeResolution {
  ok: boolean;
  state?: string;
  source?: string;
  profile?: { id: string; name: string; integrationMode: string };
  error?: string;
}

interface ExecutionPreflight {
  ok?: boolean;
  blockers?: Array<{ code?: string; message: string }>;
  warnings?: Array<{ code?: string; message: string }>;
  model?: { requested?: string | null; effective?: string | null };
  contractDigest?: string;
  contractSnapshot?: { taskRevision?: number; contributionId?: string | null };
  connection?: { ok?: boolean; error?: string; state?: string };
}

interface SessionBinding {
  id: string;
  state: string;
  revision: number;
  workspacePath?: string;
  opaqueSessionRef?: string;
  capabilities?: Array<{ id: string; support: string }>;
  scope?: { kind?: string; taskId?: string };
  updatedAt?: string;
  lastObservedAt?: string;
  taskExecution?: { state?: string; batchNumber?: number; reason?: string; updatedAt?: string };
  turn?: AgentRuntimeTurnProjection & { updatedAt?: string };
}

interface SessionEvent extends AgentRuntimeActivityEvent {
  failureClass?: string;
  requestId?: string | number;
  bindingId?: string;
  workScope?: string;
}

const requestFieldValue = (request: RuntimePermissionRequest, field: RuntimePermissionField, values: Record<string, unknown>) =>
  values[requestValueKey(request, field.name)] ?? field.defaultValue ?? (field.type === 'boolean' ? false : '');
const requestFieldIsMissing = (request: RuntimePermissionRequest, field: RuntimePermissionField, values: Record<string, unknown>) => {
  if (!field.required) return false;
  const value = requestFieldValue(request, field, values);
  if (field.type === 'boolean') return typeof value !== 'boolean';
  if (field.type === 'number' || field.type === 'integer') return value === '' || !Number.isFinite(Number(value));
  return typeof value !== 'string' || value.trim() === '';
};

interface TaskExecutionActionProps {
  task: Task;
  repositoryFolder?: string;
  trigger?: ReactNode;
  openRequest?: number;
  onOpenRequestHandled?: () => void;
  onVisibilityChange?: (visible: boolean) => void;
  onBlockedByBinding?: (binding: SessionBinding) => void;
  startOnTrigger?: boolean;
  startOnOpenRequest?: boolean;
  onOpen?: () => void;
}

function runtimeLabel(mode?: string) {
  if (mode === 'acp-local-stdio') return 'Native ACP';
  if (mode === 'codex-app-server-stdio') return 'Native Codex app-server';
  if (mode === 'claude-stream-json-stdio') return 'Native Claude stream-json';
  if (mode === 'external-handoff') return 'External handoff';
  return 'Not resolved';
}

function taskStatusLabel(status: Task['status']) {
  if (status === 'in-progress') return 'In progress';
  if (status === 'under-review') return 'Under review';
  if (status === 'done') return 'Done';
  return 'Open';
}

function ExecutionHint({ tone, title, body }: { tone: 'info' | 'warning' | 'danger'; title: string; body: string }) {
  const Icon = tone === 'info' ? Info : AlertTriangle;
  const colorClass = tone === 'danger' ? 'text-red-700 hover:bg-red-50 focus-visible:ring-red-500' : tone === 'warning' ? 'text-amber-700 hover:bg-amber-50 focus-visible:ring-amber-500' : 'text-blue-700 hover:bg-blue-50 focus-visible:ring-blue-500';
  return <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" aria-label={`${title}: ${body}`} className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${colorClass}`}>
        <Icon className="size-3.5" aria-hidden="true" />
        <span>{title}</span>
      </button>
    </TooltipTrigger>
    <TooltipContent side="bottom" align="start" className="w-[min(360px,calc(100vw-2rem))] flex-col items-start whitespace-normal text-left">
      <div className="font-semibold">{title}</div>
      <div className="mt-1 font-normal text-white/85">{body}</div>
    </TooltipContent>
  </Tooltip>;
}

export function TaskExecutionAction({ task, repositoryFolder, trigger, openRequest, onOpenRequestHandled, onVisibilityChange, onBlockedByBinding, startOnTrigger = false, startOnOpenRequest = true, onOpen }: TaskExecutionActionProps) {
  const [open, setOpen] = useState(false);
  const [startRequested, setStartRequested] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [runtimeState, setRuntimeState] = useState<RuntimeState | null>(null);
  const [workspace, setWorkspace] = useState<AgentRuntimeWorkspaceResolution | null>(null);
  const [resolution, setResolution] = useState<RuntimeResolution | null>(null);
  const [preflight, setPreflight] = useState<ExecutionPreflight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [binding, setBinding] = useState<SessionBinding | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RuntimePermissionRequest[]>([]);
  const [requestValues, setRequestValues] = useState<Record<string, unknown>>({});
  const [mcpReadOnly, setMcpReadOnly] = useState<boolean | null>(null);
  const [, setHasMoreEvents] = useState(false);
  const [operationBusy, setOperationBusy] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [steerText, setSteerText] = useState('');
  const [showSignInHelp, setShowSignInHelp] = useState(false);
  const [checkingAuthentication, setCheckingAuthentication] = useState(false);
  const [authenticationRechecked, setAuthenticationRechecked] = useState(false);
  const activityRef = useRef<HTMLDivElement>(null);
  const [awayFromLatest, setAwayFromLatest] = useState(false);
  const refreshSequence = useRef(0);
  const taskAlreadyComplete = task.status === 'done';

  const activeContribution = task.collaboration?.contributions?.find(contribution => contribution.state === 'working');
  const startableContribution = task.collaboration?.contributions?.find(contribution =>
    contribution.state === 'pending' || contribution.state === 'revision-requested'
  );
  const terminalBinding = binding?.state === 'closed' || binding?.state === 'failed';
  const activeAttempt = isAgentRuntimeTurnInFlight(binding || undefined) || (Boolean(activeContribution?.latestAttemptId) && (
    !preflight || preflight.blockers?.some(blocker => blocker.code === 'ACP_EXECUTION_ALREADY_ACTIVE') === true
  ));
  const executionContributionId = preflight?.contractSnapshot?.contributionId || startableContribution?.id;
  const resolvedRepositoryFolder = workspace?.workspacePath || '';
  const repositorySource = workspace ? agentRuntimeWorkspaceSourceLabel(workspace.source) : loading ? 'Resolving' : 'Not configured';
  const reportRuntimeError = (operation: string, caught: unknown, fallback: string) => {
    const message = caught instanceof Error ? caught.message : fallback;
    console.error(`[agent-runtime:ui] ${operation}.failed`, { taskId: task.id, bindingId: binding?.id || null, message, error: caught });
    setError(message);
  };

  useEffect(() => {
    onVisibilityChange?.(open);
  }, [onVisibilityChange, open]);

  useEffect(() => {
    if (openRequest) {
      setStartRequested(startOnOpenRequest);
      setOpen(true);
      onOpenRequestHandled?.();
    }
  }, [onOpenRequestHandled, openRequest, startOnOpenRequest]);

  useEffect(() => {
    if (!open || !window.electron?.agentRuntime) return;
    let cancelled = false;
    setLoading(true);
    setSessionLoaded(false);
    setError(null);
    setWorkspace(null);
    setResolution(null);
    setPreflight(null);
    void (async () => {
      try {
        if (taskAlreadyComplete) {
          setPreflight({ ok: false, blockers: [{ code: 'TASK_ALREADY_COMPLETE', message: 'This task is already complete. Reopen it or move it back to In progress before starting new work.' }] });
          return;
        }
        const stateResult = await window.electron.agentRuntime.getState();
        if (cancelled) return;
        if (!stateResult.ok || !stateResult.value) throw new Error(stateResult.error || 'Agent connections could not be loaded.');
        const state = stateResult.value as RuntimeState;
        setRuntimeState(state);
        const mcpCapabilities = await window.electron.mcp.getCapabilities();
        if (!cancelled) setMcpReadOnly(mcpCapabilities.ok ? Boolean(mcpCapabilities.data?.readOnly) : null);
        const resolvedWorkspace = resolveAgentRuntimeWorkspace(
          task.repositoryFolder,
          repositoryFolder,
          state.defaults?.globalWorkspacePath,
        );
        if (!cancelled) setWorkspace(resolvedWorkspace);
        const projectId = task.projectIds?.[0] || task.swimlaneId;
        const resolutionResult = await window.electron.agentRuntime.resolve({ projectId });
        if (!resolutionResult.ok || !resolutionResult.value) throw new Error(resolutionResult.error || 'The selected agent connection is unavailable.');
        const resolved = resolutionResult.value as RuntimeResolution;
        if (!cancelled) setResolution(resolved);
        const prepared = await window.electron.agentRuntime.prepareExecution({
          taskId: task.id,
          contributionId: startableContribution?.id,
          projectId,
          executionProfileId: resolved.profile?.id,
          workspacePath: resolvedWorkspace.workspacePath,
          expectedRevision: task.__mcpRevision ?? 0,
        });
        if (!cancelled) setPreflight(prepared as ExecutionPreflight);
      } catch (caught) {
        if (!cancelled) reportRuntimeError('preflight', caught, 'Checks before starting failed.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, repositoryFolder, startableContribution?.id, task.__mcpRevision, task.id, task.projectIds, task.repositoryFolder, task.swimlaneId, taskAlreadyComplete]);

  useEffect(() => {
    if (!open) return;
    void refreshSession();
    const unsubscribe = window.electron?.agentRuntime?.sessions?.onEvent?.((payload) => {
      const nextBinding = payload?.binding as SessionBinding | undefined;
      const nextEvent = payload?.event as SessionEvent | undefined;
      if (nextBinding?.scope?.taskId !== task.id && nextEvent?.workScope !== 'task') return;
      if (nextBinding?.scope?.taskId === task.id) {
        refreshSequence.current += 1;
        setBinding(nextBinding);
        if (['interrupted', 'closed', 'failed'].includes(nextBinding.state)) {
          setPendingRequests([]);
          setRequestValues({});
        }
        if (agentRuntimeTurnState(nextBinding) === 'waiting-input') void refreshSession();
      }
      if (nextEvent?.bindingId && (nextBinding?.scope?.taskId === task.id || binding?.id === nextEvent.bindingId)) {
        setEvents(current => current.some(event => event.id === nextEvent.id) ? current : [...current, nextEvent].slice(-100));
      }
    });
    return () => unsubscribe?.();
  }, [open, task.id, binding?.id]);

  const observation = resolution?.profile ? runtimeState?.observations?.[resolution.profile.id] : undefined;
  const blockers = [...new Set([
    ...(taskAlreadyComplete ? ['This task is already complete. Reopen it or move it back to In progress before starting new work.'] : []),
    ...(!resolvedRepositoryFolder && !loading ? ['A working directory could not be resolved.'] : []),
    ...(resolution?.profile?.integrationMode === 'external-handoff' ? ['The selected connection opens work externally and cannot be supervised in Omvra.'] : []),
    ...(resolution && !resolution.ok ? [resolution.error || 'The selected agent connection is unavailable.'] : []),
    ...(preflight?.connection?.ok === false ? [preflight.connection.error || `Agent connection is ${preflight.connection.state || 'unavailable'}.`] : []),
    ...(preflight?.blockers || []).map(blocker => blocker.message),
  ])];
  const warnings = preflight?.warnings || [];
  const hasCapability = (id: string) => binding?.capabilities?.some(capability => capability.id === id && capability.support === 'supported') ?? false;
  const taskExecutionState = binding?.taskExecution?.state;
  const sessionProjection = projectAgentRuntimeSession(binding || undefined, events);
  const { lastBatchCompleted, turnState } = sessionProjection;
  const sessionSummary = sessionProjection.summary;
  const taskExecutionLabel: Record<string, string> = { starting: 'Starting', ready: 'Ready', working: 'Working', continuing: 'Continuing', waiting: 'Waiting for input', stopping: 'Stopping', 'batch-finished': 'Batch finished', interrupted: 'Interrupted', stopped: 'Stopped', failed: 'Failed', 'ready-for-review': 'Ready for review', 'outcome-unreconciled': 'Outcome needs review', complete: 'Complete' };
  const latestRunEvents = selectCurrentAgentRuntimeTurnEvents(events, binding?.turn?.id).filter(event =>
    ['turn/started', 'turn/completed', 'item/agentMessage/delta', 'item/started', 'item/completed', 'warning', 'error', 'omvra/taskBatch/automatic-continuing', 'omvra/taskBatch/automatic-limit-reached'].includes(event.nativeEventType || '')
  );
  const activity = summarizeAgentRuntimeActivity(latestRunEvents);
  const agentOutput = getLatestTaskAgentOutput(events);
  const activityWithoutOutput = activity.filter(item => item.label !== 'Agent shared an update');
  const taskStarted = hasAgentRuntimeTaskStarted(turnState, events);
  const visibleActivity = activityWithoutOutput.length > 0 ? activityWithoutOutput : binding?.state === 'interrupted'
    ? [{ id: `${binding.id}-interrupted`, label: 'Work was interrupted', detail: 'Start work again to reconnect and continue with the task instructions.', count: 1, tone: 'warning' as const }]
    : binding?.state === 'failed'
      ? [{ id: `${binding.id}-failed`, label: 'Previous runtime unavailable', detail: 'Start a new session to reconnect; the current task context is preserved.', count: 1, tone: 'danger' as const }]
      : taskStarted && binding
        ? [{ id: `${binding.id}-working`, label: 'Agent work is in progress', detail: 'The runtime accepted the task instructions. Detailed activity will appear when it is reported.', count: 1, tone: 'neutral' as const }]
        : [];
  const isTurnActive = sessionSummary?.isTurnActive === true;
  const instructionsSent = taskStarted;
  const latestTurnCompleted = latestRunEvents.some(event => event.nativeEventType === 'turn/completed');
  const lastObservedAt = binding?.lastObservedAt || binding?.updatedAt;
  const lastObservedLabel = lastObservedAt
    ? new Date(lastObservedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;
  const executionNotice = task.status === 'under-review' || taskExecutionState === 'ready-for-review'
    ? { tone: 'warning' as const, title: 'Review the outcome', body: 'Inspect the completed work and acceptance checklist. Mark the task complete when the result is verified.' }
    : (binding?.state === 'failed' || taskExecutionState === 'failed')
    ? { tone: 'danger' as const, title: getAttentionState('failed').label, body: getAttentionState('failed').description }
    : taskExecutionState === 'outcome-unreconciled'
      ? { tone: 'warning' as const, title: 'Outcome needs review', body: 'The agent delivered an outcome, but the task status was not updated automatically. Review the result and move the task to Under Review when appropriate.' }
    : binding?.state === 'closed' && lastBatchCompleted
    ? { tone: 'info' as const, title: 'Last batch completed', body: 'The agent completed its latest work batch. The session is closed, but you can continue the task from its saved context.' }
    : binding?.state === 'closed'
      ? { tone: 'warning' as const, title: 'No agent is working right now', body: 'This task is still in progress, but the session shown here was closed. Start a new session to continue from the saved task context.' }
    : binding?.state === 'ready' && !isAgentRuntimeTurnInFlight(binding)
      ? { tone: 'info' as const, title: 'Last batch completed', body: 'The agent completed its latest work batch. Continue the task if more work is needed.' }
      : turnState === 'active'
        ? { tone: 'info' as const, title: 'Agent is working now', body: lastObservedLabel ? `The runtime last reported activity at ${lastObservedLabel}.` : 'The runtime is actively reporting work.' }
        : binding?.state === 'starting' || turnState === 'queued' || turnState === 'starting'
          ? { tone: 'info' as const, title: 'Connecting to the agent', body: 'The session is being created. Activity will appear here as soon as the runtime reports it.' }
          : turnState === 'waiting-input'
            ? { tone: 'warning' as const, title: 'Agent is waiting', body: 'The agent cannot continue until the pending request above is answered.' }
            : null;
  const copyAgentOutput = async () => {
    if (!agentOutput) return;
    try {
      await navigator.clipboard.writeText(agentOutput);
      toast.success('Agent output copied');
    } catch {
      toast.error('Could not copy agent output');
    }
  };
  const executionTitle = binding
    ? 'Open supervision'
    : loading
      ? 'Preparing work'
      : blockers.length > 0
        ? taskAlreadyComplete ? 'Task already complete' : 'Action needed before work starts'
        : preflight
          ? 'Ready to start'
          : 'Start work';
  const executionDescription = binding
    ? 'Follow the agent’s task progress, blockers, and outcome. Guidance is optional.'
    : loading
      ? 'Omvra is checking the assigned agent, working folder, model, and task instructions.'
      : blockers.length > 0
        ? taskAlreadyComplete ? 'Move the task back to In progress if more agent work is needed.' : 'Resolve the item below before Omvra can start the assigned work.'
        : 'Omvra has checked the task context and will open supervision when work begins.';

  const refreshSession = async () => {
    const sequence = ++refreshSequence.current;
    const listSessions = window.electron?.agentRuntime?.sessions?.list;
    if (!listSessions) {
      setSessionLoaded(true);
      return null;
    }
    const index = await measurePerformanceOperation('acp', 'task-execution.sessions.index', async () => (
      listSessions({ limit: 100 })
    ));
    if (sequence !== refreshSequence.current) return null;
    if (!index?.ok) {
      console.warn('[agent-runtime:ui] session-refresh.rejected', { taskId: task.id, error: index?.error || 'Session list unavailable.' });
      setSessionLoaded(true);
      return null;
    }
    const taskBindings = (index.bindings || []).filter((candidate: SessionBinding) => candidate.scope?.kind === 'task' && candidate.scope?.taskId === task.id);
    const newestFirst = (items: SessionBinding[]) => [...items].sort((left, right) => Date.parse(right.updatedAt || '') - Date.parse(left.updatedAt || ''));
    const nextBinding = newestFirst(taskBindings.filter(candidate => isAgentRuntimeTurnInFlight(candidate) || candidate.state === 'ready' || candidate.state === 'starting'))[0]
      || newestFirst(taskBindings)[0]
      || null;
    if (!nextBinding) {
      setBinding(null);
      setEvents([]);
      setPendingRequests([]);
      setHasMoreEvents(false);
      setSessionLoaded(true);
      return null;
    }
    const detail = await measurePerformanceOperation('acp', 'task-execution.sessions.detail', async () => (
      window.electron?.agentRuntime?.sessions?.list?.({ bindingId: nextBinding.id, limit: 100 })
    ));
    const resolvedBinding = (detail?.bindings || [nextBinding])[0] || nextBinding;
    const requests = agentRuntimeTurnState(resolvedBinding) === 'waiting-input'
      ? await measurePerformanceOperation('acp', 'task-execution.requests.list', async () => (
          window.electron?.agentRuntime?.sessions?.requests?.(nextBinding.id)
        ))
      : [];
    if (sequence !== refreshSequence.current) return null;
    setBinding(resolvedBinding);
    setEvents((detail?.events || []) as SessionEvent[]);
    setPendingRequests(Array.isArray(requests) ? requests as RuntimePermissionRequest[] : []);
    setHasMoreEvents(Boolean(detail?.hasMore));
    setSessionLoaded(true);
    return resolvedBinding;
  };

  const recoverOrphanedSession = async (bindingId: string) => {
    const closed = await window.electron?.agentRuntime?.sessions?.close?.(bindingId);
    if (!closed?.ok) throw new Error(closed?.message || closed?.error || 'The unavailable runtime session could not be replaced.');
    setBinding(null);
    setEvents([]);
    setPendingRequests([]);
    const replacement = await refreshSession();
    // Re-enter the normal launch effect: it continues a recovered `ready`
    // session, leaves active/input sessions alone, and starts a new session
    // only when no usable replacement exists.
    setStartRequested(!replacement || replacement.state === 'ready' || replacement.state === 'starting' || isAgentRuntimeTurnInFlight(replacement));
    toast.info('Runtime session recovered', { description: 'The previous provider session was replaced while preserving your task context.' });
  };

  const startWork = async (replaceBinding = false) => {
    if (!resolvedRepositoryFolder || !resolution?.profile || blockers.length > 0 || operationBusy) return;
    setOperationBusy(true);
    setError(null);
    console.info('[agent-runtime:ui] session-start.requested', { taskId: task.id, executionProfileId: resolution.profile.id });
    try {
      if (replaceBinding && binding) {
        const closed = await window.electron?.agentRuntime?.sessions?.close?.(binding.id);
        if (!closed?.ok) throw new Error(closed?.message || closed?.error || 'The previous work session could not be replaced.');
      }
      const result = await window.electron?.agentRuntime?.sessions?.start?.({
        confirmed: true,
        taskId: task.id,
        contributionId: executionContributionId,
        actorPersonId: task.assigneeId,
        projectId: task.projectIds?.[0] || task.swimlaneId,
        executionProfileId: resolution.profile.id,
        workspacePath: resolvedRepositoryFolder,
        expectedRevision: preflight?.contractSnapshot?.taskRevision ?? task.__mcpRevision ?? 0,
        expectedContractDigest: preflight?.contractDigest,
        idempotencyKey: `renderer-start-${task.id}-${Date.now()}`,
      });
      if (!result?.ok) {
        if (result.error === 'ACP_EXECUTION_ALREADY_ACTIVE') {
          if (result.binding && onBlockedByBinding) {
            onBlockedByBinding(result.binding as SessionBinding);
            toast.info('Opened the blocking task turn', { description: 'Omvra switched supervision to the exact task turn that is using execution capacity.' });
            return;
          }
          const current = await refreshSession();
          if (current && isAgentRuntimeTurnInFlight(current)) {
            setError(null);
            toast.info('This task is already open', { description: 'The active runtime session is now shown in this supervision window.' });
            return;
          }
        }
        throw new Error(result?.message || result?.blockers?.[0]?.message || result?.error || 'The work session could not be started.');
      }
      setBinding(result.binding as SessionBinding);
      await refreshSession();
      toast.success('Agent started working', { description: task.title });
      console.info('[agent-runtime:ui] session-start.completed', { taskId: task.id, bindingId: result.binding?.id || null });
    } catch (caught) {
      reportRuntimeError('session-start', caught, 'The work session could not be started.');
    } finally {
      setOperationBusy(false);
    }
  };

  const runSessionOperation = async (operation: 'prompt' | 'steer' | 'cancel' | 'close') => {
    if (!binding || operationBusy) return;
    setOperationBusy(true);
    setError(null);
    try {
      if (operation === 'close') {
        const result = await window.electron?.agentRuntime?.sessions?.close?.(binding.id);
        if (!result?.ok) throw new Error(result?.message || result?.error || 'The session could not be closed.');
      } else {
        const text = steerText.trim();
        if (operation !== 'cancel' && !text) return;
        const sessions = window.electron?.agentRuntime?.sessions;
        const result = operation === 'cancel'
          ? await sessions?.cancel?.({ bindingId: binding.id })
          : await sessions?.[operation]?.({ bindingId: binding.id, text });
        if (!result?.ok) {
          if (result.error === 'ACP_SESSION_NOT_FOUND') {
            await recoverOrphanedSession(binding.id);
            return;
          }
          throw new Error(result?.message || result?.error || 'The requested action failed.');
        }
        setSteerText('');
      }
      await refreshSession();
    } catch (caught) {
      reportRuntimeError(`session-${operation}`, caught, 'The requested action failed.');
    } finally {
      setOperationBusy(false);
    }
  };

  const respondToRequest = async (request: RuntimePermissionRequest, action: 'accept' | 'decline') => {
    if (!binding || requestBusy) return;
    setRequestBusy(true);
    setError(null);
    try {
      const response = buildPermissionResponse(request, action, Object.fromEntries(request.fields.map(field => [field.name, requestFieldValue(request, field, requestValues)])));
      const result = await window.electron?.agentRuntime?.sessions?.respond?.({
        bindingId: binding.id,
        requestId: request.requestId,
        result: response,
      });
      if (!result?.ok) {
        if (result.error === 'ACP_SESSION_NOT_FOUND') {
          setRequestValues({});
          await recoverOrphanedSession(binding.id);
          return;
        }
        throw new Error(result.message || result.error || 'Your response could not be submitted.');
      }
      setRequestValues({});
      await refreshSession();
    } catch (caught) {
      reportRuntimeError('request-response', caught, 'Your response could not be submitted.');
    } finally {
      setRequestBusy(false);
    }
  };

  const resumeSession = async () => {
    if (!binding || !resolvedRepositoryFolder || operationBusy) return;
    setOperationBusy(true);
    setError(null);
    try {
      const result = await window.electron?.agentRuntime?.sessions?.resume?.({ bindingId: binding.id, workspacePath: resolvedRepositoryFolder });
      if (!result?.ok) {
        if (result.error === 'ACP_SESSION_NOT_FOUND') {
          await recoverOrphanedSession(binding.id);
          return;
        }
        throw new Error(result?.message || result?.error || 'Work could not be resumed.');
      }
      await refreshSession();
      toast.success('Agent resumed work', { description: task.title });
    } catch (caught) {
      reportRuntimeError('session-resume', caught, 'Work could not be resumed.');
    } finally {
      setOperationBusy(false);
    }
  };

  const continueTaskSession = async () => {
    if (!binding || operationBusy) return;
    setOperationBusy(true);
    setError(null);
    try {
      const result = await window.electron?.agentRuntime?.sessions?.continueTask?.(binding.id);
      if (!result?.ok) {
        if (result.error === 'ACP_SESSION_NOT_FOUND') {
          await recoverOrphanedSession(binding.id);
          return;
        }
        throw new Error(result.message || result.error || 'Work could not be continued.');
      }
      await refreshSession();
      toast.success('Agent continued work', { description: task.title });
    } catch (caught) {
      reportRuntimeError('session-continue-task', caught, 'Work could not be continued.');
    } finally {
      setOperationBusy(false);
    }
  };

  const openExternal = async () => {
    if (!resolution?.profile || !resolvedRepositoryFolder || operationBusy) return;
    setOperationBusy(true);
    setError(null);
    try {
      const result = await window.electron?.agentRuntime?.openExternal?.({
        executionProfileId: resolution.profile.id,
        projectId: task.projectIds?.[0] || task.swimlaneId,
        workspacePath: resolvedRepositoryFolder,
        taskId: task.id,
        contextReference: `omvra://task/${task.id}`,
        prompt: `Review task ${task.title} in Omvra before starting work.`,
      });
      if (!result?.ok) throw new Error(result?.error || 'The external handoff could not be opened.');
    } catch (caught) {
      reportRuntimeError('external-handoff', caught, 'The external handoff could not be opened.');
    } finally {
      setOperationBusy(false);
    }
  };

  useEffect(() => {
    if (!open || !startRequested || loading || !sessionLoaded || operationBusy) return;
    if (binding) {
      setStartRequested(false);
      if (binding.workspacePath !== resolvedRepositoryFolder && !activeAttempt && ['ready', 'interrupted'].includes(binding.state)) {
        void startWork(true);
        return;
      }
      if (binding.state === 'interrupted') void resumeSession();
      else if (binding.state === 'ready') void continueTaskSession();
      return;
    }
    if (!preflight || !resolution?.profile || !workspace) return;
    setStartRequested(false);
    if (blockers.length > 0) {
      return;
    }
    void startWork();
  }, [activeAttempt, binding?.id, binding?.state, binding?.workspacePath, loading, open, operationBusy, preflight, resolution?.profile?.id, resolvedRepositoryFolder, sessionLoaded, startRequested, workspace]);

  const latestFailure = [...events].reverse().find(event => event.failureClass);
  const authenticationRequired = observation?.authentication === 'required' || preflight?.connection?.state === 'signed-out' || !authenticationRechecked && taskNeedsProviderSignIn(binding, latestFailure?.failureClass, agentOutput);
  const presentation = getTaskExecutionPresentation({ binding, taskStatus: task.status, loading,
    authenticationRequired, blocked: !binding && blockers.length > 0, conflict: binding?.state === 'failed' && latestFailure?.failureClass === 'conflict',
    mcpUnavailable: mcpReadOnly === true || preflight?.blockers?.some(blocker => blocker.code?.includes('MCP')) === true,
    waitingForPermission: !terminalBinding && pendingRequests.some(request => request.responseKind === 'codex-approval' || request.fields.length === 0),
  });
  const responseLabel = lastBatchCompleted
    ? binding?.taskExecution?.batchNumber ? `Batch ${binding.taskExecution.batchNumber} completed` : 'Last batch completed'
    : isTurnActive ? 'Latest update' : 'Latest response';
  const checkAuthentication = async () => {
    if (!resolution?.profile || !resolvedRepositoryFolder || checkingAuthentication) return;
    setCheckingAuthentication(true);
    try {
      const result = await window.electron.agentRuntime.testConnection({ executionProfileId: resolution.profile.id, workspacePath: resolvedRepositoryFolder });
      const state = await window.electron.agentRuntime.getState();
      if (state.ok && state.value) setRuntimeState(state.value);
      const prepared = await window.electron.agentRuntime.prepareExecution({ taskId: task.id, contributionId: startableContribution?.id, executionProfileId: resolution.profile.id, workspacePath: resolvedRepositoryFolder, expectedRevision: task.__mcpRevision ?? 0 });
      setPreflight(prepared);
      if (result.ok) { setAuthenticationRechecked(true); setShowSignInHelp(false); setError(null); }
      else setError(result.error || 'The provider still requires sign-in.');
    } catch (caught) { reportRuntimeError('sign-in-check', caught, 'Could not check provider sign-in.'); }
    finally { setCheckingAuthentication(false); }
  };

  return (
    <>
      {trigger !== undefined ? (trigger ? <button type="button" onClick={() => { onOpen?.(); if (startOnTrigger) setStartRequested(true); setOpen(true); }} className="text-left">{trigger}</button> : null) : <ContextMenuItem onSelect={() => { onOpen?.(); setStartRequested(true); setOpen(true); }}>
        <Play />
        {activeAttempt ? 'Open supervision' : 'Start work'}
      </ContextMenuItem>}
      <Sheet open={open} onOpenChange={nextOpen => { setOpen(nextOpen); if (!nextOpen) setStartRequested(false); }}>
        <SheetContent
          className="omvra-settings-sheet !bottom-2 !left-auto !right-2 !top-2 !h-auto !w-[min(650px,calc(100vw-16px))] !translate-x-0 !translate-y-0 gap-0 overflow-hidden rounded-[24px] border border-slate-200 bg-white p-0 shadow-[0_12px_32px_rgba(0,0,0,0.07)] sm:max-w-none"
          overlayClassName="omvra-settings-overlay"
          showClose={false}
        >
          <SheetHeader className="shrink-0 flex-row items-center justify-between gap-3 px-[18px] pb-2 pt-[18px] text-left">
            <SheetTitle className="min-w-0 truncate text-sm font-medium tracking-[-0.14px] text-slate-600" title={task.title}>{task.title}</SheetTitle>
            <SheetDescription className="sr-only">{executionDescription}</SheetDescription>
            <SheetClose aria-label="Minimize supervision" className="flex shrink-0 items-center gap-1 rounded-lg bg-black/5 px-2 py-1.5 text-xs font-semibold text-zinc-500 outline-none hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-blue-500">
              <Minimize2 className="size-4" strokeWidth={1.25} aria-hidden="true" />Minimize
            </SheetClose>
          </SheetHeader>
          <div ref={activityRef} onScroll={event => { const node = event.currentTarget; setAwayFromLatest(node.scrollHeight - node.scrollTop - node.clientHeight > 40); }} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-3 pt-3 text-xs text-slate-600" aria-label="Agent activity">
            {agentOutput && <div className="rounded-xl bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.1),0_0_0.5px_1px_rgba(113,113,113,0.15)]">
              <span className="inline-flex rounded-full bg-[#f9f9f9] px-2 py-1 text-xs shadow-[0_0_1px_1px_rgba(0,0,0,0.15)]">{responseLabel}</span>
              <p className="mt-5 whitespace-pre-wrap break-words leading-5">{agentOutput}</p>
            </div>}
            {visibleActivity.length ? visibleActivity.map(item => <div key={item.id} className="flex items-start justify-between gap-4" title={item.detail}>
              <span className={`min-w-0 font-semibold ${item.tone === 'danger' ? 'text-red-600' : ''}`}>{item.label === 'Task instructions accepted' ? item.detail : item.label}{item.count > 1 ? ` × ${item.count}` : ''}</span>
              {'observedAt' in item && item.observedAt && <time className="shrink-0 text-slate-400" dateTime={item.observedAt}>{new Date(item.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>}
            </div>) : !agentOutput && <p className="px-3">{loading ? 'Preparing your work session…' : 'The agent has not started work yet.'}</p>}
            {mcpReadOnly && <ExecutionNotice tone="warning" title="Task access is read-only">The agent can inspect this task but cannot change its description or status. Select Task Write under Settings → MCP Access, then restart the listener.</ExecutionNotice>}
            {error && <div className="mb-3"><ExecutionNotice tone="danger" title={getAttentionState('failed').label} nextStep={getAttentionState('failed').nextStep}>{error}</ExecutionNotice></div>}
            {!error && !authenticationRequired && blockers.length > 0 && <div className="mb-3"><ExecutionHint tone={taskAlreadyComplete ? 'warning' : 'danger'} title={taskAlreadyComplete ? 'Task already complete' : 'Action needed before work starts'} body={`${blockers.join(' ')} ${taskAlreadyComplete ? 'Reopen or move the task to In progress, then start work.' : getAttentionState('blocked').nextStep}`} /></div>}
            {!terminalBinding && turnState === 'waiting-input' && sessionLoaded && pendingRequests.length === 0 && binding && <ExecutionNotice tone="warning" title="Input request unavailable" nextStep="Reconnect the session to continue." assertive>
              <div>Omvra no longer has an answerable request for this session.</div>
              <button type="button" onClick={() => void recoverOrphanedSession(binding.id)} disabled={operationBusy} className="mt-3 rounded bg-black/5 px-2.5 py-1.5 font-semibold disabled:opacity-40">Reconnect session</button>
            </ExecutionNotice>}
            {/* Retained diagnostics for a future detail view; no underlying task/session data is removed. */}
            <div hidden>
            {!binding && <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Server className="size-3.5" />Agent connection</div>
                <div className="mt-1 font-medium text-slate-900">{loading ? 'Checking…' : resolution?.profile?.name || 'Not configured'}</div>
                {resolution?.profile && <div className="text-xs text-slate-500">{runtimeLabel(resolution.profile.integrationMode)} · {resolution.source}</div>}
              </div>
              <div className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Folder className="size-3.5" />Working directory</div>
                <div className={`mt-1 truncate font-medium ${resolvedRepositoryFolder ? 'text-slate-900' : 'text-amber-700'}`} title={resolvedRepositoryFolder || undefined}>{resolvedRepositoryFolder || (loading ? 'Resolving…' : 'Not configured')}</div>
                <div className="text-xs text-slate-500">{repositorySource}</div>
              </div>
            </div>}
            {!binding && observation && (
              <ExecutionNotice tone={observation.error ? 'warning' : 'info'} title="Connection details">
                <span>{observation.availability || 'unknown'} · sign-in {observation.authentication || 'unknown'} · {observation.state || 'unknown'}.</span>
                {observation.error && <span className="mt-1 block text-rose-700">Last connection check: {observation.error}</span>}
              </ExecutionNotice>
            )}
            {!binding && preflight?.model && (preflight.model.requested || preflight.model.effective) && (
              <ExecutionNotice tone="info" title="Model">
                {preflight.model.effective || preflight.model.requested || 'Agent default'}{preflight.model.requested && preflight.model.effective && preflight.model.requested !== preflight.model.effective ? ` · requested ${preflight.model.requested}` : ''}.
              </ExecutionNotice>
            )}
            {!binding && warnings.length > 0 && (
              <ExecutionNotice tone="info" title="Check before starting">
                <ul className="space-y-1">{warnings.map(warning => <li key={`${warning.code || 'warning'}-${warning.message}`}>{warning.message}</li>)}</ul>
              </ExecutionNotice>
            )}
              {binding && <div>                <div className="mt-3 rounded-lg bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-700">Work stages</div>
                  <div className="mt-3 grid gap-2 text-xs">
                    <div className="flex items-center gap-2"><span className={`size-2 rounded-full ${binding.state === 'starting' ? 'bg-blue-500' : ['closed', 'failed', 'interrupted'].includes(binding.state) ? 'bg-slate-300' : 'bg-emerald-500'}`} /><span className="font-medium text-slate-700">Agent connection</span><span className="ml-auto text-slate-500">{binding.state === 'starting' ? 'Connecting' : ['closed', 'failed'].includes(binding.state) ? 'Closed' : binding.state === 'interrupted' ? 'Interrupted' : 'Connected'}</span></div>
                    <div className="flex items-center gap-2"><span className={`size-2 rounded-full ${instructionsSent ? 'bg-emerald-500' : 'bg-slate-300'}`} /><span className="font-medium text-slate-700">Task instructions</span><span className="ml-auto text-slate-500">{instructionsSent ? 'Sent and accepted' : 'Not sent yet'}</span></div>
                    <div className="flex items-center gap-2"><span className={`size-2 rounded-full ${isTurnActive ? 'bg-emerald-500' : latestTurnCompleted ? 'bg-amber-400' : 'bg-slate-300'}`} /><span className="font-medium text-slate-700">Agent work</span><span className="ml-auto text-slate-500">{isTurnActive ? 'In progress' : latestTurnCompleted ? 'Batch finished' : binding.state === 'closed' ? 'Session closed' : 'Not started'}</span></div>
                  </div>
                </div>
</div>}
              {executionNotice && <ExecutionHint tone={executionNotice.tone} title={executionNotice.title} body={executionNotice.body} />}
              <span>{executionTitle} · {taskStatusLabel(task.status)} · {taskExecutionLabel[taskExecutionState || '']} · {sessionSummary?.detail}</span>
              <button type="button" onClick={() => void copyAgentOutput()}>Copy output</button>
            </div>
          </div>
          <div className="shrink-0 space-y-3 px-[18px] pb-[18px]">
            {authenticationRequired && <div className="max-h-[35vh] overflow-y-auto rounded-xl bg-white p-3.5 text-slate-600 shadow-[0_0_1px_1px_rgba(0,0,0,0.1),0_6px_14px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-1 text-sm font-medium"><ShieldCheck className="size-[18px]" strokeWidth={1.25} />Model provider authentication</div>
              <p className="mt-3 text-xs leading-4">Sign in to {resolution?.profile?.name || 'your model provider'} to connect the agent and continue this task.</p>
              {showSignInHelp && <p className="mt-3 text-xs leading-4">Sign in using your provider’s CLI or app on this computer, then select Check connection. Omvra will use that existing sign-in.</p>}
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-black/5 px-2.5 py-1.5 text-xs font-semibold text-zinc-500">Later</button>
                <button type="button" onClick={() => showSignInHelp ? void checkAuthentication() : setShowSignInHelp(true)} disabled={checkingAuthentication} className="rounded-lg bg-black/5 px-2.5 py-1.5 text-xs font-semibold text-zinc-500 disabled:opacity-40">{checkingAuthentication ? 'Checking…' : showSignInHelp ? 'Check connection' : 'Sign In'}</button>
              </div>
            </div>}
            {!terminalBinding && pendingRequests.length > 0 && <div className="max-h-[35vh] overflow-y-auto"><RuntimePermissionCard
              requests={pendingRequests}
              busy={requestBusy}
              getValue={(request, field) => requestFieldValue(request, field, requestValues)}
              isMissing={(request, field) => requestFieldIsMissing(request, field, requestValues)}
              onValueChange={(request, field, value) => setRequestValues(current => ({ ...current, [requestValueKey(request, field.name)]: value }))}
              onRespond={(request, action) => void respondToRequest(request, action)}
            /></div>}
            <div>
              <div className="mx-0.5 -mb-2 flex min-h-[39px] flex-wrap items-center justify-between gap-x-2 rounded-t-xl bg-[#eaebec] px-2.5 pb-3 pt-1 text-xs font-medium text-zinc-500">
                <div className="flex min-w-0 flex-wrap items-center gap-3" role="status">
                  <span className="inline-flex items-center gap-1.5" title={sessionSummary?.detail || observation?.error}>
                    <span className={`flex size-4 items-center justify-center rounded-full ${presentation.connection === 'Connected' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-400/10 text-slate-400'}`}><span className="size-2 rounded-full bg-current" /></span>{presentation.connection}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    {presentation.status === 'Working' ? <LoaderCircle className="size-4 motion-safe:animate-spin" strokeWidth={1.25} aria-hidden="true" /> : presentation.status === 'Waiting for approval' || presentation.status === 'Waiting for input' ? <Hourglass className="size-4" strokeWidth={1.25} aria-hidden="true" /> : null}{presentation.status}
                  </span>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  {awayFromLatest && <button type="button" onClick={() => activityRef.current?.scrollTo({ top: activityRef.current.scrollHeight, behavior: 'instant' })} className="rounded px-1.5 py-1 hover:bg-black/5">Jump to latest</button>}
              {resolution?.profile?.integrationMode === 'external-handoff' && <button type="button" onClick={() => void openExternal()} disabled={operationBusy || !resolvedRepositoryFolder} className="rounded-md px-1.5 py-1 text-xs font-medium text-zinc-500 outline-none hover:bg-black/5 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-blue-500">Open externally</button>}
              {!awayFromLatest && task.status !== 'done' && binding?.state === 'ready' && <button type="button" onClick={() => void startWork(true)} disabled={operationBusy || loading || blockers.length > 0 || !resolvedRepositoryFolder || isAgentRuntimeTurnInFlight(binding)} className="rounded-md px-1.5 py-1 text-xs font-medium text-zinc-500 outline-none hover:bg-black/5 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-blue-500" title="Start a new work attempt with the current runtime configuration">Restart</button>}
              {!awayFromLatest && task.status !== 'done' && binding?.state === 'ready' && <button type="button" onClick={() => void continueTaskSession()} disabled={operationBusy || isAgentRuntimeTurnInFlight(binding)} className="rounded-md px-1.5 py-1 text-xs font-medium text-zinc-500 outline-none hover:bg-black/5 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-blue-500">{operationBusy ? 'Continuing…' : 'Continue'}</button>}
              {task.status !== 'done' && !authenticationRequired && (binding?.state === 'interrupted' || binding?.state === 'failed' || binding?.state === 'closed' || !binding) && <button type="button" onClick={() => void (binding?.state === 'interrupted' && hasCapability('resume') ? resumeSession() : startWork(Boolean(binding && !terminalBinding)))} disabled={operationBusy || (binding?.state === 'interrupted' ? !resolvedRepositoryFolder : loading || blockers.length > 0 || activeAttempt)} className="rounded-md px-1.5 py-1 text-xs font-medium text-zinc-500 outline-none hover:bg-black/5 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-blue-500">{binding?.state === 'interrupted' && hasCapability('resume') ? 'Resume' : binding?.state === 'closed' ? 'Restart' : binding?.state === 'failed' ? 'Restart' : activeAttempt ? 'Work in progress' : operationBusy ? 'Starting…' : 'Start'}</button>}

                </div>
              </div>
              <TaskSessionComposer
                value={steerText}
                running={isAgentRuntimeTurnInFlight(binding)}
                busy={operationBusy || requestBusy}
                disabled={!binding || terminalBinding || binding.state === 'interrupted' || taskAlreadyComplete || authenticationRequired || pendingRequests.length > 0}
                canSubmit={!taskAlreadyComplete && Boolean(binding) && !terminalBinding && pendingRequests.length === 0 && !authenticationRequired && Boolean(steerText.trim()) && (isTurnActive ? hasCapability('steer') : hasCapability('prompt'))}
                canStop={!terminalBinding && turnState !== 'cancelling' && isAgentRuntimeTurnInFlight(binding) && hasCapability('cancel')}
                placeholder="Write optional follow-ups"
                onChange={setSteerText}
                onSubmit={() => void runSessionOperation(isTurnActive && hasCapability('steer') ? 'steer' : 'prompt')}
                onStop={() => void runSessionOperation('cancel')}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
