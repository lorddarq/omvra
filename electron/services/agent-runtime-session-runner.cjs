const { randomUUID } = require('node:crypto');
const { createNativeRuntimeClient } = require('./agent-runtime-protocol-client.cjs');
const { createAgentRuntimeContextPack } = require('../domain/agent-runtime-context-pack.cjs');
const { issueScopedMcpGrant } = require('./agent-runtime-mcp-grant.cjs');

const ACTIVE_TURN_STATES = new Set(['queued', 'starting', 'active', 'waiting-input', 'cancelling']);
const TERMINAL_TURN_STATES = new Set(['completed', 'failed', 'interrupted']);
const CANCEL_SETTLE_TIMEOUT_MS = 3_000;

function createAgentRuntimeSessionRunner({
  store,
  resolveProfile,
  confirmStart,
  transitionContribution,
  moveTaskToStatus = null,
  finalizeTaskAttempt = null,
  createBinding,
  updateBinding,
  appendEvent,
  listSessions,
  getTaskById = null,
  resolveTaskContext = null,
  listTaskContext = null,
  getTaskContextEntry = null,
  ensureMcpReady = null,
  updateTaskExecutionState = null,
  emitRuntimeEvent = null,
  createClient = createNativeRuntimeClient,
  issueMcpGrant = issueScopedMcpGrant,
  now = () => new Date().toISOString(),
  logger = null,
  maxAutomaticBatches = 0,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  const clients = new Map();
  const clientSubscriptions = new Map();
  const pendingRequests = new Map();
  const responsesInFlight = new Set();
  const automaticBatchCounts = new Map();
  const automaticContinuationInFlight = new Set();
  const timersByBinding = new Map();
  let disposed = false;
  const buildContextPack = typeof getTaskContextEntry === 'function'
    ? createAgentRuntimeContextPack({ getEntry: getTaskContextEntry }).build
    : null;

  const failure = (error, message, details = {}) => ({ ok: false, error, message, ...details });
  const inactiveSession = () => failure(
    'ACP_SESSION_NOT_FOUND',
    'This runtime session is not active in the current Omvra app process. It may belong to an earlier app process or provider history state. Start a new session; Omvra will keep the current task context.',
  );
  const shuttingDown = () => failure('ACP_APP_SHUTDOWN', 'The Omvra app is shutting down and cannot start or continue runtime work.');
  const log = (level, event, details = {}) => {
    // Error bodies and stacks may contain provider output, credentials or paths.
    const { message, stack, error, ...facts } = details;
    logger?.[level]?.(`[agent-runtime] ${event}`, { ...facts, ...(error ? { hasError: true } : {}) });
  };
  const emit = (payload) => {
    try { emitRuntimeEvent?.(payload); } catch (error) { log('warn', 'live-event.emit-failed', { message: error?.message || String(error) }); }
  };
  const appendRuntimeEvent = async (payload) => {
    const turnId = (await bindingFor(payload.bindingId))?.turn?.id;
    const result = await appendEvent(store, { ...payload, ...(turnId ? { turnId } : {}) });
    if (result?.ok === false) throw Object.assign(new Error('Agent history write failed'), {code:result.error || 'AGENT_WORK_STORAGE_FAILED'});
    if (result?.ok && !result.idempotent && result.event) {
      emit({ kind: 'event', event: result.event, binding: (await bindingFor(result.event.bindingId)) });
    }
    return result;
  };
  const syncTaskExecution = async (binding, state, details = {}) => {
    if (typeof updateTaskExecutionState !== 'function' || binding?.scope?.kind !== 'task') return null;
    const result = updateTaskExecutionState(store, {
      taskId: binding.scope.taskId,
      attemptId: binding.scope.executionAttemptId,
      state,
      ...(binding.turn?.id ? { turnId: binding.turn.id, turnState: binding.turn.state } : {}),
      ...details,
    });
    if (!result?.ok) log('warn', 'task-execution.state-sync-failed', { bindingId: binding.id, state, error: result?.error });
    else emit({ kind: 'binding', binding: (await bindingFor(binding.id)) || binding });
    return result;
  };
  const requestKey = (bindingId, requestId) => `${bindingId}:${typeof requestId}:${String(requestId)}`;
  const safeBinding = binding => {
    const { opaqueSessionRef: _opaqueSessionRef, mcpGrantId: _mcpGrantId, ...safe } = binding;
    return safe;
  };
  const turnStateFor = binding => binding?.turn?.state || ({ active: 'active', 'needs-input': 'waiting-input', cancelling: 'cancelling' }[binding?.state]);
  const activeTurn = async () => ((await listSessions(store, { limit: 100, activeOnly: true }))?.bindings || []).find(binding => ACTIVE_TURN_STATES.has(turnStateFor(binding)));
  const activeTurnFailure = binding => failure(
    'ACP_EXECUTION_ALREADY_ACTIVE',
    'Another task turn is already active. Open its supervision before starting new work.',
    { bindingId: binding.id, turnId: binding.turn?.id, binding: safeBinding(binding) },
  );

  function clearBindingTimers(bindingId) {
    const timers = timersByBinding.get(bindingId);
    if (timers) for (const timer of timers) clearTimer(timer);
    timersByBinding.delete(bindingId);
    automaticContinuationInFlight.delete(bindingId);
    automaticBatchCounts.delete(bindingId);
  }

  function scheduleBindingTimer(bindingId, callback, delay) {
    if (disposed) return null;
    const timer = setTimer(async () => {
      timersByBinding.get(bindingId)?.delete(timer);
      if (timersByBinding.get(bindingId)?.size === 0) timersByBinding.delete(bindingId);
      if (!disposed) { try { await callback(); } catch(error) { emit({kind:'storage-failure',bindingId,error:error.code || 'AGENT_WORK_STORAGE_FAILED'}); } }
    }, delay);
    const timers = timersByBinding.get(bindingId) || new Set();
    timers.add(timer);
    timersByBinding.set(bindingId, timers);
    return timer;
  }

  function clearClientSubscriptions(bindingId) {
    for (const unsubscribe of clientSubscriptions.get(bindingId) || []) {
      try { unsubscribe?.(); } catch (error) { log('debug', 'client.unsubscribe-failed', { bindingId, message: error?.message || String(error) }); }
    }
    clientSubscriptions.delete(bindingId);
  }

  function clearPendingRequests(bindingId) {
    for (const key of pendingRequests.keys()) if (key.startsWith(`${bindingId}:`)) pendingRequests.delete(key);
  }

  function releaseClient(bindingId, { closeTransport = true } = {}) {
    const session = clients.get(bindingId);
    clearBindingTimers(bindingId);
    clearClientSubscriptions(bindingId);
    clearPendingRequests(bindingId);
    clients.delete(bindingId);
    if (closeTransport) session?.client?.close?.();
    return Boolean(session);
  }

  async function ensureOmvraMcpListener() {
    if (typeof ensureMcpReady === 'function') {
      const readiness = await ensureMcpReady(store);
      if (!readiness?.ok) return failure(readiness?.error || 'ACP_MCP_UNAVAILABLE', readiness?.message || 'The Omvra MCP server is unavailable.');
    }
    return { ok: true };
  }

  function clientOptions(profile, workspacePath, mcpReadiness, scope) {
    const options = { workspacePath, logger };
    const endpoint = mcpReadiness?.listenerStatus?.boundUrl;
    if (profile?.integrationMode === 'claude-stream-json-stdio' && typeof endpoint === 'string' && endpoint.trim()) {
      options.mcpEndpoint = endpoint.trim();
      const grant = issueMcpGrant({
        endpoint: options.mcpEndpoint,
        scope,
        capabilityProfile: mcpReadiness.listenerStatus.capabilityProfile || 'read_only',
      });
      if (!grant?.ok) throw Object.assign(new Error(grant?.message || 'The scoped MCP grant could not be created.'), { code: grant?.error || 'ACP_MCP_GRANT_FAILED' });
      options.mcpHeaders = { Authorization: `Bearer ${grant.token}` };
      options.mcpGrantId = grant.grantId;
    }
    return options;
  }

  async function sanitizedElicitation(bindingId, message, turnId) {
    if (message?.id === undefined || message?.id === null) return null;
    const approvalMethod = typeof message.method === 'string' && [
      'item/commandExecution/requestApproval',
      'item/fileChange/requestApproval',
      'item/mcpToolCall/requestApproval',
    ].includes(message.method);
    if (approvalMethod) {
      const params = message.params || {};
      const subject = message.method === 'item/commandExecution/requestApproval'
        ? 'run a command'
        : message.method === 'item/fileChange/requestApproval'
          ? 'apply a file change'
          : 'call an MCP tool';
      return {
        bindingId,
        turnId,
        requestId: message.id,
        method: message.method,
        responseKind: 'codex-approval',
        serverName: typeof params.serverName === 'string' ? params.serverName.slice(0, 160) : '',
        mode: 'approval',
        message: `The agent requests permission to ${subject}.${typeof params.reason === 'string' && params.reason.trim() ? ` Reason: ${params.reason.trim().slice(0, 500)}` : ''}`,
        fields: [],
      };
    }
    if (message.method !== 'mcpServer/elicitation/request') return null;
    const params = message.params || {};
    const schema = params.requestedSchema && typeof params.requestedSchema === 'object' ? params.requestedSchema : {};
    const required = new Set(Array.isArray(schema.required) ? schema.required.filter(name => typeof name === 'string') : []);
    const fields = Object.entries(schema.properties || {}).slice(0, 20).map(([name, definition]) => {
      const field = definition && typeof definition === 'object' ? definition : {};
      const options = Array.isArray(field.enum) ? field.enum.filter(value => ['string', 'number', 'boolean'].includes(typeof value)).slice(0, 50) : [];
      return {
        name: String(name).slice(0, 128),
        type: ['string', 'number', 'integer', 'boolean'].includes(field.type) ? field.type : 'string',
        title: typeof field.title === 'string' ? field.title.slice(0, 200) : String(name).slice(0, 128),
        description: typeof field.description === 'string' ? field.description.slice(0, 500) : '',
        required: required.has(name),
        ...(field.default !== undefined ? { defaultValue: field.default } : {}),
        ...(options.length ? { options } : {}),
      };
    });
    return {
      bindingId,
      turnId,
      requestId: message.id,
      method: message.method,
      responseKind: 'elicitation',
      serverName: typeof params.serverName === 'string' ? params.serverName.slice(0, 160) : '',
      mode: ['form', 'openai/form', 'url'].includes(params.mode) ? params.mode : 'form',
      message: typeof params.message === 'string' ? params.message.slice(0, 2_000) : 'Codex needs input before it can continue.',
      fields,
    };
  }

  function listRequests(bindingId) {
    return [...pendingRequests.values()].filter(request => request.bindingId === bindingId).map(request => JSON.parse(JSON.stringify(request)));
  }

  function advertisedApprovalContent(params = {}) {
    const properties = params.requestedSchema?.properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return {};
    for (const [name, definition] of Object.entries(properties)) {
      if (!definition || typeof definition !== 'object' || !Array.isArray(definition.enum) || definition.enum.length === 0) continue;
      const preferred = definition.default !== undefined && definition.enum.includes(definition.default)
        ? definition.default
        : definition.enum.find(option => /^(?:allow|approve|approved|accept|yes)$/i.test(String(option))) ?? definition.enum[0];
      return { [String(name).slice(0, 128)]: preferred };
    }
    return {};
  }

  function buildCurrentTaskContext(binding) {
    if (!buildContextPack || typeof getTaskById !== 'function' || binding.scope?.kind !== 'task') return { ok: true, pack: null, text: '' };
    const task = getTaskById(store, binding.scope.taskId);
    if (!task) return failure('TASK_NOT_FOUND', `Task "${binding.scope.taskId}" not found.`);
    const context = typeof listTaskContext === 'function'
      ? listTaskContext(store, { taskId: task.id, limit: 12 })
      : null;
    const resolved = typeof resolveTaskContext === 'function'
      ? resolveTaskContext(store, task.id)
      : null;
    if (resolved?.canStart === false) return failure(resolved.error, resolved.message, { executionContext: resolved });
    return buildContextPack(store, {
      taskId: task.id,
      taskRevision: Number(task.__mcpRevision || 0),
      taskTitle: task.title,
      taskDescription: task.notes,
      taskStatus: task.status,
      taskMetadata: task,
      contributionId: binding.scope.contributionId,
      contextEntryIds: context?.ok ? (context.entries || []).map(entry => entry.id) : [],
      executionProfile: resolved?.executionProfile,
    });
  }

  async function bindingFor(id) {
    const result = await listSessions(store, { bindingId: id, limit: 1 });
    const binding = result?.bindings?.[0] || null;
    const session = clients.get(id);
    if (binding && session) session.binding = binding;
    return binding;
  }

  async function syncSessionState(bindingId, state, terminalReason) {
    const current = (await bindingFor(bindingId));
    if (!current || current.state === state) return current;
    const result = await updateBinding(store, { bindingId, expectedRevision: current.revision, state, ...(terminalReason ? { terminalReason } : {}) });
    if (!result.ok) log('warn', 'binding.state-sync-failed', { bindingId, from: current.state, to: state, error: result.error });
    else {
      const taskState = { starting: 'starting', ready: 'ready', interrupted: 'interrupted', failed: 'failed', closed: 'stopped' }[state];
      if (taskState) (await syncTaskExecution(result.binding || current, taskState, { reason: state }));
      emit({ kind: 'binding', binding: result.binding || current });
      log('info', 'binding.state-changed', { bindingId, from: current.state, to: state });
    }
    return result.binding || current;
  }

  async function syncTurnState(bindingId, state, details = {}) {
    const current = (await bindingFor(bindingId));
    if (!current) return null;
    const previous = current.turn;
    if (!previous && !details.turnId) return current;
    if (previous?.state === state && !details.requestId) return current;
    if (previous && TERMINAL_TURN_STATES.has(previous.state) && previous.id === (details.turnId || previous.id)) return current;
    const result = await updateBinding(store, {
      bindingId,
      expectedRevision: current.revision,
      state: current.state,
      turn: {
        id: details.turnId || previous?.id,
        state,
        ...(details.reason ? { terminalReason: details.reason } : {}),
        ...(details.requestId !== undefined ? { requestId: details.requestId } : {}),
      },
    });
    if (!result.ok) {
      log('warn', 'turn.state-sync-failed', { bindingId, turnId: details.turnId || previous?.id, from: previous?.state, to: state, error: result.error });
      throw Object.assign(new Error(result.error || 'AGENT_WORK_STORAGE_FAILED'), {code:result.error || 'AGENT_WORK_STORAGE_FAILED'});
    }
    const next = result.binding || (await bindingFor(bindingId)) || current;
    if (clients.has(bindingId)) clients.get(bindingId).binding = next;
    const taskState = { queued: 'starting', starting: 'starting', active: 'working', 'waiting-input': 'waiting', cancelling: 'stopping', completed: 'batch-finished', failed: 'failed', interrupted: 'interrupted' }[state];
    if (taskState) (await syncTaskExecution(next, taskState, { reason: details.reason || state, ...(details.batchNumber !== undefined ? { batchNumber: details.batchNumber } : {}) }));
    emit({ kind: 'binding', binding: next });
    log('info', 'turn.state-changed', { bindingId, turnId: next.turn?.id || details.turnId || previous?.id, from: previous?.state || null, to: state });
    return next;
  }

  async function beginTurn(bindingId, details = {}) {
    const current = (await bindingFor(bindingId));
    if (!current) return null;
    if (ACTIVE_TURN_STATES.has(current.turn?.state)) return current;
    return (await syncTurnState(bindingId, details.state || 'starting', { ...details, turnId: details.turnId || `turn-${randomUUID()}` }));
  }

  async function reconcileBindingLoss(bindingId, lifecycle = {}) {
    releaseClient(bindingId);
    const current = (await bindingFor(bindingId));
    if (!current || ['interrupted', 'closed', 'failed'].includes(current.state)) return current;
    const reason = lifecycle.kind === 'shutdown' ? 'process-exit' : lifecycle.code === 'ACP_RUNTIME_MISSING' ? 'runtime-missing' : lifecycle.kind === 'exit' ? 'process-exit' : 'protocol-error';
    if (ACTIVE_TURN_STATES.has(current.turn?.state)) (await syncTurnState(bindingId, 'interrupted', { reason }));
    const afterTurn = (await bindingFor(bindingId)) || current;
    let updated = await updateBinding(store, { bindingId, expectedRevision: afterTurn.revision, state: 'interrupted', terminalReason: reason });
    if (!updated.ok && updated.error === 'REVISION_MISMATCH') {
      const latest = (await bindingFor(bindingId));
      if (latest && !['interrupted', 'closed', 'failed'].includes(latest.state)) {
        updated = await updateBinding(store, { bindingId, expectedRevision: latest.revision, state: 'interrupted', terminalReason: reason });
      }
    }
    const binding = updated.ok && updated.binding ? updated.binding : (await bindingFor(bindingId)) || current;
    (await appendRuntimeEvent({
      bindingId,
      runtimeProfileId: binding.runtimeProfileId,
      kind: 'session',
      nativeEventType: 'omvra/runtime/connection-lost',
      state: 'interrupted',
      outcome: lifecycle.kind === 'exit' ? 'process-exit' : lifecycle.code || 'transport-error',
      idempotencyKey: `runtime:${bindingId}:connection-lost:${binding.revision}`,
    }));
    log('warn', 'session.connection-lost', { bindingId, runtimeProfileId: binding.runtimeProfileId, reason, lastObservedAt: binding.lastObservedAt || null });
    return binding;
  }

  let notificationTail = Promise.resolve();
  let pendingNotificationCount = 0;
  let pendingNotificationBytes = 0;
  const notificationFailures = new Map();
  function enqueueNotification(bindingId, client, action, message) {
    if (clients.get(bindingId)?.client !== client) return Promise.resolve({ok:false,error:'ACP_SESSION_NOT_FOUND'});
    const bytes = message ? Buffer.byteLength(JSON.stringify(message)) : 0;
    if (pendingNotificationCount >= 256 || pendingNotificationBytes + bytes > 1048576) {
      const notificationFailure = Object.assign(new Error('AGENT_WORK_QUEUE_FULL'), {code:'AGENT_WORK_QUEUE_FULL'});
      storageFailed(bindingId, notificationFailure);
      return Promise.resolve({ok:false,error:notificationFailure.code});
    }
    pendingNotificationCount++; pendingNotificationBytes += bytes;
    const result = notificationTail.then(() => clients.get(bindingId)?.client !== client ? {ok:false,error:'ACP_SESSION_NOT_FOUND'} : action()).catch(error => {
      storageFailed(bindingId, error);
      return {ok:false,error:error.code || 'AGENT_WORK_STORAGE_FAILED'};
    }).finally(() => { pendingNotificationCount--; pendingNotificationBytes -= bytes; });
    notificationTail = result;
    return result;
  }
  async function flush() { await notificationTail; if(notificationFailures.size) throw notificationFailures.values().next().value; }

  function storageFailed(bindingId, error) {
    notificationFailures.set(bindingId, error);
    clearBindingTimers(bindingId);
    emit({kind:'storage-failure',bindingId,error:error.code || 'AGENT_WORK_STORAGE_FAILED'});
  }
  const storageBlocked = () => notificationFailures.size
    ? failure('AGENT_WORK_STORAGE_FAILED', 'Agent history needs reconciliation before starting more work.') : null;
  async function controlBinding(bindingId) {
    try { return await bindingFor(bindingId); }
    catch (error) { storageFailed(bindingId, error); return clients.get(bindingId)?.binding || null; }
  }
  async function persistControl(bindingId, state, details = {}) {
    const session = clients.get(bindingId);
    if (session) session.pendingControl = {state, details};
    try {
      const binding = await syncTurnState(bindingId, state, details);
      if (binding) emit({kind:'binding',binding});
      if (session) delete session.pendingControl;
      return true;
    } catch (error) { storageFailed(bindingId, error); return false; }
  }


  function attachClient(binding, client) {
    clients.get(binding.id).binding = binding;
    const subscriptions = [
      client.onLifecycle?.(lifecycle => enqueueNotification(binding.id, client, () => reconcileBindingLoss(binding.id, lifecycle))),
      client.onNotification?.(message => enqueueNotification(binding.id, client, () => recordNotification(binding, message), message)),
    ].filter(unsubscribe => typeof unsubscribe === 'function');
    clientSubscriptions.set(binding.id, subscriptions);
  }

  function taskMayContinue(binding) {
    if (typeof getTaskById !== 'function' || binding.scope?.kind !== 'task') return false;
    const task = getTaskById(store, binding.scope.taskId);
    return Boolean(task && !['done', 'under-review'].includes(task.status));
  }

  async function finalizeAutomaticOutcome(binding) {
    const task = typeof getTaskById === 'function' && binding.scope?.kind === 'task' ? getTaskById(store, binding.scope.taskId) : null;
    if (!task) return;
    const attemptResult = typeof finalizeTaskAttempt === 'function'
      ? finalizeTaskAttempt(store, { taskId: binding.scope.taskId, attemptId: binding.scope.executionAttemptId, state: 'completed', reason: 'automatic-batch-limit' })
      : { ok: false, error: 'ATTEMPT_FINALIZER_UNAVAILABLE' };
    const latestTask = typeof getTaskById === 'function' ? getTaskById(store, binding.scope.taskId) : task;
    const moved = latestTask?.status === 'under-review' || latestTask?.status === 'done'
      ? { ok: true, task: latestTask }
      : typeof moveTaskToStatus === 'function'
        ? moveTaskToStatus(store, { taskId: binding.scope.taskId, statusId: 'under-review', statusTitle: 'Under Review', expectedRevision: latestTask?.__mcpRevision, actor: 'agent-runtime-reconciliation' })
        : { ok: false, error: 'TASK_STATUS_FINALIZER_UNAVAILABLE' };
    const executionState = moved.ok ? (moved.task?.status === 'done' ? 'complete' : 'ready-for-review') : 'outcome-unreconciled';
    (await appendRuntimeEvent({
      bindingId: binding.id,
      runtimeProfileId: binding.runtimeProfileId,
      kind: 'session',
      nativeEventType: moved.ok ? 'omvra/taskExecution/finalized-for-review' : 'omvra/taskExecution/outcome-unreconciled',
      state: executionState,
      outcome: moved.ok ? 'automatic-batch-limit-finalized' : `automatic-batch-limit:${moved.error || attemptResult.error || 'reconciliation-failed'}`,
      idempotencyKey: `runtime:${binding.id}:automatic-outcome:${executionState}`,
    }));
    const current = (await bindingFor(binding.id)) || binding;
    if (['starting', 'ready'].includes(current.state)) {
      const closed = await updateBinding(store, { bindingId: current.id, expectedRevision: current.revision, state: 'closed', terminalReason: 'closed' });
      const session = clients.get(binding.id);
      try { await session?.client?.closeSession?.(current.opaqueSessionRef); } catch (error) { log('debug', 'automatic-outcome.remote-close-failed', { bindingId: binding.id, message: error?.message || String(error) }); }
      releaseClient(binding.id);
      const closedBinding = closed?.ok ? closed.binding : (await bindingFor(binding.id)) || current;
      (await syncTaskExecution(closedBinding, executionState, { reason: moved.ok ? 'automatic-outcome-finalized' : 'automatic-outcome-unreconciled' }));
    }
  }

  async function scheduleAutomaticContinuation(bindingId) {
    if (!Number.isInteger(maxAutomaticBatches) || maxAutomaticBatches <= 0 || automaticContinuationInFlight.has(bindingId)) return;
    const current = (await bindingFor(bindingId));
    if (!current || current.state !== 'ready' || ACTIVE_TURN_STATES.has(current.turn?.state) || !taskMayContinue(current)) return;
    const completedBatches = (automaticBatchCounts.get(bindingId) || 0) + 1;
    automaticBatchCounts.set(bindingId, completedBatches);
    if (completedBatches > maxAutomaticBatches) {
      (await appendRuntimeEvent({
        bindingId,
        runtimeProfileId: current.runtimeProfileId,
        kind: 'session',
        nativeEventType: 'omvra/taskBatch/automatic-limit-reached',
        state: 'ready',
        outcome: `Automatic continuation stopped after ${maxAutomaticBatches} batches.`,
        idempotencyKey: `runtime:${bindingId}:automatic-limit:${completedBatches}`,
      }));
      await finalizeAutomaticOutcome(current);
      return;
    }
    automaticContinuationInFlight.add(bindingId);
    scheduleBindingTimer(bindingId, async () => {
      try {
        const latest = (await bindingFor(bindingId));
        if (!latest || latest.state !== 'ready' || ACTIVE_TURN_STATES.has(latest.turn?.state) || !taskMayContinue(latest)) return;
      (await appendRuntimeEvent({
          bindingId,
          runtimeProfileId: latest.runtimeProfileId,
          kind: 'session',
          nativeEventType: 'omvra/taskBatch/automatic-continuing',
          state: 'continuing',
          outcome: `Starting automatic work batch ${completedBatches} of ${maxAutomaticBatches}.`,
          idempotencyKey: `runtime:${bindingId}:automatic-continuing:${completedBatches}`,
        }));
        await continueTask(bindingId, { automatic: true });
      } finally {
        automaticContinuationInFlight.delete(bindingId);
      }
    }, 0);
  }

  async function recordNotification(binding, message) {
    if (TERMINAL_TURN_STATES.has(clients.get(binding.id)?.pendingControl?.state)) return {ok:true,ignored:true};
    const method = typeof message?.method === 'string' ? message.method : 'runtime/notification';
    const current = await controlBinding(binding.id);
    if(!current || TERMINAL_TURN_STATES.has(current.turn?.state)) return {ok:true,ignored:true};
    const lower = method.toLowerCase();
    const kind = lower.includes('permission') || lower.includes('approval') ? 'permission'
      : lower.includes('elicitation') ? 'input'
        : lower.includes('usage') || lower.includes('cost') || lower.includes('tokens') ? 'usage'
          : lower.includes('agentmessage') ? 'message'
          : lower.includes('tool') ? 'tool'
            : lower.includes('plan') ? 'plan'
              : lower.includes('turn') || lower.includes('prompt') ? 'turn'
                : 'session';
    const params = message?.params || {};
    const errorMessage = typeof params.error === 'string' ? params.error
      : typeof params.error?.message === 'string' ? params.error.message
        : typeof params.turn?.error?.message === 'string' ? params.turn.error.message
          : null;
    const subject = params.toolName || params.tool?.name || params.serverName || params.server?.name || params.name || params.item?.type || null;
    const reportedState = params.state || params.status || params.turn?.status || params.thread?.status;
    log(reportedState === 'failed' ? 'warn' : 'debug', 'notification', { bindingId: binding.id, kind, hasError: Boolean(errorMessage) });
    const activeClient = clients.get(binding.id)?.client;
    const policyApprovedOmvraCall = message?.method === 'mcpServer/elicitation/request'
      && message.params?.serverName === 'omvra'
      && message.params?._meta?.codex_approval_kind === 'mcp_tool_call'
      && activeClient?.profile?.approvalPolicy === 'never';
    if (policyApprovedOmvraCall) {
      activeClient.respond(message.id, { action: 'accept', content: advertisedApprovalContent(message.params) });
      return (await appendRuntimeEvent({
        bindingId: binding.id,
        runtimeProfileId: binding.runtimeProfileId,
        kind: 'permission',
        nativeEventType: 'omvra/mcpToolApproval/policy-accepted',
        state: 'allowed',
        outcome: 'runtime-profile-policy',
        requestId: message.id,
        toolName: 'omvra',
        permissionState: 'allowed',
        idempotencyKey: `runtime:${binding.id}:mcp-policy-approval:${String(message.id)}`,
      }));
    }
    const elicitation = (await sanitizedElicitation(binding.id, message, current.turn?.id));
    if (elicitation) {
      if (listRequests(binding.id).length >= 32 && !pendingRequests.has(requestKey(binding.id, elicitation.requestId))) throw Object.assign(new Error('Too many input requests'), {code:'AGENT_WORK_QUEUE_FULL'});
      pendingRequests.set(requestKey(binding.id, elicitation.requestId), elicitation);
      emit({kind:'binding',requestId:elicitation.requestId,binding:{...safeBinding(current),turn:{...current.turn,state:'waiting-input'}}});
    }
    const appended = method === 'turn/completed' ? null : (await appendRuntimeEvent({
      bindingId: binding.id,
      runtimeProfileId: binding.runtimeProfileId,
      kind,
      nativeEventType: method,
      state: params.state || params.status || params.turn?.status || params.thread?.status,
      outcome: params.outcome || params.failureReason || (errorMessage ? errorMessage.slice(0, 500) : undefined),
      providerDetail: errorMessage,
      requestId: message?.id ?? params.requestId,
      toolName: subject,
      capabilityId: params.capabilityId,
      permissionState: params.permissionState || params.state,
      usageAggregation: params.usage?.aggregation,
      inputTokens: params.usage?.inputTokens,
      outputTokens: params.usage?.outputTokens,
      totalTokens: params.usage?.totalTokens,
      contextTokens: params.usage?.contextTokens,
      cost: params.usage?.cost,
      currency: params.usage?.currency,
      messagePreview: method === 'item/agentMessage/delta'
        ? (typeof params.delta === 'string' ? params.delta : typeof params.text === 'string' ? params.text : undefined)
        : undefined,
      idempotencyKey: `runtime:${binding.id}:${randomUUID()}`,
    }));
    if (method === 'turn/started') {
      if (Array.isArray(params.mcpServers)) {
        const mcpServers = params.mcpServers.slice(0, 32).map(server => ({
          name: typeof server?.name === 'string' ? server.name.slice(0, 160) : null,
          status: typeof server?.status === 'string' ? server.status.slice(0, 80) : null,
          error: typeof server?.error === 'string' ? server.error.slice(0, 500) : null,
        }));
        const failedServers = mcpServers.filter(server => server.status === 'failed' || server.error);
        log(failedServers.length ? 'warn' : 'info', 'provider.mcp-status', { bindingId: binding.id, serverCount: mcpServers.length, failedCount: failedServers.length });
      }
      (await syncTurnState(binding.id, 'active'));
    }
    else if (method === 'turn/completed') {
      const waitingForInput = [...pendingRequests.values()].some(request => request.bindingId === binding.id);
      const cancellationRequested = clients.get(binding.id)?.cancelRequested || current.turn?.state === 'cancelling';
      if (!waitingForInput) for (const key of pendingRequests.keys()) if (key.startsWith(`${binding.id}:`)) pendingRequests.delete(key);
      const turnState = params.turn?.status || params.status || params.state;
      const nextState = waitingForInput ? 'waiting-input' : turnState === 'failed' ? 'failed' : turnState === 'interrupted' || cancellationRequested ? 'interrupted' : 'completed';
      const session = clients.get(binding.id);
      if (session && TERMINAL_TURN_STATES.has(nextState)) session.pendingControl = {state:nextState,details:{reason:nextState}};
      const nextBinding = (await syncTurnState(binding.id, nextState, { reason: nextState }));
      if (session) delete session.pendingControl;
      if(TERMINAL_TURN_STATES.has(nextState) && nextBinding?.turn?.state===nextState) await appendRuntimeEvent({bindingId:binding.id,runtimeProfileId:binding.runtimeProfileId,kind:'turn',nativeEventType:'turn/completed',state:nextState,idempotencyKey:`terminal-event:${nextBinding.turn.id}:${nextState}`});
      if (!waitingForInput && turnState !== 'failed' && turnState !== 'interrupted' && nextBinding?.turn?.state === 'completed') {
        const task = typeof getTaskById === 'function' && binding.scope?.kind === 'task' ? getTaskById(store, binding.scope.taskId) : null;
        const taskState = task?.status === 'done' ? 'complete' : task?.status === 'under-review' ? 'ready-for-review' : 'batch-finished';
        (await syncTaskExecution(nextBinding, taskState, { reason: taskState === 'complete' ? 'task-complete' : taskState === 'ready-for-review' ? 'task-under-review' : 'turn-completed' }));
      }
      if (!waitingForInput && turnState !== 'failed' && turnState !== 'interrupted' && nextBinding?.turn?.state === 'completed') (await scheduleAutomaticContinuation(binding.id));
    }
    else if (elicitation) (await syncTurnState(binding.id, 'waiting-input', { requestId: elicitation.requestId }));
    return appended;
  }

  async function start(payload = {}) {
    if (disposed) return shuttingDown();
    if (storageBlocked()) return storageBlocked();
    log('info', 'start.requested', { taskId: payload.taskId || null, hasWorkspace: Boolean(payload.workspacePath), executionProfileId: payload.executionProfileId || null });
    if (payload.confirmed !== true) {
      log('warn', 'start.rejected', { taskId: payload.taskId || null, error: 'ACP_START_CONFIRMATION_REQUIRED' });
      return failure('ACP_START_CONFIRMATION_REQUIRED', 'Explicit confirmation is required before starting work.');
    }
    if (typeof payload.workspacePath !== 'string' || !payload.workspacePath.trim()) {
      log('warn', 'start.rejected', { taskId: payload.taskId || null, error: 'ACP_REPOSITORY_FOLDER_REQUIRED' });
      return failure('ACP_REPOSITORY_FOLDER_REQUIRED', 'A repository folder is required before starting work.');
    }

    (await reconcile());
    const activeExisting = (await activeTurn());
    if (activeExisting) {
      log('warn', 'start.rejected', { taskId: payload.taskId, bindingId: activeExisting.id, error: 'ACP_EXECUTION_ALREADY_ACTIVE' });
      return activeTurnFailure(activeExisting);
    }

    const confirmed = confirmStart(store, payload);
    if (!confirmed?.canStart) {
      log('warn', 'start.preflight-blocked', { taskId: payload.taskId, error: confirmed?.error || null, blockers: confirmed?.blockers?.map(blocker => blocker.code || blocker) || [] });
      return confirmed;
    }
    let attempt = confirmed.attempt;

    const profileResolution = resolveProfile(store, payload);
    if (!profileResolution.ok || !profileResolution.profile) {
      if (profileResolution.state === 'disabled') return failure('ACP_RUNTIME_ACCESS_DISABLED', profileResolution.error, { state: 'disabled', preflight: confirmed });
      return failure('ACP_RUNTIME_NOT_CONFIGURED', 'The selected runtime profile could not be resolved.', { preflight: confirmed });
    }
    const profile = profileResolution.profile;
    log('info', 'start.preflight-ready', { taskId: payload.taskId, runtimeProfileId: profile.id, integrationMode: profile.integrationMode });
    const resolvedContext = typeof resolveTaskContext === 'function'
      ? resolveTaskContext(store, confirmed.contractSnapshot.taskId)
      : confirmed.context;
    if (resolvedContext?.canStart === false) return failure(resolvedContext.error, resolvedContext.message, { preflight: confirmed, executionContext: resolvedContext });
    const contextPack = buildContextPack
      ? buildContextPack(store, {
          ...confirmed.contractSnapshot,
          executionProfile: resolvedContext?.executionProfile,
          taskMetadata: resolvedContext?.task || confirmed.task,
        })
      : { ok: true, pack: null, text: '' };
    if (!contextPack.ok) return failure(contextPack.error, contextPack.message, { preflight: confirmed });
    const mcpReadiness = await ensureOmvraMcpListener();
    if (!mcpReadiness.ok) return failure(mcpReadiness.error, mcpReadiness.message, { preflight: confirmed });
    const actorPersonId = payload.actorPersonId || confirmed.task?.assigneeId || confirmed.context?.assignee?.id;
    let latestRevision = Number(confirmed.task?.__mcpRevision ?? confirmed.contractSnapshot.taskRevision);
    let started = { ok: true, task: confirmed.task };
    if (typeof moveTaskToStatus === 'function') {
      const moved = moveTaskToStatus(store, {
        taskId: confirmed.contractSnapshot.taskId,
        statusId: 'in-progress',
        statusTitle: 'In Progress',
        expectedRevision: latestRevision,
        actor: 'agent-runtime',
      });
      if (!moved?.ok) {
        return failure(moved?.error || 'TASK_STATUS_UPDATE_FAILED', moved?.message || 'The task could not be moved to In Progress.', { preflight: confirmed });
      }
      latestRevision = Number(moved.task?.__mcpRevision ?? latestRevision);
      started = { ...started, task: moved.task || started.task };
    }
    const transitionBase = {
      taskId: confirmed.contractSnapshot.taskId,
      contributionId: confirmed.contractSnapshot.contributionId,
      actorPersonId,
      expectedRevision: latestRevision,
    };
    if (confirmed.contractSnapshot.contributionId) {
      const acknowledged = transitionContribution(store, { ...transitionBase, command: 'acknowledge', idempotencyKey: `${payload.idempotencyKey}:acknowledge` });
      if (!acknowledged.ok) return failure(acknowledged.error, acknowledged.message || 'The contribution could not be acknowledged.', { preflight: confirmed });
      started = transitionContribution(store, { ...transitionBase, expectedRevision: acknowledged.task.__mcpRevision, command: 'start', idempotencyKey: `${payload.idempotencyKey}:start`, attemptId: confirmed.attempt.id });
      if (!started.ok) return failure(started.error, started.message || 'The contribution could not be started.', { preflight: confirmed });
    } else {
      attempt = {
        schemaVersion: 1,
        id: `attempt-${randomUUID()}`,
        taskId: confirmed.contractSnapshot.taskId,
        state: 'working',
        createdAt: now(),
        updatedAt: now(),
        executionContract: confirmed.contractSnapshot,
        executionContractDigest: confirmed.contractDigest,
      };
      const storedAttempts = store.get('omvra.taskContributionAttempts.v1');
      const attempts = Array.isArray(storedAttempts) ? storedAttempts : [];
      store.set('omvra.taskContributionAttempts.v1', attempts.concat(attempt));
    }

    let bindingResult;
    try {
      bindingResult = await createBinding(store, {
        runtimeProfileId: profile.id,
        idempotencyKey: `${payload.idempotencyKey}:binding`,
        scope: {
          kind: 'task',
          taskId: confirmed.contractSnapshot.taskId,
          contributionId: confirmed.contractSnapshot.contributionId,
          executionAttemptId: attempt.id,
          taskRevision: Number(started.task?.__mcpRevision || latestRevision),
        },
        capabilities: [],
        turn: { id: `turn-${randomUUID()}`, state: 'queued' },
        extensions: { workspacePath: payload.workspacePath.trim() },
      });
      if (!bindingResult.ok) throw Object.assign(new Error('The runtime session binding could not be created.'), {code:bindingResult.error});
    } catch (error) {
      // Direct attempts have no collaboration transition to recover them. Preserve
      // the failed attempt for diagnosis, but never leave it reporting live work.
      if (!confirmed.contractSnapshot.contributionId) {
        const attempts = store.get('omvra.taskContributionAttempts.v1');
        store.set('omvra.taskContributionAttempts.v1', (Array.isArray(attempts) ? attempts : []).map(item =>
          item.id === attempt.id && item.state === 'working' ? {...item,state:'failed',failureReason:'runtime-binding-failed',updatedAt:now()} : item));
      }
      return failure(error.code || 'AGENT_WORK_STORAGE_FAILED', 'The runtime session binding could not be created.', {preflight:confirmed,reconciliationRequired:true});
    }

    const binding = bindingResult.binding;
    (await syncTaskExecution(binding, 'starting', { reason: 'session-created' }));
    log('info', 'binding.created', { taskId: payload.taskId, bindingId: binding.id, runtimeProfileId: profile.id });
    let client;
    try {
      client = createClient(profile, clientOptions(profile, payload.workspacePath, mcpReadiness, binding.scope));
      clients.set(binding.id, { client, workspacePath: payload.workspacePath, profileId: profile.id });
      attachClient(binding, client);
      log('info', 'runtime.initializing', { bindingId: binding.id, runtimeProfileId: profile.id });
      const negotiated = await client.initialize();
      if (disposed) throw Object.assign(new Error('The app is shutting down.'), { code: 'ACP_APP_SHUTDOWN' });
      log('info', 'runtime.initialized', { bindingId: binding.id, authentication: negotiated.authentication || 'unknown', capabilities: Object.keys(negotiated.capabilities || {}).filter(key => negotiated.capabilities[key] === true) });
      const session = await client.startSession();
      if (disposed) throw Object.assign(new Error('The app is shutting down.'), { code: 'ACP_APP_SHUTDOWN' });
      log('info', 'session.created', { bindingId: binding.id });
      const ready = await updateBinding(store, {
        bindingId: binding.id,
        expectedRevision: (await bindingFor(binding.id)).revision,
        state: 'ready',
        opaqueSessionRef: session.sessionId,
        capabilities: Object.entries(negotiated.capabilities || {}).filter(([, supported]) => supported === true).map(([id]) => ({ id, support: 'supported' })),
      });
      if (!ready.ok) throw Object.assign(new Error(ready.message || 'The runtime session could not be marked ready.'), { code: ready.error });
      (await syncTaskExecution(ready.binding, 'ready', { reason: 'session-ready' }));
      {
        const promptText = contextPack.text || 'Begin working on the assigned task. Re-read its current state before making changes.';
        log('info', 'context.prompting', { bindingId: binding.id, contextEntryCount: confirmed.contractSnapshot.contextEntryIds?.length || 0 });
        (await appendRuntimeEvent({ bindingId: binding.id, runtimeProfileId: profile.id, kind: 'session', nativeEventType: 'omvra/taskInstructions/sent', state: 'sent', idempotencyKey: `runtime:${binding.id}:task-instructions` }));
        (await syncTurnState(binding.id, 'starting', { batchNumber: 1 }));
        await client.prompt(session.sessionId, promptText);
        log('info', 'context.accepted', { bindingId: binding.id });
      }
      log('info', 'session.ready', { taskId: payload.taskId, bindingId: binding.id, runtimeProfileId: profile.id });
      const current = (await bindingFor(binding.id)) || ready.binding;
      return { ok: true, state: current.state, binding: current, attempt, task: started.task, preflight: confirmed };
    } catch (error) {
      releaseClient(binding.id);
      (await syncTurnState(binding.id, 'failed', { reason: error.code || 'protocol-error' }));
      const current = (await bindingFor(binding.id)) || binding;
      await updateBinding(store, { bindingId: binding.id, expectedRevision: current.revision, state: 'failed', terminalReason: 'protocol-error' });
      (await syncTaskExecution((await bindingFor(binding.id)) || binding, 'failed', { reason: error.code || 'protocol-error' }));
      log('error', 'start.failed', { taskId: payload.taskId, bindingId: binding.id, code: error.code || 'ACP_RUNTIME_UNAVAILABLE', message: error.message || String(error), stack: error.stack || null });
      return failure(error.code || 'ACP_RUNTIME_UNAVAILABLE', error.message || 'The runtime session could not be started.', { preflight: confirmed, binding });
    }
  }

  async function startGoalNode(payload = {}) {
    if (disposed) return shuttingDown();
    if (storageBlocked()) return storageBlocked();
    if (payload.confirmed !== true) return failure('ACP_START_CONFIRMATION_REQUIRED', 'Explicit confirmation is required before starting Goal-node work.');
    const required = ['goalId', 'goalElementId', 'goalExecutionId', 'workspacePath'];
    if (required.some(field => typeof payload[field] !== 'string' || !payload[field].trim())) return failure('ACP_GOAL_SCOPE_REQUIRED', 'A Goal, agent-node, execution, and repository folder are required.');
    const goalRevision = Number(payload.goalRevision);
    const executionAttempt = Number(payload.executionAttempt);
    if (!Number.isInteger(goalRevision) || goalRevision < 0 || !Number.isInteger(executionAttempt) || executionAttempt < 0) return failure('ACP_GOAL_SCOPE_REQUIRED', 'Goal revision and execution attempt are required.');
    (await reconcile());
    const activeExisting = (await activeTurn());
    if (activeExisting) return activeTurnFailure(activeExisting);
    const profileResolution = resolveProfile(store, payload);
    if (!profileResolution.ok || !profileResolution.profile) {
      if (profileResolution.state === 'disabled') return failure('ACP_RUNTIME_ACCESS_DISABLED', profileResolution.error, { state: 'disabled' });
      return failure('ACP_RUNTIME_NOT_CONFIGURED', 'The selected runtime profile could not be resolved.');
    }
    const mcpReadiness = await ensureOmvraMcpListener();
    if (!mcpReadiness.ok) return mcpReadiness;
    const bindingResult = await createBinding(store, {
      runtimeProfileId: profileResolution.profile.id,
      idempotencyKey: `${payload.idempotencyKey || `goal-${payload.goalExecutionId}-${payload.goalElementId}`}:binding`,
      scope: { kind: 'goal-node', goalId: payload.goalId, goalElementId: payload.goalElementId, goalExecutionId: payload.goalExecutionId, executionAttempt, goalRevision },
      capabilities: [],
    });
    if (!bindingResult.ok) return bindingResult;
    const binding = bindingResult.binding;
    let client;
    try {
      client = createClient(profileResolution.profile, clientOptions(profileResolution.profile, payload.workspacePath, mcpReadiness, binding.scope));
      clients.set(binding.id, { client, workspacePath: payload.workspacePath, profileId: profileResolution.profile.id });
      attachClient(binding, client);
      const negotiated = await client.initialize();
      if (disposed) throw Object.assign(new Error('The app is shutting down.'), { code: 'ACP_APP_SHUTDOWN' });
      const session = await client.startSession();
      if (disposed) throw Object.assign(new Error('The app is shutting down.'), { code: 'ACP_APP_SHUTDOWN' });
      const ready = await updateBinding(store, {
        bindingId: binding.id,
        expectedRevision: (await bindingFor(binding.id)).revision,
        state: 'ready',
        opaqueSessionRef: session.sessionId,
        capabilities: Object.entries(negotiated.capabilities || {}).filter(([, supported]) => supported === true).map(([id]) => ({ id, support: 'supported' })),
      });
      if (!ready.ok) throw Object.assign(new Error(ready.message || 'The Goal runtime session could not be marked ready.'), { code: ready.error });
      return { ok: true, state: 'ready', binding: ready.binding };
    } catch (error) {
      releaseClient(binding.id);
      await updateBinding(store, { bindingId: binding.id, expectedRevision: binding.revision, state: 'failed', terminalReason: 'protocol-error' });
      return failure(error.code || 'ACP_RUNTIME_UNAVAILABLE', error.message || 'The Goal runtime session could not be started.', { binding });
    }
  }

  async function invoke(bindingId, method, text) {
    if (disposed) return shuttingDown();
    if (method !== 'cancel' && storageBlocked()) return storageBlocked();
    let current = method === 'cancel' ? clients.get(bindingId)?.binding || await controlBinding(bindingId) : await bindingFor(bindingId);
    const session = clients.get(bindingId);
    if (!current || !session) return inactiveSession();
    if (method === 'cancel') {
      if (!ACTIVE_TURN_STATES.has(current.turn?.state) && !session.pendingControl) return failure('ACP_SESSION_BUSY', 'There is no active task turn to cancel.');
      try {
        // Transport control must never wait for a database write or queue drain.
        session.cancelRequested = true;
        const result = await session.client.cancel(current.opaqueSessionRef);
        if (result?.acknowledged === true) clearPendingRequests(bindingId);
        const state = result?.acknowledged === true ? 'interrupted' : 'cancelling';
        const persisted = await persistControl(bindingId, state, {reason:'cancelled'});
        if (result?.acknowledged !== true) scheduleBindingTimer(bindingId, () => persistControl(bindingId, 'interrupted', {reason:'cancelled'}), CANCEL_SETTLE_TIMEOUT_MS);
        return {ok:true,result,...(!persisted ? {storageFailure:true,reconciliationRequired:true} : {})};
      } catch (error) {
        session.cancelRequested = false;
        return failure(error.code || 'ACP_RUNTIME_UNAVAILABLE', 'The runtime cancellation failed.');
      }
    }
    if (method === 'prompt') {
      const blocking = (await activeTurn());
      if (blocking && blocking.id !== bindingId) return activeTurnFailure(blocking);
      current = (await beginTurn(bindingId, { state: 'starting' })) || current;
    }
    if (method === 'steer' && !ACTIVE_TURN_STATES.has(current.turn?.state)) return failure('ACP_SESSION_BUSY', 'There is no active task turn to steer.');
    try {
      const result = method === 'prompt' ? await session.client.prompt(current.opaqueSessionRef, text) : await session.client.steer(current.opaqueSessionRef, text);
      return {ok:true,result};
    } catch (error) { return failure(error.code || 'ACP_RUNTIME_UNAVAILABLE', 'The runtime operation failed.'); }
  }

  async function continueTask(bindingId, { automatic = false } = {}) {
    if (disposed) return shuttingDown();
    if (storageBlocked()) return storageBlocked();
    const current = (await bindingFor(bindingId));
    const session = clients.get(bindingId);
    if (!current || !session) return inactiveSession();
    if (current.scope?.kind !== 'task') return failure('ACP_CAPABILITY_UNSUPPORTED', 'Only task sessions can be continued from Start work.');
    if (current.state !== 'ready') return failure('ACP_SESSION_BUSY', `Session is ${current.state}.`);
    const blocking = (await activeTurn());
    if (blocking && blocking.id !== bindingId) return activeTurnFailure(blocking);
    if (ACTIVE_TURN_STATES.has(current.turn?.state)) return failure('ACP_SESSION_BUSY', `Turn is ${current.turn.state}.`);
    const contextPack = buildCurrentTaskContext(current);
    if (!contextPack.ok) return contextPack;
    const text = contextPack.text || 'Continue working on the assigned task. Re-read its current state before making changes.';
    try {
      (await beginTurn(bindingId, { state: 'starting', batchNumber: Number(current.taskExecution?.batchNumber || 0) + 1 }));
      (await syncTaskExecution((await bindingFor(bindingId)) || current, automatic ? 'continuing' : 'working', { reason: automatic ? 'automatic-batch' : 'manual-batch', batchNumber: Number(current.taskExecution?.batchNumber || 0) + 1 }));
      (await appendRuntimeEvent({ bindingId, runtimeProfileId: current.runtimeProfileId, kind: 'session', nativeEventType: 'omvra/taskInstructions/sent', state: 'sent', idempotencyKey: `runtime:${bindingId}:task-instructions:${randomUUID()}` }));
      await session.client.prompt(current.opaqueSessionRef, text);
      return { ok: true, binding: (await bindingFor(bindingId)) || current };
    } catch (error) {
      return failure(error.code || 'ACP_RUNTIME_UNAVAILABLE', error.message || 'The runtime session could not be continued.');
    }
  }

  async function respond(bindingId, requestId, result, error) {
    if (disposed) return shuttingDown();
    const session = clients.get(bindingId);
    const current = session?.binding || await controlBinding(bindingId);
    if (!current || !session) return inactiveSession();
    const key = requestKey(bindingId, requestId);
    const request = pendingRequests.get(key);
    if (!request || responsesInFlight.has(key) || request.turnId !== current.turn?.id) return failure('ACP_REQUEST_NOT_FOUND', 'This runtime request is no longer pending.');
    responsesInFlight.add(key);
    try {
      await session.client.respond(requestId, result, error);
      pendingRequests.delete(key);
      const persisted = await persistControl(bindingId, listRequests(bindingId).length ? 'waiting-input' : 'active');
      return {ok:true,...(!persisted ? {storageFailure:true,reconciliationRequired:true} : {})};
    } catch (caught) {
      return failure(caught.code || 'ACP_PROTOCOL_INCOMPATIBLE', 'The runtime request could not be answered.');
    } finally { responsesInFlight.delete(key); }
  }

  async function resume(bindingId, payload = {}) {
    if (disposed) return shuttingDown();
    if (storageBlocked()) return storageBlocked();
    const current = (await bindingFor(bindingId));
    if (!current || !current.opaqueSessionRef) return failure('ACP_SESSION_RESUME_UNSUPPORTED', 'This session has no resumable runtime reference.');
    if (!['interrupted', 'starting'].includes(current.state)) return failure('ACP_SESSION_NOT_RESUMABLE', `Session is ${current.state}.`);
    const profileResolution = resolveProfile(store, { executionProfileId: current.runtimeProfileId });
    if (!profileResolution.ok) {
      if (profileResolution.state === 'disabled') return failure('ACP_RUNTIME_ACCESS_DISABLED', profileResolution.error, { state: 'disabled' });
      return failure('ACP_RUNTIME_NOT_CONFIGURED', 'The runtime profile could not be resolved.');
    }
    const workspacePath = typeof payload.workspacePath === 'string' ? payload.workspacePath.trim() : '';
    if (!workspacePath) return failure('ACP_REPOSITORY_FOLDER_REQUIRED', 'A repository folder is required before resuming work.');
    const mcpReadiness = await ensureOmvraMcpListener();
    if (!mcpReadiness.ok) return mcpReadiness;
    const starting = current.state === 'interrupted'
      ? await updateBinding(store, { bindingId, expectedRevision: current.revision, state: 'starting' })
      : { ok: true, binding: current };
    if (!starting.ok) return starting;
    let client;
    try {
      client = createClient(profileResolution.profile, clientOptions(profileResolution.profile, workspacePath, mcpReadiness, current.scope));
      clients.set(bindingId, { client, workspacePath, profileId: current.runtimeProfileId });
      attachClient(starting.binding, client);
      const negotiated = await client.initialize();
      if (disposed) throw Object.assign(new Error('The app is shutting down.'), { code: 'ACP_APP_SHUTDOWN' });
      const session = await client.resumeSession(current.opaqueSessionRef);
      if (disposed) throw Object.assign(new Error('The app is shutting down.'), { code: 'ACP_APP_SHUTDOWN' });
      const ready = await updateBinding(store, {
        bindingId,
        expectedRevision: (await bindingFor(bindingId)).revision,
        state: 'ready',
        opaqueSessionRef: session.sessionId,
        capabilities: Object.entries(negotiated.capabilities || {}).filter(([, supported]) => supported === true).map(([id]) => ({ id, support: 'supported' })),
      });
      if (!ready.ok) throw Object.assign(new Error(ready.message || 'The session could not be resumed.'), { code: ready.error });
      (await syncTaskExecution(ready.binding, 'ready', { reason: 'session-resumed' }));
      const contextPack = buildCurrentTaskContext(ready.binding);
      if (!contextPack.ok) throw Object.assign(new Error(contextPack.message), { code: contextPack.error });
      {
        const promptText = contextPack.text || 'Resume working on the assigned task. Re-read its current state before making changes.';
        (await appendRuntimeEvent({ bindingId, runtimeProfileId: current.runtimeProfileId, kind: 'session', nativeEventType: 'omvra/taskInstructions/sent', state: 'sent', idempotencyKey: `runtime:${bindingId}:task-instructions:${ready.binding.revision}` }));
        (await beginTurn(bindingId, { state: 'starting' }));
        await client.prompt(session.sessionId, promptText);
      }
      return { ...ready, binding: (await bindingFor(bindingId)) || ready.binding };
    } catch (error) {
      releaseClient(bindingId);
      if (ACTIVE_TURN_STATES.has((await bindingFor(bindingId))?.turn?.state)) (await syncTurnState(bindingId, 'failed', { reason: error.code || 'protocol-error' }));
      const latest = (await bindingFor(bindingId)) || starting.binding;
      await updateBinding(store, { bindingId, expectedRevision: latest.revision, state: 'failed', terminalReason: 'protocol-error' });
      (await syncTaskExecution((await bindingFor(bindingId)) || latest, 'failed', { reason: error.code || 'protocol-error' }));
      return failure(error.code || 'ACP_SESSION_RESUME_UNSUPPORTED', error.message || 'The runtime session could not be resumed.');
    }
  }

  async function close(bindingId) {
    const current = (await bindingFor(bindingId));
    const session = clients.get(bindingId);
    if (!current) return failure('ACP_SESSION_NOT_FOUND', 'The runtime session binding was not found.');
    if (session) {
      try {
        await session.client.closeSession(current.opaqueSessionRef);
      } catch (error) {
        if (error.code !== 'ACP_CAPABILITY_UNSUPPORTED') {
          return failure(error.code || 'ACP_CAPABILITY_UNSUPPORTED', error.message || 'The runtime session could not be closed.');
        }
      }
    }
    try {
      if (ACTIVE_TURN_STATES.has(((await bindingFor(bindingId)) || current).turn?.state)) (await syncTurnState(bindingId, 'interrupted', { reason: 'closed' }));
      const latest = (await bindingFor(bindingId)) || current;
      const result = await updateBinding(store, { bindingId, expectedRevision: latest.revision, state: 'closed', terminalReason: 'closed' });
      if (!result.ok) return result;
      (await syncTaskExecution(result.binding, 'stopped', { reason: 'closed' }));
      // Delivery releases transient output only after observing the committed closed state.
      emit({ kind: 'binding', binding: result.binding });
      releaseClient(bindingId);
      return result;
    } catch (error) {
      return failure(error.code || 'ACP_RUNTIME_UNAVAILABLE', error.message || 'The runtime session could not be closed.');
    }
  }

  async function reconcile() {
    const projection = await listSessions(store, { limit: 100, includeEvents: false });
    const persistedSessions = projection?.bindings || [];
    for (const bindingId of [...notificationFailures.keys()]) {
      const session = clients.get(bindingId);
      if (session?.pendingControl) {
        const {state,details} = session.pendingControl;
        if (!await persistControl(bindingId, state, details)) continue;
      }
      await appendRuntimeEvent({bindingId,runtimeProfileId:session?.binding?.runtimeProfileId || persistedSessions.find(b=>b.id===bindingId)?.runtimeProfileId,kind:'session',nativeEventType:'omvra/storage/reconciled',state:'interrupted',idempotencyKey:`storage-reconciled:${bindingId}:${randomUUID()}`});
      notificationFailures.delete(bindingId);
      emit({kind:'storage-recovered',bindingId});
    }

    let changed = false;
    for (const binding of persistedSessions) {
      if (['ready', 'active', 'needs-input', 'cancelling'].includes(binding.state) && !clients.has(binding.id)) {
        changed = Boolean((await reconcileBindingLoss(binding.id, { code: 'ACP_RUNTIME_MISSING', kind: 'error' }))?.ok) || changed;
      }
    }
    for (const [bindingId, session] of clients.entries()) {
      if (typeof session.client.isAlive === 'function' && !session.client.isAlive()) {
        changed = Boolean((await reconcileBindingLoss(bindingId, { code: 'ACP_SESSION_INTERRUPTED', kind: 'error' }))?.ok) || changed;
      }
    }
    return changed ? await listSessions(store, { limit: 100, includeEvents: false }) : projection;
  }

  async function dispose() {
    if (disposed) return { ok: true, idempotent: true, closedClientCount: 0 };
    disposed = true;
    await notificationTail;
    const bindingIds = [...clients.keys()];
    for (const bindingId of bindingIds) {
      releaseClient(bindingId);
      try { await reconcileBindingLoss(bindingId, { code: 'ACP_APP_SHUTDOWN', kind: 'shutdown' }); } catch (error) { storageFailed(bindingId, error); }
    }
    for (const bindingId of [...timersByBinding.keys()]) clearBindingTimers(bindingId);
    pendingRequests.clear();
    clientSubscriptions.clear();
    return { ok: true, idempotent: false, closedClientCount: bindingIds.length };
  }

  return { close, continueTask, dispose, flush, hasLiveSessions: () => clients.size > 0, invoke, listRequests, reconcile, respond, resume, start, startGoalNode };
}

module.exports = { createAgentRuntimeSessionRunner };
