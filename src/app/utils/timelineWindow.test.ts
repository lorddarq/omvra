import assert from 'node:assert/strict';
import test from 'node:test';
import type { Task } from '../types.ts';
import {
  createInitialTimelineWindow,
  extendTimelineWindow,
  getTimelineWindowAddedDayCount,
  getTimelineWindowDates,
} from './timelineWindow.ts';

test('timeline window is stable after creation and includes the planning horizon', () => {
  const referenceDate = new Date(2026, 6, 10);
  const window = createInitialTimelineWindow([
    { id: 'past-task', title: 'Historical work', status: 'open', startDate: '2024-02-10', endDate: '2024-02-12' } as Task,
  ], referenceDate);

  assert.deepEqual(window.startDate, new Date(2024, 1, 1));
  assert.deepEqual(window.endDate, new Date(2027, 5, 30));
  assert.equal(getTimelineWindowDates(window, false).some(date => date.getDay() === 0), false);
});

test('timeline window extension prepends and appends whole months', () => {
  const window = { startDate: new Date(2026, 6, 1), endDate: new Date(2026, 7, 31) };

  assert.deepEqual(extendTimelineWindow(window, 'past'), {
    startDate: new Date(2026, 3, 1),
    endDate: new Date(2026, 7, 31),
  });
  assert.deepEqual(extendTimelineWindow(window, 'future'), {
    startDate: new Date(2026, 6, 1),
    endDate: new Date(2026, 10, 30),
  });
  assert.equal(getTimelineWindowAddedDayCount(window, 'past', true), 91);
});
