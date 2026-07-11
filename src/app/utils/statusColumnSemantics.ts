import type { AgentWatchAction, LoadClassification, RoadmapStage, StatusColumn, Task } from '../types.ts';

export const DEFAULT_AI_ACTION: AgentWatchAction = 'inspect_and_work';

export function getDefaultColumnSemantics(id: string): Pick<StatusColumn, 'loadClassification' | 'roadmapStage' | 'aiWatchEnabled' | 'aiAction'> {
  switch (id) {
    case 'open':
      return { loadClassification: 'open-tasks', roadmapStage: 'not-started', aiWatchEnabled: false, aiAction: DEFAULT_AI_ACTION };
    case 'in-progress':
      return { loadClassification: 'in-progress', roadmapStage: 'in-progress', aiWatchEnabled: false, aiAction: DEFAULT_AI_ACTION };
    case 'under-review':
      return { loadClassification: 'in-review', roadmapStage: 'in-review', aiWatchEnabled: false, aiAction: DEFAULT_AI_ACTION };
    case 'done':
      return { loadClassification: 'none', roadmapStage: 'complete', aiWatchEnabled: false, aiAction: 'inspect_only' };
    default:
      return { loadClassification: 'none', roadmapStage: 'excluded', aiWatchEnabled: false, aiAction: DEFAULT_AI_ACTION };
  }
}

export function getStatusIdsForLoad(columns: StatusColumn[], classification: LoadClassification): string[] {
  return columns.filter(column => (column.loadClassification ?? getDefaultColumnSemantics(column.id).loadClassification) === classification).map(column => column.id);
}

export function getRoadmapStage(columns: StatusColumn[], statusId: string): RoadmapStage {
  return columns.find(column => column.id === statusId)?.roadmapStage ?? getDefaultColumnSemantics(statusId).roadmapStage;
}

export function filterTimelineTasks(tasks: Task[], columns: StatusColumn[], showCompleted: boolean): Task[] {
  return showCompleted
    ? tasks
    : tasks.filter(task => getRoadmapStage(columns, task.status) !== 'complete');
}

export function getRoadmapStageProgress(stage: RoadmapStage): number {
  if (stage === 'complete') return 100;
  if (stage === 'in-review') return 80;
  if (stage === 'in-progress') return 50;
  return 0;
}

export const LOAD_CLASSIFICATIONS: Array<{ value: LoadClassification; label: string }> = [
  { value: 'open-tasks', label: 'Open tasks' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'in-review', label: 'In review' },
  { value: 'none', label: 'No load' },
];

export const ROADMAP_STAGES: Array<{ value: RoadmapStage; label: string }> = [
  { value: 'not-started', label: 'Not started' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'in-review', label: 'In review' },
  { value: 'complete', label: 'Complete' },
  { value: 'excluded', label: 'Excluded' },
];

export const AI_ACTIONS: Array<{ value: AgentWatchAction; label: string }> = [
  { value: 'inspect_only', label: 'Inspect only' },
  { value: 'inspect_and_work', label: 'Inspect and work' },
  { value: 'move_to_ready_for_human_review', label: 'Move to human review' },
];
