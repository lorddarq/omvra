import type { Task } from '../types.ts';
import { getTaskProjectIds } from './roadmap.ts';

export const getTimelineTaskProjectIds = getTaskProjectIds;

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
