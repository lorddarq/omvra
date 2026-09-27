const { publicResult } = require('../services/agent-work-session-service.cjs');
const {
  deleteProfile,
  getState,
  resolveProfile,
  saveDefaults,
  saveProfile,
} = require('../domain/agent-runtime-profile-service.cjs');
const { openExternalHandoff, testConnection } = require('../services/agent-runtime-service.cjs');

function resultOf(action) {
  try {
    return { ok: true, value: action() };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

function registerAgentRuntimeIpcHandlers({
  ipcMain,
  store,
  shell,
  appendAgentRuntimeEvent,
  appendAgentRuntimeOutcome,
  confirmAgentExecutionStart,
  createAgentRuntimeSessionBinding,
  evaluateAgentRuntimeGovernance,
  listAgentRuntimeSessions,
  prepareAgentExecution,
  recoverOrphanedTaskExecution = null,
  prepareAgentRuntimeSessionArchive,
  updateAgentRuntimeSessionBinding,
  startAgentRuntimeSession,
  startGoalAgentRuntimeSession,
  invokeAgentRuntimeSession,
  respondAgentRuntimeSession,
  listAgentRuntimeSessionRequests,
  setNotificationVisibility = () => ({ok:true}),
  delivery = null,
  closeAgentRuntimeSession,
  continueAgentRuntimeTaskSession,
  resumeAgentRuntimeSession,
  resolveManagedWorkspace,
  logger = null,
}) {
  const handle = (channel, action) => ipcMain.handle(channel, async (...args) => {
    try { return publicResult(await action(...args)); }
    catch(error) { return {ok:false,error:error.code || 'AGENT_WORK_STORAGE_FAILED'}; }
  });
  const log = (level, event, details = {}) => logger?.[level]?.(`[agent-runtime:ipc] ${event}`, details);
  const logged = async (operation, details, action) => {
    log('info', `${operation}.requested`, details);
    try {
      const result = await action();
      const failed = result?.ok === false || result?.canStart === false || Boolean(result?.blockers?.length);
      log(failed ? 'warn' : 'info', `${operation}.${failed ? 'rejected' : 'completed'}`, {
        ...details,
        error: result?.error || null,
        blockerCount: result?.blockers?.length || 0,
        bindingId: result?.binding?.id || result?.bindingId || null,
      });
      return result;
    } catch (error) {
      log('error', `${operation}.failed`, { ...details, code: error?.code || null, message: error?.message || String(error), stack: error?.stack || null });
      throw error;
    }
  };
  handle('agent-runtime/get-state', () => resultOf(() => getState(store)));
  handle('agent-runtime/save-profile', (_, profile) => resultOf(() => saveProfile(store, profile)));
  handle('agent-runtime/delete-profile', (_, profileId) => resultOf(() => deleteProfile(store, profileId)));
  handle('agent-runtime/save-defaults', (_, defaults) => resultOf(() => saveDefaults(store, defaults)));
  handle('agent-runtime/resolve', (_, payload) => resultOf(() => resolveProfile(store, payload)));
  handle('agent-runtime/resolve-managed-workspace', (_, taskId) => resultOf(() => resolveManagedWorkspace(taskId)));
  handle('agent-runtime/prepare-execution', async (_, payload = {}) => {
    return logged('prepare-execution', { taskId: payload.taskId || null }, async () => {
      await recoverOrphanedTaskExecution?.(payload);
      const prepared = prepareAgentExecution({ ...payload, deferConnection: true });
      if (prepared.blockers?.length) return prepared;
      const connection = await testConnection(store, payload);
      const result = prepareAgentExecution(payload);
      return { ...result, connection };
    });
  });
  handle('agent-runtime/confirm-start', async (_, payload = {}) => {
    return logged('confirm-start', { taskId: payload.taskId || null, confirmed: payload.confirmed === true }, async () => {
      await recoverOrphanedTaskExecution?.(payload);
      if (payload.confirmed !== true) return confirmAgentExecutionStart(payload);
      const prepared = prepareAgentExecution({ ...payload, deferConnection: true });
      if (prepared.blockers?.length) return prepared;
      const connection = await testConnection(store, payload);
      if (!connection.ok) return { ...prepareAgentExecution(payload), connection };
      return { ...confirmAgentExecutionStart(payload), connection };
    });
  });
  handle('agent-runtime/sessions/notification-visibility', (event, payload) => {
    if (!payload || typeof payload.visible !== 'boolean' || (payload.visible && (typeof payload.taskId !== 'string' || !/^[A-Za-z0-9._-]{1,160}$/.test(payload.taskId)))) return {ok:false,error:'INVALID_NOTIFICATION_VISIBILITY'};
    return setNotificationVisibility(event.sender, payload.visible ? payload.taskId : null);
  });
  // Bounded delivery projections are scoped to the invoking sender; payloads are validated by the delivery owner.
  const deliver = (method, event, payload) => {
    if (!delivery) return {ok:false,error:'DELIVERY_UNAVAILABLE'};
    if (method !== 'diagnostics' && (!payload || typeof payload !== 'object')) return {ok:false,error:'INVALID_DELIVERY_REQUEST'};
    return delivery[method](event.sender, payload);
  };
  handle('agent-runtime/sessions/delivery/subscribe', (event, payload) => deliver('subscribe', event, payload));
  handle('agent-runtime/sessions/delivery/visibility', (event, payload) => deliver('setVisibility', event, payload));
  handle('agent-runtime/sessions/delivery/snapshot', (event, payload) => deliver('snapshot', event, payload));
  handle('agent-runtime/sessions/delivery/ack', (event, payload) => deliver('acknowledge', event, payload));
  handle('agent-runtime/sessions/delivery/unsubscribe', (event, payload) => deliver('unsubscribe', event, payload));
  handle('agent-runtime/sessions/delivery/diagnostics', (event) => deliver('diagnostics', event));
  handle('agent-runtime/sessions/list', (_, payload) => listAgentRuntimeSessions(payload));
  handle('agent-runtime/sessions/requests', (_, bindingId) => listAgentRuntimeSessionRequests(bindingId));
  handle('agent-runtime/sessions/create-binding', (_, payload) => createAgentRuntimeSessionBinding(payload));
  handle('agent-runtime/sessions/update-binding', (_, payload) => updateAgentRuntimeSessionBinding(payload));
  handle('agent-runtime/sessions/append-event', (_, payload) => appendAgentRuntimeEvent(payload));
  handle('agent-runtime/sessions/evaluate-governance', (_, payload) => evaluateAgentRuntimeGovernance(payload));
  handle('agent-runtime/sessions/append-outcome', (_, payload) => appendAgentRuntimeOutcome(payload));
  handle('agent-runtime/sessions/prepare-archive', (_, bindingId) => prepareAgentRuntimeSessionArchive(bindingId));
  handle('agent-runtime/sessions/start', async (_, payload = {}) => logged('session-start', { taskId: payload.taskId || null }, () => startAgentRuntimeSession(payload)));
  handle('agent-runtime/sessions/start-goal-node', async (_, payload) => startGoalAgentRuntimeSession(payload));
  handle('agent-runtime/sessions/prompt', async (_, payload) => invokeAgentRuntimeSession(payload.bindingId, 'prompt', payload.text));
  handle('agent-runtime/sessions/steer', async (_, payload) => invokeAgentRuntimeSession(payload.bindingId, 'steer', payload.text));
  handle('agent-runtime/sessions/cancel', async (_, payload) => invokeAgentRuntimeSession(payload.bindingId, 'cancel'));
  handle('agent-runtime/sessions/respond', async (_, payload) => respondAgentRuntimeSession(payload.bindingId, payload.requestId, payload.result, payload.error));
  handle('agent-runtime/sessions/close', async (_, bindingId) => closeAgentRuntimeSession(bindingId));
  handle('agent-runtime/sessions/continue-task', async (_, bindingId) => logged('session-continue-task', { bindingId: bindingId || null }, () => continueAgentRuntimeTaskSession(bindingId)));
  handle('agent-runtime/sessions/resume', async (_, payload = {}) => logged('session-resume', { bindingId: payload.bindingId || null }, () => resumeAgentRuntimeSession(payload.bindingId, payload)));
  handle('agent-runtime/test-connection', async (_, payload) => {
    try {
      return await testConnection(store, payload);
    } catch (error) {
      return { ok: false, state: 'unavailable', error: error?.message || String(error) };
    }
  });
  handle('agent-runtime/open-external', async (_, payload) => {
    try {
      return await openExternalHandoff(store, payload, { shell });
    } catch (error) {
      return { ok: false, state: 'unavailable', error: error?.message || String(error) };
    }
  });
}

module.exports = { registerAgentRuntimeIpcHandlers };
