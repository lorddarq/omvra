import assert from 'node:assert/strict';
import test from 'node:test';
import { getReadableOutlineColorFor, getReadableTextClassFor } from './contrast.ts';

test('getReadableOutlineColorFor uses dark outline on light backgrounds', () => {
  assert.equal(getReadableOutlineColorFor('#e5e7eb'), 'rgba(0,0,0,0.18)');
});

test('getReadableOutlineColorFor uses light outline on dark backgrounds', () => {
  assert.equal(getReadableOutlineColorFor('#1a60cb'), 'rgba(255,255,255,0.28)');
});

test('warm light backgrounds prefer dark readable text', () => {
  assert.equal(getReadableOutlineColorFor('#f59e0b'), 'rgba(0,0,0,0.18)');
  assert.equal(getReadableTextClassFor('status-visual-test', '#f59e0b'), 'text-black');
});

test('saturated pink and blue backgrounds prefer light readable text', () => {
  assert.equal(getReadableTextClassFor('status-visual-pink', '#ec4899'), 'text-white');
  assert.equal(getReadableTextClassFor('status-visual-blue', '#3b82f6'), 'text-white');
});

test('light gray backgrounds prefer dark readable text', () => {
  assert.equal(getReadableTextClassFor('status-visual-gray', '#d1d5db'), 'text-black');
});

test('text contrast cache includes the resolved background color', () => {
  assert.equal(getReadableTextClassFor('status-visual-cache-test', '#1a60cb'), 'text-white');
  assert.equal(getReadableTextClassFor('status-visual-cache-test', '#f9fafb'), 'text-black');
});
