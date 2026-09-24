import assert from 'node:assert/strict';
import test from 'node:test';
import { hasScheduledDateRange, normalizeTaskDateRangeForSave, updateTimelineDateRangeByKeyboard } from './date.ts';

test('keyboard Timeline dates move and resize by visible days without losing the authored duration', () => {
  assert.deepEqual(
    updateTimelineDateRangeByKeyboard('2026-09-04', '2026-09-07', 'move', 1, false),
    { startDate: '2026-09-07', endDate: '2026-09-10' },
  );
  assert.deepEqual(
    updateTimelineDateRangeByKeyboard('2026-09-07', '2026-09-09', 'resize-start', -1, false),
    { startDate: '2026-09-04', endDate: '2026-09-09' },
  );
  assert.deepEqual(
    updateTimelineDateRangeByKeyboard('2026-09-07', '2026-09-09', 'resize-end', 1, false),
    { startDate: '2026-09-07', endDate: '2026-09-10' },
  );
  assert.equal(
    updateTimelineDateRangeByKeyboard('2026-09-07', '2026-09-07', 'resize-start', 1, true),
    null,
  );
});

test('task dates are scheduled only with a valid start and a non-inverted end', () => {
  assert.equal(hasScheduledDateRange({ startDate: '2026-09-24', endDate: '2026-09-29' }), true);
  assert.equal(hasScheduledDateRange({ startDate: '2026-09-24' }), true);
  assert.equal(hasScheduledDateRange({}), false);
  assert.equal(hasScheduledDateRange({ startDate: '', endDate: '' }), false);
  assert.equal(hasScheduledDateRange({ endDate: '2026-09-24' }), false);
  assert.equal(hasScheduledDateRange({ startDate: '2026-09-29', endDate: '2026-09-24' }), false);
  assert.equal(hasScheduledDateRange({ startDate: '2026-02-30', endDate: '2026-03-01' }), false);
});

test('task editor dates persist cleared ranges as unscheduled instead of defaulting to today', () => {
  assert.deepEqual(normalizeTaskDateRangeForSave('', ''), { startDate: undefined, endDate: undefined });
  assert.deepEqual(normalizeTaskDateRangeForSave('2026-09-24', ''), { startDate: '2026-09-24', endDate: '2026-09-24' });
  assert.deepEqual(normalizeTaskDateRangeForSave('', '2026-09-29'), { startDate: '2026-09-29', endDate: '2026-09-29' });
  assert.deepEqual(normalizeTaskDateRangeForSave('2026-09-24', '2026-09-29'), { startDate: '2026-09-24', endDate: '2026-09-29' });
});
