const test = require('node:test');
const assert = require('node:assert/strict');
const { OCCURRENCES_KEY, isDue, runDueSchedules } = require('./goal-schedule-service.cjs');

function makeStore(values) {
  return {
    get(key) { return values[key]; },
    set(key, value) { values[key] = value; },
  };
}

test('scheduler detects one-time and recurring occurrences in the captured timezone', () => {
  const now = new Date('2026-07-20T07:30:00.000Z');
  assert.equal(isDue({ enabled: true, timezone: 'Europe/Bucharest', rule: { mode: 'one-time', date: '2026-07-20', time: '10:00' } }, now), true);
  assert.equal(isDue({ enabled: true, timezone: 'Europe/Bucharest', rule: { mode: 'recurring', frequency: 'weekly', dayOfWeek: 1, time: '10:00' } }, now), true);
  assert.equal(isDue({ enabled: true, timezone: 'Europe/Bucharest', rule: { mode: 'recurring', frequency: 'monthly', dayOfMonth: 19, time: '10:00' } }, now), false);
});

test('scheduler uses the captured timezone across a DST transition', () => {
  const duringNewYorkDaylightTime = new Date('2026-03-08T14:30:00.000Z');
  assert.equal(isDue({ enabled: true, timezone: 'America/New_York', rule: { mode: 'recurring', frequency: 'weekly', dayOfWeek: 0, time: '10:00' } }, duringNewYorkDaylightTime), true);
});

test('scheduler creates an immutable anchored occurrence and invokes lifecycle once', () => {
  const values = {
    'omvra.goalSchedules.v1': [{ id: 'schedule-1', goalId: 'goal-1', enabled: true, timezone: 'UTC', temporalMode: 'anchored', rule: { mode: 'one-time', date: '2026-07-20', time: '07:30' } }],
    'omvra.goalScheduleOccurrences.v1': [],
  };
  const calls = [];
  const result = runDueSchedules({
    store: makeStore(values),
    lifecycle: { execute(input) { calls.push(input); return { ok: true, execution: { id: 'execution-1' } }; } },
    now: new Date('2026-07-20T07:31:00.000Z'),
  });
  assert.equal(result.occurrences[0].state, 'started');
  assert.equal(result.occurrences[0].temporalMode, 'anchored');
  assert.equal(calls[0].command, 'start');
  assert.equal(calls[0].payload.scheduledFor, '2026-07-20T07:30@UTC');
  assert.equal(values[OCCURRENCES_KEY].length, 1);

  const duplicate = runDueSchedules({ store: makeStore(values), lifecycle: { execute() { throw new Error('should not execute twice'); } }, now: new Date('2026-07-20T07:31:00.000Z') });
  assert.equal(duplicate.occurrences.length, 0);
});

test('blocked schedule occurrences are recorded without failing the schedule loop', () => {
  const values = {
    'omvra.goalSchedules.v1': [{ id: 'schedule-1', goalId: 'missing-goal', enabled: true, timezone: 'UTC', rule: { mode: 'one-time', date: '2026-07-20', time: '07:30' } }],
    'omvra.goalScheduleOccurrences.v1': [],
  };
  const result = runDueSchedules({ store: makeStore(values), lifecycle: { execute() { return { ok: false, error: 'GOAL_NOT_FOUND' }; } }, now: new Date('2026-07-20T07:31:00.000Z') });
  assert.equal(result.occurrences[0].state, 'blocked');
  assert.equal(result.occurrences[0].error, 'GOAL_NOT_FOUND');
});
