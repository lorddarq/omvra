import { ProjectMilestone, Task, TaskStatus } from '../types';
import { parseISODateLocal } from './date';

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

const EMPTY_COUNTS: MilestoneStatusCounts = {
  open: 0,
  'in-progress': 0,
  'under-review': 0,
  done: 0,
};

export function getMilestoneProjectIds(milestone: ProjectMilestone): string[] {
  if (Array.isArray(milestone.projectIds) && milestone.projectIds.length > 0) {
    return milestone.projectIds;
  }
  return milestone.projectId ? [milestone.projectId] : [];
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
