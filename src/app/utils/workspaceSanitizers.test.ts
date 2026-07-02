import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePeople, sanitizePreferences } from './workspaceSanitizers.ts';

test('sanitizePeople preserves trimmed instructions for agentic people', () => {
  const [person] = sanitizePeople([
    {
      id: 'agent-1',
      name: 'Codex',
      role: 'Agent',
      kind: 'agentic',
      agentInstructions: '  Work carefully from the assigned task.  ',
      agentOperationalInstructions: '  Read the task, inspect dependencies, then validate output.  ',
    },
  ]);

  assert.equal(person.agentInstructions, 'Work carefully from the assigned task.');
  assert.equal(person.agentOperationalInstructions, 'Read the task, inspect dependencies, then validate output.');
});

test('sanitizePeople drops agent instructions for human people', () => {
  const [person] = sanitizePeople([
    {
      id: 'person-1',
      name: 'Alex',
      role: 'Designer',
      kind: 'human',
      agentInstructions: 'This should not be active.',
      agentOperationalInstructions: 'This should not be active either.',
    },
  ]);

  assert.equal(person.agentInstructions, undefined);
  assert.equal(person.agentOperationalInstructions, undefined);
});

test('sanitizePreferences preserves rc update channel and falls back to stable', () => {
  const fallback = {
    executionLoadStatusIds: ['in-progress'] as const,
    pipelineLoadStatusIds: ['open'] as const,
    updateChannel: 'stable' as const,
    mcpAgentAccessEnabled: false,
    mcpCapabilityProfile: 'read_only' as const,
    mcpBindHost: '127.0.0.1',
    mcpPort: 3456,
    mcpServerAddress: 'http://127.0.0.1:3456/mcp',
    mcpAccessToken: '',
    mcpAccessTokenIssuedAt: undefined,
    mcpAccessTokenTtlMinutes: 60,
  };
  const statusColumns = [
    { id: 'open', title: 'Open' },
    { id: 'in-progress', title: 'In Progress' },
  ];

  const rcPreferences = sanitizePreferences(
    {
      updateChannel: 'rc',
      executionLoadStatusIds: ['in-progress'],
      pipelineLoadStatusIds: ['open'],
    },
    statusColumns,
    fallback
  );
  const stablePreferences = sanitizePreferences(
    {
      updateChannel: 'something-else' as 'stable',
      executionLoadStatusIds: ['in-progress'],
      pipelineLoadStatusIds: ['open'],
    },
    statusColumns,
    fallback
  );

  assert.equal(rcPreferences.updateChannel, 'rc');
  assert.equal(stablePreferences.updateChannel, 'stable');
});
