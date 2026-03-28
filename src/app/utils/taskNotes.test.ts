import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTaskCardContent, normalizeTaskNotesForSave } from './taskNotes.ts';

test('normalizeTaskNotesForSave preserves meaningful markdown whitespace', () => {
  assert.equal(normalizeTaskNotesForSave(''), '');
  assert.equal(normalizeTaskNotesForSave('   \n\t  '), '');
  assert.equal(normalizeTaskNotesForSave('Paragraph\n\n'), 'Paragraph\n\n');
  assert.equal(
    normalizeTaskNotesForSave('```ts\nconst feature = true;\n```\n'),
    '```ts\nconst feature = true;\n```\n'
  );
});

test('extractTaskCardContent keeps body preview readable for markdown-heavy notes', () => {
  const preview = extractTaskCardContent(`# Shipping Plan

Review the [toolbar spec](https://example.com/spec).

- [x] Research package options
- [ ] Add tests

| Area | Status |
| --- | --- |
| Toolbar | In progress |
`);

  assert.equal(preview.bodyPreview, 'Shipping Plan Review the toolbar spec.');
  assert.deepEqual(preview.checklistItems, [
    { text: 'Research package options', checked: true },
    { text: 'Add tests', checked: false },
  ]);
});
