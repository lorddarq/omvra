import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMarkdownEditorValue } from './markdownEditorValue.ts';

test('normalizeMarkdownEditorValue keeps non-empty markdown unchanged', () => {
  assert.equal(normalizeMarkdownEditorValue('Hello **world**'), 'Hello **world**');
});

test('normalizeMarkdownEditorValue keeps empty editor content truly empty', () => {
  assert.equal(normalizeMarkdownEditorValue(''), '');
  assert.equal(normalizeMarkdownEditorValue('   '), '');
});
