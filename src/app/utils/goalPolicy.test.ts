import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultGoalPolicy,
  resetGoalPolicy,
  sanitizeGoalPolicy,
  updateGoalPolicy,
} from './goalPolicy.ts';

test('goal policy defaults are bounded and require human confirmation', () => {
  const policy = createDefaultGoalPolicy('2026-07-19T00:00:00.000Z');

  assert.equal(policy.policyRevision, 0);
  assert.equal(policy.dimensions.tokens.constrained, true);
  assert.equal(policy.dimensions.tokens.value, 100000);
  assert.equal(policy.acceptance.actor, 'human');
  assert.equal(policy.agentMutationConfirmation, 'required');
});

test('goal policy sanitizer fails closed on invalid dimensions', () => {
  const result = sanitizeGoalPolicy({
    schemaVersion: 1,
    dimensions: {
      tokens: { constrained: true, mode: 'hard-cap', value: 0, unit: 'tokens' },
      concurrency: { constrained: true, mode: 'hard-cap', value: 1.5, unit: 'loops' },
      retries: { constrained: false },
    },
  }, createDefaultGoalPolicy('fallback'));

  assert.equal(result.policy.dimensions.tokens.constrained, true);
  assert.equal(result.policy.dimensions.tokens.constrained && result.policy.dimensions.tokens.value, 100000);
  assert.equal(result.policy.dimensions.concurrency.constrained, true);
  assert.equal(result.policy.dimensions.concurrency.constrained && result.policy.dimensions.concurrency.value, 1);
  assert.deepEqual(result.policy.dimensions.retries, { constrained: false });
  assert.ok(result.warnings.length >= 2);
});

test('goal policy updates increment policy revision', () => {
  const next = updateGoalPolicy(createDefaultGoalPolicy('before'), {
    currency: 'eur',
    agentMutationConfirmation: 'allowed',
  }, 'after');

  assert.equal(next.policyRevision, 1);
  assert.equal(next.currency, 'EUR');
  assert.equal(next.agentMutationConfirmation, 'allowed');
  assert.equal(next.updatedAt, 'after');
});

test('goal policy preserves unknown fields while warning about unsafe known fields', () => {
  const result = sanitizeGoalPolicy({
    schemaVersion: 1,
    futurePolicyField: { enabled: true },
    policyRevision: 'invalid',
    acceptance: { actor: 'invalid', futureAcceptanceField: 'keep' },
    dimensions: {
      financial: {
        constrained: true,
        mode: 'hard-cap',
        value: 0.25,
        unit: 'USD',
        futureDimensionField: 'keep',
      },
    },
  });

  assert.deepEqual(result.policy.futurePolicyField, { enabled: true });
  assert.equal(result.policy.acceptance.futureAcceptanceField, 'keep');
  assert.equal(result.policy.dimensions.financial.futureDimensionField, 'keep');
  assert.equal(result.policy.dimensions.financial.constrained && result.policy.dimensions.financial.value, 0.25);
  assert.ok(result.warnings.length >= 2);
});

test('resetting a Goal policy restores safe defaults and advances the revision', () => {
  const current = updateGoalPolicy(createDefaultGoalPolicy('before'), {
    currency: 'EUR',
    agentMutationConfirmation: 'allowed',
  }, 'changed');
  const reset = resetGoalPolicy(current, 'reset');

  assert.equal(reset.currency, 'USD');
  assert.equal(reset.acceptance.actor, 'human');
  assert.equal(reset.agentMutationConfirmation, 'required');
  assert.equal(reset.policyRevision, current.policyRevision + 1);
  assert.equal(reset.updatedAt, 'reset');
});

test('goal policy validates units, modes, and unbounded dimensions', () => {
  const result = sanitizeGoalPolicy({
    dimensions: {
      financial: { constrained: true, mode: 'unknown', value: 2, unit: 'tokens' },
      retries: { constrained: false, value: 10, mode: 'hard-cap', unit: 'retries' },
    },
  });

  assert.equal(result.policy.dimensions.financial.constrained && result.policy.dimensions.financial.value, 10);
  assert.deepEqual(result.policy.dimensions.retries, { constrained: false });
  assert.ok(result.warnings.length >= 2);
});
