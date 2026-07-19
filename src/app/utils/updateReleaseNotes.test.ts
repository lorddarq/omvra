import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUpdateReleaseNotes } from './updateReleaseNotes.ts';

test('parseUpdateReleaseNotes extracts useful bullets from markdown notes', () => {
  const parsed = parseUpdateReleaseNotes(`
# What's New

- Auto-update capabilities
- Improved user interface
- Agent roles and prompts
- Better release note parsing
  `);

  assert.deepEqual(parsed.items, [
    'Auto-update capabilities',
    'Improved user interface',
    'Agent roles and prompts',
  ]);
  assert.equal(parsed.hasMore, true);
  assert.equal(parsed.summary, 'Auto-update capabilities');
});

test('parseUpdateReleaseNotes removes duplicate and noisy heading lines', () => {
  const parsed = parseUpdateReleaseNotes(`
Changes:
1. Auto-update capabilities
1. Auto-update capabilities
Version 0.3.33
Improved user interface
`);

  assert.deepEqual(parsed.items, [
    'Auto-update capabilities',
    'Improved user interface',
  ]);
  assert.equal(parsed.hasMore, false);
  assert.equal(parsed.rawLines.includes('Changes:'), false);
  assert.equal(parsed.rawLines.includes('Version 0.3.33'), false);
});

test('parseUpdateReleaseNotes keeps prose summary when no bullets exist', () => {
  const parsed = parseUpdateReleaseNotes('This release improves update reliability across packaged Omvra builds.');

  assert.deepEqual(parsed.items, ['This release improves update reliability across packaged Omvra builds.']);
  assert.equal(parsed.summary, 'This release improves update reliability across packaged Omvra builds.');
  assert.equal(parsed.hasMore, false);
});

test('parseUpdateReleaseNotes strips HTML without splitting one note across items', () => {
  const parsed = parseUpdateReleaseNotes(`
- <p>Public Preview Release for Goals functionality. Limited MCP availability.
</p>
- <p>Goal templates, availability and policies. v0.33.5</p>
  `);

  assert.deepEqual(parsed.items, [
    'Public Preview Release for Goals functionality. Limited MCP availability.',
    'Goal templates, availability and policies. v0.33.5',
  ]);
  assert.equal(parsed.rawLines.some(line => /<\/?p>/i.test(line)), false);
});
