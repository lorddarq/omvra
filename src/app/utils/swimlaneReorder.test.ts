import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveReorderDropIndex } from './swimlaneReorder.ts';

test('resolves second-to-last row dropped after last row to the final index', () => {
  assert.equal(
    resolveReorderDropIndex(['A', 'B', 'C', 'D', 'E'], 'D', {
      targetId: 'E',
      position: 'after',
    }),
    4
  );
});

test('resolves last row dropped before second-to-last row one slot upward', () => {
  assert.equal(
    resolveReorderDropIndex(['A', 'B', 'C', 'D', 'E'], 'E', {
      targetId: 'D',
      position: 'before',
    }),
    3
  );
});

test('keeps a row in place when dropped after the item immediately above it', () => {
  assert.equal(
    resolveReorderDropIndex(['A', 'B', 'C', 'D', 'E'], 'D', {
      targetId: 'C',
      position: 'after',
    }),
    3
  );
});

