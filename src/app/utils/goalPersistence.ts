import type { GoalRecord } from '../types.ts';
import { safeReadJSON } from './storage.ts';

export function goalRevision(goal: GoalRecord): number {
  const revision = Number((goal as GoalRecord & { revision?: number; __mcpRevision?: number }).revision ?? (goal as GoalRecord & { __mcpRevision?: number }).__mcpRevision ?? 0);
  return Number.isFinite(revision) ? Math.max(0, Math.floor(revision)) : 0;
}

export function readGoals(storageKey: string, excludedGoalId?: string): GoalRecord[] {
  const stored = safeReadJSON<GoalRecord[]>(storageKey, []);
  if (!Array.isArray(stored)) return [];
  return excludedGoalId ? stored.filter(goal => goal.id !== excludedGoalId) : stored;
}
