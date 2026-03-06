import { Task } from '../types';

const SIZE_WEIGHTS: Record<string, number> = { xs: 1, s: 2, m: 3, l: 5 };
const STATE_WEIGHTS: Record<string, number> = {
  open: 0.4,
  'in-progress': 1.0,
  'under-review': 0.7,
  done: 0.2,
  blocked: 1.4,
};
const COMPLEXITY_WEIGHTS: Record<string, number> = {
  routine: 1.0,
  medium: 1.2,
  hard: 1.5,
};
const BLOCKED_MULTIPLIER = 1.3;
export const PERSON_CAPACITY_POINTS = 12;

export function getTaskLoadPoints(task: Task): number {
  const sizeWeight = SIZE_WEIGHTS[task.size || 'm'] || 3;
  const stateWeight = STATE_WEIGHTS[task.status] || 1.0;
  const complexityWeight = COMPLEXITY_WEIGHTS[task.complexity || 'medium'] || 1.2;
  const blockedWeight = task.blocked ? BLOCKED_MULTIPLIER : 1.0;
  return sizeWeight * stateWeight * complexityWeight * blockedWeight;
}

export function getTaskLoadContributionPercent(task: Task): number {
  return Math.round((getTaskLoadPoints(task) / PERSON_CAPACITY_POINTS) * 100);
}
