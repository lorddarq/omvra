const { createAgentRuntimeSessionService } = require('../domain/agent-runtime-session-service.cjs');

const DAY = 86_400_000;
const DEFAULT_POLICY = Object.freeze({ eventDays: 7, eventsPerSession: 2000, events: 20000, notificationDays: 7, notifications: 500, sessionDays: 30, sessions: 1000, turns: 10000, summaryDays: 30, projections: 1000, automatic: true });
const LIMITS = Object.freeze({ queue: 256, reserved: 32, bytes: 1048576, batch: 32, prune: 200, databaseBytes: 512 * 1048576, walBytes: 256 * 1048576 });
function fail(code) { throw Object.assign(new Error(code), { code }); }
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) fail('INVALID_AGENT_WORK_INPUT');
}
function identifier(value, optional = false, max = 160) {
  if (optional && (value === undefined || value === null || value === '')) return undefined;
  if (typeof value !== 'string' || value.length > max || Buffer.byteLength(value) > max || !/^[a-zA-Z0-9._:/-]+$/.test(value) || /(?:https?:|bearer|secret|password|token=)/i.test(value)) fail('INVALID_AGENT_WORK_IDENTIFIER');
  return value;
}
function integer(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('INVALID_AGENT_WORK_NUMBER');
  return value;
}
function timestamp(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || Date.parse(value) < 0) fail('INVALID_AGENT_WORK_TIMESTAMP');
  return new Date(value).toISOString();
}
function domainService(options = {}) {
  return createAgentRuntimeSessionService({ readBindings: () => [], writeBindings: () => {}, readEvents: () => [], writeEvents: () => {}, attachBindingToAttempt: () => ({ ok: true }), appendTaskContext: () => ({ ok: true }), normalizeString: value => typeof value === 'string' ? value.trim() : '', ...options });
}
const normalizer = domainService();
function capabilities(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 50) fail('INVALID_AGENT_WORK_INPUT');
  const result = value.map(item => {
    object(item, ['id', 'support', 'version']);
    if (!['supported', 'unsupported', 'unknown'].includes(item.support)) fail('INVALID_AGENT_WORK_INPUT');
    return { id: identifier(item.id), support: item.support, ...(item.version === undefined ? {} : { version: identifier(item.version, false, 64) }) };
  });
  if (Buffer.byteLength(JSON.stringify(result)) > 16384) fail('INVALID_AGENT_WORK_INPUT');
  return result;
}
function turn(value) {
  if (value === undefined) return undefined;
  object(value, ['id', 'state', 'requestId', 'createdAt', 'updatedAt', 'startedAt', 'finishedAt', 'terminalReason']);
  const result = { id: identifier(value.id), state: identifier(value.state) };
  for (const field of ['requestId', 'terminalReason']) if (value[field] !== undefined) result[field] = identifier(String(value[field]));
  for (const field of ['createdAt', 'updatedAt', 'startedAt', 'finishedAt']) if (value[field] !== undefined) result[field] = timestamp(value[field]);
  return result;
}
function normalizeCommand(method, input = {}) {
  if (method === 'migrationSession') {
    object(input, ['binding', 'digest']);
    const b = input.binding;
    object(b, ['id','revision','runtimeProfileId','idempotencyKey','scope','state','capabilities','createdAt','updatedAt','lastObservedAt','opaqueSessionRef','terminalReason','turn','schemaVersion']);
    const created = normalizeCommand('createSession', { runtimeProfileId:b.runtimeProfileId,scope:b.scope,idempotencyKey:b.idempotencyKey,capabilities:b.capabilities });
    return { digest:identifier(input.digest), binding:{ ...created,id:identifier(b.id),revision:integer(b.revision),state:identifier(b.state),schemaVersion:1,createdAt:timestamp(b.createdAt),updatedAt:timestamp(b.updatedAt),lastObservedAt:timestamp(b.lastObservedAt),...(b.opaqueSessionRef ? {opaqueSessionRef:identifier(b.opaqueSessionRef,false,512)} : {}),...(b.terminalReason ? {terminalReason:identifier(b.terminalReason)} : {}),...(b.turn ? {turn:turn(b.turn)} : {}) } };
  }
  if (method === 'migrationFinalize') { object(input, ['bindingId']); return {bindingId:identifier(input.bindingId)}; }
  if (method === 'migrationEvent') {
    object(input, ['event']);
    return normalizeCommand('appendEvent', input.event);
  }
  if (method === 'createSession') {
    object(input, ['runtimeProfileId', 'scope', 'idempotencyKey', 'capabilities', 'turn']);
    object(input.scope, ['kind', 'taskId', 'contributionId', 'executionAttemptId', 'taskRevision', 'goalId', 'goalElementId', 'goalExecutionId', 'executionAttempt', 'goalRevision']);
    const scope = {};
    for (const [key, value] of Object.entries(input.scope).filter(([key,value])=>value!==undefined && !(key==='contributionId' && value===null))) scope[key] = ['taskRevision', 'goalRevision', 'executionAttempt'].includes(key) ? integer(value) : identifier(value);
    if (input.turn && ['completed', 'failed', 'interrupted'].includes(input.turn.state)) fail('AGENT_WORK_COMPLETION_REQUIRED');
    return { runtimeProfileId: identifier(input.runtimeProfileId), scope, idempotencyKey: identifier(input.idempotencyKey), capabilities: capabilities(input.capabilities), turn: turn(input.turn) };
  }
  if (method === 'updateSession') {
    object(input, ['bindingId', 'expectedRevision', 'state', 'opaqueSessionRef', 'terminalReason', 'capabilities', 'turn', 'recoveryRequired']);
    const result = { bindingId: identifier(input.bindingId), expectedRevision: integer(input.expectedRevision) };
    for (const key of ['state', 'terminalReason']) if (input[key] !== undefined) result[key] = identifier(input[key]);
    if (input.opaqueSessionRef !== undefined) result.opaqueSessionRef = identifier(input.opaqueSessionRef, true, 512) || '';
    if (input.capabilities !== undefined) result.capabilities = capabilities(input.capabilities);
    if (input.turn !== undefined) result.turn = turn(input.turn);
    if (input.recoveryRequired !== undefined) {
      if (typeof input.recoveryRequired !== 'boolean') fail('INVALID_AGENT_WORK_INPUT');
      result.recoveryRequired = input.recoveryRequired;
    }
    return result;
  }
  if (method === 'appendEvent') {
    object(input, ['id', 'bindingId', 'runtimeProfileId', 'turnId', 'seq', 'idempotencyKey', 'kind', 'state', 'outcome', 'sourceProtocol', 'nativeEventType', 'observedAt', 'requestId', 'capabilityId', 'permissionState', 'inputTokens', 'outputTokens', 'totalTokens', 'contextTokens', 'cost', 'currency', 'usageAggregation']);
    const clean = {};
    for (const [key, value] of Object.entries(input)) {
      if (['seq', 'inputTokens', 'outputTokens', 'totalTokens', 'contextTokens'].includes(key)) clean[key] = integer(value, key === 'seq' ? 1 : 0);
      else if (key === 'cost') {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) fail('INVALID_AGENT_WORK_NUMBER');
        clean[key] = value;
      } else if (key === 'observedAt') clean[key] = timestamp(value);
      else clean[key] = identifier(value);
    }
    clean.bindingId = identifier(input.bindingId);
    clean.runtimeProfileId = identifier(input.runtimeProfileId);
    clean.idempotencyKey = identifier(input.idempotencyKey);
    const normalized = normalizer.normalizeEvent(clean);
    if (!normalized.ok) fail(normalized.error);
    // Generated once before enqueueing so worker retries retain the same identity/time.
    return { ...normalized.event, idempotencyKey: clean.idempotencyKey, seq: clean.seq };
  }
  if (method === 'completeTurn') {
    object(input, ['bindingId', 'expectedRevision', 'turnId', 'outcome', 'idempotencyKey']);
    if (!['completed', 'failed', 'interrupted'].includes(input.outcome)) fail('INVALID_ACP_TURN_TRANSITION');
    return { bindingId: identifier(input.bindingId), expectedRevision: integer(input.expectedRevision), turnId: identifier(input.turnId), outcome: input.outcome, idempotencyKey: identifier(input.idempotencyKey) };
  }
  if (method === 'governance') { object(input,['bindingId']);return {bindingId:identifier(input.bindingId)}; }
  if (method === 'snapshot') {
    object(input, ['bindingId', 'limit', 'afterSeq']);
    return { bindingId: identifier(input.bindingId), limit: input.limit === undefined ? 50 : integer(input.limit, 1, 100), afterSeq: input.afterSeq === undefined ? 0 : integer(input.afterSeq) };
  }
  if (method === 'listSessions') {
    object(input, ['limit', 'afterId', 'taskId', 'activeOnly', 'recent']);
    return { limit: input.limit === undefined ? 50 : integer(input.limit, 1, 100), afterId: identifier(input.afterId, true) || '', taskId: identifier(input.taskId, true) || null, activeOnly:input.activeOnly===true, recent:input.recent===true };
  }
  if (method === 'preview') { object(input,['policy']); return input.policy === undefined ? {} : {policy:normalizeCommand('setPolicy',input.policy)}; }
  if (method === 'setPolicy') {
    object(input, Object.keys(DEFAULT_POLICY));
    const policy = { ...DEFAULT_POLICY, ...input };
    for (const key of Object.keys(DEFAULT_POLICY)) {
      if (key.endsWith('Days')) { if (![1, 7, 30, 90].includes(policy[key])) fail('INVALID_RETENTION_POLICY'); }
      else if (key === 'automatic') { if (typeof policy[key] !== 'boolean') fail('INVALID_RETENTION_POLICY'); }
      else integer(policy[key], 1, DEFAULT_POLICY[key] * 10);
    }
    if (policy.eventsPerSession > policy.events || policy.summaryDays > policy.sessionDays) fail('INVALID_RETENTION_POLICY');
    return policy;
  }
  if (method === 'saveDelivery') {
    object(input, ['bindingId', 'surface', 'lastSnapshotVersion', 'lastSentSeq', 'quietUntil']);
    if (!['supervisor', 'status', 'toast'].includes(input.surface)) fail('INVALID_AGENT_WORK_INPUT');
    return { bindingId: identifier(input.bindingId), surface: input.surface, lastSnapshotVersion: integer(input.lastSnapshotVersion), lastSentSeq: integer(input.lastSentSeq), quietUntil: input.quietUntil == null ? null : integer(input.quietUntil) };
  }
  if (method === 'ackNotification') {
    object(input, ['id', 'dismiss']);
    if (input.dismiss !== undefined && typeof input.dismiss !== 'boolean') fail('INVALID_AGENT_WORK_INPUT');
    return { id: identifier(input.id), dismiss: input.dismiss === true };
  }
  if (['metrics', 'prune', 'checkpoint', 'compact', 'close', 'migrationVerify'].includes(method)) { object(input, []); return {}; }
  fail('INVALID_AGENT_WORK_COMMAND');
}
// Only source fields represented by the six-table schema participate in migration verification.
function migrationIdentity(b) {
  const t=b.turn;
  return [b.id,b.revision,b.idempotencyKey,b.runtimeProfileId,Object.entries(b.scope).filter(([,v])=>v!==undefined).sort(([a],[z])=>a<z?-1:1),b.state,b.capabilities,b.createdAt,b.opaqueSessionRef||null,b.terminalReason||null,
    t ? [t.id,t.state,t.createdAt,t.startedAt||null,t.finishedAt||null,t.requestId||null] : null];
}
function safeError(error) {
  const sqlite = Number(error?.errcode) & 255;
  const code = sqlite === 5 || sqlite === 6 ? 'SQLITE_BUSY' : sqlite === 13 ? 'SQLITE_FULL' : sqlite === 8 ? 'SQLITE_READONLY' : sqlite === 11 || sqlite === 26 ? 'SQLITE_CORRUPT' : sqlite === 19 ? 'SQLITE_CONSTRAINT' : /^[A-Z][A-Z0-9_]{1,70}$/.test(error?.code || '') ? error.code : 'AGENT_WORK_STORAGE_FAILED';
  return { code, message: code }; // Never return SQL, content, file paths or provider errors.
}
module.exports = { DAY, DEFAULT_POLICY, LIMITS, domainService, normalizeCommand, safeError, fail, migrationIdentity };
