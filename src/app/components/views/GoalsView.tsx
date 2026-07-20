import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { CircleDot, LoaderCircle, MessageSquareText, Plus, RotateCcw, Sparkles, Target, Trash2 } from 'lucide-react';
import type { GoalAcceptanceActor, GoalAgentConfiguration, GoalAgentMode, GoalArtifactReference, GoalBudgetMode, GoalConditionBranch, GoalConnectorSide, GoalElement, GoalElementType, GoalPolicy, GoalPolicyDimension, GoalPolicyDimensionOverride, GoalRecord, GoalRetryExhaustionPolicy, GoalSchedule, Person, ProjectMilestone, Task } from '../../types.ts';
import type { GoalPolicyV1 } from '../../utils/goalPolicy.ts';
import { GOAL_TEMPLATES, instantiateGoalTemplate, type GoalTemplate } from '../../data/goalTemplates.ts';
import { getCanonicalJSON, safeReadJSON, setCanonicalJSON } from '../../utils/storage.ts';
import { isGoalElementConnected, isValidRetryTarget, wouldCreateGoalCycle } from '../../utils/goalCanvas.ts';
import { AgentIcon as Bot } from '../icons/AgentIcon';
import { LinkIcon as Link2 } from '../icons/LinkIcon';
import { PuzzlePieceIcon } from '../icons/PuzzlePieceIcon';
import { AttachmentIcon } from '../icons/AttachmentIcon';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { GoalsCanvasControls } from '../goals/GoalsCanvasControls';
import { GoalsCanvasNodes } from '../goals/GoalsCanvasNodes';
import { GoalsConnectorLayer } from '../goals/GoalsConnectorLayer';
import { DeleteGoalDialog, NewGoalDialog } from '../goals/GoalsDialogs';
import { GoalsInspector } from '../goals/GoalsInspector';
import { GoalsAgentSection, GoalsArtifactSection, GoalsConditionSection, GoalsConnectionsSection, GoalsControlFlowSection, GoalsDeliverableSection, GoalsRuntimeStatusSection, GoalsScheduleSection } from '../goals/GoalsInspectorSections';
import { GoalsPolicySection } from '../goals/GoalsPolicySection';
import { GoalsSidebar } from '../goals/GoalsSidebar';
import { GoalsToolbar } from '../goals/GoalsToolbar';
import { ARTIFACT_ITEMS, CONTROL_FLOW_ITEMS, TOOL_ITEMS } from '../goals/GoalsMetadata';
import { ReadyIcon, StatusIcon, compactChipClass, conditionNegativeLabel, conditionPositiveLabel, isCompletionElement, readinessChipClass, readinessDescription, readinessForElement, readinessLabel, statusChipClass, statusDescription, statusLabel, statusNextStep } from '../goals/GoalsPresentation';
import { GOAL_SCHEDULES_STORAGE_KEY, normalizeGoalSchedules, scheduleStatus } from '../../utils/goalSchedules.ts';

const STORAGE_KEY = 'omvra.goals.v1';
const GOAL_ID = 'goal-lights-off-factory';
const GOAL_POLICY_DIMENSIONS: Array<{ key: GoalPolicyDimension; label: string; unit: GoalPolicyDimensionOverride['unit']; legacyMode: keyof GoalPolicy; legacyValue: keyof GoalPolicy }> = [
  { key: 'financial', label: 'Financial cost', unit: 'USD', legacyMode: 'financialBudgetMode', legacyValue: 'maxFinancialCost' },
  { key: 'tokens', label: 'Tokens', unit: 'tokens', legacyMode: 'tokenBudgetMode', legacyValue: 'maxTokens' },
  { key: 'concurrency', label: 'Concurrent loops', unit: 'loops', legacyMode: 'concurrencyBudgetMode', legacyValue: 'maxConcurrentLoops' },
  { key: 'attempts', label: 'Total loop attempts', unit: 'attempts', legacyMode: 'loopAttemptsBudgetMode', legacyValue: 'maxLoopAttempts' },
  { key: 'retries', label: 'Retries / rework', unit: 'retries', legacyMode: 'retryBudgetMode', legacyValue: 'maxRetries' },
];
const GOAL_POLICY_SAFE_VALUES: Record<GoalPolicyDimension, number> = { financial: 10, tokens: 100000, concurrency: 1, attempts: 10, retries: 2 };
const EXECUTION_LOCKED_STATUSES = new Set(['working', 'blocked', 'evidence-required', 'approval-required', 'complete', 'permission-denied']);
const ARTIFACT_SELECT_CLASS = 'h-9 rounded-xl border-[#e5e7eb] bg-white px-3 text-sm font-medium text-[#71717a] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-visible:ring-gray-200';
type GoalRuntimeProjection = { execution?: { state?: string; revision?: number; attempt?: number; policyRevision?: number; executionAttemptId?: string; reconciliationRequired?: boolean } | null; handoffs?: Array<{ id: string; deliverableId?: string; producedArtifactReferences?: Array<{ label?: string; locator?: string; format?: string }>; deliveryFacts?: Record<string, unknown>; deliveredAt?: string }>; effectivePolicy?: GoalPolicyV1 | null; policyRevision?: number; executionAttempt?: number | null; executionAttemptId?: string | null; agentAvailability?: Array<{ elementId: string; available: boolean; errorCode?: string | null }>; policyImpacts?: Array<{ goalId?: string; status?: string; requiresUserConfirmation?: boolean }>; lastChange?: { scope?: string; errorCode?: string; changeType?: string } | null };
type SupportingArtifactType = 'document' | 'file' | 'url' | 'user-defined';

function isExecutionLocked(element: GoalElement | undefined): boolean {
  return Boolean(element?.status && EXECUTION_LOCKED_STATUSES.has(element.status));
}

function goalRevision(goal: GoalRecord): number {
  const revision = Number((goal as GoalRecord & { revision?: number; __mcpRevision?: number }).revision ?? (goal as GoalRecord & { __mcpRevision?: number }).__mcpRevision ?? 0);
  return Number.isFinite(revision) ? Math.max(0, Math.floor(revision)) : 0;
}

function inspectorDefaultDimension(dimension: GoalPolicyDimension): { constrained: true; mode: Exclude<GoalBudgetMode, 'unbounded'>; value: number; unit: GoalPolicyDimensionOverride['unit'] } {
  const metadata = GOAL_POLICY_DIMENSIONS.find(item => item.key === dimension)!;
  return { constrained: true, mode: 'hard-cap', value: GOAL_POLICY_SAFE_VALUES[dimension], unit: metadata.unit };
}

function legacyDimensionOverride(policy: GoalPolicy | undefined, dimension: GoalPolicyDimension): GoalPolicyDimensionOverride | undefined {
  if (!policy) return undefined;
  const metadata = GOAL_POLICY_DIMENSIONS.find(item => item.key === dimension)!;
  const mode = policy[metadata.legacyMode];
  const value = policy[metadata.legacyValue];
  if (mode === 'unbounded') return { constrained: false };
  if (typeof mode === 'string' && typeof value === 'number' && value > 0) {
    return { constrained: true, mode: mode as Exclude<GoalBudgetMode, 'unbounded'>, value, unit: metadata.unit };
  }
  return undefined;
}

function resolveInspectorPolicy(workspacePolicy: GoalPolicyV1 | undefined, goal: GoalRecord, target: GoalElement) {
  const dimensions = { ...(workspacePolicy?.dimensions ?? {}) } as GoalPolicyV1['dimensions'];
  const effective = {
    dimensions: GOAL_POLICY_DIMENSIONS.reduce((result, dimension) => {
      result[dimension.key] = dimensions[dimension.key] ?? inspectorDefaultDimension(dimension.key);
      return result;
    }, {} as GoalPolicyV1['dimensions']),
    acceptance: workspacePolicy?.acceptance ?? { actor: 'human' as const },
  };
  const applyScope = (policy: GoalPolicy | undefined) => {
    for (const dimension of GOAL_POLICY_DIMENSIONS) {
      const override = policy?.dimensions?.[dimension.key] ?? legacyDimensionOverride(policy, dimension.key);
      const current = effective.dimensions[dimension.key];
      if (!override || override.constrained === false) continue;
      if (!current.constrained || (override.value !== undefined && override.value <= current.value && override.unit === current.unit)) {
        effective.dimensions[dimension.key] = { ...current, ...override, constrained: true, unit: dimension.unit } as typeof current;
      }
    }
    const actor = policy?.acceptanceActor;
    const rank = { agentic: 1, human: 2, both: 3 } as const;
    if (actor && rank[actor] > rank[effective.acceptance.actor]) effective.acceptance = { actor };
  };
  applyScope(goal.policy);
  const incoming = new Map<string, string[]>();
  goal.elements.filter(element => element.type === 'connector' && element.sourceId && element.targetId).forEach(connection => {
    const parents = incoming.get(connection.targetId!) ?? [];
    parents.push(connection.sourceId!);
    incoming.set(connection.targetId!, parents);
  });
  const visited = new Set<string>([target.id]);
  const pending = [...(incoming.get(target.id) ?? [])];
  const ancestors: GoalElement[] = [];
  while (pending.length) {
    const id = pending.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const ancestor = goal.elements.find(element => element.id === id);
    if (ancestor) {
      if (ancestor.type === 'subgoal') ancestors.unshift(ancestor);
      pending.push(...(incoming.get(id) ?? []));
    }
  }
  ancestors.forEach(ancestor => applyScope(ancestor.policy));
  applyScope(target.policy);
  return effective;
}

function createStableId(prefix: string): string {
  const uuid = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${uuid}`;
}


function readGoals(): GoalRecord[] {
  const stored = safeReadJSON<GoalRecord[]>(STORAGE_KEY, []);
  if (!Array.isArray(stored)) return [];
  return stored.filter(goal => goal.id !== GOAL_ID);
}

function nodeClass(type: GoalElementType, connected = true): string {
  if (!connected && type === 'instructions') return 'border-slate-200 bg-slate-100 text-slate-500';
  if (type === 'goal') return 'border-slate-900 bg-slate-900 text-white';
  if (type === 'subgoal') return 'border-blue-200 bg-white text-slate-900';
  if (type === 'agent') return 'border-amber-200 bg-amber-50 text-slate-900';
  if (type === 'condition') return 'border-violet-200 bg-violet-50 text-slate-900';
  if (type === 'approval-gate') return 'border-orange-200 bg-orange-50 text-slate-900';
  if (type === 'human-input') return 'border-sky-200 bg-sky-50 text-slate-900';
  if (type === 'retry') return 'border-cyan-200 bg-cyan-50 text-slate-900';
  if (type === 'deliverable') return 'border-emerald-200 bg-emerald-50 text-slate-900';
  if (type === 'artifact') return 'border-sky-200 bg-sky-50 text-slate-900';
  return 'border-slate-200 bg-white text-slate-700';
}


function elementIcon(type: GoalElementType) {
  if (type === 'agent') return <Bot className="size-3.5" />;
  if (type === 'goal') return <Sparkles className="size-3.5" />;
  if (type === 'human-input') return <MessageSquareText className="size-3.5" />;
  if (type === 'retry') return <RotateCcw className="size-3.5" />;
  if (type === 'deliverable') return <PuzzlePieceIcon className="size-3.5" />;
  if (type === 'artifact') return <AttachmentIcon className="size-3.5" />;
  return <Target className="size-3.5" />;
}

export function GoalsView({ people = [], tasks = [], milestones = [], workspacePolicy, goalAuditArchiveDirectory = '', onGoalAuditArchiveDirectoryChange }: { people?: Person[]; tasks?: Task[]; milestones?: ProjectMilestone[]; workspacePolicy?: GoalPolicyV1; goalAuditArchiveDirectory?: string; onGoalAuditArchiveDirectoryChange?: (directory: string) => void }) {
  const [goals, setGoals] = useState<GoalRecord[]>(readGoals);
  const goalsRef = useRef<GoalRecord[]>([]);
  goalsRef.current = goals;
  const canonicalGoalsRef = useRef<GoalRecord[]>([]);
  const [schedules, setSchedules] = useState<GoalSchedule[]>(() => normalizeGoalSchedules(safeReadJSON<unknown>(GOAL_SCHEDULES_STORAGE_KEY, [])));
  const [schedulesHydrated, setSchedulesHydrated] = useState(false);
  const [canonicalHydrated, setCanonicalHydrated] = useState(false);
  const canonicalWrite = useRef(Promise.resolve());
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [selectedElementId, setSelectedElementId] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const spaceHeldRef = useRef(false);
  const panSessionRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [controlFlowMenuOpen, setControlFlowMenuOpen] = useState(false);
  const [artifactMenuOpen, setArtifactMenuOpen] = useState(false);
  const [policyImpacts, setPolicyImpacts] = useState<Array<{ goalId?: string; status?: string; requiresUserConfirmation?: boolean }>>([]);
  const [runtimeProjection, setRuntimeProjection] = useState<GoalRuntimeProjection | null>(null);
  const agentMenuRef = useRef<HTMLDivElement | null>(null);
  const controlFlowMenuRef = useRef<HTMLDivElement | null>(null);
  const artifactMenuRef = useRef<HTMLDivElement | null>(null);
  const [connectorMode, setConnectorMode] = useState(false);
  const [connectorSourceId, setConnectorSourceId] = useState<string | null>(null);
  const [connectorSourceSide, setConnectorSourceSide] = useState<GoalConnectorSide>('right');
  const [connectorSourceBranch, setConnectorSourceBranch] = useState<GoalConditionBranch | undefined>();
  const [rewireConnectorId, setRewireConnectorId] = useState<string | null>(null);
  const [connectorError, setConnectorError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newGoalDialogOpen, setNewGoalDialogOpen] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalBody, setNewGoalBody] = useState('');
  const [customArtifactLabel, setCustomArtifactLabel] = useState('');
  const [customArtifactKind, setCustomArtifactKind] = useState('document');
  const [customArtifactFormat, setCustomArtifactFormat] = useState('');
  const [customArtifactLocator, setCustomArtifactLocator] = useState('');
  const [supportingArtifactType, setSupportingArtifactType] = useState<SupportingArtifactType>('document');
  const [supportingSourceSearch, setSupportingSourceSearch] = useState('');
  const [canvasElementHeights, setCanvasElementHeights] = useState<Record<string, number>>({});
  const [drag, setDrag] = useState<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const draggingRef = useRef(false);
  const localMutationRef = useRef(false);
  const rendererWritesPendingRef = useRef(0);
  const scheduleWritesPendingRef = useRef(0);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const activeGoal = goals.find(goal => goal.id === selectedGoalId) ?? goals[0];
  const activeSchedule = activeGoal ? schedules.find(schedule => schedule.goalId === activeGoal.id) : undefined;
  const selectedElement = activeGoal?.elements.find(element => element.id === selectedElementId) ?? activeGoal?.elements[0];
  const selectedAgent = selectedElement?.type === 'agent' ? people.find(person => person.id === selectedElement.assigneeId) : undefined;
  const selectedAgentMissing = selectedElement?.type === 'agent' && selectedElement.agentConfiguration?.mode === 'existing' && (!selectedElement.agentConfiguration.assigneeId || !selectedAgent);
  const selectedAgentConfiguration = selectedElement?.type === 'agent' ? selectedElement.agentConfiguration : undefined;
  const selectedAgentMode: GoalAgentMode | undefined = selectedElement?.type === 'agent'
    ? selectedAgentConfiguration?.mode ?? (selectedElement.assigneeId ? 'existing' : 'ephemeral')
    : undefined;
  const selectedRetryTarget = selectedElement?.type === 'retry'
    ? activeGoal?.elements.find(element => element.type === 'connector' && element.sourceId === selectedElement.id)?.targetId
    : undefined;
  const selectedPolicyElement = selectedElement?.type === 'goal' || selectedElement?.type === 'subgoal' || selectedElement?.type === 'approval-gate' ? selectedElement : undefined;
  const selectedElementLocked = isExecutionLocked(selectedElement);
  const selectedEffectivePolicy = activeGoal && selectedPolicyElement
    ? (runtimeProjection?.effectivePolicy ?? resolveInspectorPolicy(workspacePolicy, activeGoal, selectedPolicyElement))
    : undefined;
  const selectedPolicyImpact = (runtimeProjection?.policyImpacts ?? policyImpacts).find(impact => impact.goalId === activeGoal?.id && impact.status === 'pending');
  const selectedArtifactReferences = selectedElement?.type === 'goal' || selectedElement?.type === 'subgoal' || selectedElement?.type === 'artifact' ? (selectedElement.artifactReferences ?? []) : [];
  const artifactOptions = [
    ...tasks.map(task => ({ value: `task:${task.id}`, label: `Task · ${task.title}`, searchText: task.title, artifactType: 'task' as const, artifactId: task.id })),
    ...milestones.map(milestone => ({ value: `milestone:${milestone.id}`, label: `Milestone · ${milestone.title}`, searchText: milestone.title, artifactType: 'milestone' as const, artifactId: milestone.id })),
    ...goals.filter(goal => goal.id !== activeGoal?.id).map(goal => ({ value: `goal:${goal.id}`, label: `Goal · ${goal.title}`, searchText: goal.title, artifactType: 'goal' as const, artifactId: goal.id })),
  ];
  const supportingSourceOptions = tasks.flatMap(task => (task.attachments ?? []).map(attachment => {
    const extension = attachment.name.split('.').pop()?.toLowerCase() ?? '';
    const documentExtensions = new Set(['md', 'markdown', 'txt', 'pdf', 'doc', 'docx', 'rtf', 'odt']);
    const artifactType: SupportingArtifactType = documentExtensions.has(extension) ? 'document' : 'file';
    return { value: `attachment:${task.id}:${attachment.id}`, label: `${artifactType === 'document' ? 'Document' : 'File'} · ${attachment.name}`, searchText: `${attachment.name} ${task.title}`, artifactType, artifactId: attachment.id, taskId: task.id, attachment };
  })).filter(option => option.artifactType === supportingArtifactType && option.searchText.toLocaleLowerCase().includes(supportingSourceSearch.trim().toLocaleLowerCase()));

  useEffect(() => {
    if (goals.length === 0) {
      if (selectedGoalId) setSelectedGoalId('');
      if (selectedElementId) setSelectedElementId('');
      return;
    }
    const nextGoal = goals.find(goal => goal.id === selectedGoalId) ?? goals[0];
    if (nextGoal.id !== selectedGoalId) setSelectedGoalId(nextGoal.id);
    if (!nextGoal.elements.some(element => element.id === selectedElementId)) setSelectedElementId(nextGoal.elements[0]?.id ?? '');
  }, [goals, selectedElementId, selectedGoalId]);
  useEffect(() => {
    if (!activeGoal || !canvasRef.current) return;
    const frame = requestAnimationFrame(() => {
      const nodes = Array.from(canvasRef.current?.querySelectorAll<HTMLElement>('[role="group"]') ?? []);
      const elements = activeGoal.elements.filter(element => element.type !== 'connector');
      setCanvasElementHeights(current => {
        let changed = false;
        const next = { ...current };
        nodes.forEach((node, index) => {
          const element = elements[index];
          if (!element) return;
          // Connector geometry is expressed in the canvas coordinate system. Use
          // the unscaled layout height so zoom cannot move the node endpoints.
          const height = node.offsetHeight;
          if (next[element.id] !== height) {
            next[element.id] = height;
            changed = true;
          }
        });
        return changed ? next : current;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeGoal, selectedElementId, zoom]);
  useEffect(() => {
    let cancelled = false;
    const storedImpacts = window.electron?.storeGet?.('omvra.goalPolicyImpacts.v1');
    void storedImpacts?.then(value => {
      if (cancelled) return;
      setPolicyImpacts(Array.isArray(value) ? value : []);
    });
    return () => { cancelled = true; };
  }, [workspacePolicy?.policyRevision]);
  useEffect(() => {
    let cancelled = false;
    if (!activeGoal) { setRuntimeProjection(null); return () => { cancelled = true; }; }
    void window.electron?.goals?.getRuntime?.(activeGoal.id).then(value => {
      if (!cancelled && value && typeof value === 'object') setRuntimeProjection(value as GoalRuntimeProjection);
    });
    return () => { cancelled = true; };
  }, [activeGoal?.id]);

  const getAgentForElement = (element: GoalElement) => element.type === 'agent'
    ? people.find(person => person.id === element.assigneeId)
    : undefined;

  const getElementTitle = (element: GoalElement) => getAgentForElement(element)?.name ?? element.title;
  const getElementBody = (element: GoalElement) => getAgentForElement(element)?.role ?? element.body;

  useEffect(() => {
    let cancelled = false;
    const refreshCanonicalGoals = () => getCanonicalJSON<GoalRecord[] | null>(STORAGE_KEY, null).then(stored => {
      if (cancelled || localMutationRef.current) return;
      if (Array.isArray(stored)) {
        const filtered = stored.filter(goal => goal.id !== GOAL_ID);
        canonicalGoalsRef.current = filtered;
        setGoals(filtered);
      }
    });
    void refreshCanonicalGoals().then(() => {
      setCanonicalHydrated(true);
    });
    window.addEventListener('focus', refreshCanonicalGoals);
    const unsubscribe = window.electron?.onStoreChanged?.(() => { if (!draggingRef.current && rendererWritesPendingRef.current === 0) void refreshCanonicalGoals(); });
    const unsubscribeRuntime = window.electron?.goals?.onRuntimeChanged?.((event) => {
      if (cancelled) return;
      if (event.goalId === activeGoal?.id) {
        void window.electron?.goals?.getRuntime?.(event.goalId).then(value => { if (!cancelled && value && typeof value === 'object') setRuntimeProjection(value as GoalRuntimeProjection); });
      }
      if (event.scope !== 'graph' || draggingRef.current || rendererWritesPendingRef.current > 0) return;
      const local = goalsRef.current.find(goal => goal.id === event.goalId);
      if (local && goalRevision(local) >= event.revision) return;
      void refreshCanonicalGoals();
    });
    return () => { cancelled = true; window.removeEventListener('focus', refreshCanonicalGoals); unsubscribe?.(); unsubscribeRuntime?.(); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const refreshSchedules = () => getCanonicalJSON<unknown>(GOAL_SCHEDULES_STORAGE_KEY, null).then(value => {
      if (!cancelled && value !== null) setSchedules(normalizeGoalSchedules(value));
    });
    void refreshSchedules().then(() => {
      if (!cancelled) setSchedulesHydrated(true);
    });
    const unsubscribe = window.electron?.onStoreChanged?.(() => { if (!draggingRef.current && scheduleWritesPendingRef.current === 0) void refreshSchedules(); });
    return () => { cancelled = true; unsubscribe?.(); };
  }, []);
  useEffect(() => {
    if (!schedulesHydrated) return;
    const writeTimer = window.setTimeout(() => {
      scheduleWritesPendingRef.current += 1;
      void setCanonicalJSON(GOAL_SCHEDULES_STORAGE_KEY, schedules).finally(() => {
        scheduleWritesPendingRef.current = Math.max(0, scheduleWritesPendingRef.current - 1);
      });
    }, 120);
    return () => window.clearTimeout(writeTimer);
  }, [schedulesHydrated, schedules]);
  useEffect(() => {
    if (!canonicalHydrated || draggingRef.current) return;
    const writeTimer = window.setTimeout(() => {
      rendererWritesPendingRef.current += 1;
      canonicalWrite.current = canonicalWrite.current.then(async () => {
        const forceLocalWrite = localMutationRef.current;
        try {
          const canonical = await getCanonicalJSON<GoalRecord[] | null>(STORAGE_KEY, null);
          if (Array.isArray(canonical)) canonicalGoalsRef.current = canonical.filter(goal => goal.id !== GOAL_ID);
          const localRevision = Math.max(0, ...goals.map(goalRevision));
          const canonicalRevision = Array.isArray(canonical) ? Math.max(0, ...canonical.map(goalRevision)) : 0;
          const localChangedSinceSubmission = goalsRef.current.some(current => {
            const submitted = goals.find(goal => goal.id === current.id);
            return submitted && goalRevision(current) > goalRevision(submitted);
          });
          if (!forceLocalWrite && !draggingRef.current && !localChangedSinceSubmission && canonicalRevision > localRevision && Array.isArray(canonical)) {
            setGoals(canonical);
            return;
          }
          const previous = canonicalGoalsRef.current;
          const changed = goals.filter(goal => {
            const prior = previous.find(item => item.id === goal.id);
            return prior && JSON.stringify(prior) !== JSON.stringify(goal);
          });
          if (changed.length === 1 && previous.some(goal => goal.id === changed[0].id) && typeof window.electron?.goals?.update === 'function') {
            const goal = changed[0];
            const prior = previous.find(item => item.id === goal.id)!;
            const result = await window.electron.goals.update({ goalId: goal.id, title: goal.title, elements: goal.elements, overseerAgentId: goal.overseerAgentId, expectedRevision: goalRevision(prior) });
            if (result.ok && result.goal) {
              canonicalGoalsRef.current = previous.map(item => item.id === goal.id ? result.goal : item);
              if (!draggingRef.current) setGoals(current => {
                const local = current.find(item => item.id === goal.id);
                if (!local || goalRevision(local) > goalRevision(goal)) return current;
                return current.map(item => item.id === goal.id ? result.goal : item);
              });
              return;
            }
            if (!forceLocalWrite && result.error === 'REVISION_MISMATCH') {
              const fallback = await getCanonicalJSON<GoalRecord[] | null>(STORAGE_KEY, null);
              if (Array.isArray(fallback)) {
                canonicalGoalsRef.current = fallback;
                if (!draggingRef.current) setGoals(current => {
                  const local = current.find(item => item.id === goal.id);
                  if (local && goalRevision(local) > goalRevision(goal)) return current;
                  return fallback.filter(item => item.id !== GOAL_ID);
                });
              }
              return;
            }
          }
          const stored = await setCanonicalJSON(STORAGE_KEY, goals);
          if (!stored) {
            const fallback = await getCanonicalJSON<GoalRecord[] | null>(STORAGE_KEY, null);
            if (Array.isArray(fallback) && !forceLocalWrite && !draggingRef.current) setGoals(current => {
              if (current.some(item => {
                const submitted = goals.find(goal => goal.id === item.id);
                return submitted && goalRevision(item) > goalRevision(submitted);
              })) return current;
              return fallback;
            });
          }
        } finally {
          rendererWritesPendingRef.current = Math.max(0, rendererWritesPendingRef.current - 1);
          if (forceLocalWrite) localMutationRef.current = false;
        }
      });
    }, 120);
    return () => window.clearTimeout(writeTimer);
  }, [canonicalHydrated, goals]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        spaceHeldRef.current = false;
        setSpacePressed(false);
        panSessionRef.current = null;
        setPanMode(false);
        setConnectorMode(false);
        setConnectorSourceId(null);
        setConnectorSourceBranch(undefined);
        setRewireConnectorId(null);
        setAgentMenuOpen(false);
        setControlFlowMenuOpen(false);
        setArtifactMenuOpen(false);
        setNewGoalDialogOpen(false);
        return;
      }
      if (event.code !== 'Space') return;
      spaceHeldRef.current = true;
      setSpacePressed(true);
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target?.closest('input, textarea, select, [contenteditable="true"]')) event.preventDefault();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      spaceHeldRef.current = false;
      setSpacePressed(false);
    };
    const resetSpace = () => {
      spaceHeldRef.current = false;
      setSpacePressed(false);
      panSessionRef.current = null;
    };
    const visibility = () => { if (document.hidden) resetSpace(); };
    const closeMenus = (event: PointerEvent) => {
      if (!agentMenuRef.current?.contains(event.target as Node)) setAgentMenuOpen(false);
      if (!controlFlowMenuRef.current?.contains(event.target as Node)) setControlFlowMenuOpen(false);
      if (!artifactMenuRef.current?.contains(event.target as Node)) setArtifactMenuOpen(false);
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    window.addEventListener('blur', resetSpace);
    window.addEventListener('pointerdown', closeMenus);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      window.removeEventListener('blur', resetSpace);
      window.removeEventListener('pointerdown', closeMenus);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  useEffect(() => {
    if (!drag) return;
    draggingRef.current = true;
    let frame = 0;
    let latestX = drag.startX;
    let latestY = drag.startY;
    const updatePosition = (clientX: number, clientY: number, finalize = false) => setGoals(current => current.map(goal => goal.id !== selectedGoalId ? goal : ({
      ...goal,
      ...(finalize ? { revision: goalRevision(goal) + 1, updatedAt: new Date().toISOString() } : {}),
      elements: goal.elements.map(element => element.id !== drag.id ? element : { ...element, x: drag.originX + (clientX - drag.startX) / zoom, y: drag.originY + (clientY - drag.startY) / zoom }),
    })));
    const move = (event: PointerEvent) => {
      latestX = event.clientX;
      latestY = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        updatePosition(latestX, latestY);
      });
    };
    const up = (event: PointerEvent) => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      draggingRef.current = false;
      updatePosition(event.clientX, event.clientY, true);
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      draggingRef.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [drag, selectedGoalId, zoom]);

  const updateElement = (updates: Partial<GoalElement>) => {
    if (selectedElementLocked) { setEditNotice('This node is locked while execution is active or committed. Pause, cancel, or amend the lifecycle before editing it.'); return; }
    setGoals(current => current.map(goal => goal.id !== selectedGoalId ? goal : ({ ...goal, revision: goalRevision(goal) + 1, updatedAt: new Date().toISOString(), elements: goal.elements.map(element => element.id === selectedElement?.id ? { ...element, ...updates } : element) })));
  };
  const updateArtifactReferences = async (nextReferences: GoalArtifactReference[]) => {
    if (!activeGoal || !selectedElement || (selectedElement.type !== 'goal' && selectedElement.type !== 'subgoal' && selectedElement.type !== 'artifact')) return;
    const submittedRevision = goalRevision(activeGoal);
    const result = await window.electron?.goals?.updateArtifacts?.({ goalId: activeGoal.id, elementId: selectedElement.id, artifactReferences: nextReferences, expectedRevision: submittedRevision, idempotencyKey: createStableId('artifact-mutation') });
    if (!result?.ok || !result.goal) {
      setEditNotice(result?.message ?? 'Artifact links could not be updated. Refresh the Goal and try again.');
      return;
    }
    canonicalGoalsRef.current = canonicalGoalsRef.current.map(goal => goal.id === result.goal.id ? result.goal : goal);
    setGoals(current => {
      const local = current.find(goal => goal.id === result.goal.id);
      if (!local || goalRevision(local) > submittedRevision) return current;
      return current.map(goal => goal.id === result.goal.id ? result.goal : goal);
    });
  };
  const addCustomArtifactReference = () => {
    if (!selectedElement || selectedElement.type !== 'artifact' || !customArtifactLabel.trim()) return;
    void updateArtifactReferences([...selectedArtifactReferences, {
      id: createStableId('artifact-link'),
      artifactType: customArtifactKind === 'url' ? 'url' : customArtifactKind === 'file' ? 'file' : customArtifactKind === 'document' ? 'document' : 'user-defined',
      artifactId: createStableId('artifact'),
      contribution: 'supporting',
      label: customArtifactLabel.trim(),
      kind: customArtifactKind,
      format: customArtifactFormat.trim() || undefined,
      locator: customArtifactLocator.trim() || undefined,
      linkedBy: 'renderer',
      linkedAt: new Date().toISOString(),
    }]);
    setCustomArtifactLabel('');
    setCustomArtifactFormat('');
    setCustomArtifactLocator('');
  };
  const addSupportingSourceReference = (value: string) => {
    if (!selectedElement || selectedElement.type !== 'artifact') return;
    const option = supportingSourceOptions.find(item => item.value === value);
    if (!option || selectedArtifactReferences.some(reference => reference.sourceAttachmentId === option.attachment.id && reference.sourceTaskId === option.taskId)) return;
    void updateArtifactReferences([...selectedArtifactReferences, {
      id: createStableId('artifact-link'), artifactType: option.artifactType, artifactId: option.attachment.id,
      contribution: 'supporting', label: option.attachment.name, kind: option.artifactType,
      format: option.attachment.name.split('.').pop()?.toUpperCase() || undefined, locator: option.attachment.uri || option.attachment.path,
      sourceTaskId: option.taskId, sourceAttachmentId: option.attachment.id, linkedBy: 'renderer', linkedAt: new Date().toISOString(),
    }]);
  };
  const updateAgentConfiguration = (updates: Partial<GoalAgentConfiguration>) => {
    if (selectedElement?.type !== 'agent') return;
    const current = selectedElement.agentConfiguration ?? { version: 1 as const, mode: selectedElement.assigneeId ? 'existing' as const : 'ephemeral' as const, assigneeId: selectedElement.assigneeId, instructions: '' };
    const next = { ...current, ...updates, version: 1 as const };
    if (next.mode === 'ephemeral' && !next.requestedName && !next.autoGenerateName) next.requestedName = selectedAgent?.name ?? selectedElement.title;
    updateElement({ agentConfiguration: next, assigneeId: next.mode === 'existing' ? next.assigneeId : undefined });
  };
  const updateAgentName = (name: string) => {
    if (selectedElement?.type !== 'agent') return;
    const current = selectedElement.agentConfiguration ?? { version: 1 as const, mode: 'ephemeral' as const, instructions: '' };
    updateElement({ title: name, agentConfiguration: { ...current, version: 1 as const, requestedName: name } });
  };
  const updateGoal = (updates: Partial<GoalRecord>) => {
    if (selectedElementLocked) { setEditNotice('This Goal is locked while execution is active or committed. Pause, cancel, or amend the lifecycle before editing it.'); return; }
    setGoals(current => current.map(goal => goal.id === selectedGoalId ? { ...goal, ...updates, revision: goalRevision(goal) + 1, updatedAt: new Date().toISOString() } : goal));
  };
  const createSchedule = () => {
    if (!activeGoal || activeSchedule) return;
    const schedule: GoalSchedule = {
      id: createStableId('schedule'),
      goalId: activeGoal.id,
      enabled: true,
      rule: { mode: 'one-time', date: new Date().toISOString().slice(0, 10), time: '09:00' },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      temporalMode: 'anchored',
      updatedAt: new Date().toISOString(),
    };
    setSchedules(current => [...current, schedule]);
  };
  const updateSchedule = (updates: Partial<GoalSchedule> | { rule: Partial<GoalSchedule['rule']> }) => {
    if (!activeGoal || !activeSchedule) return;
    setSchedules(current => current.map(schedule => {
      if (schedule.id !== activeSchedule.id) return schedule;
      const next = 'rule' in updates ? { ...schedule, rule: { ...schedule.rule, ...updates.rule } } : { ...schedule, ...updates };
      return { ...next, updatedAt: new Date().toISOString() };
    }));
  };
  const deleteSchedule = () => {
    if (!activeSchedule) return;
    setSchedules(current => current.filter(schedule => schedule.id !== activeSchedule.id));
  };
  const updatePolicy = (updates: Partial<GoalPolicy>) => {
    if (!selectedPolicyElement) return;
    const nextPolicy = { ...selectedPolicyElement.policy, ...updates };
    if (updates.retryBudgetMode === 'unbounded') delete nextPolicy.maxRetries;
    if (selectedPolicyElement.type === 'goal') updateGoal({ policy: nextPolicy });
    else updateElement({ policy: nextPolicy });
  };
  const updatePolicyDimension = (dimension: GoalPolicyDimension, updates: GoalPolicyDimensionOverride | undefined) => {
    const dimensions = { ...selectedPolicyElement?.policy?.dimensions };
    if (updates) dimensions[dimension] = updates;
    else delete dimensions[dimension];
    updatePolicy({ dimensions });
  };
  const addElement = (type: GoalElementType) => {
    if (!activeGoal) return;
    const id = createStableId(type === 'connector' ? 'connector' : 'element');
    const title = type === 'subgoal' ? 'New subgoal' : type === 'condition' ? 'New condition' : type === 'approval-gate' ? 'Approval gate' : type === 'human-input' ? 'Ask the user' : type === 'retry' ? 'Retry an earlier step' : type === 'deliverable' ? 'New deliverable' : type === 'artifact' ? 'Supporting artifact' : `New ${type}`;
    const body = type === 'condition' ? 'Define the condition to evaluate' : type === 'approval-gate' ? 'Define who must approve and what evidence is required' : type === 'human-input' ? 'Pause for overseer-mediated user input' : type === 'retry' ? 'Return to an earlier completed workflow step' : type === 'deliverable' ? 'Define the expected outcome and delivery handoff' : type === 'artifact' ? 'Declare an execution input or supporting file' : 'Describe the outcome and handoff';
    const element: GoalElement = {
      id, type, title, body, x: 260 + (activeGoal.elements.length % 3) * 260, y: 560,
      width: 220, height: type === 'human-input' ? 120 : 90, status: 'draft',
      ...(type === 'human-input' ? { humanInputPrompt: 'What input is needed to continue?' } : {}),
      ...(type === 'retry' ? { retryMaxAttempts: 3, retryExhaustionPolicy: 'human-review' } : {}),
      ...(type === 'deliverable' ? { deliverableStatus: 'planned', deliverySpec: { outcomeKind: 'other' as const, instructions: '', acceptanceCriteria: [] } } : {}),
      ...(type === 'artifact' ? { artifactRole: 'supporting' as const, artifactReferences: [] } : {}),
    };
    setGoals(current => current.map(goal => goal.id === selectedGoalId ? { ...goal, revision: goalRevision(goal) + 1, updatedAt: new Date().toISOString(), elements: [...goal.elements, element] } : goal));
    setSelectedElementId(id);
  };
  const deleteElement = () => {
    if (!selectedElement) return;
    if (selectedElementLocked) { setEditNotice('This node cannot be deleted during active or committed execution.'); return; }
    if (selectedElement.type === 'goal') {
      setDeleteDialogOpen(true);
      return;
    }
    performDeleteElement();
  };
  const performDeleteElement = () => {
    if (!selectedElement) return;
    if (selectedElement.type === 'goal') {
      localMutationRef.current = true;
      const remainingGoals = goals.filter(goal => goal.id !== selectedGoalId);
      setGoals(remainingGoals);
      const nextGoal = remainingGoals[0];
      setSelectedGoalId(nextGoal?.id ?? '');
      setSelectedElementId(nextGoal?.elements[0]?.id ?? '');
      setDeleteDialogOpen(false);
      return;
    }
      setGoals(current => current.map(goal => goal.id === selectedGoalId ? { ...goal, revision: goalRevision(goal) + 1, updatedAt: new Date().toISOString(), elements: goal.elements.filter(element => element.id !== selectedElement.id && element.sourceId !== selectedElement.id && element.targetId !== selectedElement.id) } : goal));
    setSelectedElementId(activeGoal.elements.find(element => element.id !== selectedElement.id)?.id ?? '');
  };
  useEffect(() => {
    const onDeleteKey = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (!selectedElement) return;
      event.preventDefault();
      deleteElement();
    };
    window.addEventListener('keydown', onDeleteKey);
    return () => window.removeEventListener('keydown', onDeleteKey);
  }, [activeGoal, deleteElement, selectedElement]);
  const openNewGoalDialog = () => {
    setNewGoalTitle('');
    setNewGoalBody('');
    setNewGoalDialogOpen(true);
  };
  const createGoal = () => {
    const title = newGoalTitle.trim() || 'Untitled goal';
    const goal: GoalRecord = { id: createStableId('goal'), title, color: '#2563eb', updatedAt: new Date().toISOString(), elements: [{ id: createStableId('element'), type: 'goal', title, body: newGoalBody.trim() || 'Define the outcome', x: 420, y: 180, width: 250, height: 104, status: 'draft' }] };
    setGoals(current => [...current, goal]); setSelectedGoalId(goal.id); setSelectedElementId(goal.elements[0].id); setNewGoalDialogOpen(false);
  };

  const addTemplate = (template: GoalTemplate) => {
    const goal = instantiateGoalTemplate(template, createStableId);
    setGoals(current => [...current, goal]);
    setSelectedGoalId(goal.id);
    setSelectedElementId(goal.elements.find(element => element.type === 'goal')?.id ?? goal.elements[0]?.id ?? '');
  };

  const connections = activeGoal?.elements.filter(element => element.type === 'connector') ?? [];
  const selectedConnections = selectedElement?.type !== 'connector'
    ? connections.filter(connection => connection.sourceId === selectedElement?.id || connection.targetId === selectedElement?.id)
    : [];

  const canvasElementHeight = (element: GoalElement) => canvasElementHeights[element.id]
    ?? (element.type === 'condition' ? Math.max(element.height ?? 90, 150) : element.type === 'human-input' ? Math.max(element.height ?? 90, 120) : element.height ?? 90);

  const moveCanvasSelection = (elementId: string, forward: boolean) => {
    const items = activeGoal?.elements ?? [];
    const index = items.findIndex(element => element.id === elementId);
    if (index < 0) return;
    const nextIndex = forward ? Math.min(items.length - 1, index + 1) : Math.max(0, index - 1);
    const nextId = items[nextIndex]?.id ?? elementId;
    setSelectedElementId(nextId);
    requestAnimationFrame(() => document.getElementById(`goal-canvas-item-${nextId}`)?.focus());
  };


  const addAgent = (person: Person) => {
    if (!activeGoal) return;
    const id = createStableId('element');
    const element: GoalElement = { id, type: 'agent', title: person.name, body: person.role, assigneeId: person.id, agentConfiguration: { version: 1, mode: 'existing', assigneeId: person.id, instructions: '' }, x: 260 + (activeGoal.elements.length % 3) * 260, y: 560, width: 220, height: 90, status: 'draft' };
    setGoals(current => current.map(goal => goal.id === selectedGoalId ? { ...goal, revision: goalRevision(goal) + 1, updatedAt: new Date().toISOString(), elements: [...goal.elements, element] } : goal));
    setSelectedElementId(id);
    setAgentMenuOpen(false);
    setArtifactMenuOpen(false);
  };

  const deleteConnection = (connectionId: string) => {
    const connection = activeGoal?.elements.find(element => element.id === connectionId);
    const source = activeGoal?.elements.find(element => element.id === connection?.sourceId);
    const target = activeGoal?.elements.find(element => element.id === connection?.targetId);
    if (isExecutionLocked(connection) || isExecutionLocked(source) || isExecutionLocked(target)) { setEditNotice('This connection participates in active or committed execution and cannot be changed.'); return; }
    setGoals(current => current.map(goal => goal.id === selectedGoalId
      ? { ...goal, revision: goalRevision(goal) + 1, updatedAt: new Date().toISOString(), elements: goal.elements.filter(element => element.id !== connectionId) }
      : goal));
    if (selectedElement?.id === connectionId) setSelectedElementId(activeGoal?.elements.find(element => element.id !== connectionId)?.id ?? '');
  };

  const connectNodes = (targetId: string, targetSide: GoalConnectorSide = 'left') => {
    if (!connectorSourceId) return;
    if (connectorSourceId === targetId) {
      setConnectorError('A connector needs two different nodes.');
      return;
    }
    if (!activeGoal?.elements.some(element => element.id === connectorSourceId && element.type !== 'connector') || !activeGoal.elements.some(element => element.id === targetId && element.type !== 'connector')) {
      setConnectorError('Both connector endpoints must be valid nodes.');
      return;
    }
    const source = activeGoal.elements.find(element => element.id === connectorSourceId);
    const target = activeGoal.elements.find(element => element.id === targetId);
    if (isExecutionLocked(source) || isExecutionLocked(target)) {
      setConnectorError('Active or committed nodes cannot be rewired. Pause, cancel, or amend the lifecycle first.');
      return;
    }
    if (source?.type === 'retry' && !isValidRetryTarget(activeGoal.elements, source.id, targetId, rewireConnectorId)) {
      setConnectorError('A retry must target an earlier connected workflow step.');
      return;
    }
    if (source?.type === 'retry' && activeGoal.elements.some(element => element.type === 'connector' && element.id !== rewireConnectorId && element.sourceId === source.id)) {
      setConnectorError('A retry node can target one earlier workflow step. Rewire its existing connector instead.');
      return;
    }
    if (source?.type !== 'retry' && wouldCreateGoalCycle(activeGoal.elements, connectorSourceId, targetId, rewireConnectorId)) {
      setConnectorError('That connection would create a cycle.');
      return;
    }
    setGoals(current => current.map(goal => {
      if (goal.id !== selectedGoalId) return goal;
      const elements = rewireConnectorId
        ? goal.elements.map(element => element.id === rewireConnectorId ? { ...element, sourceId: connectorSourceId, targetId, sourceSide: element.sourceSide ?? connectorSourceSide, targetSide, conditionBranch: connectorSourceBranch } : element)
        : [...goal.elements, { id: createStableId('connector'), type: 'connector' as const, title: 'Node connection', x: 0, y: 0, sourceId: connectorSourceId, targetId, sourceSide: connectorSourceSide, targetSide, conditionBranch: connectorSourceBranch }];
      return { ...goal, revision: goalRevision(goal) + 1, updatedAt: new Date().toISOString(), elements };
    }));
    setConnectorMode(false);
    setConnectorSourceId(null);
    setConnectorSourceBranch(undefined);
    setRewireConnectorId(null);
    setConnectorError(null);
  };

  const nodePoint = (element: GoalElement, side: GoalConnectorSide, branch?: GoalConditionBranch) => {
    const width = element.width ?? 220;
    const height = canvasElementHeight(element);
    if (side === 'top') return { x: element.x + width / 2, y: element.y };
    if (side === 'bottom') return { x: element.x + width / 2, y: element.y + height };
    if (side === 'left') return { x: element.x, y: element.y + height / 2 };
    if (element.type === 'condition' && branch) return { x: element.x + width, y: element.y + height * (branch === 'positive' ? 0.32 : 0.68) };
    return { x: element.x + width, y: element.y + height / 2 };
  };

  const controlPoint = (point: { x: number; y: number }, side: GoalConnectorSide, distance: number) => {
    if (side === 'top') return { x: point.x, y: point.y - distance };
    if (side === 'bottom') return { x: point.x, y: point.y + distance };
    if (side === 'left') return { x: point.x - distance, y: point.y };
    return { x: point.x + distance, y: point.y };
  };

  const connectorPath = (connection: GoalElement) => {
    const source = activeGoal?.elements.find(element => element.id === connection.sourceId);
    const target = activeGoal?.elements.find(element => element.id === connection.targetId);
    if (!source || !target) return null;
    const sourceSide = connection.sourceSide ?? 'right';
    const targetSide = connection.targetSide ?? 'left';
    const start = nodePoint(source, sourceSide, connection.conditionBranch);
    const end = nodePoint(target, targetSide);
    const bend = Math.max(48, Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) * 0.35);
    const first = controlPoint(start, sourceSide, bend);
    const second = controlPoint(end, targetSide, bend);
    return `M ${start.x} ${start.y} C ${first.x} ${first.y}, ${second.x} ${second.y}, ${end.x} ${end.y}`;
  };

  const beginConnection = (elementId: string, side: GoalConnectorSide, branch?: GoalConditionBranch) => {
    if (isExecutionLocked(activeGoal?.elements.find(element => element.id === elementId))) {
      setConnectorError('Active or committed nodes cannot be rewired. Pause, cancel, or amend the lifecycle first.');
      return;
    }
    setConnectorMode(true);
    setConnectorSourceId(elementId);
    setConnectorSourceSide(side);
    setConnectorSourceBranch(branch);
    setConnectorError(null);
  };

  const beginCanvasPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    setAgentMenuOpen(false);
    setArtifactMenuOpen(false);
    if ((!spaceHeldRef.current && !panMode) || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    };
  };

  const moveCanvasPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = panSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    setPan({
      x: session.originX + event.clientX - session.startX,
      y: session.originY + event.clientY - session.startY,
    });
  };

  const endCanvasPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = panSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    panSessionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
  <section className="goals-view relative h-full min-h-0 overflow-hidden bg-slate-50 text-slate-700">
    <GoalsSidebar
      goals={goals}
      selectedGoalId={selectedGoalId}
      collapsed={leftPanelCollapsed}
      onSelectGoal={goal => { setSelectedGoalId(goal.id); setSelectedElementId(goal.elements[0]?.id ?? ''); }}
      onToggleCollapsed={() => setLeftPanelCollapsed(value => !value)}
      onNewGoal={openNewGoalDialog}
      statusChipClass={statusChipClass}
      compactChipClass={compactChipClass}
      statusLabel={statusLabel}
      StatusIcon={StatusIcon}
    />
    <GoalsToolbar
      activeGoal={activeGoal}
      people={people}
      connectorMode={connectorMode}
      agentMenuOpen={agentMenuOpen}
      controlFlowMenuOpen={controlFlowMenuOpen}
      artifactMenuOpen={artifactMenuOpen}
      agentMenuRef={agentMenuRef}
      controlFlowMenuRef={controlFlowMenuRef}
      artifactMenuRef={artifactMenuRef}
      templates={GOAL_TEMPLATES}
      toolItems={TOOL_ITEMS}
      artifactItems={ARTIFACT_ITEMS}
      controlFlowItems={CONTROL_FLOW_ITEMS}
      onSelectTemplate={addTemplate}
      onAddElement={addElement}
      onAddControlFlow={type => { addElement(type); setControlFlowMenuOpen(false); }}
      onAddArtifact={type => { addElement(type); setArtifactMenuOpen(false); }}
      onAddAgent={addAgent}
      onToggleAgentMenu={() => setAgentMenuOpen(value => !value)}
      onToggleControlFlowMenu={() => setControlFlowMenuOpen(value => !value)}
      onToggleArtifactMenu={() => setArtifactMenuOpen(value => !value)}
      onStartConnector={() => { setConnectorMode(true); setConnectorSourceId(null); setConnectorSourceBranch(undefined); }}
    />
    <div ref={canvasRef} tabIndex={0} role="application" aria-label="Goal canvas. Hold space and drag to pan." className={`h-full w-full outline-none ${spacePressed || panMode ? 'cursor-grab' : 'cursor-default'}`} onPointerDown={beginCanvasPan} onPointerMove={moveCanvasPan} onPointerUp={endCanvasPan} onPointerCancel={endCanvasPan} onLostPointerCapture={event => { if (panSessionRef.current?.pointerId === event.pointerId) panSessionRef.current = null; }}>
      <div className="goals-canvas-grid absolute inset-0" aria-hidden="true" />
      {!activeGoal && <div className="absolute inset-0 flex items-center justify-center p-6" role="status" aria-live="polite"><div className="max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm"><div className="mx-auto flex size-10 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Sparkles className="size-5" /></div><h2 className="mt-3 text-sm font-semibold text-slate-900">Start with a Goal</h2><p className="mt-1 text-xs leading-5 text-slate-500">Create a Goal to shape its subgoals, agents, instructions, and approval gates on the canvas.</p><button type="button" onClick={openNewGoalDialog} className="mt-4 inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"><Plus className="size-3.5" /> New goal</button></div></div>}
      <div className="absolute left-1/2 top-1/2" style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`, transformOrigin: 'center' }}>
        <GoalsConnectorLayer connections={connections} elements={activeGoal?.elements ?? []} selectedElementId={selectedElement?.id} connectorPath={connectorPath} onSelectConnector={connectionId => { setSelectedElementId(connectionId); setConnectorMode(false); setConnectorSourceId(null); setConnectorSourceBranch(undefined); }} onMoveSelection={moveCanvasSelection} />
        {connectorError && <div role="alert" className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 shadow-sm">{connectorError}</div>}
        <GoalsCanvasNodes elements={activeGoal?.elements ?? []} selectedElementId={selectedElement?.id} connectorMode={connectorMode} connectorSourceId={connectorSourceId} connectorSourceSide={connectorSourceSide} connectorSourceBranch={connectorSourceBranch} panMode={panMode} spaceHeld={spaceHeldRef.current} canvasElementHeight={canvasElementHeight} getElementTitle={getElementTitle} getElementBody={getElementBody} isConnected={elementId => isGoalElementConnected(activeGoal?.elements ?? [], elementId)} isExecutionLocked={isExecutionLocked} nodeClass={nodeClass} elementIcon={elementIcon} conditionPositiveLabel={conditionPositiveLabel} conditionNegativeLabel={conditionNegativeLabel} readinessForElement={readinessForElement} readinessLabel={readinessLabel} readinessChipClass={readinessChipClass} isCompletionElement={isCompletionElement} compactChipClass={compactChipClass} statusChipClass={statusChipClass} statusLabel={statusLabel} StatusIcon={StatusIcon} onSelectElement={setSelectedElementId} onNodeClick={element => { if (connectorMode) { if (connectorSourceId) connectNodes(element.id); else beginConnection(element.id, 'right'); } else setSelectedElementId(element.id); }} onMoveSelection={moveCanvasSelection} onStartDrag={(element, event) => { if (spaceHeldRef.current || panMode || connectorMode || isExecutionLocked(element)) return; setSelectedElementId(element.id); setDrag({ id: element.id, startX: event.clientX, startY: event.clientY, originX: element.x, originY: element.y }); }} onConnectNode={connectNodes} onBeginConnection={beginConnection} />
      </div>
    </div>
    {editNotice && <div role="status" className="absolute bottom-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow-sm"><LockKeyhole className="size-3.5 shrink-0" />{editNotice}<button type="button" className="ml-1 font-semibold text-amber-900" onClick={() => setEditNotice(null)}>Dismiss</button></div>}

    {selectedElement && (
      <GoalsInspector selectedElement={selectedElement} selectedElementLocked={selectedElementLocked} onDelete={deleteElement}>
        <label className="mt-5 block text-xs font-medium text-slate-600">
          {selectedElement.type === 'agent' ? 'Name' : 'Title'}
          <Input
            value={selectedElement.type === 'agent' ? selectedAgent?.name ?? (selectedAgentConfiguration?.autoGenerateName ? '' : selectedAgentConfiguration?.requestedName ?? selectedElement.title) : selectedElement.title}
            placeholder={selectedElement.type === 'agent' && selectedAgentConfiguration?.autoGenerateName ? 'Generated at spawn' : undefined}
            readOnly={selectedElement.type === 'agent' && (selectedAgentMode === 'existing' || selectedAgentConfiguration?.autoGenerateName === true)}
            onChange={selectedElement.type === 'agent' ? event => updateAgentName(event.target.value) : event => updateElement({ title: event.target.value })}
            className="mt-1"
          />
          {selectedElement.type === 'agent' && selectedAgentMode === 'ephemeral' && <span className="mt-1 block text-[11px] font-normal text-slate-400">{selectedAgentConfiguration?.autoGenerateName ? 'The overseer will generate a name when this agent is spawned.' : 'Required task-focused name.'}</span>}
          {selectedAgentMissing && <span role="alert" className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-normal text-amber-800"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />Assign a canonical agent before this node can be started or dispatched.</span>}
        </label>
        {selectedElement.type === 'goal' && (
          <>
            <label className="mt-4 block text-xs font-medium text-slate-600">
              Color
              <input
                type="color"
                value={activeGoal?.color ?? '#2563eb'}
                onChange={event => updateGoal({ color: event.target.value })}
                aria-label="Goal color"
                className="mt-1 h-9 w-full cursor-pointer rounded-md border border-slate-200 bg-white p-1"
              />
            </label>
            <label className="mt-4 block text-xs font-medium text-slate-600">
              Overseer agent
              <Select value={activeGoal?.overseerAgentId ?? '__none__'} onValueChange={value => updateGoal({ overseerAgentId: value === '__none__' ? undefined : value })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select an agent</SelectItem>
                  {people.filter(person => person.kind === 'agentic').map(person => (
                    <SelectItem key={person.id} value={person.id}>{person.name} · {person.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="mt-1 block text-[11px] font-normal text-slate-400">This agent derives subgoal status toward the goal.</span>
            </label>
          </>
        )}
        {selectedElement.type !== 'agent' && <label className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs font-medium text-slate-600">
          Notes
          <textarea value={selectedElement.body ?? ''} onChange={event => updateElement({ body: event.target.value })} rows={4} className="mt-1 w-full resize-none rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </label>}
        <GoalsAgentSection element={selectedElement} people={people} selectedAgent={selectedAgent} selectedAgentMissing={Boolean(selectedAgentMissing)} selectedAgentConfiguration={selectedAgentConfiguration} selectedAgentMode={selectedAgentMode} onUpdateConfiguration={updateAgentConfiguration} />
        <GoalsControlFlowSection element={selectedElement} retryTargetTitle={selectedRetryTarget ? activeGoal?.elements.find(element => element.id === selectedRetryTarget)?.title ?? 'Missing node' : undefined} onUpdateElement={updateElement} />
        {selectedElement.type === 'deliverable' && (
          <GoalsDeliverableSection>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Delivery contract</p>
            <p className="mt-1 text-[11px] text-slate-400">These instructions are authoritative for this Goal revision. Notes provide context only.</p>
            <label className="mt-3 block text-xs font-medium text-slate-600">Outcome kind
              <Select value={selectedElement.deliverySpec?.outcomeKind ?? 'other'} onValueChange={value => updateElement({ deliverySpec: { ...(selectedElement.deliverySpec ?? { instructions: '' }), outcomeKind: value as NonNullable<GoalElement['deliverySpec']>['outcomeKind'] } })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="file">File</SelectItem><SelectItem value="summary">Summary</SelectItem><SelectItem value="conclusion">Conclusion</SelectItem><SelectItem value="resolution">Resolution</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
              </Select>
            </label>
            <label className="mt-3 block text-xs font-medium text-slate-600">Delivery instructions<textarea value={selectedElement.deliverySpec?.instructions ?? ''} onChange={event => updateElement({ deliverySpec: { ...(selectedElement.deliverySpec ?? { outcomeKind: 'other' }), instructions: event.target.value } })} rows={5} placeholder="Describe how this outcome should be delivered, where, and in what form." className="mt-1 w-full resize-y rounded-md border border-emerald-200 bg-emerald-50/30 px-2.5 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block text-xs font-medium text-slate-600">Format<Input value={selectedElement.deliverySpec?.format ?? ''} onChange={event => updateElement({ deliverySpec: { ...(selectedElement.deliverySpec ?? { outcomeKind: 'other', instructions: '' }), format: event.target.value || undefined } })} placeholder="e.g. PDF" className="mt-1" /></label>
              <label className="block text-xs font-medium text-slate-600">Recipient<Input value={selectedElement.deliverySpec?.recipient ?? ''} onChange={event => updateElement({ deliverySpec: { ...(selectedElement.deliverySpec ?? { outcomeKind: 'other', instructions: '' }), recipient: event.target.value || undefined } })} placeholder="Person or team" className="mt-1" /></label>
            </div>
            <label className="mt-3 block text-xs font-medium text-slate-600">Destination<Input value={selectedElement.deliverySpec?.destination ?? ''} onChange={event => updateElement({ deliverySpec: { ...(selectedElement.deliverySpec ?? { outcomeKind: 'other', instructions: '' }), destination: event.target.value || undefined } })} placeholder="Workspace, folder, URL, or channel" className="mt-1" /></label>
            <label className="mt-3 block text-xs font-medium text-slate-600">Acceptance criteria<textarea value={(selectedElement.deliverySpec?.acceptanceCriteria ?? []).join('\n')} onChange={event => updateElement({ deliverySpec: { ...(selectedElement.deliverySpec ?? { outcomeKind: 'other', instructions: '' }), acceptanceCriteria: event.target.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean) } })} rows={4} placeholder="One criterion per line" className="mt-1 w-full resize-y rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
            <label className="mt-3 block text-xs font-medium text-slate-600">Expected artifact count <span className="font-normal text-slate-400">(optional)</span><Input type="number" min={0} step={1} value={selectedElement.deliverySpec?.expectedArtifactCount ?? ''} onChange={event => updateElement({ deliverySpec: { ...(selectedElement.deliverySpec ?? { outcomeKind: 'other', instructions: '' }), expectedArtifactCount: event.target.value === '' ? undefined : Math.max(0, Math.floor(Number(event.target.value))) } })} className="mt-1" /></label>
            <label className="mt-3 block text-xs font-medium text-slate-600">Acceptance state
              <Select value={selectedElement.deliverableStatus ?? 'planned'} onValueChange={value => updateElement({ deliverableStatus: value as GoalElement['deliverableStatus'] })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="planned">Planned</SelectItem><SelectItem value="in-progress">In progress</SelectItem><SelectItem value="ready-for-review">Ready for review</SelectItem><SelectItem value="accepted">Accepted</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
              </Select>
            </label>
            <div className="mt-4 rounded-md border border-emerald-100 bg-emerald-50/40 p-2.5">
              <p className="text-[11px] font-semibold text-emerald-800">Delivered outputs</p>
              <p className="mt-1 text-[11px] text-emerald-700/70">Runtime handoff records appear here after execution. Supporting artifacts are kept on separate nodes.</p>
              {(runtimeProjection?.handoffs ?? []).filter(handoff => !handoff.deliverableId || handoff.deliverableId === selectedElement.id).length === 0
                ? <p className="mt-2 text-[11px] text-slate-400">No terminal handoff recorded yet.</p>
                : <div className="mt-2 space-y-2">{(runtimeProjection?.handoffs ?? []).filter(handoff => !handoff.deliverableId || handoff.deliverableId === selectedElement.id).map(handoff => <div key={handoff.id} className="rounded-md border border-emerald-100 bg-white px-2.5 py-2"><p className="text-[10px] text-slate-400">{handoff.deliveredAt ? new Date(handoff.deliveredAt).toLocaleString() : 'Recorded handoff'}</p>{(handoff.producedArtifactReferences ?? []).map((reference, index) => <p key={`${handoff.id}-${index}`} className="mt-1 truncate text-xs font-medium text-slate-700">{reference.label ?? reference.locator ?? 'Produced output'}{reference.format ? ` · ${reference.format}` : ''}</p>)}</div>)}</div>}
            </div>
          </GoalsDeliverableSection>
        )}
        <GoalsConditionSection element={selectedElement} positiveLabel={conditionPositiveLabel(selectedElement)} negativeLabel={conditionNegativeLabel(selectedElement)} onUpdateElement={updateElement} />
        {selectedElement.type === 'subgoal' && (
          <section className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Handoff</p>
            <label className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={selectedElement.handoffRequired === true} onChange={event => updateElement({ handoffRequired: event.target.checked })} /> Require handoff before the next step</label>
            <label className="mt-3 block text-xs font-medium text-slate-600">Handoff notes<textarea value={selectedElement.handoffNotes ?? ''} onChange={event => updateElement({ handoffNotes: event.target.value })} rows={3} placeholder="What must be passed to the next step?" className="mt-1 w-full resize-none rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
          </section>
        )}
        {selectedElement.type === 'goal' && <GoalsScheduleSection schedule={activeSchedule} onCreate={createSchedule} onUpdate={updateSchedule} onDelete={deleteSchedule} />}
        {selectedPolicyElement && (
          <GoalsPolicySection>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Policy</p>
            <p className="mt-1 text-[11px] text-slate-400">Typed controls become part of the execution contract.</p>
            {runtimeProjection?.execution && <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">Runtime: <span className="font-medium text-slate-800">{runtimeProjection.execution.state ?? 'unknown'}</span> · execution revision {runtimeProjection.execution.revision ?? 0} · policy revision {runtimeProjection.policyRevision ?? 0}</p>}
            {runtimeProjection?.lastChange?.errorCode && <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-800">Conflict: <span className="font-semibold">{runtimeProjection.lastChange.errorCode}</span>. The rejected change remains inspectable and canonical state was preserved.</p>}
            {runtimeProjection?.execution?.reconciliationRequired && <p className="mt-2 rounded-md border border-orange-200 bg-orange-50 px-2.5 py-2 text-[11px] text-orange-800">Reconciliation required before execution can continue.</p>}
            {runtimeProjection?.execution?.state === 'approval-required' && <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">Approval required before this execution can proceed.</p>}
            {runtimeProjection?.execution?.state === 'blocked' && <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">Execution is blocked. Review the runtime policy, dependencies, and agent availability.</p>}
            {runtimeProjection?.agentAvailability?.some(item => !item.available) && <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-800">Agent unavailable: dispatch remains blocked until the configured capability is available or an approved fallback is selected.</p>}
            {workspacePolicy && <p className="mt-2 rounded-md border border-blue-100 bg-blue-50/60 px-2.5 py-2 text-[11px] text-blue-800">Workspace policy revision {workspacePolicy.policyRevision} is the inherited baseline. Goal and gate values can only narrow it.</p>}
            {selectedPolicyImpact && <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">Active execution has a pending policy impact. {selectedPolicyImpact.requiresUserConfirmation ? 'Confirmation is required before the widened policy can apply.' : 'Pause and review the affected execution before continuing.'}</p>}
            {selectedEffectivePolicy && <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
              <p className="text-[11px] font-medium text-slate-600">Effective policy</p>
              <div className="mt-2 space-y-1.5">
                {GOAL_POLICY_DIMENSIONS.map(dimension => {
                  const explicit = selectedPolicyElement.policy?.dimensions?.[dimension.key] ?? legacyDimensionOverride(selectedPolicyElement.policy, dimension.key);
                  const effective = selectedEffectivePolicy.dimensions[dimension.key];
                  const value = effective.constrained ? `${effective.mode} · ${effective.value} ${dimension.unit}` : 'Unbounded';
                  return <div key={dimension.key} className="flex items-center justify-between gap-2 text-[11px]"><span className="text-slate-500">{dimension.label}</span><span className="text-right text-slate-700"><span>{value}</span><span className="ml-1 text-slate-400">· {explicit ? 'Explicit override' : 'Inherited'}</span></span></div>;
                })}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">Acceptance: <span className="font-medium text-slate-700">{selectedEffectivePolicy.acceptance.actor}</span><span className="ml-1 text-slate-400">· {selectedPolicyElement.policy?.acceptanceActor ? 'Explicit override' : 'Inherited'}</span></p>
            </div>}
            {selectedPolicyElement.type === 'goal' && <div className="mt-3 space-y-3">
              <p className="text-[11px] font-medium text-slate-500">Goal budget overrides</p>
              {GOAL_POLICY_DIMENSIONS.map(dimension => {
                const explicit = selectedPolicyElement.policy?.dimensions?.[dimension.key];
                const mode = explicit?.constrained === false ? 'unbounded' : explicit?.mode ?? '__default__';
                const value = explicit?.constrained === true ? explicit.value : '';
                return <div key={dimension.key} className="rounded-lg border border-slate-200 p-2.5">
                  <label className="block text-xs font-medium text-slate-600">{dimension.label}
                    <Select value={mode} onValueChange={nextMode => {
                      if (nextMode === '__default__') updatePolicyDimension(dimension.key, undefined);
                      else if (nextMode === 'unbounded') updatePolicyDimension(dimension.key, { constrained: false });
                      else updatePolicyDimension(dimension.key, { constrained: true, mode: nextMode as Exclude<GoalBudgetMode, 'unbounded'>, value: explicit?.constrained === true ? explicit.value : GOAL_POLICY_SAFE_VALUES[dimension.key], unit: dimension.unit });
                    }}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Use workspace default" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__">Use workspace default</SelectItem>
                        <SelectItem value="hard-cap">Hard cap</SelectItem>
                        <SelectItem value="goal-pool">Goal pool</SelectItem>
                        <SelectItem value="approval-required">Approval required</SelectItem>
                        <SelectItem value="unbounded">Unbounded</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  {explicit?.constrained === true && <div className="mt-2 flex items-center gap-2">
                    <Input type="number" min="0.01" step={dimension.key === 'financial' ? '0.01' : '1'} value={value} onChange={event => { const next = Number(event.target.value); if (Number.isFinite(next) && next > 0 && (dimension.key === 'financial' || Number.isInteger(next))) updatePolicyDimension(dimension.key, { ...explicit, value: next, unit: dimension.unit }); }} aria-label={`${dimension.label} override value`} />
                    <span className="text-[11px] text-slate-400">{dimension.unit}</span>
                  </div>}
                  <span className="mt-1 block text-[11px] text-slate-400">Missing or cleared values inherit the workspace policy.</span>
                </div>;
              })}
            </div>}
            <label className="mt-3 block text-xs font-medium text-slate-600">
              {selectedElement.type === 'approval-gate' ? 'Required approver' : 'Acceptance actor'}
              <Select value={selectedPolicyElement.policy?.acceptanceActor ?? '__default__'} onValueChange={value => updatePolicy({ acceptanceActor: value === '__default__' ? undefined : value as GoalAcceptanceActor })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Use goal default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Use goal default</SelectItem>
                  <SelectItem value="human">Human</SelectItem>
                  <SelectItem value="agentic">Agentic</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {selectedElement.type === 'approval-gate' && <label className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={selectedElement.approvalEvidenceRequired !== false} onChange={event => updateElement({ approvalEvidenceRequired: event.target.checked })} /> Require evidence before approval</label>}
            <label className="mt-3 block text-xs font-medium text-slate-600">
              Retry budget
              <Select value={selectedPolicyElement.policy?.retryBudgetMode ?? '__default__'} onValueChange={value => updatePolicy({ retryBudgetMode: value === '__default__' ? undefined : value as GoalBudgetMode })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Use goal default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Use goal default</SelectItem>
                  <SelectItem value="hard-cap">Hard cap</SelectItem>
                  <SelectItem value="goal-pool">Goal pool</SelectItem>
                  <SelectItem value="approval-required">Approval required</SelectItem>
                  <SelectItem value="unbounded">Unbounded</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {selectedPolicyElement.policy?.retryBudgetMode !== 'unbounded' && <label className="mt-3 block text-xs font-medium text-slate-600">
              Max retries
              <Input
                type="number"
                min={1}
                step={1}
                value={selectedPolicyElement.policy?.maxRetries ?? ''}
                onChange={event => updatePolicy({ maxRetries: event.target.value === '' ? undefined : Math.max(1, Math.floor(Number(event.target.value))) })}
                className="mt-1"
                aria-describedby="max-retries-help"
              />
              <span id="max-retries-help" className="mt-1 block text-[11px] font-normal text-slate-400">Use a positive whole number. Leave unbounded selected to remove this limit.</span>
            </label>}
          </GoalsPolicySection>
        )}
        {(selectedElement.type === 'goal' || selectedElement.type === 'subgoal' || selectedElement.type === 'artifact') && <GoalsArtifactSection>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{selectedElement.type === 'artifact' ? 'Supporting artifacts' : 'Execution artifacts'}</p>
          <p className="mt-1 text-[11px] text-slate-400">{selectedElement.type === 'artifact' ? 'These files and references support execution; they never satisfy delivery acceptance.' : 'Links stay attached to this node; task and milestone records remain canonical.'}</p>
          {selectedElement.type !== 'artifact' && <Select onValueChange={value => {
            const option = artifactOptions.find(item => item.value === value);
            if (!option || selectedArtifactReferences.some(reference => reference.artifactType === option.artifactType && reference.artifactId === option.artifactId)) return;
            void updateArtifactReferences([...selectedArtifactReferences, { id: createStableId('artifact-link'), artifactType: option.artifactType, artifactId: option.artifactId, linkedBy: 'renderer', linkedAt: new Date().toISOString() }]);
          }}>
            <SelectTrigger className="mt-2"><SelectValue placeholder="Link a task or milestone" /></SelectTrigger>
            <SelectContent>
              {artifactOptions.filter(option => !selectedArtifactReferences.some(reference => reference.artifactType === option.artifactType && reference.artifactId === option.artifactId)).map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              {artifactOptions.length === 0 && <SelectItem value="__none__" disabled>No tasks or milestones available</SelectItem>}
            </SelectContent>
          </Select>}
          {selectedElement.type === 'artifact' && <div className="mt-3 rounded-md border border-sky-100 bg-sky-50/40 p-2.5">
            <p className="text-[11px] font-semibold text-sky-800">Select a workspace source</p>
            <p className="mt-1 text-[11px] text-sky-700/70">Links the existing attachment without copying its contents into the Goal.</p>
            <label className="mt-3 block text-[11px] font-medium text-slate-600">Artifact type
              <Select value={supportingArtifactType} onValueChange={value => { setSupportingArtifactType(value as SupportingArtifactType); setSupportingSourceSearch(''); }}>
                <SelectTrigger className={`mt-1 ${ARTIFACT_SELECT_CLASS}`}><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl"><SelectItem value="document">Document</SelectItem><SelectItem value="file">File</SelectItem><SelectItem value="url">URL</SelectItem><SelectItem value="user-defined">User-defined</SelectItem></SelectContent>
              </Select>
            </label>
            {(supportingArtifactType === 'document' || supportingArtifactType === 'file') && <>
              <label className="mt-3 block text-[11px] font-medium text-slate-600">Search workspace sources
                <Input value={supportingSourceSearch} onChange={event => setSupportingSourceSearch(event.target.value)} placeholder="Search by attachment or task name" className="mt-1 rounded-xl bg-white" />
              </label>
              <label className="mt-3 block text-[11px] font-medium text-slate-600">Workspace source
                <Select onValueChange={addSupportingSourceReference}>
                  <SelectTrigger className={`mt-1 ${ARTIFACT_SELECT_CLASS}`}><SelectValue placeholder={supportingSourceOptions.length ? 'Choose an existing source' : 'No matching sources'} /></SelectTrigger>
                  <SelectContent className="rounded-xl">{supportingSourceOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}<span className="ml-1 text-[10px] text-slate-400">· {option.searchText.replace(option.attachment.name, '').trim()}</span></SelectItem>)}{supportingSourceOptions.length === 0 && <SelectItem value="__none__" disabled>No matching workspace attachments</SelectItem>}</SelectContent>
                </Select>
              </label>
            </>}
            <p className="mt-3 text-[11px] font-semibold text-sky-800">Or declare an external/user-defined source</p>
            <Input value={customArtifactLabel} onChange={event => setCustomArtifactLabel(event.target.value)} placeholder="Artifact label" className="mt-2 bg-white" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Select value={customArtifactKind} onValueChange={setCustomArtifactKind}><SelectTrigger className={ARTIFACT_SELECT_CLASS}><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="document">Document</SelectItem><SelectItem value="file">File</SelectItem><SelectItem value="url">URL</SelectItem><SelectItem value="user-defined">User-defined</SelectItem></SelectContent></Select>
              <Input value={customArtifactFormat} onChange={event => setCustomArtifactFormat(event.target.value)} placeholder="Format (optional)" className="bg-white" />
            </div>
            <Input value={customArtifactLocator} onChange={event => setCustomArtifactLocator(event.target.value)} placeholder="Locator or URL (optional)" className="mt-2 bg-white" />
            <button type="button" onClick={addCustomArtifactReference} disabled={!customArtifactLabel.trim()} className="mt-2 rounded-md border border-sky-200 bg-white px-2.5 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50">Add supporting artifact</button>
          </div>}
          {selectedArtifactReferences.length > 0 ? <div className="mt-2 space-y-2">{selectedArtifactReferences.map(reference => {
            const projection = reference.projection;
            const sourceTask = reference.sourceTaskId ? tasks.find(task => task.id === reference.sourceTaskId) : undefined;
            const sourceAvailable = reference.sourceAttachmentId ? Boolean(sourceTask?.attachments?.some(attachment => attachment.id === reference.sourceAttachmentId)) : undefined;
            const missing = projection?.exists === false || sourceAvailable === false;
            const blocked = projection?.status === 'blocked';
            const approvalRequired = projection?.status === 'approval-required' || selectedElement.status === 'approval-required';
            const status = missing ? 'Stale reference' : blocked ? 'Blocked' : approvalRequired ? 'Approval required' : projection?.status ?? 'Linked';
            const statusClass = missing || blocked ? 'border-rose-200 bg-rose-50 text-rose-700' : approvalRequired ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600';
            return <div key={reference.id} className="rounded-md border border-slate-200 px-2.5 py-2"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-700">{projection?.title ?? reference.label ?? `${reference.artifactType} · ${reference.artifactId}`}</p><p className={`mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold capitalize ${statusClass}`}>{status.replaceAll('-', ' ')}</p></div><button type="button" onClick={() => void updateArtifactReferences(selectedArtifactReferences.filter(item => item.id !== reference.id))} className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Unlink execution artifact">×</button></div>{projection?.exists && <p className="mt-1 text-[10px] text-slate-400">{projection.assigneeId ? `Assignee ${projection.assigneeId}` : 'Unassigned'}{projection.dependencyIds?.length ? ` · ${projection.dependencyIds.length} dependencies` : ''}{projection.evidence?.length ? ` · ${projection.evidence.length} evidence refs` : ''}</p>}{missing && <p className="mt-1 text-[10px] text-rose-600">The source artifact no longer exists and must be relinked.</p>}</div>;
          })}</div> : <p className="mt-2 text-[11px] text-slate-400">No execution artifacts linked yet.</p>}
        </GoalsArtifactSection>}
        {selectedElement.type !== 'connector' && <GoalsConnectionsSection element={selectedElement} connections={selectedConnections} elements={activeGoal?.elements ?? []} onDeleteConnection={deleteConnection} />}
        <GoalsRuntimeStatusSection>
          {isCompletionElement(selectedElement) ? <>
            <div className="flex items-center gap-1">
              <span>Completion</span>
              <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${compactChipClass(statusChipClass(selectedElement.status))}`}>
                <StatusIcon status={selectedElement.status} className="mr-1 size-3.5" />{statusLabel(selectedElement.status)}
              </span>
            </div>
            <span className="mt-1 block text-[11px] text-slate-400">{statusDescription(selectedElement.status)}</span>
            {statusNextStep(selectedElement.status) && <span className="mt-2 block rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-normal text-slate-600"><span className="font-semibold text-slate-700">Next step: </span>{statusNextStep(selectedElement.status)}</span>}
          </> : (() => { const readiness = readinessForElement(selectedElement, isGoalElementConnected(activeGoal?.elements ?? [], selectedElement.id)); return <>
            <div className="flex items-center gap-1">
              <span>Readiness</span>
              {readiness === 'ready' ? <span className="inline-flex items-center" title="Ready for workflow use"><ReadyIcon /></span> : <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${readinessChipClass(readiness)}`}><CircleDot className="mr-1 size-3.5" />{readinessLabel(readiness)}</span>}
            </div>
            <span className="mt-1 block text-[11px] text-slate-400">{readinessDescription(selectedElement, readiness)}</span>
          </>; })()}
        </GoalsRuntimeStatusSection>
        {selectedElement.type === 'connector' && (
          <section className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Connection</p>
            <dl className="mt-2 space-y-1 text-[11px] text-slate-500">
              <div className="flex justify-between gap-3"><dt>From</dt><dd className="max-w-[150px] truncate font-medium text-slate-700">{activeGoal?.elements.find(element => element.id === selectedElement.sourceId)?.title ?? 'Missing node'}</dd></div>
              <div className="flex justify-between gap-3"><dt>To</dt><dd className="max-w-[150px] truncate font-medium text-slate-700">{activeGoal?.elements.find(element => element.id === selectedElement.targetId)?.title ?? 'Missing node'}</dd></div>
              <div className="flex justify-between gap-3"><dt>Ports</dt><dd className="font-medium capitalize text-slate-700">{selectedElement.sourceSide ?? 'right'} → {selectedElement.targetSide ?? 'left'}</dd></div>
            </dl>
            {selectedElement.conditionBranch && <div className="mt-2 text-[11px] font-medium capitalize text-slate-500">Branch: {selectedElement.conditionBranch}</div>}
            <button disabled={selectedElement.status === 'permission-denied'} onClick={() => { setConnectorMode(true); setRewireConnectorId(selectedElement.id); setConnectorSourceId(selectedElement.sourceId ?? null); setConnectorSourceSide(selectedElement.sourceSide ?? 'right'); setConnectorSourceBranch(selectedElement.conditionBranch); }} className="mt-4 flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-400">
              <Link2 className="size-3.5" /> {selectedElement.status === 'permission-denied' ? 'Rewiring unavailable' : 'Rewire connector'}
            </button>
          </section>
        )}
      </GoalsInspector>
    )}
    <DeleteGoalDialog open={deleteDialogOpen} onCancel={() => setDeleteDialogOpen(false)} onConfirm={performDeleteElement} />
    <NewGoalDialog open={newGoalDialogOpen} title={newGoalTitle} body={newGoalBody} auditDirectory={goalAuditArchiveDirectory} existingGoalCount={goals.length} onTitleChange={setNewGoalTitle} onBodyChange={setNewGoalBody} onPickDirectory={async () => { const directory = await window.electron?.goalAudit?.pickDirectory?.(); if (directory) onGoalAuditArchiveDirectoryChange?.(directory); }} onCancel={() => setNewGoalDialogOpen(false)} onSubmit={event => { event.preventDefault(); createGoal(); }} />
    <GoalsCanvasControls
      spacePressed={spacePressed}
      panMode={panMode}
      zoom={zoom}
      onTogglePanMode={() => setPanMode(value => !value)}
      onZoomOut={() => setZoom(value => Math.max(.6, value - .1))}
      onZoomIn={() => setZoom(value => Math.min(1.4, value + .1))}
    />
  </section>
  );
}
