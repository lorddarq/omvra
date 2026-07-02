import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROJECT_COLOR, getProjectVisual, resolveProjectColor } from './projectVisual.ts';

test('resolveProjectColor prefers explicit and project colors before fallback', () => {
  assert.equal(resolveProjectColor({ color: '#22c55e' }), '#22c55e');
  assert.equal(resolveProjectColor({ color: '#22c55e' }, '#ef4444'), '#ef4444');
  assert.equal(resolveProjectColor(undefined), DEFAULT_PROJECT_COLOR);
});

test('getProjectVisual returns shared label and styles for project dots and chips', () => {
  const visual = getProjectVisual({ id: 'project-1', name: 'Omvra', color: '#22c55e' });

  assert.equal(visual.label, 'Omvra');
  assert.equal(visual.color, '#22c55e');
  assert.deepEqual(visual.markerStyle, { backgroundColor: '#22c55e' });
  assert.deepEqual(visual.iconStyle, { color: '#22c55e' });
});
