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

test('normalizeMarkdownEditorValue escapes fenced code blocks as plain text', () => {
  assert.equal(
    normalizeMarkdownEditorValue('Before\n\n```txt\nPOST /webhook -> 404\n# not a heading\n```\n\nAfter'),
    'Before\n\n\\`\\`\\`txt\nPOST /webhook \\-\\> 404\n\\# not a heading\n\\`\\`\\`\n\nAfter'
  );
});

test('normalizeMarkdownEditorValue escapes tilde fenced code blocks as plain text', () => {
  assert.equal(
    normalizeMarkdownEditorValue('~~~json\n{\"ok\": true}\n~~~'),
    '\\~\\~\\~json\n\\{\"ok\": true\\}\n\\~\\~\\~'
  );
});
