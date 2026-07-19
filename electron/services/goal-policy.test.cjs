const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildGoalContractPacket,
  isAgentMutationAllowed,
  recordGoalPolicyChangeImpact,
  resolveGoalPolicy,
} = require('./goal-policy.cjs');

test('effective policy inherits and only narrows workspace, goal, subgoal, and gate scopes', () => {
  const goal = {
    id: 'goal-1',
    title: 'Ship it',
    revision: 4,
    policy: { dimensions: { tokens: { constrained: true, mode: 'hard-cap', value: 5000, unit: 'tokens' } } },
    elements: [
      { id: 'subgoal-1', type: 'subgoal', policy: { dimensions: { tokens: { constrained: true, mode: 'goal-pool', value: 1000, unit: 'tokens' } }, acceptance: { actor: 'human' } } },
      { id: 'gate-1', type: 'approval-gate', policy: { acceptance: { actor: 'both' }, dimensions: { tokens: { constrained: true, mode: 'hard-cap', value: 250, unit: 'tokens' } } } },
      { id: 'to-subgoal', type: 'connector', sourceId: 'goal-root', targetId: 'subgoal-1' },
      { id: 'to-gate', type: 'connector', sourceId: 'subgoal-1', targetId: 'gate-1' },
    ],
  };
  const policy = resolveGoalPolicy({
    workspacePolicy: { policyRevision: 8, dimensions: { tokens: { constrained: true, mode: 'hard-cap', value: 10000, unit: 'tokens' } }, acceptance: { actor: 'human' } },
    goal,
    targetElementId: 'gate-1',
  });

  assert.equal(policy.dimensions.tokens.value, 250);
  assert.equal(policy.acceptance.actor, 'both');
  assert.equal(policy.sourceRevision, 8);
  assert.equal(policy.sources.target, 'explicit');

  const attemptedWiden = resolveGoalPolicy({
    workspacePolicy: { dimensions: { tokens: { constrained: true, mode: 'hard-cap', value: 1000, unit: 'tokens' } }, acceptance: { actor: 'human' } },
    goal: { ...goal, policy: { dimensions: { tokens: { constrained: false } }, acceptance: { actor: 'agentic' } } },
  });
  assert.equal(attemptedWiden.dimensions.tokens.value, 1000);
  assert.equal(attemptedWiden.acceptance.actor, 'human');
});

test('contract packets carry the effective policy and revision', () => {
  const packet = buildGoalContractPacket({ goal: { id: 'goal-1', title: 'Ship it', revision: 3 }, effectivePolicy: { sourceRevision: 9, acceptance: { actor: 'human' } }, executionAttempt: 2, now: () => '2026-07-19T00:00:00.000Z' });
  assert.equal(packet.contractRevision, 3);
  assert.equal(packet.policyRevision, 9);
  assert.equal(packet.effectivePolicy.acceptance.actor, 'human');
});

test('agent graph mutation is confirmation-gated by default and configurable', () => {
  assert.equal(isAgentMutationAllowed({ get: () => ({ agentMutationConfirmation: 'required' }) }).allowed, false);
  assert.equal(isAgentMutationAllowed({ get: () => ({ agentMutationConfirmation: 'required' }) }, true).allowed, true);
  assert.equal(isAgentMutationAllowed({ get: () => ({ agentMutationConfirmation: 'allowed' }) }).allowed, true);
});

test('active policy changes create durable impact-gate decisions', () => {
  const values = new Map([
    ['omvra.goals.v1', [{ id: 'goal-1', title: 'Ship it', elements: [] }]],
    ['omvra.goalExecutions.v1', [{ id: 'execution-1', goalId: 'goal-1', state: 'working' }]],
  ]);
  const store = { get: key => values.get(key), set: (key, value) => values.set(key, value) };
  const result = recordGoalPolicyChangeImpact(store, {
    previousPolicy: { policyRevision: 2, dimensions: { tokens: { constrained: true, mode: 'hard-cap', value: 100, unit: 'tokens' } } },
    nextPolicy: { policyRevision: 3, dimensions: { tokens: { constrained: true, mode: 'hard-cap', value: 50, unit: 'tokens' } } },
    now: () => '2026-07-19T00:00:00.000Z',
  });
  assert.equal(result.impacts.length, 1);
  assert.equal(result.impacts[0].decision, 'pause-and-review');
  assert.equal(result.impacts[0].priorPolicyRevision, 2);
  assert.equal(values.get('omvra.goalPolicyImpacts.v1')[0].status, 'pending');
});
