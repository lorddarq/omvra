import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePeople } from './workspaceSanitizers.ts';

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
