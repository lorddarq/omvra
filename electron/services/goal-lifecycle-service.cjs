const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const { cleanupGoalArtifacts } = require('./goal-artifact-cleanup.cjs');
const {
  GOALS_KEY,
  EXECUTIONS_KEY,
  EVENTS_KEY,
  EVIDENCE_KEY,
  createEvidenceRecord,
  normalizeAgentConfiguration,
} = require('./goal-state-service.cjs');
const { GOAL_POLICY_KEY, buildGoalContractPacket, getPendingGoalPolicyImpact, resolveGoalPolicy, resolveGoalPolicyImpact } = require('./goal-policy.cjs');
const { collectSkillRequirements, resolveRequiredSkills } = require('./skill-service.cjs');

const RECONCILIATIONS_KEY = 'omvra.goalReconciliations.v1';
const HANDOFFS_KEY = 'omvra.goalHandoffs.v1';
const PREFERENCES_KEY = 'omvra.preferences.v1';

const STATES = [
  'ready',
  'working',
  'evidence-required',
  'handoff-pending',
  'paused',
  'approval-required',
  'blocked',
  'interrupted',
  'failed',
  'complete',
];

const CLEANUP_PENDING_STATUSES = new Set(['blocked', 'invalid', 'partial-failure', 'failed']);

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
  'delegate',
  'wake',
  'escalate',
  'approve',
  'reconcile',
  'fail',
  'complete',
  'retry-cleanup',
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

function createHandoffRecord({ goalId, execution, payload, now }) {
  const produced = Array.isArray(payload?.producedArtifactReferences) ? payload.producedArtifactReferences : [];
  return {
    id: `handoff_${randomUUID()}`,
    goalId,
    executionId: execution.id,
    executionRevision: execution.revision,
    goalRevision: execution.goalRevision ?? null,
    ...(typeof payload?.deliverableId === 'string' && payload.deliverableId.trim() ? { deliverableId: payload.deliverableId.trim() } : {}),
    producedArtifactReferences: produced.filter(item => item && typeof item === 'object' && !Array.isArray(item)).map(item => ({ ...item, immutable: true })),
    deliveryFacts: payload?.deliveryFacts && typeof payload.deliveryFacts === 'object' && !Array.isArray(payload.deliveryFacts) ? { ...payload.deliveryFacts } : {},
    deliveredAt: typeof payload?.deliveredAt === 'string' ? payload.deliveredAt : now(),
    immutable: true,
    createdAt: now(),
  };
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
  const previousStatus = payload?.previousStatus ?? execution.previousState ?? null;
  const nextStatus = payload?.nextStatus ?? execution.state;
  const eventType = {
    delegate: 'goal.delegated',
    retry: 'goal.retry',
    'submit-evidence': 'goal.evidence.submitted',
    'request-handoff': 'goal.handoff.requested',
    accept: 'goal.approval.accepted',
    approve: 'goal.approval.granted',
    fail: 'goal.failure',
    reconcile: 'goal.reconciled',
  }[command] || `goal.${command}`;
  return {
    id: randomUUID(),
    goalId: execution.goalId,
    executionId: execution.id,
    executionRevision: execution.revision,
    type: eventType,
    actor,
    payload: payload || {},
    goalRevision: execution.goalRevision ?? null,
    executionAttemptId: execution.id,
    previousStatus,
    nextStatus,
    occurredAt: now(),
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

function getAuditArchiveDirectory(store, payload = {}) {
  const configured = payload.auditArchiveDirectory ?? store.get(PREFERENCES_KEY)?.goalAuditArchiveDirectory;
  return typeof configured === 'string' ? configured.trim() : '';
}

function buildAgentDelegations(store, goal) {
  const people = readArray(store, 'omvra.people.v1');
  return (goal?.elements || []).filter(element => element?.type === 'agent').map(element => {
    const configuration = normalizeAgentConfiguration(element.agentConfiguration, element.assigneeId);
    if (!configuration) return { elementId: element.id, title: element.title, status: 'not-configured', mode: null, profileSource: 'none' };
    if (configuration.mode === 'ephemeral') {
      return {
        elementId: element.id,
        title: element.title,
        status: configuration.requestedName || configuration.autoGenerateName ? 'recruitment-requested' : 'unavailable',
        mode: 'ephemeral',
        profileSource: 'none',
        requestedName: configuration.requestedName,
        requestedType: configuration.requestedType,
        autoGenerateName: configuration.autoGenerateName,
        instructions: configuration.instructions,
        recruitmentFallback: 'overseer-managed-temporary-agent',
      };
    }
    const person = people.find(candidate => candidate?.id === configuration.assigneeId && candidate.kind === 'agentic');
    if (!person) return {
      elementId: element.id,
      title: element.title,
      status: 'unavailable',
      mode: 'existing',
      assigneeId: configuration.assigneeId,
      profileSource: 'none',
      instructions: configuration.instructions,
      recruitmentFallback: configuration.spawnIfUnavailable ? 'overseer-managed-temporary-agent' : undefined,
    };
    return {
      elementId: element.id,
      title: element.title,
      status: 'resolved',
      mode: 'existing',
      assigneeId: person.id,
      profileSource: 'canonical',
      personaInstructions: typeof person.agentInstructions === 'string' ? person.agentInstructions.trim() || undefined : undefined,
      operationalInstructions: typeof person.agentOperationalInstructions === 'string' ? person.agentOperationalInstructions.trim() || undefined : undefined,
      instructions: configuration.instructions,
    };
  });
}

function buildContractPacket(store, goal, effectivePolicy, executionAttempt, now, options = {}) {
  const packet = buildGoalContractPacket({ goal, effectivePolicy, executionAttempt, now });
  const agentDelegations = buildAgentDelegations(store, goal);
  const skillRequirements = collectSkillRequirements(goal);
  const preferences = store.get(PREFERENCES_KEY) || {};
  const skillResolution = resolveRequiredSkills(skillRequirements, {
    skillsRoot: options.skillsRoot || preferences.skillsRoot,
    skillRoots: options.skillRoots || preferences.skillRoots,
    userDataPath: options.userDataPath || preferences.userDataPath,
    agentSkills: options.agentSkills || preferences.agentSkills,
    availableSkills: options.availableSkills || preferences.availableSkills,
  });
  return {
    ...packet,
    skillRequirements,
    skillReferences: skillResolution.skills,
    skillResolution: { ok: skillResolution.ok, blockingResults: skillResolution.blockingResults, diagnostics: skillResolution.diagnostics },
    agentDelegations,
    recruitmentRequests: agentDelegations.filter(item => item.status === 'recruitment-requested' || item.recruitmentFallback).map(item => ({
      elementId: item.elementId,
      mode: item.mode,
      requestedName: item.requestedName,
      requestedType: item.requestedType,
      autoGenerateName: item.autoGenerateName,
      rationale: item.mode === 'ephemeral' ? 'The node explicitly requests temporary capability-scoped recruitment.' : 'The configured canonical agent is unavailable and fallback is enabled.',
    })),
  };
}

function validateAgentDispatch({ store, goal, targetElementId }) {
  if (!targetElementId) return { ok: true };
  const element = goal?.elements?.find(item => item?.id === targetElementId);
  if (element?.type !== 'agent') return { ok: true };
  const configuration = normalizeAgentConfiguration(element.agentConfiguration, element.assigneeId);
  if (!configuration) return failure('AGENT_CONFIGURATION_REQUIRED', 'The agent node has no valid delegation configuration.', { targetElementId });
  if (configuration.mode === 'ephemeral') {
    return configuration.requestedName || configuration.autoGenerateName
      ? { ok: true }
      : failure('AGENT_CONFIGURATION_INVALID', 'Ephemeral delegation requires a task-focused name or spawn-time name generation.', { targetElementId });
  }
  const available = readArray(store, 'omvra.people.v1').some(person => person?.id === configuration.assigneeId && person.kind === 'agentic');
  if (available || configuration.spawnIfUnavailable === true) return { ok: true };
  return failure('AGENT_UNAVAILABLE', 'The configured canonical agent is unavailable and temporary recruitment fallback is disabled.', { targetElementId, assigneeId: configuration.assigneeId });
}

function appendCleanupAudit(store, record, payload = {}) {
  const directory = getAuditArchiveDirectory(store, payload);
  if (!directory) return { status: 'unconfigured' };
  const filePath = path.join(directory, 'goal-cleanup-audit.jsonl');
  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8');
    return { status: 'written', filePath };
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : String(error) };
  }
}

function validateControlInputs({ store, goal, execution, command, payload }) {
  if (['start', 'dispatch'].includes(command) && payload.contractPacket?.skillResolution?.ok === false) {
    return failure('SKILL_PREFLIGHT_BLOCKED', 'Required skills must resolve before Goal setup or dispatch.', {
      skillResolution: payload.contractPacket.skillResolution,
    });
  }
  if (command === 'dispatch') {
    if (!execution.acknowledged && payload.requireAcknowledgement !== false) {
      return failure('ACKNOWLEDGEMENT_REQUIRED', 'The current contract must be acknowledged before dispatch.');
    }
    if (payload.conditionResult === false) return failure('CONDITION_BLOCKED', 'A lifecycle condition is not satisfied.');
    if (payload.conditionPending === true) return failure('APPROVAL_REQUIRED', 'A lifecycle condition requires overseer or human review.');
    if (payload.approvalGateStatus && payload.approvalGateStatus !== 'passed') {
      return failure('APPROVAL_REQUIRED', 'The configured approval gate has not passed.');
    }
    if (execution.acknowledgedContractRevision !== payload.contractPacket?.contractRevision
      || (execution.acknowledgedContractHash && execution.acknowledgedContractHash !== payload.contractPacket?.contractHash)) {
      return failure('CONTRACT_STALE', 'The acknowledged contract no longer matches the current Goal contract packet.', {
        contractRevision: payload.contractPacket?.contractRevision,
        contractHash: payload.contractPacket?.contractHash,
      });
    }
    const predecessors = Array.isArray(payload.predecessorStates) ? payload.predecessorStates : payload.predecessors;
    if (Array.isArray(predecessors) && predecessors.some(item => (item?.state || item) !== 'complete')) {
      return failure('DEPENDENCY_BLOCKED', 'A sequence predecessor is not complete.');
    }
  }
  if (['request-handoff', 'accept', 'complete'].includes(command)) {
    const evidence = readArray(store, EVIDENCE_KEY).filter(item => item?.goalId === execution.goalId && item?.executionId === execution.id);
    const refs = new Set(evidence.map(item => item.ref));
    if (execution.evidenceRefs.some(ref => !refs.has(ref))) return failure('EVIDENCE_NOT_DURABLE', 'Every evidence reference must have a durable record for this execution.');
  }
  if (['dispatch', 'complete'].includes(command) && payload.approvalGateStatus === 'required') {
    return failure('APPROVAL_REQUIRED', 'An approval gate must be explicitly passed before continuing.');
  }
  if (command === 'reconcile' && payload.decision === 'resume' && payload.humanConfirmed !== true) {
    return failure('HUMAN_CONFIRMATION_REQUIRED', 'Resuming reconciled work requires explicit human confirmation.');
  }
  if (command === 'delegate' && !payload.assigneeId) return failure('ASSIGNEE_REQUIRED', 'Delegation requires an assigneeId.');
  if (goal?.elements && payload.targetElementId) {
    const target = goal.elements.find(element => element?.id === payload.targetElementId);
    if (target?.type === 'approval-gate' && payload.approvalGateStatus !== 'passed') return failure('APPROVAL_REQUIRED', 'The target approval gate has not passed.');
  }
  const agentValidation = validateAgentDispatch({ store, goal, targetElementId: payload.targetElementId });
  if (!agentValidation.ok) return agentValidation;
  return { ok: true };
}

function createGoalLifecycleService({
  store,
  cleanup = cleanupGoalArtifacts,
  now = () => new Date().toISOString(),
  onRuntimeChange,
  skillsRoot,
  userDataPath,
} = {}) {
  if (!store || typeof store.get !== 'function' || typeof store.set !== 'function') {
    throw new TypeError('A synchronous store with get/set methods is required.');
  }

  function notifyRuntime(change) {
    if (typeof onRuntimeChange === 'function') onRuntimeChange(change);
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
    const goal = findGoal(store, goalId);
    const effectivePolicy = resolveGoalPolicy({
      workspacePolicy: store.get(GOAL_POLICY_KEY),
      goal,
      targetElementId: payload.targetElementId,
    });
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

    if (command === 'retry-cleanup') {
      if (!existing) return failure('EXECUTION_NOT_FOUND', `No execution exists for goal "${goalId}".`);
      if (existing.state !== 'complete') return failure('GOAL_NOT_COMPLETE', 'Cleanup can only be retried after durable Goal completion.');
      if (existing.cleanupPending !== true) return failure('CLEANUP_NOT_PENDING', 'This Goal has no pending cleanup work.');
      if (payload.humanConfirmed !== true) return failure('HUMAN_CONFIRMATION_REQUIRED', 'An explicit user confirmation is required to retry cleanup.');
      return retryCleanup({ goalId, execution: existing, executions, events, commandId: commandId.trim(), actor, payload });
    }

    const pendingImpact = getPendingGoalPolicyImpact(store, goalId);
    const impactDecision = payload.policyImpactDecision;
    if (pendingImpact && command !== 'pause' && !(command === 'resume' && impactDecision === 'confirmed')) {
      return failure('POLICY_IMPACT_GATE_REQUIRED', 'A policy change requires the active Goal to pause and be reviewed before continuing.', { impact: pendingImpact });
    }

    if (payload.interdictedCommands && payload.interdictedCommands.includes(command)) {
      return failure('INTERDICTED', `Lifecycle command "${command}" is interdicted by policy.`);
    }

    const executionId = existing?.id || `execution_${randomUUID()}`;
    const execution = existing
      ? { ...existing }
      : {
          id: executionId,
          goalId,
          attempt: 1,
          revision: 0,
          state: 'ready',
          evidenceRefs: [],
          acceptanceSatisfied: false,
          cleanupStatus: 'not-requested',
          cleanupPending: false,
          commandResults: {},
          effectivePolicy,
          policyRevision: effectivePolicy.sourceRevision,
          executionAttemptId: executionId,
          contractPacket: buildContractPacket(store, goal, effectivePolicy, 1, now, { skillsRoot, userDataPath, ...payload }),
          createdAt: now(),
        };

    const currentGoalRevision = goal.revision ?? goal.__mcpRevision ?? 0;
    const refreshedContractPacket = buildContractPacket(store, goal, effectivePolicy, execution.attempt, now, { skillsRoot, userDataPath, ...payload });
    const contractPacket = command === 'dispatch'
      && execution.contractPacket
      && execution.goalRevision === currentGoalRevision
      && execution.contractPacket.contractHash === refreshedContractPacket.contractHash
      ? execution.contractPacket
      : refreshedContractPacket;
    const policyPayload = {
      ...payload,
      effectivePolicy,
      policyRevision: effectivePolicy.sourceRevision,
      executionAttemptId: execution.id,
      contractPacket,
    };
    if (command === 'acknowledge') {
      const acknowledgedRevision = normalizeRevision(policyPayload.contractRevision);
      const acknowledgedHash = typeof policyPayload.contractHash === 'string' ? policyPayload.contractHash : '';
      if (acknowledgedRevision === null && !acknowledgedHash) {
        return failure('CONTRACT_REQUIRED', 'Acknowledgement requires the current contractRevision or contractHash.', {
          contractRevision: policyPayload.contractPacket?.contractRevision,
          contractHash: policyPayload.contractPacket?.contractHash,
        });
      }
      if ((acknowledgedRevision !== null && acknowledgedRevision !== policyPayload.contractPacket?.contractRevision)
        || (acknowledgedHash && acknowledgedHash !== policyPayload.contractPacket?.contractHash)) {
        return failure('CONTRACT_STALE', 'The supplied contract no longer matches the current Goal contract packet.', {
          contractRevision: policyPayload.contractPacket?.contractRevision,
          contractHash: policyPayload.contractPacket?.contractHash,
        });
      }
    }
    const controlValidation = validateControlInputs({ store, goal, execution, command, payload: policyPayload });
    if (!controlValidation.ok) return controlValidation;
    const transition = transitionExecution(execution, command, policyPayload);
    if (!transition.ok) return transition;

    const nextExecution = {
      ...execution,
      ...transition.patch,
      previousState: execution.state,
      goalRevision: currentGoalRevision,
      effectivePolicy,
      policyRevision: effectivePolicy.sourceRevision,
      executionAttemptId: execution.id,
      contractPacket: policyPayload.contractPacket,
      revision: execution.revision + 1,
      updatedAt: now(),
    };
    if (command === 'request-handoff' || command === 'complete') {
      const handoff = createHandoffRecord({ goalId, execution: nextExecution, payload, now });
      store.set(HANDOFFS_KEY, readArray(store, HANDOFFS_KEY).concat(handoff));
      transition.eventPayload = { ...transition.eventPayload, handoffRecord: handoff };
    }
    const event = {
      ...eventFor(nextExecution, command, actor, {
        ...transition.eventPayload,
        effectivePolicy,
        policyRevision: effectivePolicy.sourceRevision,
        contractPacket: nextExecution.contractPacket,
      }, now),
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

    if (command === 'reconcile') {
      const reconciliations = readArray(store, RECONCILIATIONS_KEY);
      store.set(RECONCILIATIONS_KEY, reconciliations.concat({
        id: `reconciliation_${randomUUID()}`,
        goalId,
        executionId: nextExecution.id,
        commandId: commandId.trim(),
        decision: payload.decision || 'review-required',
        source: payload.source || 'runtime',
        markdownCompletionIgnored: true,
        createdAt: now(),
      }));
    }

    const nextExecutions = existing
      ? executions.map(item => item && item.goalId === goalId ? nextExecution : item)
      : executions.concat(nextExecution);
    writeExecutionState(store, nextExecutions, events.concat(event));

    notifyRuntime({
      scope: command === 'reconcile' ? 'reconciliation' : 'execution',
      goalId,
      revision: nextExecution.revision,
      actor,
      changeType: `lifecycle.${command}`,
    });

    if (pendingImpact && command === 'pause') resolveGoalPolicyImpact(store, goalId, 'paused', now);
    if (pendingImpact && command === 'resume' && impactDecision === 'confirmed') resolveGoalPolicyImpact(store, goalId, 'confirmed', now);

    if (command === 'complete') {
      return persistCleanupOutcome({ nextExecution, event, executions: nextExecutions, events: events.concat(event), payload });
    }

    return commandResult(nextExecution, event);
  }

  function markPendingCommand({ goalId: rawGoalId, command, commandId, payload = {}, actor = 'overseer' } = {}) {
    const goalId = normalizeGoalId(rawGoalId);
    const execution = getExecution(goalId);
    if (!execution) return failure('EXECUTION_NOT_FOUND', `No execution exists for goal "${goalId}".`);
    if (!commandId) return failure('COMMAND_ID_REQUIRED', 'commandId is required for a pending command.');
    const executions = readArray(store, EXECUTIONS_KEY);
    const next = { ...execution, pendingCommand: { command, commandId, payload, actor, recordedAt: now() }, updatedAt: now() };
    store.set(EXECUTIONS_KEY, executions.map(item => item?.goalId === goalId ? next : item));
    notifyRuntime({ scope: 'execution', goalId, revision: execution.revision, actor, changeType: 'execution.command-pending' });
    return { ok: true, execution: next };
  }

  function reconcilePending({ now: reconcileNow = now } = {}) {
    const executions = readArray(store, EXECUTIONS_KEY);
    const events = readArray(store, EVENTS_KEY);
    const reconciliations = readArray(store, RECONCILIATIONS_KEY);
    const nextExecutions = [];
    const nextEvents = [...events];
    const nextReconciliations = [...reconciliations];
    const pendingCleanupKeys = new Set(reconciliations
      .filter(item => item?.kind === 'cleanup' && item.status === 'pending')
      .map(item => `${item.goalId}:${item.executionId}`));
    for (const execution of executions) {
      if (execution?.cleanupPending === true && !pendingCleanupKeys.has(`${execution.goalId}:${execution.id}`)) {
        nextReconciliations.push({
          id: `reconciliation_${randomUUID()}`,
          kind: 'cleanup',
          goalId: execution.goalId,
          executionId: execution.id,
          status: 'pending',
          cleanupStatus: execution.cleanupStatus,
          attemptCount: 0,
          reason: 'cleanup-pending-discovered',
          createdAt: reconcileNow(),
        });
      }
      if (!execution?.pendingCommand && execution.state !== 'interrupted') { nextExecutions.push(execution); continue; }
      const next = { ...execution, state: 'approval-required', pendingCommand: undefined, reconciliationRequired: true, updatedAt: reconcileNow() };
      const event = eventFor({ ...next, previousState: execution.state }, 'reconcile', 'lifecycle-service', {
        reason: 'process-restart-or-pending-command',
        markdownCompletionIgnored: true,
        previousStatus: execution.state,
        nextStatus: next.state,
      }, reconcileNow);
      nextEvents.push(event);
      nextReconciliations.push({ id: `reconciliation_${randomUUID()}`, goalId: execution.goalId, executionId: execution.id, reason: 'pending-command', status: 'review-required', markdownCompletionIgnored: true, createdAt: reconcileNow() });
      nextExecutions.push(next);
    }
    writeExecutionState(store, nextExecutions, nextEvents);
    store.set(RECONCILIATIONS_KEY, nextReconciliations);
    for (const execution of nextExecutions.filter(item => item?.reconciliationRequired)) {
      notifyRuntime({ scope: 'reconciliation', goalId: execution.goalId, revision: execution.revision, actor: 'lifecycle-service', changeType: 'reconciliation.required' });
    }
    return { ok: true, executions: nextExecutions, events: nextEvents, reconciliations: nextReconciliations };
  }

  function persistCleanupOutcome({ nextExecution, event, executions, events, payload }) {
    const cleanupAttemptEvent = {
      id: randomUUID(),
      goalId: nextExecution.goalId,
      executionId: nextExecution.id,
      executionRevision: nextExecution.revision,
      type: 'goal.artifacts.cleanup.attempted',
      actor: 'lifecycle-service',
      payload: { status: 'pending', cleanupPending: true },
      createdAt: now(),
    };
    writeExecutionState(store, executions, events.concat(cleanupAttemptEvent));
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

    const cleanupPending = CLEANUP_PENDING_STATUSES.has(cleanupResult.status);
    const auditBase = {
      kind: 'goal-cleanup-attempt',
      goalId: nextExecution.goalId,
      executionId: nextExecution.id,
      executionRevision: nextExecution.revision,
      attempt: 1,
      cleanup: cleanupResult,
      recordedAt: now(),
    };
    const auditArchive = appendCleanupAudit(store, auditBase, payload);
    const updated = {
      ...nextExecution,
      cleanupStatus: cleanupResult.status,
      cleanupPending,
      updatedAt: now(),
    };
    const cleanupEvent = {
      id: randomUUID(),
      goalId: updated.goalId,
      executionId: updated.id,
      executionRevision: updated.revision,
      type: 'goal.artifacts.cleanup',
      actor: 'lifecycle-service',
      payload: { ...cleanupResult, cleanupPending, auditArchive },
      createdAt: now(),
    };
    const nextReconciliations = readArray(store, RECONCILIATIONS_KEY).filter(item => !(item?.kind === 'cleanup' && item.goalId === updated.goalId && item.executionId === updated.id && item.status === 'pending'));
    if (cleanupPending) {
      nextReconciliations.push({
        id: `reconciliation_${randomUUID()}`,
        kind: 'cleanup',
        goalId: updated.goalId,
        executionId: updated.id,
        status: 'pending',
        cleanupStatus: updated.cleanupStatus,
        attemptCount: 1,
        reason: cleanupResult.reason || 'cleanup-retry-available',
        createdAt: now(),
      });
    }
    writeExecutionState(store, executions.map(item => item && item.goalId === updated.goalId ? updated : item), events.concat(cleanupAttemptEvent, cleanupEvent));
    store.set(RECONCILIATIONS_KEY, nextReconciliations);
    notifyRuntime({ scope: 'reconciliation', goalId: updated.goalId, revision: updated.revision, actor: 'lifecycle-service', changeType: 'reconciliation.cleanup' });
    return commandResult(updated, event, { cleanup: cleanupResult, cleanupEvent });
  }

  function retryCleanup({ goalId, execution, executions, events, commandId, actor, payload }) {
    const cleanupAttemptEvent = { id: randomUUID(), goalId, executionId: execution.id, executionRevision: execution.revision + 1, type: 'goal.artifacts.cleanup.attempted', actor, commandId, payload: { status: 'pending', cleanupPending: true, retry: true }, createdAt: now() };
    writeExecutionState(store, executions, events.concat(cleanupAttemptEvent));
    let cleanupResult;
    try {
      cleanupResult = cleanup({
        goalId,
        artifactRoot: payload.artifactRoot,
        userDataPath: payload.userDataPath,
        cleanupEnabled: payload.cleanupEnabled !== false,
        durableRecordsVerified: true,
        finalEvidenceVerified: true,
      });
    } catch (error) {
      cleanupResult = { ok: false, status: 'partial-failure', reason: error instanceof Error ? error.message : String(error), requestedFiles: [], removedFiles: [] };
    }
    const priorAttempt = readArray(store, RECONCILIATIONS_KEY).find(item => item?.kind === 'cleanup' && item.goalId === goalId && item.executionId === execution.id);
    const attempt = Number(priorAttempt?.attemptCount || 1) + 1;
    const cleanupPending = CLEANUP_PENDING_STATUSES.has(cleanupResult.status);
    const auditBase = { kind: 'goal-cleanup-attempt', goalId, executionId: execution.id, executionRevision: execution.revision + 1, attempt, cleanup: cleanupResult, recordedAt: now() };
    const auditArchive = appendCleanupAudit(store, auditBase, payload);
    const updated = { ...execution, revision: execution.revision + 1, cleanupStatus: cleanupResult.status, cleanupPending, updatedAt: now() };
    const cleanupEvent = { id: randomUUID(), goalId, executionId: execution.id, executionRevision: updated.revision, type: 'goal.artifacts.cleanup.retry', actor, commandId, payload: { ...cleanupResult, cleanupPending, auditArchive, attempt }, createdAt: now() };
    const nextEvent = { ...eventFor(updated, 'retry-cleanup', actor, { cleanupStatus: cleanupResult.status, cleanupPending, attempt }, now), commandId };
    const nextReconciliations = readArray(store, RECONCILIATIONS_KEY).filter(item => !(item?.kind === 'cleanup' && item.goalId === goalId && item.executionId === execution.id));
    if (cleanupPending) nextReconciliations.push({ id: `reconciliation_${randomUUID()}`, kind: 'cleanup', goalId, executionId: execution.id, status: 'pending', cleanupStatus: cleanupResult.status, attemptCount: attempt, reason: cleanupResult.reason || 'cleanup-retry-available', createdAt: now() });
    updated.commandResults = { ...execution.commandResults, [commandId]: { revision: updated.revision, eventId: nextEvent.id } };
    writeExecutionState(store, executions.map(item => item?.goalId === goalId ? updated : item), events.concat(cleanupAttemptEvent, nextEvent, cleanupEvent));
    store.set(RECONCILIATIONS_KEY, nextReconciliations);
    notifyRuntime({ scope: 'reconciliation', goalId, revision: updated.revision, actor, changeType: 'reconciliation.cleanup-retry' });
    return commandResult(updated, nextEvent, { cleanup: cleanupResult, cleanupEvent, auditArchive });
  }

  return {
    execute,
    markPendingCommand,
    reconcilePending,
    getExecution,
    keys: { GOALS_KEY, EXECUTIONS_KEY, EVENTS_KEY, EVIDENCE_KEY, RECONCILIATIONS_KEY, PREFERENCES_KEY },
    states: [...STATES],
    commands: [...COMMANDS],
  };
}

function transitionExecution(execution, command, payload) {
  const state = execution.state;
  const retryDimension = payload.effectivePolicy?.dimensions?.retries;
  const attemptsDimension = payload.effectivePolicy?.dimensions?.attempts;
  const maxRetries = Number.isFinite(Number(payload.maxRetries))
    ? Math.max(0, Math.floor(Number(payload.maxRetries)))
    : retryDimension?.constrained === true ? Math.max(0, Math.floor(Number(retryDimension.value))) : null;
  switch (command) {
    case 'start':
      if (state !== 'ready') return failure('INVALID_TRANSITION', `Cannot start an execution in state "${state}".`);
      return { ok: true, patch: {}, eventPayload: {} };
    case 'dispatch':
      if (!['ready', 'paused'].includes(state)) return failure('INVALID_TRANSITION', `Cannot dispatch an execution in state "${state}".`);
      return { ok: true, patch: { state: 'working' }, eventPayload: {} };
    case 'acknowledge':
      if (!['ready', 'working', 'paused'].includes(state)) return failure('INVALID_TRANSITION', `Cannot acknowledge an execution in state "${state}".`);
      return {
        ok: true,
        patch: {
          acknowledged: true,
          acknowledgedContractRevision: payload.contractRevision,
          acknowledgedContractHash: payload.contractHash,
          acknowledgedPolicyRevision: payload.policyRevision,
          acknowledgedSkillReferences: payload.contractPacket?.skillReferences || [],
          acknowledgedAt: payload.acknowledgedAt,
        },
        eventPayload: {
          contractRevision: payload.contractRevision,
          contractHash: payload.contractHash,
          policyRevision: payload.policyRevision,
          skillReferences: payload.contractPacket?.skillReferences || [],
        },
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
      const acceptedAs = payload.acceptanceActor || 'human';
      return {
        ok: true,
        patch: {
          acceptanceSatisfied: true,
          humanAcceptanceSatisfied: acceptedAs === 'human' ? true : execution.humanAcceptanceSatisfied,
          agenticAcceptanceSatisfied: acceptedAs === 'agentic' ? true : execution.agenticAcceptanceSatisfied,
          acceptedBy: payload.acceptedBy || payload.actor || acceptedAs,
          acceptedAt: payload.acceptedAt,
        },
        eventPayload: { acceptanceActor: acceptedAs },
      };
    case 'complete':
      if (state !== 'handoff-pending') return failure('INVALID_TRANSITION', `Cannot complete an execution in state "${state}".`);
      if (execution.evidenceRefs.length === 0 || !payload.finalEvidenceVerified) return failure('EVIDENCE_REQUIRED', 'Verified final evidence is required before completion.');
      const acceptanceActor = payload.effectivePolicy?.acceptance?.actor || payload.acceptanceActor;
      const humanAccepted = execution.humanAcceptanceSatisfied || payload.acceptanceActor === 'human' || payload.acceptedBy;
      const agenticAccepted = execution.agenticAcceptanceSatisfied || payload.acceptanceActor === 'agentic';
      if (acceptanceActor === 'both' && (!humanAccepted || !agenticAccepted)) return failure('ACCEPTANCE_REQUIRED', 'Both human and agentic acceptance are required before completion.');
      if (acceptanceActor === 'human' && !humanAccepted && !payload.acceptanceSatisfied) return failure('ACCEPTANCE_REQUIRED', 'Human acceptance is required before completion.');
      if (acceptanceActor === 'agentic' && !agenticAccepted && !payload.acceptanceSatisfied) return failure('ACCEPTANCE_REQUIRED', 'Agentic acceptance is required before completion.');
      return { ok: true, patch: { state: 'complete', acceptanceSatisfied: true }, eventPayload: {} };
    case 'pause':
      if (['complete', 'failed'].includes(state)) return failure('INVALID_TRANSITION', `Cannot pause an execution in state "${state}".`);
      return { ok: true, patch: { state: 'paused' }, eventPayload: {} };
    case 'resume':
      if (state !== 'paused') return failure('INVALID_TRANSITION', `Cannot resume an execution in state "${state}".`);
      return { ok: true, patch: { state: 'ready' }, eventPayload: {} };
    case 'delegate':
      if (!['ready', 'working', 'paused', 'blocked'].includes(state)) return failure('INVALID_TRANSITION', `Cannot delegate an execution in state "${state}".`);
      return { ok: true, patch: { delegatedTo: payload.assigneeId, delegatedAt: payload.delegatedAt || new Date().toISOString() }, eventPayload: { assigneeId: payload.assigneeId } };
    case 'wake':
      if (!['paused', 'blocked', 'approval-required', 'interrupted'].includes(state)) return failure('INVALID_TRANSITION', `Cannot wake an execution in state "${state}".`);
      if (state === 'approval-required' && payload.approvalGranted !== true) return failure('APPROVAL_REQUIRED', 'Wake requires an approval outcome.');
      return { ok: true, patch: { state: 'ready', wakeReason: payload.reason || 'overseer-wake' }, eventPayload: { reason: payload.reason || 'overseer-wake' } };
    case 'escalate':
      if (['complete', 'failed'].includes(state)) return failure('INVALID_TRANSITION', `Cannot escalate an execution in state "${state}".`);
      return { ok: true, patch: { state: 'approval-required', escalationReason: payload.reason || 'overseer-escalation' }, eventPayload: { reason: payload.reason || 'overseer-escalation' } };
    case 'approve':
      if (state !== 'approval-required') return failure('INVALID_TRANSITION', `Cannot approve an execution in state "${state}".`);
      if (payload.approvalGranted !== true) return failure('APPROVAL_REQUIRED', 'An explicit approval outcome is required.');
      return { ok: true, patch: { state: 'ready', approvalGranted: true, approvedBy: payload.approvedBy || payload.actor || 'human' }, eventPayload: { approvedBy: payload.approvedBy || payload.actor || 'human' } };
    case 'reconcile':
      if (!['interrupted', 'approval-required', 'blocked', 'paused'].includes(state)) return failure('INVALID_TRANSITION', `Cannot reconcile an execution in state "${state}".`);
      if (!payload.decision) return failure('RECONCILIATION_DECISION_REQUIRED', 'A reconciliation decision is required.');
      return { ok: true, patch: { state: payload.decision === 'resume' ? 'ready' : 'approval-required', reconciliationRequired: false, reconciliationDecision: payload.decision }, eventPayload: { decision: payload.decision } };
    case 'retry':
      if (!['failed', 'blocked', 'approval-required'].includes(state)) return failure('INVALID_TRANSITION', `Cannot retry an execution in state "${state}".`);
      if (maxRetries !== null && execution.retryCount >= maxRetries) return failure('BUDGET_EXHAUSTED', 'Retry budget is exhausted.', { stopState: 'approval-required' });
      if (attemptsDimension?.constrained === true && execution.attempt >= Math.floor(Number(attemptsDimension.value))) return failure('BUDGET_EXHAUSTED', 'Total loop-attempt budget is exhausted.', { stopState: 'approval-required' });
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
  RECONCILIATIONS_KEY,
  HANDOFFS_KEY,
  STATES,
  createGoalLifecycleService,
};
