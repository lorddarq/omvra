const { randomUUID } = require('crypto');

const SCHEDULES_KEY = 'omvra.goalSchedules.v1';
const OCCURRENCES_KEY = 'omvra.goalScheduleOccurrences.v1';

function readArray(store, key) {
  const value = store.get(key);
  return Array.isArray(value) ? value : [];
}

function localParts(now, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'UTC',
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`).getUTCDay(),
  };
}

function occurrenceStamp(schedule, now) {
  const local = localParts(now, schedule.timezone);
  return `${local.date}T${schedule.rule?.time || '09:00'}@${schedule.timezone || 'UTC'}`;
}

function isDue(schedule, now) {
  if (!schedule || schedule.enabled === false || !schedule.rule) return false;
  const local = localParts(now, schedule.timezone);
  if (schedule.endsAt && local.date > String(schedule.endsAt).slice(0, 10)) return false;
  if (schedule.startsAt && local.date < String(schedule.startsAt).slice(0, 10)) return false;
  if (local.time < schedule.rule.time) return false;
  if (schedule.rule.mode === 'one-time') return local.date === schedule.rule.date;
  if (schedule.rule.frequency === 'monthly') return Number(local.date.slice(8, 10)) === Number(schedule.rule.dayOfMonth);
  return local.weekday === Number(schedule.rule.dayOfWeek);
}

function runDueSchedules({ store, lifecycle, now = new Date(), actor = 'goal-scheduler' } = {}) {
  if (!store || !lifecycle || typeof lifecycle.execute !== 'function') throw new Error('store and lifecycle are required');
  const schedules = readArray(store, SCHEDULES_KEY);
  const occurrences = readArray(store, OCCURRENCES_KEY);
  const nextOccurrences = [...occurrences];
  const results = [];

  for (const schedule of schedules) {
    if (!isDue(schedule, now)) continue;
    const scheduledFor = occurrenceStamp(schedule, now);
    const existing = nextOccurrences.find(item => item.scheduleId === schedule.id && item.scheduledFor === scheduledFor);
    if (existing) continue;

    const occurrence = {
      id: `occurrence_${randomUUID()}`,
      scheduleId: schedule.id,
      goalId: schedule.goalId,
      scheduledFor,
      temporalMode: schedule.temporalMode === 'latest' ? 'latest' : 'anchored',
      state: 'pending',
      createdAt: now.toISOString(),
    };
    nextOccurrences.push(occurrence);
    const result = lifecycle.execute({
      goalId: schedule.goalId,
      command: 'start',
      expectedRevision: 0,
      commandId: `schedule:${schedule.id}:${scheduledFor}`,
      actor,
      payload: { scheduledFor, temporalMode: occurrence.temporalMode, scheduleId: schedule.id, occurrenceId: occurrence.id },
    });
    const index = nextOccurrences.length - 1;
    if (result?.ok) {
      nextOccurrences[index] = { ...occurrence, state: 'started', executionId: result.execution?.id, startedAt: now.toISOString() };
    } else {
      nextOccurrences[index] = { ...occurrence, state: 'blocked', error: result?.error || 'SCHEDULE_START_FAILED', message: result?.message, blockedAt: now.toISOString() };
    }
    results.push(nextOccurrences[index]);
  }

  if (results.length) store.set(OCCURRENCES_KEY, nextOccurrences);
  return { ok: true, occurrences: results, allOccurrences: nextOccurrences };
}

module.exports = { SCHEDULES_KEY, OCCURRENCES_KEY, localParts, isDue, runDueSchedules };
