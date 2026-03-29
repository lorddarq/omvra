import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMarkdownEditorValue } from './markdownEditorValue.ts';

test('normalizeMarkdownEditorValue keeps non-empty markdown unchanged', () => {
  assert.equal(normalizeMarkdownEditorValue('Hello **world**'), 'Hello **world**');
});

test('normalizeMarkdownEditorValue turns empty editor content into a blank paragraph', () => {
  assert.equal(normalizeMarkdownEditorValue(''), '\n');
  assert.equal(normalizeMarkdownEditorValue('   '), '\n');
});
