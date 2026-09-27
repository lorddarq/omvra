const test = require('node:test');
const assert = require('node:assert/strict');
const { createAgentRuntimeDelivery, DELIVERY_LIMITS } = require('./agent-runtime-delivery.cjs');

function fixture({ requests = [], loadBinding } = {}) {
  let at = 0, id = 0, uuid = 0;
  const timers = new Map();
  const delivery = createAgentRuntimeDelivery({
    now: () => at,
    setTimer: (fn, delay) => { timers.set(++id, { fn, at: at + delay }); return id; },
    clearTimer: timer => timers.delete(timer),
    createId: () => `id-${++uuid}`,
    listRequests: () => requests,
    loadBinding,
  });
  const tick = ms => {
    const end = at + ms;
    let guard = 0;
    while (true) {
      const next = [...timers].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      assert.ok(++guard < 100000);
      at = next[1].at;
      timers.delete(next[0]);
      next[1].fn();
    }
    at = end;
  };
  let requestId = 0;
  const subscribe = async ({ ownerId = 1, visible = true, windowVisible = () => true, bindingId = 'b' } = {}) => {
    const sent = [];
    const result = await delivery.subscribe({ ownerId, bindingId, visible, requestId: ++requestId, send: envelope => { sent.push(envelope); }, isWindowVisible: windowVisible });
    assert.equal(result.ok, true);
    return { sent, subscriptionId: result.subscriptionId, snapshot: result.snapshot, kinds: () => sent.map(envelope => envelope.kind) };
  };
  return { delivery, tick, timers, subscribe, nextRequestId: () => ++requestId, advance: ms => { at += ms; } };
}
const binding = (overrides = {}) => ({
  id: 'b', revision: 1, state: 'active', scope: { kind: 'task', taskId: 't' },
  turn: { id: 'turn-1', state: 'active' }, capabilities: [], ...overrides,
});
const output = (text, turnId = 'turn-1', extra = {}) => ({ kind: 'event', binding: binding(), event: { id: `e-${Math.random()}`, bindingId: 'b', turnId, type: 'message-observed', nativeEventType: 'item/agentMessage/delta', messagePreview: text, ...extra } });

test('a 10,000-delta burst with a stalled renderer stays bounded and restores from one snapshot', async () => {
  const f = fixture();
  f.delivery.accept({ kind: 'binding', binding: binding() });
  const visible = await f.subscribe();
  const hidden = await f.subscribe({ ownerId: 2, visible: false });
  for (let i = 0; i < 10000; i++) {
    f.delivery.accept(output(`token-${i} ${'x'.repeat(i % 7)} `));
    if (i % 50 === 0) f.tick(10);
  }
  f.tick(DELIVERY_LIMITS.burstMs);
  const diagnostics = f.delivery.diagnostics();
  // No acknowledgements: one sent projection, then suspension after the ack timeout.
  assert.ok(visible.sent.filter(envelope => envelope.kind === 'output').length <= 3, `output sends: ${visible.kinds().join(',')}`);
  assert.equal(hidden.sent.filter(envelope => envelope.kind === 'output').length, 0);
  assert.ok(diagnostics.counters.ackTimeouts >= 1);
  assert.ok(diagnostics.highWater.pendingOutputBytes <= DELIVERY_LIMITS.burstBytes + 64);
  assert.ok(diagnostics.bindings[0].pendingOutputBytes <= DELIVERY_LIMITS.burstBytes);
  assert.equal(diagnostics.counters.ingestedOutputEvents, 10000);

  const restored = f.delivery.snapshot({ ownerId: 1, subscriptionId: visible.subscriptionId, requestId: f.nextRequestId() });
  assert.equal(restored.ok, true);
  assert.equal(restored.snapshot.kind, 'snapshot');
  assert.ok(Array.from(restored.snapshot.output.text).length <= DELIVERY_LIMITS.textCodePoints);
  assert.ok(Buffer.byteLength(restored.snapshot.output.text) <= DELIVERY_LIMITS.textBytes);
  assert.equal(restored.snapshot.output.truncated, true);
  assert.match(restored.snapshot.output.text, /token-9999 x*$/, 'newest text is retained');
  assert.ok(Buffer.byteLength(JSON.stringify(restored.snapshot)) <= DELIVERY_LIMITS.envelopeBytes);
});

test('visible output is coalesced per burst window and waits for acknowledgement', async () => {
  const f = fixture();
  f.delivery.accept({ kind: 'binding', binding: binding() });
  const sub = await f.subscribe();
  for (let i = 0; i < 200; i++) f.delivery.accept(output(`${i} `));
  assert.equal(sub.sent.length, 0, 'no per-token IPC');
  f.tick(DELIVERY_LIMITS.burstMs);
  assert.deepEqual(sub.kinds(), ['output']);
  const first = sub.sent[0];
  assert.match(first.text, /^0 1 2/);
  for (let i = 0; i < 50; i++) f.delivery.accept(output('more '));
  f.tick(DELIVERY_LIMITS.burstMs);
  assert.equal(sub.sent.length, 1, 'held until the installed version is acknowledged');
  f.delivery.acknowledge({ ownerId: 1, subscriptionId: sub.subscriptionId, version: first.version });
  assert.equal(sub.sent.length, 2);
  assert.ok(sub.sent[1].version > first.version);
  assert.ok(sub.sent[1].text.startsWith(first.text), 'output is a full replacement, not a delta');
});

test('hidden or minimized supervision receives attention changes but no ordinary output', async () => {
  let windowVisible = true;
  const f = fixture({ requests: [{ requestId: 7, turnId: 'turn-1', responseKind: 'codex-approval' }] });
  f.delivery.accept({ kind: 'binding', binding: binding() });
  const sub = await f.subscribe({ windowVisible: () => windowVisible });
  windowVisible = false;
  f.delivery.windowVisibilityChanged(1, false);
  for (let i = 0; i < 100; i++) f.delivery.accept(output('hidden '));
  f.tick(1000);
  assert.equal(sub.sent.length, 0);
  f.delivery.accept({ kind: 'binding', requestId: 7, binding: binding({ revision: 2, turn: { id: 'turn-1', state: 'waiting-input' } }) });
  assert.deepEqual(sub.kinds(), ['state'], 'permission is delivered synchronously');
  const attention = sub.sent[0].attention.find(record => record.category === 'permission');
  assert.deepEqual(attention.request, { bindingId: 'b', turnId: 'turn-1', requestId: 7 });
  assert.equal(sub.sent[0].text, undefined, 'state carries no model text');
  windowVisible = true;
  f.delivery.windowVisibilityChanged(1, true);
  assert.equal(sub.sent.at(-1).kind, 'snapshot');
  assert.match(sub.sent.at(-1).output.text, /hidden/);
});

test('attention for permission, input, failure, cancellation and completion is immediate', async () => {
  for (const [turn, category] of [
    [{ state: 'failed', terminalReason: 'protocol-error' }, 'failure'],
    [{ state: 'interrupted', terminalReason: 'interrupted' }, 'cancelled'],
    [{ state: 'interrupted', terminalReason: 'runtime-missing' }, 'recovery'],
    [{ state: 'completed' }, 'completed'],
  ]) {
    const f = fixture();
    f.delivery.accept({ kind: 'binding', binding: binding() });
    const sub = await f.subscribe({ visible: false });
    f.delivery.accept({ kind: 'binding', binding: binding({ revision: 2, turn: { id: 'turn-1', ...turn } }) });
    assert.equal(sub.sent.length, 1, category);
    assert.deepEqual(sub.sent[0].attention.map(record => record.category), [category]);
    assert.equal(sub.sent[0].barrier.state, 'committed');
  }
  const f = fixture({ requests: [{ requestId: '1', turnId: 'turn-1', responseKind: 'elicitation' }] });
  f.delivery.accept({ kind: 'binding', binding: binding() });
  const sub = await f.subscribe({ visible: false });
  f.delivery.accept({ kind: 'binding', requestId: '1', binding: binding({ turn: { id: 'turn-1', state: 'waiting-input' } }) });
  const input = sub.sent[0].attention[0];
  assert.equal(input.category, 'input');
  assert.equal(input.request.requestId, '1', 'typed request IDs are preserved');
  f.delivery.accept({ kind: 'binding', requestId: '1', binding: binding({ turn: { id: 'turn-1', state: 'waiting-input' } }) });
  assert.equal(sub.sent.length, 1, 'identical requests are not re-announced');
  f.delivery.accept({ kind: 'binding', binding: binding({ revision: 3, turn: { id: 'turn-1', state: 'waiting-input' } }), requestId: 1 });
  assert.equal(sub.sent.length, 1);
});

test('completion barrier publishes final output before completion and seals late output', async () => {
  const f = fixture();
  f.delivery.accept({ kind: 'binding', binding: binding() });
  const visible = await f.subscribe();
  const hidden = await f.subscribe({ ownerId: 2, visible: false });
  const order = [];
  f.delivery.accept(output('Final '));
  f.delivery.accept(output('answer.'));
  const result = f.delivery.accept({ kind: 'binding', binding: binding({ revision: 2, state: 'ready', turn: { id: 'turn-1', state: 'completed' } }) });
  order.push('notification-scheduled');
  const final = visible.sent.at(-1);
  assert.equal(final.kind, 'snapshot');
  assert.equal(final.output.text, 'Final answer.');
  assert.equal(final.barrier.state, 'committed');
  assert.ok(final.output.outputVersion >= final.barrier.finalOutputVersion);
  assert.equal(result.version, final.version, 'notification requires the committed projection version');
  assert.deepEqual(hidden.kinds(), ['state']);
  assert.equal(hidden.sent[0].barrier.finalOutputVersion, final.barrier.finalOutputVersion);
  assert.equal(hidden.sent[0].output, undefined);

  f.delivery.accept(output('late text'));
  f.tick(1000);
  assert.equal(f.delivery.diagnostics().counters.lateOutputs, 1);
  assert.equal(f.delivery.snapshot({ ownerId: 1, subscriptionId: visible.subscriptionId, requestId: f.nextRequestId() }).snapshot.output.text, 'Final answer.');

  // A committed old turn cannot overwrite a newer turn; the new turn clears output.
  f.delivery.accept({ kind: 'binding', binding: binding({ revision: 3, turn: { id: 'turn-2', state: 'active' } }) });
  f.delivery.accept({ kind: 'binding', binding: binding({ revision: 2, state: 'ready', turn: { id: 'turn-1', state: 'completed' } }) });
  const current = f.delivery.snapshot({ ownerId: 1, subscriptionId: visible.subscriptionId, requestId: f.nextRequestId() }).snapshot;
  assert.equal(current.turnId, 'turn-2');
  assert.equal(current.turnState, 'active');
  assert.equal(current.output.text, '');
  assert.equal(current.barrier.state, 'none');
  assert.deepEqual(current.attention, []);
});

test('failed history commit fails the barrier and never reports completion', async () => {
  const f = fixture();
  f.delivery.accept({ kind: 'binding', binding: binding() });
  const sub = await f.subscribe({ visible: false });
  f.delivery.accept({ kind: 'storage-failure', bindingId: 'b', error: 'AGENT_WORK_STORAGE_FAILED' });
  const state = sub.sent.at(-1);
  assert.equal(state.barrier.state, 'failed');
  assert.deepEqual(state.attention.map(record => record.category).sort(), ['blocked', 'failure']);
  assert.ok(!state.attention.some(record => record.category === 'completed'));
  f.delivery.accept({ kind: 'storage-recovered', bindingId: 'b' });
  assert.ok(!sub.sent.at(-1).attention.some(record => record.category === 'blocked'));
});

test('explicit close clears timers and transient output but keeps the committed summary', async () => {
  const f = fixture();
  f.delivery.accept({ kind: 'binding', binding: binding() });
  const sub = await f.subscribe();
  f.delivery.accept(output('done'));
  f.delivery.accept({ kind: 'binding', binding: binding({ revision: 2, state: 'ready', turn: { id: 'turn-1', state: 'completed' } }) });
  f.delivery.accept(output('ignored'));
  assert.ok(f.delivery.diagnostics().timers >= 1, 'retention timer armed');
  f.delivery.accept({ kind: 'binding', binding: binding({ revision: 3, state: 'closed', turn: { id: 'turn-1', state: 'completed' } }) });
  const diagnostics = f.delivery.diagnostics();
  assert.equal(diagnostics.timers, 0);
  assert.equal(diagnostics.pendingProjections, 0);
  assert.equal(diagnostics.inFlightProjections, 0);
  assert.equal(diagnostics.bindings[0].pendingOutputBytes, 0);
  const snapshot = f.delivery.snapshot({ ownerId: 1, subscriptionId: sub.subscriptionId, requestId: f.nextRequestId() }).snapshot;
  assert.equal(snapshot.connectionState, 'closed');
  assert.equal(snapshot.barrier.state, 'committed');
  assert.deepEqual(snapshot.attention.map(record => record.category), ['completed']);
  assert.equal(snapshot.output.text, '');
  assert.equal(snapshot.output.availability, 'summary-only');
});

test('terminal text is retained for a bounded window only', async () => {
  const f = fixture();
  f.delivery.accept({ kind: 'binding', binding: binding() });
  const sub = await f.subscribe({ visible: false });
  f.delivery.accept(output('answer'));
  f.delivery.accept({ kind: 'binding', binding: binding({ revision: 2, state: 'ready', turn: { id: 'turn-1', state: 'completed' } }) });
  f.tick(DELIVERY_LIMITS.terminalTextRetentionMs);
  const snapshot = f.delivery.snapshot({ ownerId: 1, subscriptionId: sub.subscriptionId, requestId: f.nextRequestId() }).snapshot;
  assert.equal(snapshot.output.text, '');
  assert.equal(snapshot.output.availability, 'summary-only');
  assert.equal(snapshot.barrier.state, 'committed');
  assert.equal(f.delivery.diagnostics().timers, 0);
});

test('subscriptions are sender-scoped, request IDs are monotonic and destruction releases state', async () => {
  const f = fixture();
  f.delivery.accept({ kind: 'binding', binding: binding() });
  const sub = await f.subscribe();
  assert.equal(f.delivery.setVisibility({ ownerId: 2, subscriptionId: sub.subscriptionId, visible: false, requestId: f.nextRequestId() }).ok, false);
  assert.equal(f.delivery.acknowledge({ ownerId: 2, subscriptionId: sub.subscriptionId, version: 1 }).ok, false);
  assert.equal(f.delivery.snapshot({ ownerId: 1, subscriptionId: sub.subscriptionId, requestId: 0 }).error, 'STALE_DELIVERY_REQUEST');
  assert.equal((await f.delivery.subscribe({ ownerId: 1, bindingId: 'b', visible: 'yes', requestId: f.nextRequestId(), send() {} })).error, 'INVALID_DELIVERY_SUBSCRIPTION');
  f.delivery.accept(output('text'));
  assert.equal(f.delivery.diagnostics().timers, 1);
  f.delivery.releaseOwner(1);
  const diagnostics = f.delivery.diagnostics();
  assert.equal(diagnostics.subscriptions, 0);
  assert.equal(diagnostics.timers, 0);
  f.delivery.dispose();
  assert.equal(f.delivery.accept(output('after')).accepted, false);
  assert.equal((await f.delivery.subscribe({ ownerId: 3, bindingId: 'b', visible: true, requestId: 1, send() {} })).error, 'DELIVERY_DISPOSED');
});

test('restart reopen exposes a safe summary without text and the cache stays bounded', async () => {
  const f = fixture({ loadBinding: async id => id === 'old' ? binding({ id: 'old', state: 'ready', turn: { id: 'turn-x', state: 'completed' } }) : null });
  const reopened = await f.subscribe({ bindingId: 'old' });
  assert.equal(reopened.snapshot.output.availability, 'summary-only');
  assert.equal(reopened.snapshot.output.text, '');
  assert.equal(reopened.snapshot.barrier.state, 'committed');
  assert.equal((await f.delivery.subscribe({ ownerId: 1, bindingId: 'missing', visible: true, requestId: f.nextRequestId(), send() {} })).error, 'ACP_SESSION_NOT_FOUND');

  f.delivery.accept({ kind: 'binding', binding: binding({ id: 'active' }) });
  for (let i = 0; i < 250; i++) f.delivery.accept({ kind: 'binding', binding: binding({ id: `done-${i}`, state: 'closed', turn: null }) });
  const diagnostics = f.delivery.diagnostics();
  assert.ok(diagnostics.entries <= DELIVERY_LIMITS.cacheEntries);
  assert.ok(diagnostics.bindings.some(entry => entry.bindingId === 'active'), 'active work is never evicted');
  assert.ok(diagnostics.bindings.some(entry => entry.bindingId === 'old'), 'subscribed bindings are never evicted');
});

test('activity counts dedupe provider identity and never exceed the summary budget', async () => {
  const f = fixture();
  f.delivery.accept({ kind: 'binding', binding: binding() });
  const sub = await f.subscribe();
  for (let i = 0; i < 100; i++) f.delivery.accept({ kind: 'event', binding: binding(), event: { id: `t${i}`, bindingId: 'b', turnId: 'turn-1', type: 'tool-state', requestId: String(i % 10), toolName: `tool-${i}` } });
  f.tick(DELIVERY_LIMITS.burstMs);
  const state = sub.sent.at(-1);
  assert.equal(state.kind, 'state');
  assert.deepEqual(state.activity.tools, { count: 10, exact: true });
  assert.equal(state.activity.entries.length, DELIVERY_LIMITS.activityEntries);
  f.delivery.accept({ kind: 'event', binding: binding(), event: { id: 'anon', bindingId: 'b', turnId: 'turn-1', type: 'tool-state' } });
  f.tick(DELIVERY_LIMITS.burstMs);
  assert.equal(sub.sent.at(-1).activity.tools.exact, false);
});

test('word-shaped whole messages join like the renderer and boundaries reset the response', async () => {
  const f = fixture();
  f.delivery.accept({ kind: 'binding', binding: binding() });
  const sub = await f.subscribe({ visible: false });
  f.delivery.accept(output('Checking'));
  f.delivery.accept(output('the tests.'));
  let snapshot = f.delivery.snapshot({ ownerId: 1, subscriptionId: sub.subscriptionId, requestId: f.nextRequestId() }).snapshot;
  assert.equal(snapshot.output.text, 'Checking the tests.');
  f.delivery.accept({ kind: 'event', binding: binding(), event: { id: 'i', bindingId: 'b', turnId: 'turn-1', type: 'observation', nativeEventType: 'item/completed' } });
  f.delivery.accept(output('Done.'));
  snapshot = f.delivery.snapshot({ ownerId: 1, subscriptionId: sub.subscriptionId, requestId: f.nextRequestId() }).snapshot;
  assert.equal(snapshot.output.text, 'Done.');
  assert.equal(f.delivery.accept(output('x')).ordinaryOutput, true);
});

test('runner emissions stream through bounded delivery with completion after final output and clean close', async () => {
  const { createAgentRuntimeSessionRunner } = require('./agent-runtime-session-runner.cjs');
  const f = fixture();
  const order = [];
  let notify, binding = null, sequence = 0;
  const events = [];
  const runner = createAgentRuntimeSessionRunner({
    store: { get: () => [], set: () => {} },
    resolveProfile: () => ({ ok: true, profile: { id: 'runtime-1', integrationMode: 'codex-app-server-stdio', executablePath: '/tmp/codex' } }),
    confirmStart: () => ({ canStart: true, task: { __mcpRevision: 1 }, contractSnapshot: { taskId: 'task-1', taskRevision: 1, contributionId: null }, contractDigest: 'digest' }),
    transitionContribution: () => ({ ok: true }),
    moveTaskToStatus: () => ({ ok: true, task: { __mcpRevision: 2, status: 'in-progress' } }),
    createBinding: () => { binding = { id: 'b', revision: 0, runtimeProfileId: 'runtime-1', state: 'starting', scope: { kind: 'task', taskId: 'task-1', executionAttemptId: 'attempt-1', taskRevision: 1 }, turn: { id: 'turn-0', state: 'queued' } }; return { ok: true, binding }; },
    updateBinding: (_store, input) => { binding = { ...binding, ...input, revision: input.expectedRevision + 1 }; return { ok: true, binding }; },
    // Mirrors the storage owner: durable facts only, with the transient preview attached to the live event.
    appendEvent: (_store, input) => {
      const event = { id: `event-${++sequence}`, bindingId: input.bindingId, turnId: input.turnId, type: ({message:'message-observed',tool:'tool-state',turn:'turn-state',session:'session-state'})[input.kind] || 'unsupported-event', nativeEventType: input.nativeEventType, ...(input.messagePreview ? { messagePreview: input.messagePreview } : {}) };
      events.push(event);
      return { ok: true, event };
    },
    listSessions: () => ({ bindings: binding ? [binding] : [], events: [] }),
    getTaskById: () => ({ id: 'task-1', status: 'in-progress', __mcpRevision: 2 }),
    emitRuntimeEvent: payload => {
      const delivered = f.delivery.accept(payload);
      if (payload.kind === 'binding' && payload.binding?.turn?.state === 'completed') order.push(`completion-notification@${delivered.version}`);
    },
    createClient: () => ({
      initialize: async () => ({ capabilities: { prompt: true } }),
      onNotification: callback => { notify = callback; },
      onLifecycle: () => {},
      startSession: async () => ({ sessionId: 'thread-1' }),
      prompt: async () => { await notify({ method: 'turn/started', params: { turn: { status: 'inProgress' } } }); return { turnId: 'turn-1' }; },
      closeSession: async () => {},
      close: () => {},
    }),
  });
  assert.equal((await runner.start({ confirmed: true, taskId: 'task-1', workspacePath: '/tmp/workspace', idempotencyKey: 'delivery' })).ok, true);
  await runner.continueTask('b');
  const sub = await f.subscribe();
  const originalSend = sub.sent.push.bind(sub.sent);
  sub.sent.push = envelope => { if (envelope.kind === 'snapshot' && envelope.barrier.state === 'committed') order.push(`final-snapshot@${envelope.version}`); return originalSend(envelope); };

  for (let i = 0; i < 500; i++) await notify({ method: 'item/agentMessage/delta', params: { delta: `w${i} ` } });
  await runner.flush();
  assert.equal(events.filter(event => event.type === 'message-observed').length, 500, 'provider consumption and history stay complete');
  assert.equal(sub.sent.length, 0, 'no IPC before the burst window elapses');
  f.tick(DELIVERY_LIMITS.burstMs);
  assert.ok(sub.sent.length <= 2, `burst sends: ${sub.kinds().join(',')}`);

  await notify({ method: 'turn/completed', params: { turn: { status: 'completed' } } });
  await runner.flush();
  const final = sub.sent.find(envelope => envelope.kind === 'snapshot' && envelope.barrier.state === 'committed');
  assert.ok(final, sub.kinds().join(','));
  assert.match(final.output.text, /^w0 w1 .* w499$/);
  assert.equal(order[0].split('@')[0], 'final-snapshot');
  assert.ok(order.some(entry => entry.startsWith('completion-notification')));
  assert.ok(sub.sent.length < 20, `total sends ${sub.sent.length} for 500 provider events`);

  assert.equal((await runner.close('b')).ok, true);
  const diagnostics = f.delivery.diagnostics();
  assert.equal(diagnostics.timers, 0);
  assert.equal(diagnostics.bindings[0].barrier, 'committed');
  assert.deepEqual(diagnostics.bindings[0].attention, ['completed']);
  await runner.dispose();
});
