import assert from 'node:assert/strict';
import test from 'node:test';
import { getReadableOutlineColorFor, getReadableTextClassFor } from './contrast.ts';

test('getReadableOutlineColorFor uses dark outline on light backgrounds', () => {
  assert.equal(getReadableOutlineColorFor('#e5e7eb'), 'rgba(0,0,0,0.18)');
});

test('getReadableOutlineColorFor uses light outline on dark backgrounds', () => {
  assert.equal(getReadableOutlineColorFor('#1a60cb'), 'rgba(255,255,255,0.28)');
});

test('amber backgrounds prefer dark readable contrast', () => {
  assert.equal(getReadableOutlineColorFor('#f59e0b'), 'rgba(0,0,0,0.18)');
  assert.equal(getReadableTextClassFor('status-visual-test', '#f59e0b'), 'text-black');
});
