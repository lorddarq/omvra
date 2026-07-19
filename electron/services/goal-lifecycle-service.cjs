const { randomUUID } = require('crypto');
const { cleanupGoalArtifacts } = require('./goal-artifact-cleanup.cjs');
const {
  GOALS_KEY,
  EXECUTIONS_KEY,
  EVENTS_KEY,
  EVIDENCE_KEY,
  createEvidenceRecord,
} = require('./goal-state-service.cjs');

const STATES = [
  'ready',
  'working',
  'evidence-required',
  'handoff-pending',
  'paused',
  'approval-required',
  'blocked',
  'failed',
  'complete',
];

const COMMANDS = [
  'start',
  'dispatch',
  'acknowledge',
  'submit-evidence',
  'request-handoff',
  'accept',
  'pause',
  'resume',
  'retry',
  'fail',
  'complete',
];

function readArray(store, key) {
  const value = store.get(key);
  return Array.isArray(value) ? value : [];
}

function writeExecutionState(store, executions, events) {
  store.set(EXECUTIONS_KEY, executions);
  store.set(EVENTS_KEY, events);
}

function writeEvidence(store, evidence) {
  store.set(EVIDENCE_KEY, evidence);
}

function normalizeRevision(value) {
  const revision = Number(value);
  return Number.isFinite(revision) && revision >= 0 ? Math.floor(revision) : null;
}

function normalizeGoalId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function findGoal(store, goalId) {
  return readArray(store, GOALS_KEY).find(goal => goal && goal.id === goalId) || null;
}

function findExecution(executions, goalId) {
  return executions.find(execution => execution && execution.goalId === goalId) || null;
}

function eventFor(execution, command, actor, payload, now) {
  return {
    id: randomUUID(),
    goalId: execution.goalId,
    executionId: execution.id,
    executionRevision: execution.revision,
    type: `goal.${command}`,
    actor,
    payload: payload || {},
    createdAt: now(),
  };
}

function commandResult(execution, event, extra = {}) {
  return {
    ok: true,
    execution,
    event,
    ...extra,
  };
}

function failure(error, message, details = {}) {
  return { ok: false, error, message, ...details };
}

function createGoalLifecycleService({
  store,
  cleanup = cleanupGoalArtifacts,
  now = () => new Date().toISOString(),
} = {}) {
  if (!store || typeof store.get !== 'function' || typeof store.set !== 'function') {
    throw new TypeError('A synchronous store with get/set methods is required.');
  }

  function getExecution(goalId) {
    return findExecution(readArray(store, EXECUTIONS_KEY), goalId);
  }

  function execute({
    command,
    goalId: rawGoalId,
    expectedRevision,
    commandId,
    actor = 'overseer',
    payload = {},
  } = {}) {
    if (!COMMANDS.includes(command)) return failure('UNKNOWN_COMMAND', `Unsupported lifecycle command "${command}".`);
    const goalId = normalizeGoalId(rawGoalId);
    if (!goalId) return failure('GOAL_ID_REQUIRED', 'goalId is required.');
    if (!findGoal(store, goalId)) return failure('GOAL_NOT_FOUND', `Goal "${goalId}" was not found.`);
    if (typeof commandId !== 'string' || !commandId.trim()) return failure('COMMAND_ID_REQUIRED', 'commandId is required for idempotent lifecycle commands.');

    const executions = readArray(store, EXECUTIONS_KEY);
    const events = readArray(store, EVENTS_KEY);
    const existing = findExecution(executions, goalId);
    const prior = events.find(event => event && event.goalId === goalId && event.commandId === commandId);
    if (prior) {
      return commandResult(existing, prior, { idempotent: true });
    }

    const expected = normalizeRevision(expectedRevision);
    if (expected === null) return failure('EXPECTED_REVISION_REQUIRED', 'expectedRevision is required and must be a non-negative integer.', { currentRevision: existing ? existing.revision : 0 });
    if (existing && command === 'start') return failure('EXECUTION_EXISTS', `An execution already exists for goal "${goalId}".`);
    if (!existing && command !== 'start') return failure('EXECUTION_NOT_FOUND', `No execution exists for goal "${goalId}".`);
    if (existing && expected !== existing.revision) {
      return failure('REVISION_MISMATCH', 'Execution revision mismatch.', { currentRevision: existing.revision, expectedRevision: expected });
    }

    if (payload.interdictedCommands && payload.interdictedCommands.includes(command)) {
      return failure('INTERDICTED', `Lifecycle command "${command}" is interdicted by policy.`);
    }

    const execution = existing
      ? { ...existing }
      : {
          id: `execution_${randomUUID()}`,
          goalId,
          attempt: 1,
          revision: 0,
          state: 'ready',
          evidenceRefs: [],
          acceptanceSatisfied: false,
          cleanupStatus: 'not-requested',
          commandResults: {},
          createdAt: now(),
        };

    const transition = transitionExecution(execution, command, payload);
    if (!transition.ok) return transition;

    const nextExecution = {
      ...execution,
      ...transition.patch,
      revision: execution.revision + 1,
      updatedAt: now(),
    };
    const event = {
      ...eventFor(nextExecution, command, actor, transition.eventPayload, now),
      commandId: commandId.trim(),
    };
    nextExecution.commandResults = {
      ...execution.commandResults,
      [commandId.trim()]: { revision: nextExecution.revision, eventId: event.id },
    };

    if (command === 'submit-evidence') {
      const existingEvidence = readArray(store, EVIDENCE_KEY);
      const submitted = Array.isArray(payload.evidenceRecords)
        ? payload.evidenceRecords
        : (Array.isArray(transition.eventPayload?.evidenceRefs) ? transition.eventPayload.evidenceRefs : []);
      const records = submitted.map(item => {
        const source = item && typeof item === 'object' ? item : { ref: item };
        return createEvidenceRecord({
          goalId,
          executionId: nextExecution.id,
          ref: source.ref || source.uri || source.url,
          kind: source.kind,
          metadata: source.metadata,
          createdAt: now(),
        });
      }).filter(record => record.ref);
      if (records.length) writeEvidence(store, existingEvidence.concat(records));
    }

    const nextExecutions = existing
      ? executions.map(item => item && item.goalId === goalId ? nextExecution : item)
      : executions.concat(nextExecution);
    writeExecutionState(store, nextExecutions, events.concat(event));

    if (command === 'complete') {
      return persistCleanupOutcome({ nextExecution, event, executions: nextExecutions, events: events.concat(event), payload });
    }

    return commandResult(nextExecution, event);
  }

  function persistCleanupOutcome({ nextExecution, event, executions, events, payload }) {
    let cleanupResult;
    try {
      cleanupResult = cleanup({
        goalId: nextExecution.goalId,
        artifactRoot: payload.artifactRoot,
        userDataPath: payload.userDataPath,
        cleanupEnabled: payload.cleanupEnabled === true,
        durableRecordsVerified: true,
        finalEvidenceVerified: true,
      });
    } catch (error) {
      cleanupResult = {
        ok: false,
        status: 'partial-failure',
        reason: error instanceof Error ? error.message : String(error),
        requestedFiles: [],
        removedFiles: [],
      };
    }

    const updated = {
      ...nextExecution,
      cleanupStatus: cleanupResult.status,
      updatedAt: now(),
    };
    const cleanupEvent = {
      id: randomUUID(),
      goalId: updated.goalId,
      executionId: updated.id,
      executionRevision: updated.revision,
      type: 'goal.artifacts.cleanup',
      actor: 'lifecycle-service',
      payload: cleanupResult,
      createdAt: now(),
    };
    writeExecutionState(
      store,
      executions.map(item => item && item.goalId === updated.goalId ? updated : item),
      events.concat(cleanupEvent),
    );
    return commandResult(updated, event, { cleanup: cleanupResult, cleanupEvent });
  }

  return {
    execute,
    getExecution,
    keys: { GOALS_KEY, EXECUTIONS_KEY, EVENTS_KEY, EVIDENCE_KEY },
    states: [...STATES],
    commands: [...COMMANDS],
  };
}

function transitionExecution(execution, command, payload) {
  const state = execution.state;
  const maxRetries = Number.isFinite(Number(payload.maxRetries)) ? Math.max(0, Math.floor(Number(payload.maxRetries))) : null;
  switch (command) {
    case 'start':
      if (state !== 'ready') return failure('INVALID_TRANSITION', `Cannot start an execution in state "${state}".`);
      return { ok: true, patch: {}, eventPayload: {} };
    case 'dispatch':
      if (!['ready', 'paused'].includes(state)) return failure('INVALID_TRANSITION', `Cannot dispatch an execution in state "${state}".`);
      return { ok: true, patch: { state: 'working' }, eventPayload: {} };
    case 'acknowledge':
      if (!['ready', 'working', 'paused'].includes(state)) return failure('INVALID_TRANSITION', `Cannot acknowledge an execution in state "${state}".`);
      if (!payload.contractRevision && !payload.contractHash) return failure('CONTRACT_REQUIRED', 'contractRevision or contractHash is required for acknowledgement.');
      return {
        ok: true,
        patch: {
          acknowledged: true,
          acknowledgedContractRevision: payload.contractRevision,
          acknowledgedContractHash: payload.contractHash,
          acknowledgedAt: payload.acknowledgedAt,
        },
        eventPayload: { contractRevision: payload.contractRevision, contractHash: payload.contractHash },
      };
    case 'submit-evidence': {
      if (!['working', 'evidence-required'].includes(state)) return failure('INVALID_TRANSITION', `Cannot submit evidence in state "${state}".`);
      const refs = Array.isArray(payload.evidenceRefs) ? payload.evidenceRefs.filter(Boolean) : [];
      if (refs.length === 0) return failure('EVIDENCE_REQUIRED', 'At least one evidence reference is required.');
      return { ok: true, patch: { state: 'evidence-required', evidenceRefs: [...execution.evidenceRefs, ...refs] }, eventPayload: { evidenceRefs: refs } };
    }
    case 'request-handoff':
      if (!['evidence-required', 'working'].includes(state)) return failure('INVALID_TRANSITION', `Cannot request handoff in state "${state}".`);
      if (execution.evidenceRefs.length === 0) return failure('EVIDENCE_REQUIRED', 'Evidence is required before handoff.');
      return { ok: true, patch: { state: 'handoff-pending' }, eventPayload: {} };
    case 'accept':
      if (state !== 'handoff-pending') return failure('INVALID_TRANSITION', `Cannot accept an execution in state "${state}".`);
      if (execution.evidenceRefs.length === 0 || !payload.finalEvidenceVerified) return failure('EVIDENCE_REQUIRED', 'Verified final evidence is required before acceptance.');
      return { ok: true, patch: { acceptanceSatisfied: true, acceptedBy: payload.acceptedBy || payload.actor || 'human', acceptedAt: payload.acceptedAt }, eventPayload: {} };
    case 'complete':
      if (state !== 'handoff-pending') return failure('INVALID_TRANSITION', `Cannot complete an execution in state "${state}".`);
      if (execution.evidenceRefs.length === 0 || !payload.finalEvidenceVerified) return failure('EVIDENCE_REQUIRED', 'Verified final evidence is required before completion.');
      if (payload.acceptanceActor !== 'agentic' && !execution.acceptanceSatisfied && !payload.acceptanceSatisfied) return failure('ACCEPTANCE_REQUIRED', 'Acceptance is required before completion.');
      return { ok: true, patch: { state: 'complete', acceptanceSatisfied: true }, eventPayload: {} };
    case 'pause':
      if (['complete', 'failed'].includes(state)) return failure('INVALID_TRANSITION', `Cannot pause an execution in state "${state}".`);
      return { ok: true, patch: { state: 'paused' }, eventPayload: {} };
    case 'resume':
      if (state !== 'paused') return failure('INVALID_TRANSITION', `Cannot resume an execution in state "${state}".`);
      return { ok: true, patch: { state: 'ready' }, eventPayload: {} };
    case 'retry':
      if (!['failed', 'blocked', 'approval-required'].includes(state)) return failure('INVALID_TRANSITION', `Cannot retry an execution in state "${state}".`);
      if (maxRetries !== null && execution.retryCount >= maxRetries) return failure('BUDGET_EXHAUSTED', 'Retry budget is exhausted.');
      return { ok: true, patch: { state: 'ready', attempt: execution.attempt + 1, retryCount: (execution.retryCount || 0) + 1 }, eventPayload: {} };
    case 'fail':
      if (state === 'complete') return failure('INVALID_TRANSITION', 'A completed execution is terminal.');
      return { ok: true, patch: { state: 'failed', failureReason: payload.reason || 'unspecified' }, eventPayload: { reason: payload.reason || 'unspecified' } };
    default:
      return failure('UNKNOWN_COMMAND', `Unsupported lifecycle command "${command}".`);
  }
}

module.exports = {
  COMMANDS,
  EVENTS_KEY,
  EVIDENCE_KEY,
  EXECUTIONS_KEY,
  GOALS_KEY,
  STATES,
  createGoalLifecycleService,
};
