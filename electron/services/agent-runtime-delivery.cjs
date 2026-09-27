// Main-process delivery projection between normalized runtime events and renderer IPC.
// The runner keeps consuming the provider stream in full; this layer only decides which
// bounded replacements cross IPC. It never waits on a renderer before accepting input,
// never persists text, and never infers task, contribution or Goal outcomes.
const { randomUUID } = require('node:crypto');

const DELIVERY_LIMITS = Object.freeze({
  textCodePoints: 20_000,
  textBytes: 80 * 1024,
  burstMs: 100,
  burstBytes: 8 * 1024,
  envelopeBytes: 128 * 1024,
  activityEntries: 20,
  activityIdentities: 512,
  cacheEntries: 100,
  sealedTurns: 8,
  ackTimeoutMs: 2_000,
  terminalTextRetentionMs: 15 * 60 * 1000,
  subscriptionsPerOwner: 16,
  summaryCodePoints: 160,
});
const ACTIVE_TURN_STATES = new Set(['queued', 'starting', 'active', 'waiting-input', 'cancelling']);
const TERMINAL_TURN_STATES = new Set(['completed', 'failed', 'interrupted']);
const CANCEL_REASONS = new Set(['interrupted', 'cancelled', 'closed']);
const TERMINAL_ATTENTION = ['completed', 'failure', 'cancelled', 'recovery'];
const RESPONSE_BOUNDARIES = new Set(['item/started', 'item/completed']);
const BINDING_ID = /^[A-Za-z0-9._:-]{1,200}$/;
const ERROR_CODE = /^[A-Za-z0-9._-]{1,80}$/;
const SUMMARIES = {
  permission: 'Agent needs permission',
  input: 'Agent needs input',
  blocked: 'Agent history needs reconciliation before new work can start',
  failure: 'Agent work needs attention',
  cancelled: 'Agent run stopped',
  completed: 'Agent run finished',
  recovery: 'Agent connection was interrupted',
};

const byteLength = text => Buffer.byteLength(text, 'utf8');
const safeCode = value => typeof value === 'string' && ERROR_CODE.test(value) ? value : undefined;
const safeLabel = value => typeof value === 'string'
  ? Array.from(value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()).slice(0, DELIVERY_LIMITS.summaryCodePoints).join('')
  : '';

// Keep the newest text within both the code point and UTF-8 byte budgets.
function boundNewest(text) {
  // UTF-16 length bounds code points, and BMP text is at most 3 bytes per unit.
  if (text.length <= DELIVERY_LIMITS.textCodePoints && text.length * 3 <= DELIVERY_LIMITS.textBytes) return { text, truncated: false };
  let points = Array.from(text.length > DELIVERY_LIMITS.textCodePoints * 2 ? text.slice(-DELIVERY_LIMITS.textCodePoints * 2) : text);
  let truncated = points.length > DELIVERY_LIMITS.textCodePoints || text.length > DELIVERY_LIMITS.textCodePoints * 2;
  if (points.length > DELIVERY_LIMITS.textCodePoints) points = points.slice(-DELIVERY_LIMITS.textCodePoints);
  let bounded = points.join('');
  while (byteLength(bounded) > DELIVERY_LIMITS.textBytes) {
    points = points.slice(Math.ceil(points.length / 16));
    bounded = points.join('');
    truncated = true;
  }
  if (/^[\uDC00-\uDFFF]/.test(bounded)) bounded = bounded.slice(1);
  return { text: bounded, truncated };
}

// Mirrors the renderer's delta joining: raw concatenation once any whitespace boundary
// is observed, otherwise word-joined messages (providers that send whole messages).
function spacedJoin(text) {
  return text.replace(/\s+([,.;:!?])/g, '$1').replace(/([([{])\s+/g, '$1').replace(/\s+([)\]}])/g, '$1');
}

function createAgentRuntimeDelivery({
  listRequests = () => [],
  loadBinding = async () => null,
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  createId = randomUUID,
  logger = null,
} = {}) {
  const epoch = createId();
  const entries = new Map();
  const subscriptions = new Map();
  const owners = new Map();
  let disposed = false;
  const counters = {
    ingestedEvents: 0, ingestedOutputEvents: 0, ingestedOutputBytes: 0, staleBindings: 0,
    coalescedOutputs: 0, droppedHiddenOutputs: 0, droppedSuspendedOutputs: 0, lateOutputs: 0, staleOutputs: 0,
    outputSends: 0, outputBytes: 0, stateSends: 0, stateBytes: 0, snapshotSends: 0, snapshotBytes: 0,
    snapshotRequests: 0, acknowledgements: 0, ackTimeouts: 0, oversizeRejected: 0, sendFailures: 0,
    evictions: 0, protectedOverflow: 0, barriersCommitted: 0, barriersFailed: 0, cleanups: 0,
  };
  const highWater = { pendingOutputBytes: 0, pendingProjections: 0, entries: 0 };
  const latency = { lastFlushMs: null, maxFlushMs: 0, lastBarrierMs: null, maxBarrierMs: 0 };
  const log = (level, event, details = {}) => logger?.[level]?.(`[agent-runtime:delivery] ${event}`, details);
  const unavailable = () => ({ ok: false, error: 'DELIVERY_DISPOSED' });

  function createEntry(bindingId) {
    const entry = {
      bindingId, version: 0, revision: -1, binding: null, turnId: null, outputTurnId: null,
      text: '', raw: '', spaced: '', lastDelta: '', sawBoundary: false, truncated: false, availability: 'unavailable',
      outputVersion: 0, pending: [], pendingBytes: 0, pendingSince: null, lastOutputAt: null,
      activity: emptyActivity(), activityIds: new Set(), activityDirty: false,
      attention: new Map(), barrier: { state: 'none', turnId: null, finalOutputVersion: null },
      sealed: [], burstTimer: null, retentionTimer: null, lastControlKey: '',
    };
    entries.set(bindingId, entry);
    highWater.entries = Math.max(highWater.entries, entries.size);
    evictIfNeeded(entry);
    return entry;
  }
  const emptyActivity = () => ({ tools: { count: 0, exact: true }, files: null, checks: null, lastActivityAt: null, entries: [] });
  const isProtected = entry => ACTIVE_TURN_STATES.has(entry.binding?.turn?.state) || entry.barrier.state === 'failed' || entry.attention.has('permission') || entry.attention.has('input');
  const subscribersOf = entry => [...subscriptions.values()].filter(sub => sub.bindingId === entry.bindingId);

  function evictIfNeeded(fresh) {
    while (entries.size > DELIVERY_LIMITS.cacheEntries) {
      const victim = [...entries.values()].find(entry => entry !== fresh && !isProtected(entry) && !subscribersOf(entry).length);
      if (!victim) { counters.protectedOverflow++; return; }
      releaseEntry(victim);
      entries.delete(victim.bindingId);
      counters.evictions++;
    }
  }
  function releaseEntry(entry) {
    if (entry.burstTimer !== null) clearTimer(entry.burstTimer);
    if (entry.retentionTimer !== null) clearTimer(entry.retentionTimer);
    entry.burstTimer = entry.retentionTimer = null;
    entry.pending = [];
    entry.pendingBytes = 0;
    entry.pendingSince = null;
  }

  // Materialize pending deltas into the bounded latest response. Returns true on change.
  function reduceOutput(entry) {
    if (!entry.pending.length) return false;
    for (const delta of entry.pending) {
      if (delta === null) { entry.raw = entry.spaced = entry.lastDelta = ''; entry.sawBoundary = false; entry.truncated = false; continue; }
      if (!entry.sawBoundary && entry.lastDelta && (/\s$/.test(entry.lastDelta) || /^\s/.test(delta))) { entry.sawBoundary = true; entry.spaced = ''; }
      entry.raw += delta;
      if (!entry.sawBoundary) entry.spaced = entry.spaced ? `${entry.spaced} ${delta}` : delta;
      entry.lastDelta = delta;
    }
    const raw = boundNewest(entry.raw);
    entry.raw = raw.text;
    let truncated = raw.truncated;
    if (!entry.sawBoundary) { const spaced = boundNewest(entry.spaced); entry.spaced = spaced.text; truncated ||= spaced.truncated; }
    entry.truncated ||= truncated;
    if (entry.pendingSince !== null) {
      const flushMs = now() - entry.pendingSince;
      latency.lastFlushMs = flushMs;
      latency.maxFlushMs = Math.max(latency.maxFlushMs, flushMs);
    }
    entry.pending = [];
    entry.pendingBytes = 0;
    entry.pendingSince = null;
    const text = (entry.sawBoundary ? entry.raw : spacedJoin(entry.spaced)).trim();
    if (text === entry.text && entry.availability === 'live') return false;
    entry.text = text;
    entry.availability = 'live';
    entry.version++;
    entry.outputVersion = entry.version;
    return true;
  }
  function clearOutput(entry, availability) {
    entry.pending = [];
    entry.pendingBytes = 0;
    entry.pendingSince = null;
    entry.text = entry.raw = entry.spaced = entry.lastDelta = '';
    entry.sawBoundary = entry.truncated = false;
    entry.availability = availability;
  }

  const header = (entry, kind) => ({ schemaVersion: 1, kind, epoch, bindingId: entry.bindingId, turnId: entry.turnId, version: entry.version, observedAt: new Date(now()).toISOString() });
  function control(entry) {
    const binding = entry.binding || {};
    return {
      connectionState: binding.state || null,
      turnState: binding.turn?.state || null,
      taskExecutionState: binding.taskExecution?.state || null,
      scope: binding.scope ? { ...binding.scope } : null,
      capabilities: Array.isArray(binding.capabilities) ? binding.capabilities : [],
      attention: [...entry.attention.values()].map(record => ({ ...record })),
      activity: { ...entry.activity, entries: entry.activity.entries.map(item => ({ ...item })) },
      outputVersion: entry.outputVersion,
      barrier: { ...entry.barrier },
    };
  }
  const output = entry => ({ outputVersion: entry.outputVersion, text: entry.text, truncated: entry.truncated, availability: entry.availability });
  const stateEnvelope = entry => ({ ...header(entry, 'state'), ...control(entry) });
  const outputEnvelope = entry => ({ ...header(entry, 'output'), ...output(entry) });
  const snapshotEnvelope = (entry, sub) => ({ ...header(entry, 'snapshot'), subscriptionId: sub.id, ...control(entry), output: output(entry) });

  // Enforce the serialized envelope budget: optional detail first, then text, then reject.
  function fit(envelope) {
    let serialized = JSON.stringify(envelope);
    if (byteLength(serialized) <= DELIVERY_LIMITS.envelopeBytes) return { envelope, bytes: byteLength(serialized) };
    const next = { ...envelope, ...(envelope.activity ? { activity: { ...envelope.activity, entries: [] } } : {}) };
    const target = envelope.kind === 'output' ? next : envelope.kind === 'snapshot' ? (next.output = { ...next.output }) : null;
    serialized = JSON.stringify(next);
    while (target && byteLength(serialized) > DELIVERY_LIMITS.envelopeBytes && target.text) {
      target.text = target.text.slice(Math.ceil(target.text.length / 8)).replace(/^[\uDC00-\uDFFF]/, '');
      target.truncated = true;
      serialized = JSON.stringify(next);
    }
    if (byteLength(serialized) > DELIVERY_LIMITS.envelopeBytes) { counters.oversizeRejected++; return null; }
    return { envelope: next, bytes: byteLength(serialized) };
  }
  function transmit(sub, envelope) {
    const fitted = fit(envelope);
    if (!fitted) return false;
    try {
      if (sub.send(fitted.envelope) === false) { counters.sendFailures++; return false; }
    } catch { counters.sendFailures++; return false; }
    const key = { output: 'output', state: 'state', snapshot: 'snapshot' }[envelope.kind];
    counters[`${key}Sends`]++;
    counters[`${key}Bytes`] += fitted.bytes;
    return true;
  }
  const streaming = sub => sub.visible && sub.isWindowVisible() !== false;

  function sendOutput(sub, entry) {
    if (!streaming(sub)) { counters.droppedHiddenOutputs++; sub.pending = false; return; }
    if (sub.suspended) { counters.droppedSuspendedOutputs++; return; }
    if (sub.inFlight) {
      if (now() - sub.inFlight.sentAt >= DELIVERY_LIMITS.ackTimeoutMs) {
        // A stalled renderer is resynchronized by one snapshot, never by a growing queue.
        sub.suspended = true;
        sub.pending = false;
        counters.ackTimeouts++;
        log('warn', 'ack-timeout', { bindingId: entry.bindingId, subscriptionId: sub.id, version: sub.inFlight.version });
        return;
      }
      if (sub.pending) counters.coalescedOutputs++;
      sub.pending = true;
      highWater.pendingProjections = Math.max(highWater.pendingProjections, [...subscriptions.values()].filter(candidate => candidate.pending).length);
      return;
    }
    sub.pending = false;
    if (transmit(sub, outputEnvelope(entry))) sub.inFlight = { version: entry.version, sentAt: now() };
  }
  function sendSnapshot(sub, entry) {
    sub.pending = false;
    sub.suspended = false;
    if (transmit(sub, snapshotEnvelope(entry, sub))) sub.inFlight = streaming(sub) ? { version: entry.version, sentAt: now() } : null;
  }

  // Publish one reduction. Control changes reach every subscriber immediately; output and
  // activity-only changes stream to visible subscribers only.
  function publish(entry, { controlChanged = false, outputChanged = false, final = false } = {}) {
    const subs = subscribersOf(entry);
    for (const sub of subs) {
      if (final && streaming(sub)) { sendSnapshot(sub, entry); continue; }
      if (controlChanged || (entry.activityDirty && streaming(sub))) transmit(sub, stateEnvelope(entry));
      if (outputChanged) sendOutput(sub, entry);
    }
    entry.activityDirty = false;
  }

  function flushBurst(entry) {
    if (entry.burstTimer !== null) { clearTimer(entry.burstTimer); entry.burstTimer = null; }
    const outputChanged = reduceOutput(entry);
    if (entry.activityDirty && !outputChanged) entry.version++;
    if (outputChanged || entry.activityDirty) publish(entry, { outputChanged });
  }
  function scheduleBurst(entry) {
    if (entry.burstTimer !== null || !subscribersOf(entry).some(streaming)) return;
    entry.burstTimer = setTimer(() => { entry.burstTimer = null; if (!disposed) flushBurst(entry); }, DELIVERY_LIMITS.burstMs);
  }

  function setAttention(entry, category, details = {}) {
    const previous = entry.attention.get(category);
    const id = details.id || `${entry.bindingId}:${entry.turnId || 'session'}:${category}${details.errorCode ? `:${details.errorCode}` : ''}`;
    if (previous?.id === id && previous.pendingCount === details.pendingCount) return false;
    entry.attention.set(category, {
      id,
      category,
      summary: SUMMARIES[category],
      createdVersion: previous?.id === id ? previous.createdVersion : entry.version + 1,
      ...(details.errorCode ? { errorCode: details.errorCode } : {}),
      ...(details.request ? { request: details.request, pendingCount: details.pendingCount } : {}),
    });
    return true;
  }
  const dropAttention = (entry, categories) => categories.reduce((changed, category) => entry.attention.delete(category) || changed, false);

  function deriveAttention(entry, binding, requestId) {
    let changed = false;
    const turnState = binding.turn?.state;
    if (turnState === 'waiting-input') {
      let requests = [];
      try { requests = (listRequests(entry.bindingId) || []).filter(request => !request.turnId || request.turnId === binding.turn.id); } catch { requests = []; }
      const first = requests[0];
      const reference = first?.requestId ?? requestId ?? binding.turn.requestId;
      if (reference !== undefined && reference !== null) {
        const category = first?.responseKind === 'elicitation' ? 'input' : 'permission';
        changed = dropAttention(entry, [category === 'input' ? 'permission' : 'input']) || changed;
        changed = setAttention(entry, category, {
          id: `${entry.bindingId}:${binding.turn.id}:${category}:${typeof reference}:${String(reference)}`,
          request: { bindingId: entry.bindingId, turnId: binding.turn.id, requestId: reference },
          pendingCount: Math.max(1, requests.length),
        }) || changed;
      }
    } else changed = dropAttention(entry, ['permission', 'input']) || changed;

    if (TERMINAL_TURN_STATES.has(turnState) && binding.turn.id === entry.turnId) {
      const reason = binding.turn.terminalReason;
      const category = turnState === 'completed' ? 'completed' : turnState === 'failed' ? 'failure' : CANCEL_REASONS.has(reason) || !reason ? 'cancelled' : 'recovery';
      changed = dropAttention(entry, TERMINAL_ATTENTION.filter(candidate => candidate !== category)) || changed;
      changed = setAttention(entry, category, { errorCode: category === 'completed' ? undefined : safeCode(reason) }) || changed;
    } else if (binding.state === 'failed') {
      changed = setAttention(entry, 'failure', { errorCode: safeCode(binding.terminalReason) }) || changed;
    }
    return changed;
  }

  function startTurn(entry, turnId) {
    if (entry.turnId && !entry.sealed.includes(entry.turnId)) entry.sealed = [...entry.sealed, entry.turnId].slice(-DELIVERY_LIMITS.sealedTurns);
    entry.turnId = turnId;
    clearOutput(entry, 'live');
    entry.activity = emptyActivity();
    entry.activityIds.clear();
    entry.barrier = { state: 'none', turnId, finalOutputVersion: null };
    dropAttention(entry, [...TERMINAL_ATTENTION, 'permission', 'input']);
    if (entry.retentionTimer !== null) { clearTimer(entry.retentionTimer); entry.retentionTimer = null; }
    entry.version++;
    entry.outputVersion = entry.version;
  }

  // Completion barrier: the runner emits a terminal binding only after the storage owner
  // committed the terminal turn. Seal and materialize the final output, publish one final
  // snapshot (control-only for hidden subscribers), and only then return to the caller so
  // completion notifications are scheduled after the projection.
  function commitBarrier(entry) {
    if (entry.barrier.state === 'committed' && entry.barrier.turnId === entry.turnId) return false;
    reduceOutput(entry);
    if (!entry.sealed.includes(entry.turnId)) entry.sealed = [...entry.sealed, entry.turnId].slice(-DELIVERY_LIMITS.sealedTurns);
    entry.barrier = { state: 'committed', turnId: entry.turnId, finalOutputVersion: entry.text ? entry.outputVersion : null };
    counters.barriersCommitted++;
    if (entry.lastOutputAt !== null) {
      const barrierMs = now() - entry.lastOutputAt;
      latency.lastBarrierMs = barrierMs;
      latency.maxBarrierMs = Math.max(latency.maxBarrierMs, barrierMs);
    }
    if (entry.burstTimer !== null) { clearTimer(entry.burstTimer); entry.burstTimer = null; }
    if (entry.retentionTimer !== null) clearTimer(entry.retentionTimer);
    entry.retentionTimer = setTimer(() => {
      entry.retentionTimer = null;
      if (disposed || !entry.text) return;
      clearOutput(entry, 'summary-only');
      entry.version++;
      entry.outputVersion = entry.version;
      publish(entry, { controlChanged: true, outputChanged: true });
    }, DELIVERY_LIMITS.terminalTextRetentionMs);
    return true;
  }

  function applyBinding(entry, binding, requestId) {
    if (typeof binding.revision === 'number') {
      if (binding.revision < entry.revision) { counters.staleBindings++; return null; }
      entry.revision = binding.revision;
    }
    let turnChanged = false;
    if (binding.turn?.id && binding.turn.id !== entry.turnId) {
      if (entry.sealed.includes(binding.turn.id)) { counters.staleBindings++; return null; }
      startTurn(entry, binding.turn.id);
      turnChanged = true;
    }
    entry.binding = binding;
    let final = false;
    if (TERMINAL_TURN_STATES.has(binding.turn?.state) && binding.turn.id === entry.turnId) final = commitBarrier(entry);
    const attentionChanged = deriveAttention(entry, binding, requestId);
    const key = JSON.stringify([binding.state, binding.turn?.state, binding.taskExecution?.state, binding.capabilities || null, entry.barrier.state]);
    const controlChanged = turnChanged || final || attentionChanged || key !== entry.lastControlKey;
    entry.lastControlKey = key;
    if (binding.state === 'closed') return { controlChanged, final, closed: true };
    return { controlChanged, final };
  }

  function applyEvent(entry, event) {
    counters.ingestedEvents++;
    const turnId = event.turnId || entry.turnId;
    if (event.type === 'message-observed' && typeof event.messagePreview === 'string') {
      counters.ingestedOutputEvents++;
      if (entry.sealed.includes(turnId)) { counters.lateOutputs++; return {}; }
      if (turnId !== entry.turnId) { counters.staleOutputs++; return {}; }
      if (!event.messagePreview) return {};
      const bytes = byteLength(event.messagePreview);
      counters.ingestedOutputBytes += bytes;
      entry.pending.push(event.messagePreview);
      entry.pendingBytes += bytes;
      entry.pendingSince ??= now();
      entry.lastOutputAt = now();
      highWater.pendingOutputBytes = Math.max(highWater.pendingOutputBytes, entry.pendingBytes);
      return { output: true };
    }
    if (RESPONSE_BOUNDARIES.has(event.nativeEventType) && turnId === entry.turnId && !entry.sealed.includes(turnId)) {
      entry.pending.push(null);
      entry.pendingSince ??= now();
      return { output: true };
    }
    if (['tool-state', 'plan-update'].includes(event.type) && turnId === entry.turnId && !entry.sealed.includes(turnId)) {
      const activity = entry.activity;
      const identity = event.requestId === undefined || event.requestId === null ? null : `${typeof event.requestId}:${String(event.requestId)}`;
      if (event.type === 'tool-state') {
        if (identity === null) activity.tools.exact = false;
        if (identity === null || !entry.activityIds.has(identity)) {
          activity.tools.count++;
          if (identity !== null) {
            entry.activityIds.add(identity);
            if (entry.activityIds.size > DELIVERY_LIMITS.activityIdentities) entry.activityIds.delete(entry.activityIds.values().next().value);
          }
        } else counters.coalescedOutputs++;
      }
      activity.lastActivityAt = new Date(now()).toISOString();
      const label = event.type === 'plan-update' ? 'Plan updated' : safeLabel(event.toolName ? `Tool: ${event.toolName}` : 'Tool activity');
      const last = activity.entries[activity.entries.length - 1];
      if (last?.label === label) { last.count++; last.at = activity.lastActivityAt; }
      else activity.entries = [...activity.entries, { id: `${entry.version}:${activity.entries.length}`, label, count: 1, at: activity.lastActivityAt }].slice(-DELIVERY_LIMITS.activityEntries);
      entry.activityDirty = true;
      return { activity: true };
    }
    return {};
  }

  // Accept one runner emission. Returns the delivery version so the notification
  // scheduler can require it; `ordinaryOutput` lets callers drop legacy per-token IPC.
  function accept(payload) {
    if (disposed || !payload || typeof payload !== 'object') return { accepted: false };
    const bindingId = payload.binding?.id || payload.event?.bindingId || payload.bindingId;
    if (typeof bindingId !== 'string' || !BINDING_ID.test(bindingId)) return { accepted: false };
    const entry = entries.get(bindingId) || createEntry(bindingId);
    let result = { controlChanged: false, final: false };
    let stale = false;

    if (payload.kind === 'storage-failure') {
      const errorCode = safeCode(payload.error) || 'AGENT_WORK_STORAGE_FAILED';
      if (ACTIVE_TURN_STATES.has(entry.binding?.turn?.state)) {
        entry.barrier = { state: 'failed', turnId: entry.turnId, finalOutputVersion: null, errorCode };
        counters.barriersFailed++;
        setAttention(entry, 'failure', { errorCode });
      }
      setAttention(entry, 'blocked', { errorCode });
      result.controlChanged = true;
    } else if (payload.kind === 'storage-recovered') {
      result.controlChanged = dropAttention(entry, ['blocked']);
    } else if (payload.binding) {
      const applied = applyBinding(entry, payload.binding, payload.requestId);
      if (applied) result = applied;
      else stale = true;
    }

    let eventResult = {};
    if (payload.kind === 'event' && payload.event) eventResult = applyEvent(entry, payload.event);

    if (result.final) {
      entry.version++;
      publish(entry, { controlChanged: true, final: true });
    } else if (result.controlChanged) {
      // Attention transitions carry the newest output with them; never behind a timer.
      const outputChanged = reduceOutput(entry);
      if (!outputChanged) entry.version++;
      if (entry.burstTimer !== null) { clearTimer(entry.burstTimer); entry.burstTimer = null; }
      publish(entry, { controlChanged: true, outputChanged });
    } else if (eventResult.output || eventResult.activity) {
      if (entry.pendingBytes >= DELIVERY_LIMITS.burstBytes) flushBurst(entry);
      else if (subscribersOf(entry).some(streaming)) scheduleBurst(entry);
    }
    if (result.closed) closeEntry(entry);
    return { accepted: true, stale, version: entry.version, ordinaryOutput: payload.kind === 'event' && payload.event?.type === 'message-observed' };
  }

  // Explicit end session: the closed state was already projected; release transient text,
  // timers and per-subscriber queues while keeping barrier, attention and activity.
  function closeEntry(entry) {
    releaseEntry(entry);
    for (const sub of subscribersOf(entry)) { sub.pending = false; sub.inFlight = null; }
    if (entry.text || entry.availability === 'live') {
      clearOutput(entry, 'summary-only');
      entry.version++;
      entry.outputVersion = entry.version;
      for (const sub of subscribersOf(entry)) if (streaming(sub)) transmit(sub, outputEnvelope(entry));
    }
    counters.cleanups++;
  }

  function ownerState(ownerId) {
    if (!owners.has(ownerId)) owners.set(ownerId, { lastRequestId: -1, subscriptions: new Set() });
    return owners.get(ownerId);
  }
  function acceptRequestId(owner, requestId) {
    if (!Number.isSafeInteger(requestId) || requestId < 0 || requestId <= owner.lastRequestId) return false;
    owner.lastRequestId = requestId;
    return true;
  }
  function ownedSubscription(ownerId, subscriptionId) {
    const sub = typeof subscriptionId === 'string' ? subscriptions.get(subscriptionId) : null;
    return sub && sub.ownerId === ownerId ? sub : null;
  }

  async function subscribe({ ownerId, send, isWindowVisible = () => true, bindingId, visible, requestId }) {
    if (disposed) return unavailable();
    if (typeof bindingId !== 'string' || !BINDING_ID.test(bindingId) || typeof visible !== 'boolean' || typeof send !== 'function') return { ok: false, error: 'INVALID_DELIVERY_SUBSCRIPTION' };
    const owner = ownerState(ownerId);
    if (!acceptRequestId(owner, requestId)) return { ok: false, error: 'STALE_DELIVERY_REQUEST' };
    if (owner.subscriptions.size >= DELIVERY_LIMITS.subscriptionsPerOwner) return { ok: false, error: 'DELIVERY_SUBSCRIPTION_LIMIT' };
    let entry = entries.get(bindingId);
    if (!entry) {
      const binding = await loadBinding(bindingId);
      if (disposed) return unavailable();
      if (!binding) return { ok: false, error: 'ACP_SESSION_NOT_FOUND' };
      entry = entries.get(bindingId);
      if (!entry) {
        // Restart / unseen binding: expose control state only; transcripts are never recovered.
        entry = createEntry(bindingId);
        applyBinding(entry, binding);
        entry.availability = TERMINAL_TURN_STATES.has(binding.turn?.state) || binding.state === 'closed' ? 'summary-only' : 'unavailable';
        entry.version++;
      }
    }
    const sub = { id: createId(), ownerId, bindingId, send, isWindowVisible, visible, pending: false, inFlight: null, suspended: false };
    subscriptions.set(sub.id, sub);
    owner.subscriptions.add(sub.id);
    reduceOutput(entry);
    counters.snapshotRequests++;
    return { ok: true, subscriptionId: sub.id, snapshot: fit(snapshotEnvelope(entry, sub))?.envelope || null };
  }

  function setVisibility({ ownerId, subscriptionId, visible, requestId }) {
    if (disposed) return unavailable();
    const sub = ownedSubscription(ownerId, subscriptionId);
    if (!sub || typeof visible !== 'boolean') return { ok: false, error: 'INVALID_DELIVERY_SUBSCRIPTION' };
    if (!acceptRequestId(ownerState(ownerId), requestId)) return { ok: false, error: 'STALE_DELIVERY_REQUEST' };
    sub.visible = visible;
    sub.pending = false;
    sub.inFlight = null;
    if (!visible) return { ok: true };
    return snapshot({ ownerId, subscriptionId, requestId: undefined, skipRequestCheck: true });
  }

  function snapshot({ ownerId, subscriptionId, requestId, skipRequestCheck = false }) {
    if (disposed) return unavailable();
    const sub = ownedSubscription(ownerId, subscriptionId);
    if (!sub) return { ok: false, error: 'INVALID_DELIVERY_SUBSCRIPTION' };
    if (!skipRequestCheck && !acceptRequestId(ownerState(ownerId), requestId)) return { ok: false, error: 'STALE_DELIVERY_REQUEST' };
    const entry = entries.get(sub.bindingId);
    if (!entry) return { ok: false, error: 'ACP_SESSION_NOT_FOUND' };
    reduceOutput(entry);
    sub.pending = false;
    sub.suspended = false;
    sub.inFlight = null;
    counters.snapshotRequests++;
    return { ok: true, snapshot: fit(snapshotEnvelope(entry, sub))?.envelope || null };
  }

  function acknowledge({ ownerId, subscriptionId, version }) {
    if (disposed) return unavailable();
    const sub = ownedSubscription(ownerId, subscriptionId);
    if (!sub || !Number.isSafeInteger(version) || version < 0) return { ok: false, error: 'INVALID_DELIVERY_ACK' };
    counters.acknowledgements++;
    if (sub.inFlight && version >= sub.inFlight.version) {
      sub.inFlight = null;
      const entry = entries.get(sub.bindingId);
      if (sub.pending && entry) sendOutput(sub, entry);
    }
    return { ok: true };
  }

  function unsubscribe({ ownerId, subscriptionId }) {
    const sub = ownedSubscription(ownerId, subscriptionId);
    if (!sub) return { ok: false, error: 'INVALID_DELIVERY_SUBSCRIPTION' };
    subscriptions.delete(sub.id);
    owners.get(ownerId)?.subscriptions.delete(sub.id);
    const entry = entries.get(sub.bindingId);
    if (entry && entry.burstTimer !== null && !subscribersOf(entry).some(streaming)) { clearTimer(entry.burstTimer); entry.burstTimer = null; }
    return { ok: true };
  }

  // Renderer destruction removes every sender-owned subscription and timer.
  function releaseOwner(ownerId) {
    const owner = owners.get(ownerId);
    if (!owner) return;
    for (const subscriptionId of [...owner.subscriptions]) unsubscribe({ ownerId, subscriptionId });
    owners.delete(ownerId);
  }

  // Main observes window minimize/hide independently of renderer visibility reports.
  function windowVisibilityChanged(ownerId, visible) {
    const owner = owners.get(ownerId);
    if (!owner || disposed) return;
    for (const subscriptionId of owner.subscriptions) {
      const sub = subscriptions.get(subscriptionId);
      if (!sub) continue;
      sub.pending = false;
      sub.inFlight = null;
      const entry = entries.get(sub.bindingId);
      if (visible && sub.visible && entry) { reduceOutput(entry); sendSnapshot(sub, entry); }
      else if (entry && entry.burstTimer !== null && !subscribersOf(entry).some(streaming)) { clearTimer(entry.burstTimer); entry.burstTimer = null; }
    }
  }

  function diagnostics() {
    const list = [...entries.values()];
    return {
      epoch,
      entries: list.length,
      protectedEntries: list.filter(isProtected).length,
      subscriptions: subscriptions.size,
      inFlightProjections: [...subscriptions.values()].filter(sub => sub.inFlight).length,
      pendingProjections: [...subscriptions.values()].filter(sub => sub.pending).length,
      suspendedSubscriptions: [...subscriptions.values()].filter(sub => sub.suspended).length,
      timers: list.reduce((count, entry) => count + Number(entry.burstTimer !== null) + Number(entry.retentionTimer !== null), 0),
      counters: { ...counters },
      highWater: { ...highWater },
      latency: { ...latency },
      bindings: list.map(entry => ({
        bindingId: entry.bindingId, turnId: entry.turnId, version: entry.version, outputVersion: entry.outputVersion,
        pendingOutputBytes: entry.pendingBytes, textCodePointsApprox: entry.text.length, barrier: entry.barrier.state,
        attention: [...entry.attention.keys()], subscribers: subscribersOf(entry).length, protected: isProtected(entry),
      })),
    };
  }

  function dispose() {
    disposed = true;
    for (const entry of entries.values()) releaseEntry(entry);
    entries.clear();
    subscriptions.clear();
    owners.clear();
  }

  return { accept, subscribe, setVisibility, snapshot, acknowledge, unsubscribe, releaseOwner, windowVisibilityChanged, diagnostics, dispose, epoch };
}

module.exports = { createAgentRuntimeDelivery, DELIVERY_LIMITS };
