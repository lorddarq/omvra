export type TaskStatus = 'open' | 'in-progress' | 'under-review' | 'done';
export type TaskSize = 'xs' | 's' | 'm' | 'l';
export type TaskComplexity = 'routine' | 'medium' | 'hard';
export type TaskPriority = 'urgent' | 'moderate' | 'normal' | 'low';
export type PersonKind = 'human' | 'agentic';
export type LoadClassification = 'open-tasks' | 'in-progress' | 'in-review' | 'none';
export type RoadmapStage = 'not-started' | 'in-progress' | 'in-review' | 'complete' | 'excluded';
export type AgentWatchAction = 'inspect_only' | 'inspect_and_work' | 'move_to_ready_for_human_review';

export interface StatusColumn {
  id: string;
  title: string;
  color?: string;
  description?: string;
  loadClassification?: LoadClassification;
  roadmapStage?: RoadmapStage;
  aiWatchEnabled?: boolean;
  aiAction?: AgentWatchAction;
}

export interface TaskComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface TaskTimeEntry {
  id: string;
  minutes: number;
  note?: string;
  loggedAt: string;
  actor?: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  path: string;
  uri: string;
  size?: number;
  addedAt: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  kind: PersonKind;
  avatar?: string;
  color?: string;
  agentInstructions?: string;
  agentOperationalInstructions?: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  notes?: string;
  startDate?: string;
  endDate?: string;
  color?: string;
  size?: TaskSize;
  complexity?: TaskComplexity;
  blocked?: boolean;
  priority?: TaskPriority;
  swimlaneOnly?: boolean; // Tasks that only appear in swimlanes
  swimlaneId?: string; // Which timeline swimlane row this task belongs to
  projectIds?: string[]; // Projects this task belongs to
  assigneeId?: string; // Person assigned to this task
  project?: string; // Project this task belongs to
  milestoneId?: string; // Primary roadmap milestone this task contributes to
  dependencyIds?: string[]; // Roadmap-only dependencies used for milestone planning arrows
  timeSpentMinutes?: number; // Approximate total time spent on this task
  timeSpentNote?: string; // Latest human-readable time-spent note/source
  timeEntries?: TaskTimeEntry[]; // Optional append-only approximate time log
  attachments?: TaskAttachment[]; // Local file references attached to this task
  comments?: TaskComment[];
  mcpUpdatedAt?: string;
  mcpLastActor?: string;
}

export interface ProjectMilestone {
  id: string;
  convexId?: string;
  title: string;
  projectIds: string[];
  projectId?: string; // Legacy single-project milestone field kept for migration.
  startDate?: string;
  endDate: string;
  notes?: string;
  color?: string;
  linkedTaskIds?: string[];
}

export type GoalElementType = 'goal' | 'subgoal' | 'agent' | 'connector' | 'instructions' | 'condition' | 'approval-gate';
export type GoalConnectorSide = 'top' | 'right' | 'bottom' | 'left';
export type GoalConditionBranch = 'positive' | 'negative';
export type GoalElementReadiness = 'not-ready' | 'ready' | 'unavailable' | 'needs-review';
export type GoalAcceptanceActor = 'human' | 'agentic' | 'both';
export type GoalBudgetMode = 'hard-cap' | 'goal-pool' | 'approval-required' | 'unbounded';
export type GoalPolicyDimension = 'financial' | 'tokens' | 'concurrency' | 'attempts' | 'retries';
export type GoalPolicyUnit = 'USD' | 'tokens' | 'loops' | 'attempts' | 'retries';

export interface GoalPolicyDimensionOverride {
  constrained?: boolean;
  mode?: Exclude<GoalBudgetMode, 'unbounded'>;
  value?: number;
  unit?: GoalPolicyUnit;
}

export interface GoalPolicy {
  acceptanceActor?: GoalAcceptanceActor;
  financialBudgetMode?: GoalBudgetMode;
  tokenBudgetMode?: GoalBudgetMode;
  timeBudgetMode?: GoalBudgetMode;
  concurrencyBudgetMode?: GoalBudgetMode;
  retryBudgetMode?: GoalBudgetMode;
  maxRetries?: number;
  maxLoopAttempts?: number;
  maxConcurrentLoops?: number;
  maxFinancialCost?: number;
  maxTokens?: number;
  loopAttemptsBudgetMode?: GoalBudgetMode;
  dimensions?: Partial<Record<GoalPolicyDimension, GoalPolicyDimensionOverride>>;
  agentMutationConfirmation?: 'required' | 'allowed';
}

export interface GoalElement {
  id: string;
  type: GoalElementType;
  title: string;
  body?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  status?: 'draft' | 'working' | 'blocked' | 'complete' | 'evidence-required' | 'approval-required' | 'permission-denied' | 'human-review';
  readiness?: GoalElementReadiness;
  readinessReason?: string;
  assigneeId?: string;
  sourceId?: string;
  targetId?: string;
  sourceSide?: GoalConnectorSide;
  targetSide?: GoalConnectorSide;
  conditionBranch?: GoalConditionBranch;
  conditionPositiveLabel?: string;
  conditionNegativeLabel?: string;
  conditionPositiveOutcome?: string;
  conditionNegativeOutcome?: string;
  /** Legacy aliases retained for older persisted condition records. */
  conditionTrueLabel?: string;
  conditionFalseLabel?: string;
  handoffRequired?: boolean;
  handoffNotes?: string;
  approvalEvidenceRequired?: boolean;
  policy?: GoalPolicy;
}

export interface GoalRecord {
  id: string;
  title: string;
  color?: string;
  updatedAt: string;
  elements: GoalElement[];
  overseerAgentId?: string;
  policy?: GoalPolicy;
}

export type Swimlane = StatusColumn;

export interface TimelineSwimlane {
  id: string;
  name: string;
  description?: string;
  subtitle?: string;
  color?: string;
}

export interface StorageMeter {
  usedBytes: number;
  totalBytes: number;
  usagePercent: number;
  sourceLabel: string;
}
