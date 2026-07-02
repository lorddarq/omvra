import type { ProjectMilestone, Task } from '../types.ts';

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
