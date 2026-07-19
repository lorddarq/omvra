const test = require('node:test');
const assert = require('node:assert/strict');
const {
  EVIDENCE_KEY,
  migrateGoalRecords,
  normalizeGoal,
  createEvidenceRecord,
} = require('./goal-state-service.cjs');

test('goal normalization preserves unknown fields and initializes revisions', () => {
  const goal = normalizeGoal({
    id: 'legacy-goal',
    title: 'Legacy goal',
    futureGoalMetadata: { owner: 'next-version' },
    elements: [{ id: 'legacy-node', type: 'subgoal', title: 'Work', futureNodeMetadata: true }],
  });

  assert.equal(goal.schemaVersion, 1);
  assert.equal(goal.revision, 0);
  assert.deepEqual(goal.futureGoalMetadata, { owner: 'next-version' });
  assert.equal(goal.elements[0].futureNodeMetadata, true);
});

test('legacy goal migration preserves ids and only writes when normalization changes data', () => {
  const values = new Map([['omvra.goals.v1', [{ id: 'goal-old', title: 'Goal', elements: [] }]]]);
  const store = { get: key => values.get(key), set: (key, value) => values.set(key, value) };
  const first = migrateGoalRecords(store);
  assert.equal(first.changed, true);
  assert.equal(first.goals[0].id, 'goal-old');
  const second = migrateGoalRecords(store);
  assert.equal(second.changed, false);
});

test('evidence records are immutable, prefixed, and separate from execution state', () => {
  const evidence = createEvidenceRecord({ goalId: 'goal_1', executionId: 'execution_1', ref: 'file:///tmp/result.json' });
  assert.match(evidence.id, /^evidence_/);
  assert.equal(evidence.immutable, true);
  assert.equal(evidence.ref, 'file:///tmp/result.json');
  assert.notEqual(EVIDENCE_KEY, 'omvra.goalExecutions.v1');
});
