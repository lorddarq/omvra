const { randomUUID } = require('crypto');

const GOAL_SCHEMA_VERSION = 1;
const GOALS_KEY = 'omvra.goals.v1';
const EXECUTIONS_KEY = 'omvra.goalExecutions.v1';
const EVENTS_KEY = 'omvra.goalExecutionEvents.v1';
const EVIDENCE_KEY = 'omvra.goalEvidence.v1';

const GOAL_ELEMENT_TYPES = new Set(['goal', 'subgoal', 'agent', 'connector', 'instructions', 'condition', 'approval-gate', 'human-input', 'retry', 'artifact', 'deliverable']);
const GOAL_STATUSES = new Set(['draft', 'working', 'blocked', 'complete']);
const CONNECTOR_SIDES = new Set(['top', 'right', 'bottom', 'left']);
const GOAL_AGENT_MODES = new Set(['existing', 'ephemeral']);
const GOAL_ARTIFACT_TYPES = new Set(['task', 'milestone', 'goal', 'document', 'file', 'url', 'user-defined']);
const GOAL_DELIVERABLE_STATUSES = new Set(['planned', 'in-progress', 'ready-for-review', 'accepted', 'rejected']);

function prefixedId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRevision(value) {
  const revision = Number(value);
  return Number.isFinite(revision) && revision >= 0 ? Math.floor(revision) : 0;
}

function normalizePolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return undefined;
  // Spread first so fields added by newer versions survive older round trips.
  const normalized = { ...policy };
  if (policy.acceptanceActor && !['human', 'agentic', 'both'].includes(policy.acceptanceActor)) delete normalized.acceptanceActor;
  for (const field of ['financialBudgetMode', 'tokenBudgetMode', 'timeBudgetMode', 'concurrencyBudgetMode', 'retryBudgetMode']) {
    if (policy[field] && !['hard-cap', 'goal-pool', 'approval-required', 'unbounded'].includes(policy[field])) delete normalized[field];
  }
  for (const field of ['maxRetries', 'maxLoopAttempts', 'maxConcurrentLoops']) {
    if (Object.prototype.hasOwnProperty.call(policy, field)) {
      const value = Number(policy[field]);
      if (Number.isFinite(value) && value >= 0) normalized[field] = Math.floor(value);
      else delete normalized[field];
    }
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

function normalizeAgentConfiguration(configuration, legacyAssigneeId) {
  if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
    const assigneeId = normalizeString(legacyAssigneeId);
    return assigneeId ? { version: 1, mode: 'existing', assigneeId, instructions: '' } : undefined;
  }
  const mode = GOAL_AGENT_MODES.has(configuration.mode) ? configuration.mode : 'existing';
  const normalized = {
    version: 1,
    mode,
    instructions: normalizeString(configuration.instructions),
  };
  for (const field of ['assigneeId', 'requestedName', 'requestedType']) {
    const value = normalizeString(configuration[field]);
    if (value) normalized[field] = value;
  }
  if (configuration.spawnIfUnavailable === true) normalized.spawnIfUnavailable = true;
  if (configuration.autoGenerateName === true) normalized.autoGenerateName = true;
  if (configuration.workAsSubagent === true) normalized.workAsSubagent = true;
  if (mode === 'existing' && !normalized.assigneeId) return undefined;
  if (mode === 'ephemeral' && !normalized.requestedName && !normalized.autoGenerateName) return undefined;
  return normalized;
}

function normalizeArtifactReferences(references) {
  if (!Array.isArray(references)) return [];
  const seen = new Set();
  return references.map(reference => {
    if (!reference || typeof reference !== 'object' || Array.isArray(reference)) return null;
    const artifactType = GOAL_ARTIFACT_TYPES.has(reference.artifactType) ? reference.artifactType : null;
    const artifactId = normalizeString(reference.artifactId);
    if (!artifactType || !artifactId) return null;
    const key = `${artifactType}:${artifactId}`;
    if (seen.has(key)) return null;
    seen.add(key);
    const normalized = {
      ...reference,
      id: normalizeString(reference.id) || prefixedId('artifact-link'),
      artifactType,
      artifactId,
    };
    delete normalized.content;
    delete normalized.contents;
    delete normalized.copiedContents;
    if (reference.contribution === 'supporting' || reference.contribution === 'deliverable') normalized.contribution = reference.contribution;
    for (const field of ['label', 'kind', 'format', 'locator', 'contentHash', 'sourceTaskId', 'sourceAttachmentId']) {
      const value = normalizeString(reference[field]);
      if (value) normalized[field] = value;
      else delete normalized[field];
    }
    for (const field of ['role', 'linkedAt', 'linkedBy']) {
      const value = normalizeString(reference[field]);
      if (value) normalized[field] = value;
      else delete normalized[field];
    }
    const sourceRevision = Number(reference.sourceRevision);
    if (Number.isFinite(sourceRevision) && sourceRevision >= 0) normalized.sourceRevision = Math.floor(sourceRevision);
    else delete normalized.sourceRevision;
    return normalized;
  }).filter(Boolean);
}

function normalizeElement(element) {
  if (!element || typeof element !== 'object' || Array.isArray(element)) return null;
  const type = GOAL_ELEMENT_TYPES.has(element.type) ? element.type : 'subgoal';
  const normalized = {
    ...element,
    id: normalizeString(element.id) || prefixedId(type === 'connector' ? 'connector' : 'element'),
    type,
    title: normalizeString(element.title) || 'Untitled element',
    x: Number.isFinite(Number(element.x)) ? Number(element.x) : 0,
    y: Number.isFinite(Number(element.y)) ? Number(element.y) : 0,
  };
  if (element.status !== undefined) normalized.status = GOAL_STATUSES.has(element.status) ? element.status : 'draft';
  if (element.sourceSide !== undefined) normalized.sourceSide = CONNECTOR_SIDES.has(element.sourceSide) ? element.sourceSide : undefined;
  if (element.targetSide !== undefined) normalized.targetSide = CONNECTOR_SIDES.has(element.targetSide) ? element.targetSide : undefined;
  if (element.type === 'human-input') {
    const prompt = normalizeString(element.humanInputPrompt);
    if (prompt) normalized.humanInputPrompt = prompt;
    else delete normalized.humanInputPrompt;
  }
  if (element.type === 'retry') {
    const maxAttempts = Number(element.retryMaxAttempts);
    if (Number.isFinite(maxAttempts) && maxAttempts >= 1) normalized.retryMaxAttempts = Math.floor(maxAttempts);
    else delete normalized.retryMaxAttempts;
    if (['human-review', 'fail-goal'].includes(element.retryExhaustionPolicy)) normalized.retryExhaustionPolicy = element.retryExhaustionPolicy;
    else delete normalized.retryExhaustionPolicy;
  }
  if (element.type === 'deliverable') {
    const deliverySpec = element.deliverySpec && typeof element.deliverySpec === 'object' && !Array.isArray(element.deliverySpec) ? element.deliverySpec : {};
    const outcomeKind = ['file', 'summary', 'conclusion', 'resolution', 'other'].includes(deliverySpec.outcomeKind) ? deliverySpec.outcomeKind : 'other';
    const instructions = normalizeString(deliverySpec.instructions);
    normalized.deliverySpec = {
      outcomeKind,
      instructions,
      format: normalizeString(deliverySpec.format) || undefined,
      destination: normalizeString(deliverySpec.destination) || undefined,
      recipient: normalizeString(deliverySpec.recipient) || undefined,
      acceptanceCriteria: Array.isArray(deliverySpec.acceptanceCriteria) ? deliverySpec.acceptanceCriteria.map(normalizeString).filter(Boolean) : [],
    };
    const expectedArtifactCount = Number(deliverySpec.expectedArtifactCount);
    if (Number.isFinite(expectedArtifactCount) && expectedArtifactCount >= 0) normalized.deliverySpec.expectedArtifactCount = Math.floor(expectedArtifactCount);
    normalized.deliverableStatus = GOAL_DELIVERABLE_STATUSES.has(element.deliverableStatus) ? element.deliverableStatus : 'planned';
  }
  if (element.type === 'artifact') {
    normalized.artifactRole = 'supporting';
  } else {
    delete normalized.artifactRole;
  }
  if (element.type === 'agent') {
    const agentConfiguration = normalizeAgentConfiguration(element.agentConfiguration, element.assigneeId);
    if (agentConfiguration) normalized.agentConfiguration = agentConfiguration;
    else delete normalized.agentConfiguration;
    if (agentConfiguration?.mode === 'existing') normalized.assigneeId = agentConfiguration.assigneeId;
    else delete normalized.assigneeId;
  }
  if (element.type === 'goal' || element.type === 'subgoal' || element.type === 'artifact') {
    normalized.artifactReferences = normalizeArtifactReferences(element.artifactReferences);
    if (normalized.artifactReferences.length === 0) delete normalized.artifactReferences;
  } else {
    delete normalized.artifactReferences;
  }
  const policy = normalizePolicy(element.policy);
  if (policy) normalized.policy = policy;
  else delete normalized.policy;
  return normalized;
}

function normalizeGoal(goal) {
  if (!goal || typeof goal !== 'object' || Array.isArray(goal)) return null;
  const rawElements = Array.isArray(goal.elements) ? goal.elements : [];
  const normalizedElements = rawElements.map(normalizeElement).filter(Boolean);
  const migratedIds = new Set(normalizedElements.map(element => element.id));
  for (const rawElement of rawElements) {
    if (rawElement?.type !== 'deliverable' || !Array.isArray(rawElement.artifactReferences)) continue;
    const references = normalizeArtifactReferences(rawElement.artifactReferences).map(reference => ({ ...reference, contribution: 'supporting' }));
    references.forEach((reference, index) => {
      const migratedId = `artifact_migrated_${rawElement.id}_${reference.id}`;
      if (migratedIds.has(migratedId)) return;
      migratedIds.add(migratedId);
      normalizedElements.push({
        id: migratedId,
        type: 'artifact',
        artifactRole: 'supporting',
        title: reference.label || 'Supporting artifact',
        body: 'Migrated from a deliverable artifact link.',
        x: Number(rawElement.x || 0) + 40 + (index * 24),
        y: Number(rawElement.y || 0) + 180,
        artifactReferences: [reference],
      });
    });
  }
  const normalized = {
    ...goal,
    schemaVersion: Number.isFinite(Number(goal.schemaVersion)) ? Number(goal.schemaVersion) : GOAL_SCHEMA_VERSION,
    id: normalizeString(goal.id) || prefixedId('goal'),
    title: normalizeString(goal.title) || 'Untitled goal',
    updatedAt: normalizeString(goal.updatedAt) || new Date().toISOString(),
    revision: normalizeRevision(goal.revision ?? goal.__mcpRevision),
    elements: normalizedElements,
  };
  const policy = normalizePolicy(goal.policy);
  if (policy) normalized.policy = policy;
  else delete normalized.policy;
  return normalized;
}

function readArray(store, key) {
  const value = store.get(key);
  return Array.isArray(value) ? value : [];
}

function readGoalRecords(store) {
  return readArray(store, GOALS_KEY).map(normalizeGoal).filter(Boolean);
}

function migrateGoalRecords(store) {
  const current = readArray(store, GOALS_KEY);
  const migrated = current.map(normalizeGoal).filter(Boolean);
  const changed = JSON.stringify(current) !== JSON.stringify(migrated);
  if (changed) store.set(GOALS_KEY, migrated);
  return { changed, goals: migrated };
}

function createEvidenceRecord({ goalId, executionId, ref, kind = 'artifact', metadata = {}, createdAt = new Date().toISOString() } = {}) {
  return {
    id: prefixedId('evidence'),
    goalId: normalizeString(goalId),
    executionId: normalizeString(executionId),
    ref: normalizeString(ref),
    kind,
    metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? { ...metadata } : {},
    immutable: true,
    createdAt,
  };
}

module.exports = {
  GOAL_SCHEMA_VERSION,
  GOALS_KEY,
  EXECUTIONS_KEY,
  EVENTS_KEY,
  EVIDENCE_KEY,
  prefixedId,
  normalizePolicy,
  normalizeAgentConfiguration,
  normalizeElement,
  normalizeGoal,
  readGoalRecords,
  migrateGoalRecords,
  createEvidenceRecord,
};
