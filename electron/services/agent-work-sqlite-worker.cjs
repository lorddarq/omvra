const { parentPort, workerData } = require('node:worker_threads');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const { randomUUID, createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { DAY, DEFAULT_POLICY, LIMITS, domainService, safeError, fail, migrationIdentity } = require('./agent-work-contract.cjs');

let db;
let policy = DEFAULT_POLICY;
let policyVersion = 0;
let lastWrite = Date.now();
let lastCheckpoint = Date.now();
const maintenance = { deletedRows: 0, pruneDurationMs: 0, lastPrune: null, lastCheckpoint: null, lastCompaction: null, busyRetries: 0, lastError: null };
const all = (sql, ...args) => db.prepare(sql).all(...args);
const get = (sql, ...args) => db.prepare(sql).get(...args);
const run = (sql, ...args) => db.prepare(sql).run(...args);
const json = value => JSON.stringify(value);
const activeTurns = "'queued','starting','active','waiting-input','cancelling'";
const liveSessions = "'starting','ready','active','needs-input','cancelling','interrupted'";
const protectedSession = `s.recovery_required=1 OR s.state IN (${liveSessions}) OR EXISTS(SELECT 1 FROM agent_turns t WHERE t.session_id=s.id AND t.state IN (${activeTurns}))`;
const idCheck = name => `CHECK(length(CAST(${name} AS BLOB)) BETWEEN 1 AND 160)`;
const counterCheck = name => `CHECK(${name} BETWEEN 0 AND 9007199254740991)`;
function transaction(action) {
  db.exec('BEGIN IMMEDIATE');
  const deletedBefore = maintenance.deletedRows;
  try { const result = action(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); maintenance.deletedRows = deletedBefore; throw error; }
}
function openDatabase() {
  db = new DatabaseSync(workerData.databasePath, { timeout: 50 });
  db.exec('PRAGMA busy_timeout=50; PRAGMA foreign_keys=ON;');
  const version = get('PRAGMA user_version').user_version;
  if (version > 1) fail('AGENT_WORK_SCHEMA_TOO_NEW');
  if (get('PRAGMA quick_check').quick_check !== 'ok') fail('SQLITE_CORRUPT');
  if (version === 0) {
    // An unknown unversioned file is not an empty database to overwrite.
    if (get("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").n) fail('AGENT_WORK_SCHEMA_UNKNOWN');
    db.exec('PRAGMA auto_vacuum=INCREMENTAL;');
    transaction(() => db.exec(`
      CREATE TABLE agent_sessions (
        id TEXT PRIMARY KEY NOT NULL ${idCheck('id')}, revision INTEGER NOT NULL ${counterCheck('revision')},
        idempotency_key TEXT NOT NULL UNIQUE ${idCheck('idempotency_key')}, runtime_profile_id TEXT NOT NULL ${idCheck('runtime_profile_id')},
        provider TEXT, source_protocol TEXT NOT NULL CHECK(source_protocol IN ('acp','codex-app-server','claude-stream-json','unknown')),
        scope_kind TEXT NOT NULL CHECK(scope_kind IN ('task','goal-node')),
        task_id TEXT, contribution_id TEXT, attempt_id TEXT, goal_id TEXT, goal_element_id TEXT, goal_execution_id TEXT, goal_execution_attempt INTEGER,
        source_revision INTEGER NOT NULL ${counterCheck('source_revision')}, provider_session_ref TEXT CHECK(length(CAST(provider_session_ref AS BLOB))<=512),
        state TEXT NOT NULL CHECK(state IN ('starting','ready','interrupted','closed','failed','active','needs-input','cancelling')),
        attention_state TEXT NOT NULL, capabilities_json TEXT NOT NULL CHECK(json_valid(capabilities_json) AND length(CAST(capabilities_json AS BLOB))<=16384),
        created_at INTEGER NOT NULL CHECK(created_at>=0), updated_at INTEGER NOT NULL CHECK(updated_at>=created_at), last_observed_at INTEGER NOT NULL,
        finished_at INTEGER CHECK(finished_at>=created_at), terminal_reason TEXT,
        last_event_seq INTEGER NOT NULL DEFAULT 0 ${counterCheck('last_event_seq')},
        pruned_through_seq INTEGER NOT NULL DEFAULT 0 CHECK(pruned_through_seq BETWEEN 0 AND last_event_seq),
        snapshot_version INTEGER NOT NULL DEFAULT 0 ${counterCheck('snapshot_version')}, recovery_required INTEGER NOT NULL CHECK(recovery_required IN (0,1)),
        governance_json TEXT NOT NULL CHECK(json_valid(governance_json) AND length(CAST(governance_json AS BLOB))<=4096),
        CHECK((scope_kind='task' AND task_id IS NOT NULL AND attempt_id IS NOT NULL AND goal_id IS NULL AND goal_element_id IS NULL AND goal_execution_id IS NULL AND goal_execution_attempt IS NULL)
          OR (scope_kind='goal-node' AND goal_id IS NOT NULL AND goal_element_id IS NOT NULL AND goal_execution_id IS NOT NULL AND goal_execution_attempt>=0 AND task_id IS NULL AND contribution_id IS NULL AND attempt_id IS NULL))
      ) STRICT;
      CREATE INDEX sessions_task ON agent_sessions(task_id,attempt_id,updated_at,id);
      CREATE INDEX sessions_goal ON agent_sessions(goal_execution_id,id);
      CREATE INDEX sessions_finished ON agent_sessions(finished_at,id);
      CREATE TABLE agent_turns (
        id TEXT PRIMARY KEY NOT NULL ${idCheck('id')}, session_id TEXT NOT NULL REFERENCES agent_sessions(id),
        turn_index INTEGER NOT NULL CHECK(turn_index>=0), state TEXT NOT NULL CHECK(state IN (${activeTurns},'completed','failed','interrupted')),
        request_id TEXT, created_at INTEGER NOT NULL CHECK(created_at>=0), updated_at INTEGER NOT NULL CHECK(updated_at>=created_at), started_at INTEGER, finished_at INTEGER CHECK(finished_at>=created_at),
        outcome TEXT, final_summary TEXT CHECK(length(CAST(final_summary AS BLOB))<=4096), final_summary_version INTEGER NOT NULL DEFAULT 0 ${counterCheck('final_summary_version')}, error_code TEXT,
        governance_json TEXT NOT NULL CHECK(json_valid(governance_json) AND length(CAST(governance_json AS BLOB))<=4096),
        UNIQUE(session_id,turn_index), UNIQUE(session_id,id)
      ) STRICT;
      CREATE UNIQUE INDEX one_active_turn ON agent_turns((1)) WHERE state IN (${activeTurns});
      CREATE INDEX turns_finished ON agent_turns(finished_at,id);
      CREATE TABLE agent_events (
        id TEXT PRIMARY KEY NOT NULL ${idCheck('id')}, session_id TEXT NOT NULL REFERENCES agent_sessions(id), turn_id TEXT,
        seq INTEGER NOT NULL CHECK(seq BETWEEN 1 AND 9007199254740991), idempotency_key TEXT NOT NULL ${idCheck('idempotency_key')},
        kind TEXT NOT NULL, native_type TEXT NOT NULL ${idCheck('native_type')}, priority INTEGER NOT NULL CHECK(priority BETWEEN 1 AND 4),
        summary TEXT NOT NULL CHECK(length(CAST(summary AS BLOB))<=1024), facts_json TEXT NOT NULL CHECK(json_valid(facts_json) AND length(CAST(facts_json AS BLOB))<=2048),
        observed_at INTEGER NOT NULL CHECK(observed_at>=0), created_at INTEGER NOT NULL CHECK(created_at>=0),
        UNIQUE(session_id,seq), UNIQUE(session_id,idempotency_key), FOREIGN KEY(session_id,turn_id) REFERENCES agent_turns(session_id,id)
      ) STRICT;
      CREATE INDEX events_time ON agent_events(created_at,id);
      CREATE TABLE agent_work_projections (
        task_id TEXT NOT NULL, attempt_id TEXT NOT NULL, session_id TEXT NOT NULL REFERENCES agent_sessions(id),
        latest_state TEXT NOT NULL, latest_attention_state TEXT NOT NULL, latest_summary TEXT CHECK(length(CAST(latest_summary AS BLOB))<=4096),
        started_at INTEGER, finished_at INTEGER, updated_at INTEGER NOT NULL, projection_version INTEGER NOT NULL ${counterCheck('projection_version')},
        PRIMARY KEY(task_id,attempt_id)
      ) STRICT;
      CREATE INDEX projections_time ON agent_work_projections(updated_at,task_id,attempt_id);
      CREATE TABLE agent_delivery_state (
        session_id TEXT NOT NULL REFERENCES agent_sessions(id), surface TEXT NOT NULL CHECK(surface IN ('supervisor','status','toast')),
        last_snapshot_version INTEGER NOT NULL ${counterCheck('last_snapshot_version')}, last_sent_seq INTEGER NOT NULL ${counterCheck('last_sent_seq')}, quiet_until INTEGER,
        updated_at INTEGER NOT NULL, PRIMARY KEY(session_id,surface)
      ) STRICT;
      CREATE TABLE agent_notifications (
        id TEXT PRIMARY KEY NOT NULL ${idCheck('id')}, session_id TEXT NOT NULL REFERENCES agent_sessions(id), turn_id TEXT,
        priority INTEGER NOT NULL CHECK(priority BETWEEN 1 AND 4), dedupe_key TEXT NOT NULL ${idCheck('dedupe_key')},
        summary TEXT NOT NULL CHECK(length(CAST(summary AS BLOB))<=1024), created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL CHECK(expires_at>=created_at), delivered_at INTEGER, dismissed_at INTEGER,
        UNIQUE(session_id,dedupe_key), FOREIGN KEY(session_id,turn_id) REFERENCES agent_turns(session_id,id)
      ) STRICT;
      CREATE INDEX notifications_expiry ON agent_notifications(expires_at,id);
      CREATE INDEX notifications_delivery ON agent_notifications(delivered_at,created_at,id);
      PRAGMA user_version=1;
    `));
  }
  if (get('PRAGMA auto_vacuum').auto_vacuum !== 2) fail('AGENT_WORK_SCHEMA_UNKNOWN');
  if (get('PRAGMA journal_mode=WAL').journal_mode !== 'wal') fail('AGENT_WORK_WAL_UNAVAILABLE');
  db.exec('PRAGMA synchronous=FULL; PRAGMA wal_autocheckpoint=0;');
  if (get('PRAGMA foreign_key_check')) fail('SQLITE_CORRUPT');
}
function emptyGovernance() { return { schemaVersion: 1, coveredSeq: 0, turns: 0, toolCalls: 0, latestUsage: null, usageTokens: null, usageCost: null, deltaTokens: 0, deltaCost: 0, allTokensKnown: true, allCostKnown: true }; }
function session(id) { const s = get('SELECT * FROM agent_sessions WHERE id=?', id); if (!s) fail('ACP_SESSION_NOT_FOUND'); return s; }
function latestTurn(id) { return get('SELECT * FROM agent_turns WHERE session_id=? ORDER BY turn_index DESC LIMIT 1', id); }
const iso = value => new Date(value).toISOString();
function binding(s) {
  const t = latestTurn(s.id);
  return {
    schemaVersion: 1, id: s.id, revision: s.revision, runtimeProfileId: s.runtime_profile_id, idempotencyKey: s.idempotency_key,
    scope: s.scope_kind === 'task' ? { kind: 'task', taskId: s.task_id, executionAttemptId: s.attempt_id, taskRevision: s.source_revision, ...(s.contribution_id ? { contributionId: s.contribution_id } : {}) }
      : { kind: 'goal-node', goalId: s.goal_id, goalElementId: s.goal_element_id, goalExecutionId: s.goal_execution_id, executionAttempt: s.goal_execution_attempt, goalRevision: s.source_revision },
    state: s.state, capabilities: JSON.parse(s.capabilities_json), createdAt: iso(s.created_at), updatedAt: iso(s.updated_at), lastObservedAt: iso(s.last_observed_at),
    ...(s.provider_session_ref ? { opaqueSessionRef: s.provider_session_ref } : {}), ...(s.terminal_reason ? { terminalReason: s.terminal_reason } : {}),
    ...(t ? { turn: { id: t.id, state: t.state, createdAt: iso(t.created_at), updatedAt: iso(t.updated_at), ...(t.started_at == null ? {} : { startedAt: iso(t.started_at) }), ...(t.finished_at == null ? {} : { finishedAt: iso(t.finished_at) }), ...(t.request_id ? { requestId: t.request_id } : {}) } } : {}),
  };
}
function saveBinding(b, recoveryRequired) {
  const previous = get('SELECT * FROM agent_sessions WHERE id=?', b.id);
  const scope = b.scope;
  const at = Math.max(Date.now(), previous?.updated_at || 0);
  const terminal = ['closed', 'failed'].includes(b.state);
  if (recoveryRequired === false && (!terminal || (b.turn && ['queued','starting','active','waiting-input','cancelling'].includes(b.turn.state)))) fail('AGENT_WORK_RECOVERY_PROTECTED');
  run(`INSERT INTO agent_sessions(id,revision,idempotency_key,runtime_profile_id,source_protocol,scope_kind,task_id,contribution_id,attempt_id,goal_id,goal_element_id,goal_execution_id,goal_execution_attempt,source_revision,provider_session_ref,state,attention_state,capabilities_json,created_at,updated_at,last_observed_at,finished_at,terminal_reason,recovery_required,governance_json)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,state=excluded.state,attention_state=excluded.attention_state,capabilities_json=excluded.capabilities_json,provider_session_ref=excluded.provider_session_ref,updated_at=excluded.updated_at,last_observed_at=excluded.last_observed_at,finished_at=excluded.finished_at,terminal_reason=excluded.terminal_reason,recovery_required=excluded.recovery_required,snapshot_version=agent_sessions.snapshot_version+1`,
    b.id, b.revision, b.idempotencyKey, b.runtimeProfileId, 'unknown', scope.kind, scope.taskId || null, scope.contributionId || null, scope.executionAttemptId || null,
    scope.goalId || null, scope.goalElementId || null, scope.goalExecutionId || null, scope.executionAttempt ?? null, scope.taskRevision ?? scope.goalRevision,
    terminal ? null : b.opaqueSessionRef || null, b.state, b.turn?.state || b.state, json(b.capabilities), Date.parse(b.createdAt), at, at, terminal ? at : null, b.terminalReason || null,
    recoveryRequired === undefined ? previous?.recovery_required ?? 1 : Number(recoveryRequired), json(emptyGovernance()));
  if (b.turn) {
    const t = b.turn;
    const old = get('SELECT * FROM agent_turns WHERE id=?', t.id);
    if (old && old.session_id !== b.id) fail('INVALID_ACP_TURN');
    const governance = JSON.parse(session(b.id).governance_json);
    const ordinal = old?.turn_index ?? (governance.lastTurnIndex ?? -1) + 1;
    if (!old) {
      governance.lastTurnIndex = ordinal;
      run('UPDATE agent_sessions SET governance_json=? WHERE id=?', json(governance), b.id);
    }
    run(`INSERT INTO agent_turns(id,session_id,turn_index,state,request_id,created_at,updated_at,started_at,finished_at,governance_json) VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET state=excluded.state,request_id=excluded.request_id,updated_at=excluded.updated_at,started_at=excluded.started_at,finished_at=excluded.finished_at`,
      t.id, b.id, ordinal, t.state, t.requestId || null, Date.parse(t.createdAt), at, t.startedAt ? Date.parse(t.startedAt) : null, t.finishedAt ? Date.parse(t.finishedAt) : null, json(emptyGovernance()));
  }
  if(b.turn?.state==='active' && previous?.attention_state==='waiting-input') {
    const g=JSON.parse(session(b.id).governance_json);delete g.pendingAttention;
    run('UPDATE agent_sessions SET governance_json=? WHERE id=?',json(g),b.id);
  }
  project(b.id);
  if (terminal) {
    run('DELETE FROM agent_delivery_state WHERE session_id=?', b.id); // At most three surfaces.
    const governance = JSON.parse(session(b.id).governance_json);
    delete governance.pendingAttention;
    run('UPDATE agent_sessions SET governance_json=? WHERE id=?', json(governance), b.id);
  }
}
function project(id) {
  const s = session(id);
  if (!s.task_id) return;
  const t = latestTurn(id);
  run(`INSERT INTO agent_work_projections(task_id,attempt_id,session_id,latest_state,latest_attention_state,latest_summary,started_at,finished_at,updated_at,projection_version) VALUES(?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(task_id,attempt_id) DO UPDATE SET session_id=excluded.session_id,latest_state=excluded.latest_state,latest_attention_state=excluded.latest_attention_state,latest_summary=excluded.latest_summary,started_at=excluded.started_at,finished_at=excluded.finished_at,updated_at=excluded.updated_at,projection_version=excluded.projection_version`,
    s.task_id, s.attempt_id, id, t?.state || s.state, s.attention_state, t?.final_summary || null, t?.started_at ?? null, t?.finished_at ?? null, s.updated_at, s.snapshot_version);
}
function applyDomain(method, input) {
  const selected = method === 'createBinding' ? get('SELECT * FROM agent_sessions WHERE idempotency_key=?', input.idempotencyKey) : session(input.bindingId);
  const active = get(`SELECT s.* FROM agent_sessions s JOIN agent_turns t ON t.session_id=s.id WHERE t.state IN (${activeTurns}) LIMIT 1`);
  const rows = [selected, active].filter((row, index, list) => row && list.findIndex(item => item?.id === row.id) === index).map(binding);
  const domain = domainService({ now: () => iso(Math.max(Date.now(), selected?.updated_at || 0)), readBindings: () => rows, writeBindings: (_store, next) => {
    for (const b of next) if (!isDeepStrictEqual(rows.find(row => row.id === b.id), b)) saveBinding(b, input.recoveryRequired);
  } });
  const result = domain[method](null, input);
  if (!result.ok) fail(result.error);
  return result;
}
const eventSummary = {
  'session-state': 'Session state observed.', 'turn-state': 'Turn state observed.', 'plan-update': 'Plan activity observed.',
  'message-observed': 'Model output observed; content not retained.', 'tool-state': 'Tool activity observed.',
  'permission-request': 'Runtime permission state observed.', 'input-request': 'Runtime input requested.', 'usage-reported': 'Provider usage reported.',
  'cancellation-state': 'Cancellation observed.', 'session-closed': 'Session closed.', 'unsupported-event': 'Unsupported runtime event observed.',
};
function advanceGovernance(current, e, seq) {
  const g = { ...current, coveredSeq: seq };
  if (e.type === 'turn-state') g.turns++;
  if (e.type === 'tool-state') g.toolCalls++;
  if (e.usage) {
    const usage = e.usage;
    const tokens = usage.totalTokens ?? (usage.inputTokens === undefined && usage.outputTokens === undefined ? null : (usage.inputTokens || 0) + (usage.outputTokens || 0));
    const cost = usage.cost ?? null;
    g.allTokensKnown &&= tokens !== null;
    g.allCostKnown &&= cost !== null;
    g.deltaTokens += tokens ?? 0;
    g.deltaCost += cost ?? 0;
    g.usageTokens = usage.aggregation === 'cumulative' ? tokens : usage.aggregation === 'delta' && g.allTokensKnown ? g.deltaTokens : null;
    g.usageCost = usage.aggregation === 'cumulative' ? cost : usage.aggregation === 'delta' && g.allCostKnown ? g.deltaCost : null;
    g.latestUsage = { ...usage, observedAt: e.observedAt };
  }
  if (['permission-request','input-request'].includes(e.type)) g.pendingAttention = { kind: e.type, requestId: e.requestId || null, state: e.permission?.state || 'requested' };
  for (const key of ['turns','toolCalls','deltaTokens','deltaCost']) if (!Number.isFinite(g[key]) || g[key] > Number.MAX_SAFE_INTEGER) fail('AGENT_WORK_COUNTER_OVERFLOW');
  return g;
}
function removeEvent(row) {
  if (!row) return;
  run('DELETE FROM agent_events WHERE id=?', row.id);
  run('UPDATE agent_sessions SET pruned_through_seq=max(pruned_through_seq,?) WHERE id=?', row.seq, row.session_id);
  maintenance.deletedRows++;
}
function append(e, importing = false) {
  const s = session(e.bindingId);
  if (s.runtime_profile_id !== e.runtimeProfileId) fail('ACP_SESSION_NOT_FOUND');
  const seq = e.seq ?? s.last_event_seq + 1;
  if (e.seq !== undefined && seq <= s.pruned_through_seq) return { alreadyPruned: true, seq, persisted: false };
  const facts = {};
  for (const field of ['state','outcome','requestId','capabilityId','permission','usage','failureClass','sourceProtocol']) if (e[field] !== undefined) facts[field] = e[field];
  const factsJson = json(facts);
  const existing = get('SELECT * FROM agent_events WHERE session_id=? AND (idempotency_key=? OR seq=?)', s.id, e.idempotencyKey, seq);
  if (existing) {
    if (existing.idempotency_key !== e.idempotencyKey || (e.seq !== undefined && existing.seq !== seq) || existing.turn_id !== (e.turnId || null) || existing.kind !== e.type || existing.native_type !== e.nativeEventType || existing.facts_json !== factsJson) fail('IDEMPOTENCY_CONFLICT');
    return { idempotent: true, persisted: true, seq: existing.seq, event: existing };
  }
  if (seq !== s.last_event_seq + 1) fail('AGENT_WORK_SEQUENCE_GAP');
  if (!importing && e.type === 'turn-state' && ['completed','failed','interrupted'].includes(e.state || e.outcome)) {
    const finalTurn = e.turnId && get('SELECT state,final_summary_version FROM agent_turns WHERE session_id=? AND id=?', s.id, e.turnId);
    if (!finalTurn?.final_summary_version || finalTurn.state !== (e.state || e.outcome)) fail('AGENT_WORK_COMPLETION_REQUIRED');
  }
  if (!importing && (e.type === 'session-closed' || (e.type === 'session-state' && ['closed','failed'].includes(e.state))) && !['closed','failed'].includes(s.state)) fail('AGENT_WORK_COMPLETION_REQUIRED');
  if (!importing && e.turnId && ['message-observed','tool-state','plan-update','usage-reported'].includes(e.type)) {
    const currentTurn = get('SELECT state FROM agent_turns WHERE session_id=? AND id=?', s.id, e.turnId);
    if (currentTurn && ['completed','failed','interrupted'].includes(currentTurn.state)) fail('AGENT_WORK_TURN_FINISHED');
  }
  const priority = ['permission-request','input-request','cancellation-state','session-closed'].includes(e.type) ? 1 : e.type === 'message-observed' ? 4 : 2;
  const at = Math.max(Date.now(), s.updated_at);
  if(importing && (get('SELECT count(*) AS n FROM agent_events WHERE session_id=?',s.id).n>=policy.eventsPerSession || get('SELECT count(*) AS n FROM agent_events').n>=policy.events)) fail('AGENT_WORK_MIGRATION_CAPACITY');
  // Enforce count caps during ingestion too: a continuously busy producer cannot starve retention.
  if (get('SELECT count(*) AS n FROM agent_events WHERE session_id=?', s.id).n >= policy.eventsPerSession)
    removeEvent(get('SELECT id,session_id,seq FROM agent_events WHERE session_id=? ORDER BY seq LIMIT 1', s.id));
  if (get('SELECT count(*) AS n FROM agent_events').n >= policy.events)
    removeEvent(get('SELECT id,session_id,seq FROM agent_events ORDER BY created_at,session_id,seq LIMIT 1'));
  run('INSERT INTO agent_events VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', e.id, s.id, e.turnId || null, seq, e.idempotencyKey, e.type, e.nativeEventType, priority, eventSummary[e.type], factsJson, Date.parse(e.observedAt), at);
  const governance = advanceGovernance(JSON.parse(s.governance_json), e, seq);
  run('UPDATE agent_sessions SET last_event_seq=?,snapshot_version=snapshot_version+1,updated_at=?,source_protocol=?,governance_json=?,attention_state=? WHERE id=?', seq, at, e.sourceProtocol, json(governance), priority === 1 ? e.type : s.attention_state, s.id);
  if (e.turnId) {
    const t = get('SELECT * FROM agent_turns WHERE id=? AND session_id=?', e.turnId, s.id);
    run('UPDATE agent_turns SET governance_json=? WHERE id=?', json(advanceGovernance(JSON.parse(t.governance_json), e, seq)), t.id);
  }
  project(s.id);
  if (!importing && priority === 1) notify(s.id, e.turnId || null, `event:${seq}`, eventSummary[e.type], at);
  return { persisted: true, seq, event: get('SELECT * FROM agent_events WHERE id=?', e.id) };
}
function notify(id, turnId, key, summary, at) {
  if (!get('SELECT 1 FROM agent_notifications WHERE session_id=? AND dedupe_key=?', id, key) && get('SELECT count(*) AS n FROM agent_notifications').n >= policy.notifications) {
    run('DELETE FROM agent_notifications WHERE id=(SELECT id FROM agent_notifications ORDER BY created_at,id LIMIT 1)');
    maintenance.deletedRows++;
  }
  run('INSERT INTO agent_notifications(id,session_id,turn_id,priority,dedupe_key,summary,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(session_id,dedupe_key) DO NOTHING', `notification-${randomUUID()}`, id, turnId, 1, key, summary, at, at + policy.notificationDays * DAY);
}
function complete(input) {
  const s = session(input.bindingId);
  const prior = get('SELECT * FROM agent_notifications WHERE session_id=? AND dedupe_key=?', s.id, input.idempotencyKey);
  if (prior) {
    const t = get('SELECT * FROM agent_turns WHERE id=? AND session_id=?', input.turnId, s.id);
    if (prior.turn_id !== input.turnId || t?.outcome !== input.outcome) fail('IDEMPOTENCY_CONFLICT');
    return { idempotent: true, snapshot: snapshot({ bindingId: s.id, limit: 1, afterSeq: 0 }), notification: prior };
  }
  const current = latestTurn(s.id);
  if (!current || current.id !== input.turnId) fail('INVALID_ACP_TURN');
  if (['completed','failed','interrupted'].includes(current.state)) {
    if (current.outcome === input.outcome && current.final_summary_version > 0 && JSON.parse(current.governance_json).completionKey === input.idempotencyKey) return { idempotent: true, snapshot: snapshot({ bindingId: s.id, limit: 1, afterSeq: 0 }), notification: null };
    fail('INVALID_ACP_TURN_TRANSITION');
  }
  applyDomain('updateBinding', { bindingId: s.id, expectedRevision: input.expectedRevision, turn: { id: input.turnId, state: input.outcome } });
  const at = Date.now();
  const g = JSON.parse(session(s.id).governance_json);
  delete g.pendingAttention;
  const summary = `Turn ${input.outcome}; ${JSON.parse(current.governance_json).toolCalls} tool observations. Model content not retained.`;
  run('UPDATE agent_turns SET outcome=?,final_summary=?,final_summary_version=final_summary_version+1,governance_json=? WHERE id=?', input.outcome, summary, json({ ...JSON.parse(current.governance_json), completionKey: input.idempotencyKey }), input.turnId);
  run('UPDATE agent_sessions SET governance_json=?,attention_state=?,snapshot_version=snapshot_version+1 WHERE id=?', json(g), input.outcome, s.id);
  project(s.id);
  notify(s.id, input.turnId, input.idempotencyKey, summary, at);
  return { snapshot: snapshot({ bindingId: s.id, limit: 1, afterSeq: 0 }), notification: get('SELECT * FROM agent_notifications WHERE session_id=? AND dedupe_key=?', s.id, input.idempotencyKey) };
}
function snapshot(input) {
  const s = session(input.bindingId);
  const events = all('SELECT * FROM agent_events WHERE session_id=? AND seq>? ORDER BY seq DESC LIMIT ?', s.id, input.afterSeq, input.limit + 1);
  const hasMore = events.length > input.limit;
  return { binding: binding(s), session: s, turn: latestTurn(s.id) || null, events: events.slice(0, input.limit).reverse(), hasMore,
    projection: get('SELECT * FROM agent_work_projections WHERE session_id=?', s.id) || null,
    notifications: all('SELECT * FROM agent_notifications WHERE session_id=? AND dismissed_at IS NULL AND expires_at>? ORDER BY created_at DESC,id DESC LIMIT ?', s.id, Date.now(), input.limit) };
}
function sizes() {
  const size = path => { try { return fs.statSync(path).size; } catch (error) { if (error.code === 'ENOENT') return 0; throw error; } };
  const pageSize = get('PRAGMA page_size').page_size;
  const pages = get('PRAGMA page_count').page_count;
  const freePages = get('PRAGMA freelist_count').freelist_count;
  return { databaseBytes: size(workerData.databasePath), walBytes: size(`${workerData.databasePath}-wal`), logicalBytes: pages * pageSize, freeBytes: freePages * pageSize, freePages, pages };
}
function metrics() {
  const counts = {};
  for (const name of ['sessions','turns','events','work_projections','delivery_state','notifications']) counts[name] = get(`SELECT count(*) AS n FROM agent_${name}`).n;
  const protectedRecords = get(`SELECT count(*) AS count,min(created_at) AS oldest FROM agent_sessions s WHERE ${protectedSession}`);
  const size=sizes();
  const protectedIds=`SELECT s.id FROM agent_sessions s WHERE ${protectedSession}`;
  protectedRecords.categories={sessions:protectedRecords.count,
    turns:get(`SELECT count(*) AS n FROM agent_turns t WHERE t.session_id IN (${protectedIds}) AND (t.state IN (${activeTurns}) OR t.turn_index=(SELECT max(last.turn_index) FROM agent_turns last WHERE last.session_id=t.session_id))`).n,
    work_projections:get(`SELECT count(*) AS n FROM agent_work_projections WHERE session_id IN (${protectedIds})`).n,
    delivery_state:get(`SELECT count(*) AS n FROM agent_delivery_state WHERE session_id IN (${protectedIds})`).n};
  protectedRecords.estimatedBytes=Math.round(Object.values(protectedRecords.categories).reduce((a,b)=>a+b,0)*(size.logicalBytes-size.freeBytes)/Math.max(1,Object.values(counts).reduce((a,b)=>a+b,0)));
  return { ...size, counts, protectedRecords, policy, policyVersion, maintenance: { ...maintenance }, schemaVersion: 1, driver: 'node:sqlite', nodeVersion: process.versions.node, sqliteVersion: get('SELECT sqlite_version() AS version').version };
}
function retentionSelection(policy, at) {
  const protectedSql = `(${protectedSession})`;
  const summaryFloor = at - DAY;
  // Parent candidates remain in the database until every child has been deleted in bounded batches.
  const expiredSessions = `SELECT s.id FROM agent_sessions s WHERE NOT ${protectedSql} AND s.finished_at IS NOT NULL AND s.finished_at<=${summaryFloor}
    AND (s.finished_at<${at - policy.sessionDays * DAY} OR s.id IN (SELECT id FROM agent_sessions WHERE finished_at IS NOT NULL ORDER BY finished_at DESC,id DESC LIMIT -1 OFFSET ${policy.sessions}))`;
  const expiredTurns = `SELECT t.id FROM agent_turns t JOIN agent_sessions s ON s.id=t.session_id WHERE t.finished_at IS NOT NULL AND t.finished_at<=${summaryFloor}
    AND (NOT ${protectedSql} OR t.turn_index < (SELECT max(last.turn_index) FROM agent_turns last WHERE last.session_id=s.id))
    AND (t.finished_at<${at-policy.sessionDays*DAY} OR t.id IN (SELECT id FROM agent_turns WHERE finished_at IS NOT NULL ORDER BY finished_at DESC,id DESC LIMIT -1 OFFSET ${policy.turns}) OR s.id IN (${expiredSessions}))`;
  const excess = Math.max(0, get('SELECT count(*) AS n FROM agent_events').n-policy.events);
  const events = `SELECT e.session_id,max(e.seq) AS through_seq FROM agent_events e WHERE
    e.created_at<${at-policy.eventDays*DAY} OR e.session_id IN (${expiredSessions}) OR e.turn_id IN (${expiredTurns})
    OR e.seq <= (SELECT last_event_seq-${policy.eventsPerSession} FROM agent_sessions WHERE id=e.session_id)
    OR e.id IN (SELECT id FROM agent_events ORDER BY created_at,session_id,seq LIMIT ${excess})
    GROUP BY e.session_id`;
  return { events, notifications: `expires_at<=${at} OR created_at<${at-policy.notificationDays*DAY} OR session_id IN (${expiredSessions}) OR turn_id IN (${expiredTurns}) OR id IN (SELECT id FROM agent_notifications ORDER BY created_at DESC,id DESC LIMIT -1 OFFSET ${policy.notifications})`,
    delivery_state: `session_id IN (${expiredSessions})`, turns: `id IN (${expiredTurns})`,
    work_projections: `session_id IN (${expiredSessions}) OR (finished_at<${summaryFloor} AND session_id IN (SELECT s.id FROM agent_sessions s WHERE NOT ${protectedSql}) AND (finished_at<${at-policy.summaryDays*DAY} OR rowid IN (SELECT rowid FROM agent_work_projections WHERE finished_at IS NOT NULL ORDER BY finished_at DESC,rowid DESC LIMIT -1 OFFSET ${policy.projections})))`,
    sessions: `id IN (${expiredSessions})`, summaries: `SELECT t.id FROM agent_turns t JOIN agent_sessions s ON s.id=t.session_id WHERE t.final_summary IS NOT NULL AND t.finished_at<${at-policy.summaryDays*DAY} AND NOT ${protectedSql}` };
}
function preview({policy: proposed = policy} = {}) {
  const selection=retentionSelection(proposed,Date.now());
  const eligible={};
  eligible.events=get(`SELECT count(*) AS n FROM agent_events e JOIN (${selection.events}) c ON c.session_id=e.session_id AND e.seq<=c.through_seq`).n;
  for(const category of ['sessions','turns','notifications','work_projections','delivery_state']) eligible[category]=get(`SELECT count(*) AS n FROM agent_${category} WHERE ${selection[category]}`).n;
  eligible.summaries=get(`SELECT count(*) AS n FROM (${selection.summaries})`).n;
  const m=metrics(), rows=Object.values(m.counts).reduce((a,b)=>a+b,0);
  const bytesPerRow=(m.logicalBytes-m.freeBytes)/Math.max(1,rows);
  return {eligible,estimatedBytes:Math.round(Object.entries(eligible).filter(([k])=>k!=='summaries').reduce((a,[,n])=>a+n,0)*bytesPerRow),protectedRecords:{...m.protectedRecords,estimatedBytes:m.protectedRecords.estimatedBytes,reason:'Active, reusable or recovery-critical sessions retain their latest snapshot, reference and counters.'},policyVersion,policy:proposed,freeBytes:m.freeBytes};
}
function pruneBatch() {
  const start=Date.now(), at=Date.now(), budget=LIMITS.prune;
  let deleted = 0;
  let summariesCleared = 0;
  transaction(() => {
    const selection=retentionSelection(policy,at);
    const candidates=all(`${selection.events} ORDER BY session_id LIMIT ?`,budget);
    for (const candidate of candidates) {
      if (deleted >= budget) break;
      const rows = all('SELECT id,seq FROM agent_events WHERE session_id=? AND seq<=? ORDER BY seq LIMIT ?', candidate.session_id, candidate.through_seq, budget-deleted);
      for (const row of rows) run('DELETE FROM agent_events WHERE id=?', row.id);
      if (rows.length) run('UPDATE agent_sessions SET pruned_through_seq=max(pruned_through_seq,?) WHERE id=?', rows.at(-1).seq, candidate.session_id);
      deleted += rows.length;
    }
    const remove = (table, where, args=[]) => {
      if (deleted >= budget) return;
      const rows = all(`SELECT rowid AS rid FROM ${table} WHERE ${where} ORDER BY rowid LIMIT ?`, ...args, budget-deleted);
      for (const row of rows) run(`DELETE FROM ${table} WHERE rowid=?`, row.rid);
      deleted += rows.length;
    };
    remove('agent_notifications',selection.notifications);
    remove('agent_delivery_state',selection.delivery_state);
    remove('agent_turns',`${selection.turns} AND NOT EXISTS(SELECT 1 FROM agent_events e WHERE e.turn_id=agent_turns.id) AND NOT EXISTS(SELECT 1 FROM agent_notifications n WHERE n.turn_id=agent_turns.id)`);
    remove('agent_work_projections',selection.work_projections);
    remove('agent_sessions',`${selection.sessions} AND NOT EXISTS(SELECT 1 FROM agent_turns t WHERE t.session_id=agent_sessions.id) AND NOT EXISTS(SELECT 1 FROM agent_events e WHERE e.session_id=agent_sessions.id) AND NOT EXISTS(SELECT 1 FROM agent_notifications n WHERE n.session_id=agent_sessions.id) AND NOT EXISTS(SELECT 1 FROM agent_delivery_state d WHERE d.session_id=agent_sessions.id) AND NOT EXISTS(SELECT 1 FROM agent_work_projections p WHERE p.session_id=agent_sessions.id)`);
    // Summary expiry doesn't delete recovery or budget state. Updates are also bounded.
    if (deleted < budget) {
      const rows = all(`${selection.summaries} ORDER BY t.finished_at,t.id LIMIT ?`,budget-deleted);
      for (const row of rows) run('UPDATE agent_turns SET final_summary=NULL WHERE id=?', row.id);
      summariesCleared = rows.length;
    }
  });
  maintenance.deletedRows += deleted;
  maintenance.pruneDurationMs = Date.now()-start;
  maintenance.lastPrune = Date.now();
  return { deletedRows: deleted, summariesCleared, more: deleted + summariesCleared === budget, durationMs: maintenance.pruneDurationMs };
}
function checkpoint() {
  let result = get('PRAGMA wal_checkpoint(PASSIVE)');
  // PASSIVE copies frames but retains the file allocation. Reclaim it under
  // pressure without waiting for readers or deleting any recovery records.
  if (result.log === result.checkpointed && sizes().walBytes >= LIMITS.walBytes) {
    db.exec('PRAGMA busy_timeout=0');
    try { result = get('PRAGMA wal_checkpoint(TRUNCATE)'); }
    finally { db.exec('PRAGMA busy_timeout=50'); }
  }
  lastCheckpoint = Date.now();
  maintenance.lastCheckpoint = { at: lastCheckpoint, ...result };
  return result;
}
function storagePressure() {
  let size = sizes();
  if (size.walBytes >= LIMITS.walBytes) { checkpoint(); size = sizes(); }
  return size.logicalBytes >= LIMITS.databaseBytes || size.walBytes >= LIMITS.walBytes;
}
function compact() {
  const s = sizes();
  if (Date.now()-lastWrite < 30000 || get(`SELECT 1 FROM agent_sessions s WHERE ${protectedSession} LIMIT 1`)) return { deferred: true, reason: 'active-or-recovery', more: false, deletedRows: 0 };
  if (s.freeBytes < 16*1048576 || s.freePages / Math.max(1,s.pages) < 0.2) return { deferred: true, reason: 'below-threshold', more: false, deletedRows: 0 };
  db.exec('PRAGMA incremental_vacuum(128)');
  const result = get('PRAGMA wal_checkpoint(TRUNCATE)');
  maintenance.lastCompaction = { at: Date.now(), ...result };
  const after = sizes();
  return { deletedRows: 0, reclaimedBytes: Math.max(0,s.databaseBytes-after.databaseBytes), more: result.busy === 0 && after.freeBytes>=16*1048576 && after.freePages/after.pages>=0.2, busy: result.busy };
}
async function recover() {
  while (true) {
    const rows = all(`SELECT * FROM agent_sessions WHERE state IN ('starting','ready','active','needs-input','cancelling') LIMIT ?`, LIMITS.prune);
    if (!rows.length) break;
    transaction(() => {
      for (const s of rows) {
        const at = Math.max(Date.now(),s.updated_at);
        run(`UPDATE agent_turns SET request_id=NULL,state='interrupted',outcome='interrupted',final_summary='Runtime interrupted; reopen supervision before resuming.',final_summary_version=final_summary_version+1,finished_at=?,updated_at=? WHERE session_id=? AND state IN (${activeTurns})`, at, at, s.id);
        run("UPDATE agent_sessions SET state='interrupted',attention_state='interrupted',terminal_reason='process-exit',recovery_required=1,revision=revision+1,snapshot_version=snapshot_version+1,updated_at=? WHERE id=?", at,s.id);
        const g = JSON.parse(s.governance_json);
        delete g.pendingAttention;
        run('UPDATE agent_sessions SET governance_json=? WHERE id=?',json(g),s.id);
        project(s.id);
      }
    });
    await new Promise(resolve=>setImmediate(resolve));
  }
}
const migrationEventDigest = () => {
  const hash = createHash('sha256');
  for (const e of db.prepare('SELECT id,session_id,turn_id,seq,idempotency_key,kind,native_type,observed_at,facts_json FROM agent_events ORDER BY session_id,seq').iterate()) hash.update(JSON.stringify(Object.values(e))+'\n');
  return hash.digest('hex');
};
const methods = {
  migrationSession: ({binding:b,digest}) => transaction(()=>{
    const old = get('SELECT * FROM agent_sessions WHERE id=?',b.id);
    if(old) { if(JSON.parse(old.governance_json).importDigest!==digest) fail('AGENT_WORK_MIGRATION_CONFLICT'); return {idempotent:true}; }
    saveBinding(b,!['closed','failed'].includes(b.state));
    if(b.turn) run('UPDATE agent_turns SET turn_index=20001 WHERE id=?',b.turn.id);
    const g=JSON.parse(session(b.id).governance_json);
    run('UPDATE agent_sessions SET governance_json=? WHERE id=?',json({...g,lastTurnIndex:b.turn?20001:-1,importDigest:digest,importCurrentTurnId:b.turn?.id||null,historyIncomplete:true}),b.id);
    return {imported:true};
  }),
  migrationEvent: e => transaction(()=>{
    const s=session(e.bindingId);
    if(!JSON.parse(s.governance_json).importDigest) fail('AGENT_WORK_MIGRATION_CONFLICT');
    if(e.turnId && !get('SELECT 1 FROM agent_turns WHERE id=?',e.turnId)) {
      // Historical turn boundaries were not retained by the legacy array. Mark an explicit gap.
      const at=Date.parse(e.observedAt);
      run('INSERT INTO agent_turns(id,session_id,turn_index,state,created_at,updated_at,finished_at,outcome,final_summary,governance_json) VALUES(?,?,?,?,?,?,?,?,?,?)',e.turnId,s.id,e.seq,'interrupted',at,at,at,'history-gap','Historical turn boundary unavailable.',json(emptyGovernance()));
      const g=JSON.parse(s.governance_json);g.lastTurnIndex=Math.max(g.lastTurnIndex??-1,e.seq);
      run('UPDATE agent_sessions SET governance_json=? WHERE id=?',json(g),s.id);
    }
    return append(e,true);
  }),
  migrationFinalize: ({bindingId}) => transaction(()=>{
    const s=session(bindingId);
    if(!JSON.parse(s.governance_json).importDigest) fail('AGENT_WORK_MIGRATION_CONFLICT');
    const t=latestTurn(s.id);
    if(t && ['completed','failed','interrupted'].includes(t.state)) {
      run('UPDATE agent_turns SET final_summary=?,final_summary_version=1 WHERE id=?',`Retained turn ${t.state}; historical output was not imported.`,t.id);
    }
    run('UPDATE agent_sessions SET attention_state=? WHERE id=?',s.state==='interrupted'?'interrupted':t?.state||s.state,s.id);
    project(s.id);
    return {finalized:true};
  }),
  migrationVerify: () => {
    const hash=createHash('sha256');
    for(const s of db.prepare('SELECT * FROM agent_sessions ORDER BY id').iterate()) {
      const b=binding(s);
      if(!JSON.parse(s.governance_json).importCurrentTurnId) delete b.turn;
      const actualDigest=createHash('sha256').update(json(migrationIdentity(b))).digest('hex');
      hash.update(json([s.id,actualDigest])+'\n');
    }
    return {sessions:get('SELECT count(*) AS n FROM agent_sessions').n,events:get('SELECT count(*) AS n FROM agent_events').n,eventDigest:migrationEventDigest(),sessionDigest:hash.digest('hex')};
  },
  createSession: input => {
    if(storagePressure()) fail('AGENT_WORK_STORAGE_PRESSURE');
    return transaction(() => applyDomain('createBinding',input));
  },
  updateSession: input => transaction(()=>{
    const current = latestTurn(input.bindingId);
    if (input.turn && ['completed','failed','interrupted'].includes(input.turn.state)) fail('AGENT_WORK_COMPLETION_REQUIRED');
    if (['closed','failed'].includes(input.state) && current && ['queued','starting','active','waiting-input','cancelling'].includes(current.state)) fail('AGENT_WORK_COMPLETION_REQUIRED');
    return applyDomain('updateBinding',input);
  }),
  appendBatch: inputs => {
    const pressure=storagePressure();
    return transaction(()=>inputs.map(e=>pressure && e.type==='message-observed' ? { persisted:false, reason:'storage-pressure' } : append(e)));
  },
  completeTurn: input => transaction(()=>complete(input)), snapshot,
  listSessions: input => ({ sessions: all(`SELECT * FROM agent_sessions s WHERE id>? AND (? IS NULL OR task_id=?) ${input.activeOnly ? `AND EXISTS(SELECT 1 FROM agent_turns t WHERE t.session_id=s.id AND t.state IN (${activeTurns}))` : ''} ORDER BY ${input.recent?'updated_at DESC,id DESC':'id'} LIMIT ?`,input.afterId,input.taskId,input.taskId,input.limit+1).map(binding) }),
  governance: ({bindingId}) => {
    const s=session(bindingId),g=JSON.parse(s.governance_json);
    return {binding:binding(s),latestUsage:g.latestUsage,metrics:{turns:g.historyIncomplete?null:g.turns,toolCalls:g.historyIncomplete?null:g.toolCalls,reportedTokens:g.historyIncomplete&&g.latestUsage?.aggregation!=='cumulative'?null:g.usageTokens,reportedCost:g.historyIncomplete&&g.latestUsage?.aggregation!=='cumulative'?null:g.usageCost,concurrency:get(`SELECT count(*) AS n FROM agent_turns WHERE state IN (${activeTurns})`).n,attempts:get('SELECT count(*) AS n FROM agent_sessions WHERE scope_kind=? AND task_id IS ? AND contribution_id IS ? AND goal_id IS ? AND goal_element_id IS ?',s.scope_kind,s.task_id,s.contribution_id,s.goal_id,s.goal_element_id).n}};
  },
  metrics, preview, prune: pruneBatch, checkpoint, compact,
  setPolicy: input => { policy=input; policyVersion++; return { policy,policyVersion }; },
  saveDelivery: input => transaction(()=>{ const s=session(input.bindingId); if(input.lastSnapshotVersion>s.snapshot_version || input.lastSentSeq>s.last_event_seq || ['closed','failed'].includes(s.state)) fail('INVALID_DELIVERY_CURSOR'); run('INSERT INTO agent_delivery_state VALUES(?,?,?,?,?,?) ON CONFLICT(session_id,surface) DO UPDATE SET last_snapshot_version=max(last_snapshot_version,excluded.last_snapshot_version),last_sent_seq=max(last_sent_seq,excluded.last_sent_seq),quiet_until=excluded.quiet_until,updated_at=excluded.updated_at',s.id,input.surface,input.lastSnapshotVersion,input.lastSentSeq,input.quietUntil,Date.now()); return {saved:true}; }),
  ackNotification: input => { const result=run(`UPDATE agent_notifications SET ${input.dismiss?'dismissed_at':'delivered_at'}=coalesce(${input.dismiss?'dismissed_at':'delivered_at'},?) WHERE id=?`,Date.now(),input.id); return {changed:result.changes>0}; },
  close: ()=>{ db.close(); return {closed:true}; },
};
async function execute(message) {
  const method=methods[message.method];
  if(!method) fail('INVALID_AGENT_WORK_COMMAND');
  for(let attempt=0;;attempt++) {
    try {
      const result=method(message.input);
      if(['createSession','updateSession','appendBatch','completeTurn','saveDelivery','ackNotification'].includes(message.method)) lastWrite=Date.now();
      return result;
    } catch(error) {
      const safe=safeError(error);
      if(safe.code==='SQLITE_BUSY' && attempt<3 && !['prune','compact','checkpoint'].includes(message.method)) {
        maintenance.busyRetries++;
        await new Promise(resolve=>setTimeout(resolve,[50,100,200][attempt]));
        continue;
      }
      maintenance.lastError={...safe,at:Date.now()};
      throw error;
    }
  }
}
(async()=>{
  try { openDatabase(); await recover(); parentPort.postMessage({ready:true}); }
  catch(error) { try { db?.close(); } catch {} parentPort.postMessage({startupError:safeError(error)}); parentPort.close(); return; }
  // The owner sends exactly one bounded command at a time; there is no hidden worker queue.
  parentPort.on('message',async message=>{
    try { parentPort.postMessage({id:message.id,result:await execute(message)}); }
    catch(error) { parentPort.postMessage({id:message.id,error:safeError(error)}); }
    if(message.method==='close') parentPort.close();
  });
})();
