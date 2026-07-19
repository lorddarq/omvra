const test = require('node:test');
const assert = require('node:assert/strict');
const { createGoalLifecycleService, EVENTS_KEY, EXECUTIONS_KEY, EVIDENCE_KEY } = require('./goal-lifecycle-service.cjs');

function makeStore() {
  const values = new Map([
    ['omvra.goals.v1', [{ id: 'goal-1', title: 'Ship it' }]],
  ]);
  return {
    get(key) { return values.get(key); },
    set(key, value) { values.set(key, value); },
  };
}

function makeClock() {
  let tick = 0;
  return () => `2026-07-18T00:00:0${tick++}.000Z`;
}

test('lifecycle transitions require evidence, acceptance, and revisions', () => {
  const store = makeStore();
  const lifecycle = createGoalLifecycleService({ store, now: makeClock(), cleanup: () => ({ status: 'skipped', ok: true }) });

  const started = lifecycle.execute({ goalId: 'goal-1', command: 'start', expectedRevision: 0, commandId: 'start-1' });
  assert.equal(started.ok, true);
  assert.equal(started.execution.state, 'ready');
  assert.equal(lifecycle.execute({ goalId: 'goal-1', command: 'start', expectedRevision: 1, commandId: 'start-2' }).error, 'EXECUTION_EXISTS');
  lifecycle.execute({ goalId: 'goal-1', command: 'acknowledge', expectedRevision: 1, commandId: 'ack-1', payload: { contractRevision: 0 } });

  const dispatched = lifecycle.execute({ goalId: 'goal-1', command: 'dispatch', expectedRevision: 2, commandId: 'dispatch-1' });
  assert.equal(dispatched.execution.state, 'working');

  const missingEvidence = lifecycle.execute({ goalId: 'goal-1', command: 'request-handoff', expectedRevision: 3, commandId: 'handoff-1' });
  assert.equal(missingEvidence.error, 'EVIDENCE_REQUIRED');

  const evidence = lifecycle.execute({ goalId: 'goal-1', command: 'submit-evidence', expectedRevision: 3, commandId: 'evidence-1', payload: { evidenceRefs: ['evidence-1'] } });
  assert.equal(evidence.execution.state, 'evidence-required');
  assert.equal(store.get(EVIDENCE_KEY).length, 1);
  assert.match(store.get(EVIDENCE_KEY)[0].id, /^evidence_/);

  const handoff = lifecycle.execute({ goalId: 'goal-1', command: 'request-handoff', expectedRevision: 4, commandId: 'handoff-2' });
  assert.equal(handoff.execution.state, 'handoff-pending');

  const accepted = lifecycle.execute({ goalId: 'goal-1', command: 'accept', expectedRevision: 5, commandId: 'accept-1', payload: { finalEvidenceVerified: true, acceptedBy: 'human-1' } });
  assert.equal(accepted.execution.state, 'handoff-pending');
  assert.equal(accepted.execution.acceptanceSatisfied, true);

  const blocked = lifecycle.execute({ goalId: 'goal-1', command: 'complete', expectedRevision: 6, commandId: 'complete-1', payload: { finalEvidenceVerified: false } });
  assert.equal(blocked.error, 'EVIDENCE_REQUIRED');

  const completed = lifecycle.execute({ goalId: 'goal-1', command: 'complete', expectedRevision: 6, commandId: 'complete-2', payload: { finalEvidenceVerified: true } });
  assert.equal(completed.execution.state, 'complete');
  assert.equal(completed.cleanup.status, 'skipped');
  assert.equal(store.get(EXECUTIONS_KEY)[0].state, 'complete');
});

test('acceptance also requires verified final evidence', () => {
  const store = makeStore();
  const lifecycle = createGoalLifecycleService({ store, now: makeClock(), cleanup: () => ({ status: 'skipped', ok: true }) });

  lifecycle.execute({ goalId: 'goal-1', command: 'start', expectedRevision: 0, commandId: 'start' });
  lifecycle.execute({ goalId: 'goal-1', command: 'acknowledge', expectedRevision: 1, commandId: 'ack', payload: { contractRevision: 0 } });
  lifecycle.execute({ goalId: 'goal-1', command: 'dispatch', expectedRevision: 2, commandId: 'dispatch' });
  lifecycle.execute({ goalId: 'goal-1', command: 'submit-evidence', expectedRevision: 3, commandId: 'evidence', payload: { evidenceRefs: ['final'] } });
  lifecycle.execute({ goalId: 'goal-1', command: 'request-handoff', expectedRevision: 4, commandId: 'handoff' });

  const blocked = lifecycle.execute({ goalId: 'goal-1', command: 'accept', expectedRevision: 5, commandId: 'accept-1', payload: { finalEvidenceVerified: false } });
  assert.equal(blocked.error, 'EVIDENCE_REQUIRED');
  const accepted = lifecycle.execute({ goalId: 'goal-1', command: 'accept', expectedRevision: 5, commandId: 'accept-2', payload: { finalEvidenceVerified: true } });
  assert.equal(accepted.execution.state, 'handoff-pending');
  const completed = lifecycle.execute({ goalId: 'goal-1', command: 'complete', expectedRevision: 6, commandId: 'complete', payload: { finalEvidenceVerified: true } });
  assert.equal(completed.execution.state, 'complete');
});

test('acknowledgement records receipt without completing or changing execution state', () => {
  const store = makeStore();
  const lifecycle = createGoalLifecycleService({ store, now: makeClock(), cleanup: () => ({ status: 'skipped', ok: true }) });

  lifecycle.execute({ goalId: 'goal-1', command: 'start', expectedRevision: 0, commandId: 'start' });
  const acknowledged = lifecycle.execute({ goalId: 'goal-1', command: 'acknowledge', expectedRevision: 1, commandId: 'ack', payload: { contractRevision: 3, contractHash: 'hash-3' } });
  assert.equal(acknowledged.execution.state, 'ready');
  assert.equal(acknowledged.execution.acknowledged, true);
  assert.equal(acknowledged.execution.acknowledgedContractRevision, 3);
});

test('lifecycle execution carries the resolved policy into the contract packet and validation inputs', () => {
  const store = makeStore();
  store.set('omvra.goalPolicy.v1', {
    policyRevision: 6,
    dimensions: { retries: { constrained: true, mode: 'hard-cap', value: 1, unit: 'retries' } },
    acceptance: { actor: 'human' },
  });
  const lifecycle = createGoalLifecycleService({ store, now: makeClock(), cleanup: () => ({ status: 'skipped', ok: true }) });
  const started = lifecycle.execute({ goalId: 'goal-1', command: 'start', expectedRevision: 0, commandId: 'start-policy' });
  assert.equal(started.execution.effectivePolicy.sourceRevision, 6);
  assert.equal(started.execution.contractPacket.policyRevision, 6);
  assert.equal(started.execution.contractPacket.effectivePolicy.acceptance.actor, 'human');
});

test('pending policy impact gate blocks continuation until pause and confirmation', () => {
  const store = makeStore();
  const lifecycle = createGoalLifecycleService({ store, now: makeClock(), cleanup: () => ({ status: 'skipped', ok: true }) });
  lifecycle.execute({ goalId: 'goal-1', command: 'start', expectedRevision: 0, commandId: 'start-impact' });
  store.set('omvra.goalPolicyImpacts.v1', [{ goalId: 'goal-1', executionId: 'execution_1', status: 'pending', decision: 'confirmation-required' }]);
  const blocked = lifecycle.execute({ goalId: 'goal-1', command: 'dispatch', expectedRevision: 1, commandId: 'dispatch-impact' });
  assert.equal(blocked.error, 'POLICY_IMPACT_GATE_REQUIRED');
  const paused = lifecycle.execute({ goalId: 'goal-1', command: 'pause', expectedRevision: 1, commandId: 'pause-impact' });
  assert.equal(paused.execution.state, 'paused');
  assert.equal(store.get('omvra.goalPolicyImpacts.v1')[0].status, 'paused');
});

test('stale revisions fail and repeated command ids are idempotent', () => {
  const store = makeStore();
  const lifecycle = createGoalLifecycleService({ store, now: makeClock(), cleanup: () => ({ status: 'skipped', ok: true }) });

  const first = lifecycle.execute({ goalId: 'goal-1', command: 'start', expectedRevision: 0, commandId: 'same-command' });
  const stale = lifecycle.execute({ goalId: 'goal-1', command: 'dispatch', expectedRevision: 0, commandId: 'stale-command' });
  assert.equal(stale.error, 'REVISION_MISMATCH');

  const duplicate = lifecycle.execute({ goalId: 'goal-1', command: 'start', expectedRevision: 0, commandId: 'same-command' });
  assert.equal(duplicate.idempotent, true);
  assert.equal(duplicate.event.id, first.event.id);
  assert.equal(store.get(EVENTS_KEY).length, 1);
});

test('retry budget blocks further retries and cleanup runs after durable completion', () => {
  const store = makeStore();
  const cleanupCalls = [];
  const lifecycle = createGoalLifecycleService({
    store,
    now: makeClock(),
    cleanup(input) {
      cleanupCalls.push({ stateAtCall: store.get(EXECUTIONS_KEY)[0].state, input });
      return { ok: true, status: 'cleaned', removedFiles: ['project.md'] };
    },
  });

  lifecycle.execute({ goalId: 'goal-1', command: 'start', expectedRevision: 0, commandId: 'start' });
  lifecycle.execute({ goalId: 'goal-1', command: 'fail', expectedRevision: 1, commandId: 'fail', payload: { reason: 'test' } });
  const retry = lifecycle.execute({ goalId: 'goal-1', command: 'retry', expectedRevision: 2, commandId: 'retry', payload: { maxRetries: 1 } });
  assert.equal(retry.execution.retryCount, 1);
  lifecycle.execute({ goalId: 'goal-1', command: 'fail', expectedRevision: 3, commandId: 'fail-2', payload: { reason: 'test again' } });
  const exhausted = lifecycle.execute({ goalId: 'goal-1', command: 'retry', expectedRevision: 4, commandId: 'retry-2', payload: { maxRetries: 1 } });
  assert.equal(exhausted.error, 'BUDGET_EXHAUSTED');

  assert.equal(cleanupCalls.length, 0);
});

test('cleanup failure does not downgrade a completed execution', () => {
  const store = makeStore();
  const lifecycle = createGoalLifecycleService({
    store,
    now: makeClock(),
    cleanup() { throw new Error('disk unavailable'); },
  });

  lifecycle.execute({ goalId: 'goal-1', command: 'start', expectedRevision: 0, commandId: 'start' });
  lifecycle.execute({ goalId: 'goal-1', command: 'acknowledge', expectedRevision: 1, commandId: 'ack', payload: { contractRevision: 0 } });
  lifecycle.execute({ goalId: 'goal-1', command: 'dispatch', expectedRevision: 2, commandId: 'dispatch' });
  lifecycle.execute({ goalId: 'goal-1', command: 'submit-evidence', expectedRevision: 3, commandId: 'evidence', payload: { evidenceRefs: ['final'] } });
  lifecycle.execute({ goalId: 'goal-1', command: 'request-handoff', expectedRevision: 4, commandId: 'handoff' });
  const result = lifecycle.execute({ goalId: 'goal-1', command: 'complete', expectedRevision: 5, commandId: 'complete', payload: { finalEvidenceVerified: true, acceptanceSatisfied: true } });

  assert.equal(result.execution.state, 'complete');
  assert.equal(result.cleanup.status, 'partial-failure');
  assert.equal(store.get(EXECUTIONS_KEY)[0].state, 'complete');
});

test('dispatch enforces acknowledgement, conditions, approval gates, and dependencies', () => {
  const store = makeStore();
  const lifecycle = createGoalLifecycleService({ store, now: makeClock() });
  lifecycle.execute({ goalId: 'goal-1', command: 'start', expectedRevision: 0, commandId: 'start' });
  assert.equal(lifecycle.execute({ goalId: 'goal-1', command: 'dispatch', expectedRevision: 1, commandId: 'dispatch-no-ack' }).error, 'ACKNOWLEDGEMENT_REQUIRED');
  lifecycle.execute({ goalId: 'goal-1', command: 'acknowledge', expectedRevision: 1, commandId: 'ack', payload: { contractRevision: 0 } });
  assert.equal(lifecycle.execute({ goalId: 'goal-1', command: 'dispatch', expectedRevision: 2, commandId: 'dispatch-blocked', payload: { predecessorStates: ['working'] } }).error, 'DEPENDENCY_BLOCKED');
  assert.equal(lifecycle.execute({ goalId: 'goal-1', command: 'dispatch', expectedRevision: 2, commandId: 'dispatch-gated', payload: { conditionPending: true } }).error, 'APPROVAL_REQUIRED');
  const dispatched = lifecycle.execute({ goalId: 'goal-1', command: 'dispatch', expectedRevision: 2, commandId: 'dispatch-ok', payload: { predecessorStates: ['complete'], conditionResult: true, approvalGateStatus: 'passed' } });
  assert.equal(dispatched.execution.state, 'working');
});

test('coordination commands persist delegation, retry, escalation, approval, and handoff events', () => {
  const store = makeStore();
  const lifecycle = createGoalLifecycleService({ store, now: makeClock() });
  lifecycle.execute({ goalId: 'goal-1', command: 'start', expectedRevision: 0, commandId: 'start' });
  const delegated = lifecycle.execute({ goalId: 'goal-1', command: 'delegate', expectedRevision: 1, commandId: 'delegate', payload: { assigneeId: 'agent-2' } });
  assert.equal(delegated.execution.delegatedTo, 'agent-2');
  lifecycle.execute({ goalId: 'goal-1', command: 'escalate', expectedRevision: 2, commandId: 'escalate', payload: { reason: 'needs-review' } });
  const approved = lifecycle.execute({ goalId: 'goal-1', command: 'approve', expectedRevision: 3, commandId: 'approve', payload: { approvalGranted: true, approvedBy: 'human-1' } });
  assert.equal(approved.execution.state, 'ready');
  const eventTypes = store.get('omvra.goalExecutionEvents.v1').map(event => event.type);
  assert.ok(eventTypes.includes('goal.delegated'));
  assert.ok(eventTypes.includes('goal.failure') === false);
  assert.ok(eventTypes.includes('goal.approval.granted'));
});

test('human acceptance mode stops completion until the required actor accepts', () => {
  const store = makeStore();
  store.set('omvra.goalPolicy.v1', { acceptance: { actor: 'both' } });
  const lifecycle = createGoalLifecycleService({ store, now: makeClock() });
  lifecycle.execute({ goalId: 'goal-1', command: 'start', expectedRevision: 0, commandId: 'start' });
  lifecycle.execute({ goalId: 'goal-1', command: 'acknowledge', expectedRevision: 1, commandId: 'ack', payload: { contractRevision: 0 } });
  lifecycle.execute({ goalId: 'goal-1', command: 'dispatch', expectedRevision: 2, commandId: 'dispatch' });
  lifecycle.execute({ goalId: 'goal-1', command: 'submit-evidence', expectedRevision: 3, commandId: 'evidence', payload: { evidenceRefs: ['final'] } });
  lifecycle.execute({ goalId: 'goal-1', command: 'request-handoff', expectedRevision: 4, commandId: 'handoff' });
  lifecycle.execute({ goalId: 'goal-1', command: 'accept', expectedRevision: 5, commandId: 'agent-accept', payload: { finalEvidenceVerified: true, acceptanceActor: 'agentic' } });
  assert.equal(lifecycle.execute({ goalId: 'goal-1', command: 'complete', expectedRevision: 6, commandId: 'complete-blocked', payload: { finalEvidenceVerified: true } }).error, 'ACCEPTANCE_REQUIRED');
  lifecycle.execute({ goalId: 'goal-1', command: 'accept', expectedRevision: 6, commandId: 'human-accept', payload: { finalEvidenceVerified: true, acceptanceActor: 'human' } });
  const completed = lifecycle.execute({ goalId: 'goal-1', command: 'complete', expectedRevision: 7, commandId: 'complete', payload: { finalEvidenceVerified: true } });
  assert.equal(completed.execution.state, 'complete');
});

test('pending commands reconcile after restart without inferring completion from Markdown', () => {
  const store = makeStore();
  const lifecycle = createGoalLifecycleService({ store, now: makeClock() });
  lifecycle.execute({ goalId: 'goal-1', command: 'start', expectedRevision: 0, commandId: 'start' });
  lifecycle.markPendingCommand({ goalId: 'goal-1', command: 'dispatch', commandId: 'pending-dispatch' });
  const result = lifecycle.reconcilePending();
  assert.equal(result.executions[0].state, 'approval-required');
  assert.equal(result.executions[0].reconciliationRequired, true);
  assert.equal(result.reconciliations.at(-1).markdownCompletionIgnored, true);
  assert.ok(store.get('omvra.goalExecutionEvents.v1').some(event => event.type === 'goal.reconciled'));
});
