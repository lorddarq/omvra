import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeTimelineLayoutState, sanitizeViewStates } from './uiState.ts';

test('sanitizeTimelineLayoutState clamps width and preserves numeric month widths', () => {
  const result = sanitizeTimelineLayoutState({
    leftColWidth: 999,
    monthWidths: {
      '2026-6': 320,
      invalid: 'oops',
    },
  });

  assert.equal(result.leftColWidth, 420);
  assert.deepEqual(result.monthWidths, {
    '2026-6': 320,
  });
  assert.equal(result.showCompleted, false);

  assert.equal(sanitizeTimelineLayoutState({ showCompleted: true }).showCompleted, true);
});

test('sanitizeViewStates falls back to defaults for invalid payloads', () => {
  const result = sanitizeViewStates({
    timeline: { mode: 'people', scrollLeft: 120, collapsedSwimlanes: ['lane-1'] },
    kanban: { scrollTop: 48 },
    roadmap: null,
  });

  assert.equal(result.timeline.mode, 'people');
  assert.equal(result.timeline.scrollLeft, 120);
  assert.deepEqual(result.timeline.collapsedSwimlanes, ['lane-1']);
  assert.equal(result.kanban.scrollTop, 48);
  assert.equal(result.roadmap.scrollLeft, 0);
});
