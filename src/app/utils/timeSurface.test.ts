import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addCalendarDays,
  buildDateRangeFromDates,
  buildDateSequence,
  daysBetweenLocal,
  findNearestVisibleDateIndex,
  getCenteredScrollLeftForMarker,
  getFixedDaySurfaceMarker,
  getMonthKey,
  getVariableDaySurfaceMarker,
  startOfLocalDay,
} from './timeSurface.ts';

test('buildDateRangeFromDates includes today and applies padding', () => {
  const result = buildDateRangeFromDates(
    [
      new Date(2026, 6, 10, 15, 0, 0),
      new Date(2026, 6, 20, 9, 30, 0),
    ],
    {
      today: new Date(2026, 6, 15, 12, 0, 0),
      padStartDays: 7,
      padEndDays: 14,
    }
  );

  assert.deepEqual(result, {
    start: new Date(2026, 6, 3),
    end: new Date(2026, 7, 3),
  });
});

test('buildDateRangeFromDates falls back around today when no dates exist', () => {
  const result = buildDateRangeFromDates([], {
    today: new Date(2026, 6, 2, 10, 0, 0),
    fallbackStartOffsetDays: -7,
    fallbackEndOffsetDays: 90,
  });

  assert.deepEqual(result, {
    start: new Date(2026, 5, 25),
    end: new Date(2026, 8, 30),
  });
});

test('buildDateSequence returns an inclusive day list', () => {
  const dates = buildDateSequence({
    start: new Date(2026, 6, 1),
    end: new Date(2026, 6, 3),
  });

  assert.deepEqual(dates, [
    new Date(2026, 6, 1),
    new Date(2026, 6, 2),
    new Date(2026, 6, 3),
  ]);
});

test('basic time-surface helpers normalize to local calendar boundaries', () => {
  const date = new Date(2026, 6, 2, 18, 45, 0);

  assert.deepEqual(startOfLocalDay(date), new Date(2026, 6, 2));
  assert.deepEqual(addCalendarDays(date, 2), new Date(2026, 6, 4, 18, 45, 0));
  assert.equal(daysBetweenLocal(new Date(2026, 6, 2, 23, 0, 0), new Date(2026, 6, 5, 1, 0, 0)), 3);
  assert.equal(getMonthKey(new Date(2026, 6, 2)), '2026-6');
});

test('getFixedDaySurfaceMarker returns centered marker metadata when date is inside range', () => {
  const marker = getFixedDaySurfaceMarker(
    new Date(2026, 6, 1),
    10,
    52,
    new Date(2026, 6, 3, 16, 0, 0)
  );

  assert.deepEqual(marker, {
    index: 2,
    left: 104,
    center: 130,
  });
});

test('getFixedDaySurfaceMarker returns null when date is outside explicit range', () => {
  assert.equal(
    getFixedDaySurfaceMarker(new Date(2026, 6, 1), 10, 52, new Date(2026, 5, 30)),
    null
  );
  assert.equal(
    getFixedDaySurfaceMarker(new Date(2026, 6, 1), 10, 52, new Date(2026, 6, 20)),
    null
  );
});

test('findNearestVisibleDateIndex prefers exact match then next visible day then last day', () => {
  const dates = [
    new Date(2026, 6, 3),
    new Date(2026, 6, 6),
    new Date(2026, 6, 7),
  ];

  assert.equal(findNearestVisibleDateIndex(dates, new Date(2026, 6, 6, 14, 0, 0)), 1);
  assert.equal(findNearestVisibleDateIndex(dates, new Date(2026, 6, 4, 9, 0, 0)), 1);
  assert.equal(findNearestVisibleDateIndex(dates, new Date(2026, 6, 10, 9, 0, 0)), 2);
  assert.equal(findNearestVisibleDateIndex([], new Date(2026, 6, 10, 9, 0, 0)), -1);
});

test('getVariableDaySurfaceMarker returns left and center for variable-width surfaces', () => {
  const marker = getVariableDaySurfaceMarker([40, 60, 80], 2, 50);

  assert.deepEqual(marker, {
    index: 2,
    left: 100,
    center: 140,
  });

  assert.equal(getVariableDaySurfaceMarker([40, 60, 80], -1, 50), null);
  assert.equal(getVariableDaySurfaceMarker([40, 60, 80], 4, 50), null);
});

test('getCenteredScrollLeftForMarker centers and clamps to zero', () => {
  assert.equal(getCenteredScrollLeftForMarker(260, 400), 60);
  assert.equal(getCenteredScrollLeftForMarker(100, 400), 0);
});
