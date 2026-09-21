import type { ProjectMilestone, Task } from '../types.ts';
import { getRequiredArchivedDependencyIds, getBlockedArchiveTaskIds, isArchived } from '../utils/archiving.ts';

export interface ArchiveMutationResult {
  tasks: Task[];
  blockedTaskIds: string[];
}

export function archiveTaskRecords(
  tasks: Task[],
  taskIds: string[],
  archivedAt: string
): ArchiveMutationResult {
  const requestedIds = new Set(taskIds);
  const blocked = getBlockedArchiveTaskIds(tasks, requestedIds);
  const blockedTaskIds = tasks.filter(task => blocked.has(task.id)).map(task => task.id);

  return {
    tasks: tasks.map(task => (
      requestedIds.has(task.id) && !isArchived(task) && !blocked.has(task.id)
        ? { ...task, archived: true, archivedAt }
        : task
    )),
    blockedTaskIds,
  };
}

export function archiveMilestoneRecords(
  milestones: ProjectMilestone[],
  milestoneIds: string[],
  archivedAt: string
): ProjectMilestone[] {
  const selected = new Set(milestoneIds);
  return milestones.map(milestone => selected.has(milestone.id) && !isArchived(milestone)
    ? { ...milestone, archived: true, archivedAt }
    : milestone);
}

export function restoreTaskRecords(tasks: Task[], taskIds: string[]): Task[] {
  const tasksById = new Map(tasks.map(task => [task.id, task]));
  const restoreIds = new Set(taskIds);
  taskIds.forEach(taskId => {
    const task = tasksById.get(taskId);
    if (!task) return;
    getRequiredArchivedDependencyIds(task, tasksById).forEach(dependencyId => restoreIds.add(dependencyId));
  });

  return tasks.map(task => restoreIds.has(task.id)
    ? { ...task, archived: false, archivedAt: undefined }
    : task);
}

export function restoreMilestoneRecords(
  tasks: Task[],
  milestones: ProjectMilestone[],
  milestoneIds: string[]
): { tasks: Task[]; milestones: ProjectMilestone[] } {
  const selected = new Set(milestoneIds);
  const taskIds = milestones
    .filter(milestone => selected.has(milestone.id))
    .flatMap(milestone => milestone.linkedTaskIds || []);
  return {
    tasks: restoreTaskRecords(tasks, taskIds),
    milestones: milestones.map(milestone => selected.has(milestone.id)
      ? { ...milestone, archived: false, archivedAt: undefined }
      : milestone),
  };
}

export function syncMilestoneTaskLinks(tasks: Task[], milestone: ProjectMilestone): Task[] {
  const linkedTaskIds = new Set(milestone.linkedTaskIds || []);
  return tasks.map(task => {
    if (linkedTaskIds.has(task.id)) {
      return { ...task, milestoneId: milestone.id };
    }
    if (task.milestoneId === milestone.id) {
      return { ...task, milestoneId: undefined, dependencyIds: [] };
    }
    return task;
  });
}

export function linkTaskToMilestones(
  milestones: ProjectMilestone[],
  taskId: string,
  nextMilestoneId?: string
): ProjectMilestone[] {
  return milestones.map(milestone => {
    const linkedTaskIds = milestone.linkedTaskIds || [];
    const shouldLink = milestone.id === nextMilestoneId;
    const isLinked = linkedTaskIds.includes(taskId);

    if (shouldLink && !isLinked) {
      return { ...milestone, linkedTaskIds: [...linkedTaskIds, taskId] };
    }
    if (!shouldLink && isLinked) {
      return { ...milestone, linkedTaskIds: linkedTaskIds.filter(id => id !== taskId) };
    }
    return milestone;
  });
}

export function removeTaskFromMilestones(milestones: ProjectMilestone[], taskId: string): ProjectMilestone[] {
  return milestones.map(milestone => ({
    ...milestone,
    linkedTaskIds: (milestone.linkedTaskIds || []).filter(id => id !== taskId),
  }));
}

export function saveMilestoneRecord(
  milestones: ProjectMilestone[],
  milestone: ProjectMilestone
): ProjectMilestone[] {
  const exists = milestones.some(item => item.id === milestone.id);
  return exists
    ? milestones.map(item => (item.id === milestone.id ? milestone : item))
    : [milestone, ...milestones];
}

export function updateRoadmapTaskDependencies(
  tasks: Task[],
  updates: Array<{ taskId: string; dependencyIds: string[] }>
): Task[] {
  const updatesByTaskId = new Map(updates.map(update => [update.taskId, update.dependencyIds]));
  return tasks.map(task => {
    const dependencyIds = updatesByTaskId.get(task.id);
    if (!dependencyIds) return task;
    return { ...task, dependencyIds };
  });
}

export function deleteMilestoneFromWorkspace(
  tasks: Task[],
  milestones: ProjectMilestone[],
  milestoneId: string
): {
  tasks: Task[];
  milestones: ProjectMilestone[];
} {
  const milestone = milestones.find(item => item.id === milestoneId);
  const milestoneTaskIds = new Set(milestone?.linkedTaskIds || []);

  return {
    milestones: milestones.filter(candidate => candidate.id !== milestoneId),
    tasks: tasks.map(task => {
      const shouldClearMilestone = task.milestoneId === milestoneId;
      const shouldClearDependencies = milestoneTaskIds.has(task.id);

      return {
        ...task,
        milestoneId: shouldClearMilestone ? undefined : task.milestoneId,
        dependencyIds: shouldClearDependencies ? [] : task.dependencyIds,
      };
    }),
  };
}
