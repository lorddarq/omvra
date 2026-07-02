import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDateRangeLabel } from './dateRange.ts';

test('formatDateRangeLabel renders a shared closed range label', () => {
  assert.equal(formatDateRangeLabel('2026-07-01', '2026-07-10'), '2026-07-01 to 2026-07-10');
});

test('formatDateRangeLabel collapses single-day ranges and handles empty values', () => {
  assert.equal(formatDateRangeLabel('2026-07-10', '2026-07-10'), '2026-07-10');
  assert.equal(formatDateRangeLabel(undefined, '2026-07-10'), '2026-07-10');
  assert.equal(formatDateRangeLabel(undefined, undefined), 'No date');
});
