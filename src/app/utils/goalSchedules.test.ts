import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGoalSchedule, normalizeGoalSchedules, scheduleStatus } from './goalSchedules.ts';

test('goal schedules normalize one-time and recurring rules without losing the captured timezone', () => {
  const schedules = normalizeGoalSchedules([
    { id: 'one', goalId: 'goal-1', rule: { mode: 'one-time', date: '2026-07-20', time: '08:30' }, timezone: 'Europe/Bucharest' },
    { id: 'weekly', goalId: 'goal-1', rule: { mode: 'recurring', frequency: 'weekly', dayOfWeek: 4, time: '17:45' }, timezone: 'America/New_York', temporalMode: 'latest' },
    { id: 'invalid' },
  ]);

  assert.equal(schedules.length, 2);
  assert.equal(schedules[0].timezone, 'Europe/Bucharest');
  assert.equal(schedules[0].rule.mode, 'one-time');
  assert.equal(schedules[1].rule.frequency, 'weekly');
  assert.equal(schedules[1].rule.dayOfWeek, 4);
  assert.equal(schedules[1].temporalMode, 'latest');
});

test('schedule status respects disabled and expired boundaries', () => {
  const base = { id: 'schedule-1', goalId: 'goal-1', rule: { mode: 'one-time' as const, date: '2026-07-20', time: '09:00' }, timezone: 'UTC', updatedAt: new Date(0).toISOString() };
  assert.equal(scheduleStatus({ ...base, enabled: false }), 'disabled');
  assert.equal(scheduleStatus({ ...base, enabled: true, endsAt: '2026-07-19T00:00:00.000Z' }, new Date('2026-07-20T00:00:00.000Z')), 'expired');
  assert.equal(scheduleStatus({ ...base, enabled: true }, new Date('2026-07-20T00:00:00.000Z')), 'scheduled');
});

test('incomplete schedules fail closed instead of becoming runnable records', () => {
  assert.equal(normalizeGoalSchedule({ id: 'missing-goal' }), null);
  const normalized = normalizeGoalSchedule({ id: 'schedule-2', goalId: 'goal-2', rule: { mode: 'recurring', frequency: 'monthly', dayOfMonth: 99, time: 'invalid' }, timezone: '' });
  assert.equal(normalized?.rule.dayOfMonth, 1);
  assert.equal(normalized?.rule.time, '09:00');
  assert.equal(normalized?.timezone, 'UTC');
});
