const test = require('node:test');
const assert = require('node:assert/strict');
const { updateGoalElement } = require('./workspace-service.cjs');

function makeStore(policy) {
  const values = new Map([
    ['omvra.goals.v1', [{ id: 'goal-1', title: 'Ship it', elements: [{ id: 'node-1', type: 'subgoal', title: 'Work' }] }]],
    ['omvra.goalPolicy.v1', policy],
  ]);
  return { get: key => values.get(key), set: (key, value) => values.set(key, value) };
}

test('agent graph writes require confirmation unless workspace policy allows them', () => {
  const blocked = updateGoalElement(makeStore({ agentMutationConfirmation: 'required' }), {
    goalId: 'goal-1', elementId: 'node-1', updates: { title: 'Changed' }, expectedRevision: 0, idempotencyKey: 'blocked', actor: 'mcp-agent',
  });
  assert.equal(blocked.error, 'HUMAN_CONFIRMATION_REQUIRED');

  const confirmed = updateGoalElement(makeStore({ agentMutationConfirmation: 'required' }), {
    goalId: 'goal-1', elementId: 'node-1', updates: { title: 'Changed' }, expectedRevision: 0, idempotencyKey: 'confirmed', actor: 'mcp-agent', humanConfirmed: true,
  });
  assert.equal(confirmed.ok, true);

  const allowed = updateGoalElement(makeStore({ agentMutationConfirmation: 'allowed' }), {
    goalId: 'goal-1', elementId: 'node-1', updates: { title: 'Changed' }, expectedRevision: 0, idempotencyKey: 'allowed', actor: 'mcp-agent',
  });
  assert.equal(allowed.ok, true);
});
