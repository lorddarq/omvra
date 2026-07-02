import { getReadableTextClassFor } from '../utils/contrast.ts';
import { parseISODateLocal } from '../utils/date.ts';
import type { ProjectMilestone, StatusColumn, Task, TaskStatus } from '../types.ts';

export type MilestoneHealth = 'complete' | 'at-risk' | 'in-progress' | 'planned' | 'empty';

export type MilestoneStatusCounts = Record<TaskStatus, number>;

export interface RoadmapMilestoneSummary {
  linkedTasks: Task[];
  lateTasks: Task[];
  counts: MilestoneStatusCounts;
  totalTasks: number;
  completedTasks: number;
  completionPercent: number;
  health: MilestoneHealth;
}

export interface StatusVisual {
  id: string;
  label: string;
  color: string;
  backgroundClassName?: string;
  backgroundStyle?: { backgroundColor: string };
  textClassName: string;
  progressPercent: number;
}

export interface MilestoneHealthVisual {
  label: string;
  className: string;
}

const EMPTY_COUNTS: MilestoneStatusCounts = {
  open: 0,
  'in-progress': 0,
  'under-review': 0,
  done: 0,
};

const STATUS_PROGRESS: Record<TaskStatus, number> = {
  open: 15,
  'in-progress': 45,
  'under-review': 80,
  done: 100,
};

const STATUS_FALLBACK_COLORS: Record<TaskStatus, string> = {
  open: '#d1d5db',
  'in-progress': '#3b82f6',
  'under-review': '#f59e0b',
  done: '#10b981',
};

const STATUS_COLOR_CLASS_TO_HEX: Record<string, string> = {
  'bg-cyan-500': '#06b6d4',
  'bg-blue-500': '#3b82f6',
  'bg-amber-500': '#f59e0b',
  'bg-orange-500': '#f97316',
  'bg-red-500': '#ef4444',
  'bg-emerald-500': '#10b981',
  'bg-green-500': '#22c55e',
  'bg-pink-500': '#ec4899',
  'bg-purple-500': '#a855f7',
  'bg-zinc-500': '#71717a',
  'bg-gray-500': '#6b7280',
  'bg-gray-300': '#d1d5db',
};

export const MILESTONE_HEALTH_VISUALS: Record<MilestoneHealth, MilestoneHealthVisual> = {
  complete: {
    label: 'Complete',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  'at-risk': {
    label: 'At risk',
    className: 'border-red-200 bg-red-50 text-red-700',
  },
  'in-progress': {
    label: 'In progress',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  planned: {
    label: 'Planned',
    className: 'border-gray-200 bg-gray-50 text-gray-700',
  },
  empty: {
    label: 'No tasks',
    className: 'border-gray-200 bg-white text-gray-500',
  },
};

function isCssColor(value: string): boolean {
  return value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl');
}

function resolveStatusColumn(statusColumns: Array<Pick<StatusColumn, 'id' | 'title' | 'color'>>, status: string) {
  return statusColumns.find(column => column.id === status);
}

export function getStatusLabel(
  statusColumns: Array<Pick<StatusColumn, 'id' | 'title' | 'color'>>,
  status: string
): string {
  return resolveStatusColumn(statusColumns, status)?.title || status;
}

export function resolveStatusColor(status?: string, explicitColor?: string): string {
  if (explicitColor && isCssColor(explicitColor)) {
    return explicitColor;
  }

  if (explicitColor) {
    const mappedColor = STATUS_COLOR_CLASS_TO_HEX[explicitColor];
    if (mappedColor) return mappedColor;
  }

  switch ((status || '').toLowerCase()) {
    case 'open':
      return STATUS_FALLBACK_COLORS.open;
    case 'in-progress':
      return STATUS_FALLBACK_COLORS['in-progress'];
    case 'under-review':
      return STATUS_FALLBACK_COLORS['under-review'];
    case 'done':
      return STATUS_FALLBACK_COLORS.done;
    default:
      break;
  }

  const normalizedStatus = (status || '').toLowerCase();
  if (normalizedStatus.includes('bug')) return '#da0004';
  if (normalizedStatus.includes('done') || normalizedStatus.includes('complete')) return '#69b86d';
  if (normalizedStatus.includes('review')) return '#d1923a';
  if (normalizedStatus.includes('progress')) return '#1a60cb';
  return '#71717a';
}

export function getTaskProgress(status: TaskStatus): number {
  return STATUS_PROGRESS[status] ?? STATUS_PROGRESS.open;
}

export function getStatusVisual(
  statusColumns: Array<Pick<StatusColumn, 'id' | 'title' | 'color'>>,
  status: TaskStatus
): StatusVisual {
  const column = resolveStatusColumn(statusColumns, status);
  const color = resolveStatusColor(status, column?.color);
  const backgroundClassName = column?.color && !isCssColor(column.color) ? column.color : undefined;

  return {
    id: status,
    label: getStatusLabel(statusColumns, status),
    color,
    backgroundClassName,
    backgroundStyle: backgroundClassName ? undefined : { backgroundColor: color },
    textClassName: getReadableTextClassFor(backgroundClassName || `status-visual-${status}-${color}`, color),
    progressPercent: getTaskProgress(status),
  };
}

export function getMilestoneHealthVisual(health: MilestoneHealth): MilestoneHealthVisual {
  return MILESTONE_HEALTH_VISUALS[health];
}

export function getMilestoneProjectIds(milestone: ProjectMilestone): string[] {
  if (Array.isArray(milestone.projectIds) && milestone.projectIds.length > 0) {
    return milestone.projectIds;
  }
  return milestone.projectId ? [milestone.projectId] : [];
}

export function getTaskProjectIds(task: Task): string[] {
  if (Array.isArray(task.projectIds) && task.projectIds.length > 0) {
    return task.projectIds;
  }
  return task.swimlaneId ? [task.swimlaneId] : [];
}

export function getTasksForMilestone(milestone: ProjectMilestone, tasks: Task[]): Task[] {
  const linkedTaskIds = new Set(milestone.linkedTaskIds || []);
  return tasks.filter(task => task.milestoneId === milestone.id || linkedTaskIds.has(task.id));
}

export function getMilestoneForTask(task: Task | null | undefined, milestones: ProjectMilestone[]): ProjectMilestone | undefined {
  if (!task) return undefined;
  if (task.milestoneId) {
    const directMilestone = milestones.find(milestone => milestone.id === task.milestoneId);
    if (directMilestone) return directMilestone;
  }
  return milestones.find(milestone => (milestone.linkedTaskIds || []).includes(task.id));
}

export function isTaskLateForMilestone(task: Task, milestone: ProjectMilestone): boolean {
  if (!task.endDate || !milestone.endDate) return false;
  const taskEnd = parseISODateLocal(task.endDate);
  const milestoneEnd = parseISODateLocal(milestone.endDate);
  if (!taskEnd || !milestoneEnd) return false;
  return taskEnd.getTime() > milestoneEnd.getTime();
}

export function summarizeMilestone(milestone: ProjectMilestone, tasks: Task[]): RoadmapMilestoneSummary {
  const linkedTasks = getTasksForMilestone(milestone, tasks);
  const counts = linkedTasks.reduce<MilestoneStatusCounts>((nextCounts, task) => {
    nextCounts[task.status] = (nextCounts[task.status] || 0) + 1;
    return nextCounts;
  }, { ...EMPTY_COUNTS });
  const lateTasks = linkedTasks.filter(task => isTaskLateForMilestone(task, milestone));
  const totalTasks = linkedTasks.length;
  const completedTasks = counts.done;
  const completionPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  let health: MilestoneHealth = 'empty';
  if (totalTasks > 0 && lateTasks.length > 0) {
    health = 'at-risk';
  } else if (totalTasks > 0 && completedTasks === totalTasks) {
    health = 'complete';
  } else if (counts['in-progress'] > 0 || counts['under-review'] > 0) {
    health = 'in-progress';
  } else if (totalTasks > 0) {
    health = 'planned';
  }

  return {
    linkedTasks,
    lateTasks,
    counts,
    totalTasks,
    completedTasks,
    completionPercent,
    health,
  };
}

export function getMilestoneDateRangeLabel(milestone: ProjectMilestone): string {
  if (milestone.startDate && milestone.startDate !== milestone.endDate) {
    return `${milestone.startDate} to ${milestone.endDate}`;
  }
  return milestone.endDate;
}

export function wouldCreateDependencyCycle(
  taskId: string,
  dependencyId: string,
  getDependencyIds: (currentTaskId: string) => string[] | undefined
): boolean {
  if (taskId === dependencyId) return true;

  const visited = new Set<string>();
  const visit = (currentTaskId: string): boolean => {
    if (currentTaskId === taskId) return true;
    if (visited.has(currentTaskId)) return false;
    visited.add(currentTaskId);
    return (getDependencyIds(currentTaskId) || []).some(visit);
  };

  return visit(dependencyId);
}

export function assertNoDependencyCycle(
  taskId: string,
  dependencyIds: string[],
  getDependencyIds: (currentTaskId: string) => string[] | undefined
): boolean {
  return dependencyIds.every(dependencyId => !wouldCreateDependencyCycle(taskId, dependencyId, getDependencyIds));
}
