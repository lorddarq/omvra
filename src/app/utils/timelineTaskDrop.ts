import type { Task } from '../types.ts';

export function getTimelineTaskProjectIds(task: Task): string[] {
  if (Array.isArray(task.projectIds) && task.projectIds.length > 0) {
    return task.projectIds;
  }

  return task.swimlaneId ? [task.swimlaneId] : [];
}

export function canDropTimelineTaskInRow(
  task: Task,
  swimlaneId: string,
  mode: 'projects' | 'people'
): boolean {
  if (mode === 'people') {
    return true;
  }

  return getTimelineTaskProjectIds(task).includes(swimlaneId);
}

export function applyTimelineTaskDrop(
  task: Task,
  swimlaneId: string,
  mode: 'projects' | 'people',
  newStartDate?: string,
  newEndDate?: string
): Task {
  if (!canDropTimelineTaskInRow(task, swimlaneId, mode)) {
    return task;
  }

  const updatedTask: Task = { ...task };

  if (mode === 'people') {
    updatedTask.assigneeId = swimlaneId;
  } else {
    updatedTask.swimlaneId = swimlaneId;
  }

  if (newStartDate) {
    updatedTask.startDate = newStartDate;
  }

  if (newEndDate) {
    updatedTask.endDate = newEndDate;
  }

  return updatedTask;
}
