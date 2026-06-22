import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTaskDetailsForClipboard } from './taskClipboard.ts';

test('formatTaskDetailsForClipboard includes core collaboration details', () => {
  assert.equal(
    formatTaskDetailsForClipboard({
      taskId: 'task-123',
      title: 'Copy task details from modal',
      assigneeLabel: 'Codex',
      projectLabels: ['Omvra'],
      statusLabel: 'Open Tasks',
    }),
    [
      'Task: Copy task details from modal',
      'ID: task-123',
      'Allocated to: Codex',
      'Project: Omvra',
      'Status: Open Tasks',
    ].join('\n')
  );
});

test('formatTaskDetailsForClipboard handles missing assignee and project labels', () => {
  assert.equal(
    formatTaskDetailsForClipboard({
      taskId: 'task-456',
      title: 'Unrouted task',
      statusLabel: 'In Progress',
    }),
    [
      'Task: Unrouted task',
      'ID: task-456',
      'Allocated to: Unassigned',
      'Project: No project',
      'Status: In Progress',
    ].join('\n')
  );
});

test('formatTaskDetailsForClipboard formats multiple projects readably', () => {
  assert.match(
    formatTaskDetailsForClipboard({
      taskId: 'task-789',
      title: 'Shared task',
      assigneeLabel: 'Sorin Jurcut',
      projectLabels: ['Omvra', 'Omvra Web'],
      statusLabel: 'Ready for human review',
    }),
    /Project: Omvra, Omvra Web/
  );
});
