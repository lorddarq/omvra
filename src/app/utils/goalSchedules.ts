import type { GoalSchedule, GoalScheduleRule } from '../types.ts';

export const GOAL_SCHEDULES_STORAGE_KEY = 'omvra.goalSchedules.v1';

function validTime(value: unknown): string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '09:00';
}

export function normalizeGoalSchedule(value: unknown): GoalSchedule | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<GoalSchedule>;
  if (typeof candidate.id !== 'string' || !candidate.id || typeof candidate.goalId !== 'string' || !candidate.goalId) return null;
  const inputRule = candidate.rule && typeof candidate.rule === 'object' ? candidate.rule as Partial<GoalScheduleRule> : {};
  const mode = inputRule.mode === 'recurring' ? 'recurring' : 'one-time';
  const frequency = inputRule.frequency === 'monthly' ? 'monthly' : 'weekly';
  const dayOfWeek = Number.isInteger(inputRule.dayOfWeek) && inputRule.dayOfWeek >= 0 && inputRule.dayOfWeek <= 6 ? inputRule.dayOfWeek : 1;
  const dayOfMonth = Number.isInteger(inputRule.dayOfMonth) && inputRule.dayOfMonth >= 1 && inputRule.dayOfMonth <= 31 ? inputRule.dayOfMonth : 1;
  return {
    id: candidate.id,
    goalId: candidate.goalId,
    enabled: candidate.enabled !== false,
    rule: {
      mode,
      frequency: mode === 'recurring' ? frequency : undefined,
      time: validTime(inputRule.time),
      date: mode === 'one-time' && typeof inputRule.date === 'string' ? inputRule.date : undefined,
      dayOfWeek: mode === 'recurring' && frequency === 'weekly' ? dayOfWeek : undefined,
      dayOfMonth: mode === 'recurring' && frequency === 'monthly' ? dayOfMonth : undefined,
    },
    timezone: typeof candidate.timezone === 'string' && candidate.timezone ? candidate.timezone : 'UTC',
    startsAt: typeof candidate.startsAt === 'string' && candidate.startsAt ? candidate.startsAt : undefined,
    endsAt: typeof candidate.endsAt === 'string' && candidate.endsAt ? candidate.endsAt : undefined,
    temporalMode: candidate.temporalMode === 'latest' ? 'latest' : 'anchored',
    updatedAt: typeof candidate.updatedAt === 'string' && candidate.updatedAt ? candidate.updatedAt : new Date(0).toISOString(),
  };
}

export function normalizeGoalSchedules(value: unknown): GoalSchedule[] {
  return Array.isArray(value) ? value.map(normalizeGoalSchedule).filter((schedule): schedule is GoalSchedule => Boolean(schedule)) : [];
}

export function scheduleStatus(schedule: GoalSchedule, now = new Date()): 'disabled' | 'expired' | 'scheduled' {
  if (!schedule.enabled) return 'disabled';
  if (schedule.endsAt && new Date(schedule.endsAt).getTime() < now.getTime()) return 'expired';
  return 'scheduled';
}
