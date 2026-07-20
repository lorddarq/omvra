const test = require('node:test');
const assert = require('node:assert/strict');
const {
  EVIDENCE_KEY,
  migrateGoalRecords,
  normalizeGoal,
  normalizeAgentConfiguration,
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

test('control-flow nodes normalize as supported Goal elements and preserve their configuration', () => {
  const goal = normalizeGoal({
    id: 'goal-control-flow',
    title: 'Control flow',
    elements: [
      { id: 'input-1', type: 'human-input', title: 'Ask user', humanInputPrompt: 'Which competitor should we add?', x: 0, y: 0 },
      { id: 'retry-1', type: 'retry', title: 'Retry research', retryMaxAttempts: 3, retryExhaustionPolicy: 'human-review', x: 100, y: 0 },
    ],
  });

  assert.equal(goal.elements[0].type, 'human-input');
  assert.equal(goal.elements[0].humanInputPrompt, 'Which competitor should we add?');
  assert.equal(goal.elements[1].type, 'retry');
  assert.equal(goal.elements[1].retryMaxAttempts, 3);
  assert.equal(goal.elements[1].retryExhaustionPolicy, 'human-review');
});

test('deliverable nodes keep the delivery contract separate from migrated supporting artifacts', () => {
  const goal = normalizeGoal({
    id: 'goal-deliverable',
    title: 'Deliverable goal',
    elements: [{
      id: 'deliverable-1',
      type: 'deliverable',
      title: 'Final report',
      deliverySpec: {
        outcomeKind: 'file',
        instructions: 'Deliver the report to the research folder.',
        format: 'PDF',
        acceptanceCriteria: ['Contains findings'],
        expectedArtifactCount: 1.8,
      },
      deliverableStatus: 'ready-for-review',
      artifactReferences: [
        { id: 'artifact-1', artifactType: 'user-defined', artifactId: 'report-1', contribution: 'deliverable', label: 'Report', kind: 'document', format: 'PDF', locator: 'file:///tmp/report.pdf' },
        { id: 'artifact-duplicate', artifactType: 'user-defined', artifactId: 'report-1', label: 'Ignored duplicate' },
      ],
      x: 0,
      y: 0,
    }],
  });

  const deliverable = goal.elements.find(element => element.type === 'deliverable');
  assert.equal(deliverable.type, 'deliverable');
  assert.equal(deliverable.deliverableStatus, 'ready-for-review');
  assert.equal(deliverable.deliverySpec.expectedArtifactCount, 1);
  assert.equal(deliverable.artifactReferences, undefined);
  const supporting = goal.elements.find(element => element.type === 'artifact');
  assert.equal(supporting.artifactRole, 'supporting');
  assert.equal(supporting.artifactReferences[0].contribution, 'supporting');
  assert.equal(supporting.artifactReferences[0].locator, 'file:///tmp/report.pdf');
});

test('supporting artifact nodes normalize their role and references', () => {
  const goal = normalizeGoal({ id: 'goal-supporting', title: 'Inputs', elements: [{ id: 'artifact-1', type: 'artifact', title: 'Research notes', artifactReferences: [{ artifactType: 'document', artifactId: 'doc-1', sourceTaskId: 'task-1', sourceAttachmentId: 'attachment-1', copiedContents: 'must-not-persist' }] }] });
  assert.equal(goal.elements[0].artifactRole, 'supporting');
  assert.equal(goal.elements[0].artifactReferences[0].contribution, undefined);
  assert.equal(goal.elements[0].artifactReferences[0].sourceTaskId, 'task-1');
  assert.equal(goal.elements[0].artifactReferences[0].sourceAttachmentId, 'attachment-1');
  assert.equal(goal.elements[0].artifactReferences[0].copiedContents, undefined);
});

test('agent configuration migrates legacy assignees and rejects incomplete ephemeral nodes', () => {
  const goal = normalizeGoal({
    id: 'goal-agent-contract',
    title: 'Agent contract',
    elements: [
      { id: 'legacy-agent', type: 'agent', title: 'Legacy', assigneeId: 'agent-1', body: 'Visible note' },
      { id: 'invalid-agent', type: 'agent', title: 'Invalid', agentConfiguration: { version: 1, mode: 'ephemeral', instructions: 'Do work' } },
      { id: 'ephemeral-agent', type: 'agent', title: 'Temporary', agentConfiguration: { mode: 'ephemeral', requestedName: 'Researcher', requestedType: 'researcher', instructions: 'Find evidence', spawnIfUnavailable: true } },
      { id: 'generated-agent', type: 'agent', title: 'Generated', agentConfiguration: { mode: 'ephemeral', autoGenerateName: true, requestedType: 'researcher', instructions: 'Find evidence' } },
    ],
  });

  assert.deepEqual(goal.elements[0].agentConfiguration, { version: 1, mode: 'existing', assigneeId: 'agent-1', instructions: '' });
  assert.equal(goal.elements[1].agentConfiguration, undefined);
  assert.deepEqual(goal.elements[2].agentConfiguration, { version: 1, mode: 'ephemeral', requestedName: 'Researcher', requestedType: 'researcher', instructions: 'Find evidence', spawnIfUnavailable: true });
  assert.deepEqual(goal.elements[3].agentConfiguration, { version: 1, mode: 'ephemeral', requestedType: 'researcher', instructions: 'Find evidence', autoGenerateName: true });
  assert.equal(normalizeAgentConfiguration({ mode: 'existing', assigneeId: 'agent-2', instructions: 'Ship it' }).version, 1);
});

test('evidence records are immutable, prefixed, and separate from execution state', () => {
  const evidence = createEvidenceRecord({ goalId: 'goal_1', executionId: 'execution_1', ref: 'file:///tmp/result.json' });
  assert.match(evidence.id, /^evidence_/);
  assert.equal(evidence.immutable, true);
  assert.equal(evidence.ref, 'file:///tmp/result.json');
  assert.notEqual(EVIDENCE_KEY, 'omvra.goalExecutions.v1');
});
