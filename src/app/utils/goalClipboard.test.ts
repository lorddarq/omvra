import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatGoalDetailsForClipboard } from './goalClipboard.ts';

test('formats Goal metadata for clipboard handoff', () => {
  assert.equal(formatGoalDetailsForClipboard({
    goalId: 'goal-1',
    title: 'Prepare article',
    revision: 4,
    status: 'complete',
    overseerLabel: 'Editorial overseer',
    agentLabels: ['Editorial strategist'],
    deliverableLabels: ['Blog Article'],
    nodeCount: 6,
    notes: 'Use the existing site as context.',
  }), [
    'Goal: Prepare article',
    'ID: goal-1',
    'Revision: 4',
    'Status: complete',
    'Overseer: Editorial overseer',
    'Agents: Editorial strategist',
    'Deliverables: Blog Article',
    'Nodes: 6',
    'Notes: Use the existing site as context.',
  ].join('\n'));
});
