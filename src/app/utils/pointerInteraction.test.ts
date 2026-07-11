import test from 'node:test';
import assert from 'node:assert/strict';
import { isPointerReleased } from './pointerInteraction.ts';

test('isPointerReleased detects a release after the pointer leaves its original target', () => {
  assert.equal(isPointerReleased(0), true);
  assert.equal(isPointerReleased(1), false);
});
