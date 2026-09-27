import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDeliveryEnvelope, emptyDeliveryCursor, primaryDeliveryAttention, setDeliveryOutputSuppressed, type DeliveryEnvelope } from './agentRuntimeDelivery.ts';

const control = (overrides: Record<string, unknown> = {}) => ({
  connectionState: 'active', turnState: 'active', taskExecutionState: 'working', scope: { kind: 'task', taskId: 't' }, capabilities: [],
  attention: [], activity: { tools: { count: 0, exact: true }, files: null, checks: null, lastActivityAt: null, entries: [] },
  outputVersion: 0, barrier: { state: 'none', turnId: 'turn-1', finalOutputVersion: null }, ...overrides,
});
const header = (kind: string, version: number, overrides: Record<string, unknown> = {}) => ({ schemaVersion: 1, kind, epoch: 'e1', bindingId: 'b', turnId: 'turn-1', version, observedAt: '2026-09-25T00:00:00.000Z', ...overrides });
const snapshot = (version: number, text: string, overrides: Record<string, unknown> = {}) => ({
  ...header('snapshot', version), subscriptionId: 's1', ...control({ outputVersion: version }),
  output: { outputVersion: version, text, truncated: false, availability: 'live' }, ...overrides,
}) as DeliveryEnvelope;
const state = (version: number, overrides: Record<string, unknown> = {}) => ({ ...header('state', version, overrides), ...control(overrides) }) as DeliveryEnvelope;
const output = (version: number, text: string, overrides: Record<string, unknown> = {}) => ({ ...header('output', version, overrides), outputVersion: version, text, truncated: false, availability: 'live' }) as DeliveryEnvelope;

test('state before same-version output keeps both lanes and stale envelopes are ignored', () => {
  let cursor = applyDeliveryEnvelope(emptyDeliveryCursor('b', 's1'), snapshot(10, 'a')).cursor;
  cursor = applyDeliveryEnvelope(cursor, state(12, { outputVersion: 12 })).cursor;
  const installed = applyDeliveryEnvelope(cursor, output(12, 'ab'));
  assert.equal(installed.cursor.output?.text, 'ab');
  assert.equal(installed.acknowledge, 12);
  cursor = installed.cursor;
  assert.equal(applyDeliveryEnvelope(cursor, output(11, 'old')).cursor, cursor);
  assert.equal(applyDeliveryEnvelope(cursor, output(12, 'ab')).cursor, cursor, 'duplicates never append');
  assert.equal(applyDeliveryEnvelope(cursor, state(11)).cursor, cursor);
  assert.equal(applyDeliveryEnvelope(cursor, snapshot(9, 'regressed')).cursor, cursor);
});

test('reopen races, other subscriptions, new epochs and unknown schemas never regress state', () => {
  const empty = emptyDeliveryCursor('b', 's1');
  assert.equal(applyDeliveryEnvelope(empty, output(3, 'before snapshot')).cursor, empty, 'no cursor before the snapshot');
  assert.equal(applyDeliveryEnvelope(empty, snapshot(3, 'x', { subscriptionId: 'other' })).cursor, empty);
  let cursor = applyDeliveryEnvelope(empty, snapshot(20, 'current')).cursor;
  const epoch = applyDeliveryEnvelope(cursor, state(1, { epoch: 'e2' }));
  assert.equal(epoch.needsSnapshot, true);
  assert.equal(epoch.cursor.output, null);
  assert.equal(applyDeliveryEnvelope(epoch.cursor, snapshot(1, 'fresh', { epoch: 'e2' })).cursor.output?.text, 'fresh');
  assert.equal(applyDeliveryEnvelope(cursor, { ...state(30), schemaVersion: 2 } as DeliveryEnvelope).needsSnapshot, true);
  assert.equal(applyDeliveryEnvelope(cursor, { ...state(30), bindingId: 'other' } as DeliveryEnvelope).cursor, cursor);
  cursor = applyDeliveryEnvelope(cursor, state(31, { turnId: 'turn-2', outputVersion: 31 })).cursor;
  assert.equal(cursor.output, null, 'old-turn output is not shown under a new turn');
});

test('completion is only presentable with the final output installed', () => {
  let cursor = applyDeliveryEnvelope(emptyDeliveryCursor('b', 's1'), snapshot(1, '')).cursor;
  cursor = applyDeliveryEnvelope(cursor, output(4, 'Final answer.')).cursor;
  cursor = applyDeliveryEnvelope(cursor, snapshot(5, 'Final answer.', { barrier: { state: 'committed', turnId: 'turn-1', finalOutputVersion: 4 }, output: { outputVersion: 4, text: 'Final answer.', truncated: false, availability: 'live' } })).cursor;
  assert.equal(cursor.control?.barrier.state, 'committed');
  assert.ok((cursor.output?.outputVersion ?? -1) >= (cursor.control?.barrier.finalOutputVersion ?? Infinity));
});

test('hidden supervision keeps control state but neither retains nor requests model text', () => {
  let cursor = applyDeliveryEnvelope(emptyDeliveryCursor('b', 's1'), snapshot(10, 'visible text')).cursor;
  cursor = setDeliveryOutputSuppressed(cursor, true);
  assert.equal(cursor.output, null, 'hiding drops retained text immediately');
  assert.equal(setDeliveryOutputSuppressed(cursor, true), cursor, 'repeated hides are stable');

  const permission = { id: 'b:turn-1:permission:string:r1', category: 'permission', summary: 'Agent needs permission', createdVersion: 12, request: { bindingId: 'b', turnId: 'turn-1', requestId: 'r1' }, pendingCount: 1 };
  const hiddenState = applyDeliveryEnvelope(cursor, state(12, { outputVersion: 11, attention: [permission], turnState: 'waiting-input' }));
  assert.equal(hiddenState.cursor.control?.attention[0]?.category, 'permission', 'attention still arrives while hidden');
  assert.equal(hiddenState.needsSnapshot, false, 'missing text is expected while hidden, not a recovery trigger');
  assert.equal(hiddenState.cursor.output, null);
  cursor = hiddenState.cursor;

  const stray = applyDeliveryEnvelope(cursor, output(13, 'late burst'));
  assert.equal(stray.cursor, cursor, 'output racing the hide is discarded');
  assert.equal(stray.acknowledge, 13, 'but acknowledged so main never stalls on it');
  const hiddenSnapshot = applyDeliveryEnvelope(cursor, snapshot(14, 'snapshot text'));
  assert.equal(hiddenSnapshot.cursor.output, null, 'a snapshot while hidden installs control only');
  assert.equal(hiddenSnapshot.cursor.controlVersion, 14);
});

test('reopening installs one current snapshot and then resumes bursts', () => {
  let cursor = setDeliveryOutputSuppressed(applyDeliveryEnvelope(emptyDeliveryCursor('b', 's1'), snapshot(5, 'old')).cursor, true);
  cursor = applyDeliveryEnvelope(cursor, state(9, { outputVersion: 8 })).cursor;
  cursor = setDeliveryOutputSuppressed(cursor, false);
  assert.equal(cursor.output, null, 'showing waits for the snapshot rather than reviving stale text');
  cursor = applyDeliveryEnvelope(cursor, snapshot(9, 'current', { output: { outputVersion: 8, text: 'current', truncated: false, availability: 'live' } })).cursor;
  assert.equal(cursor.output?.text, 'current');
  assert.equal(applyDeliveryEnvelope(cursor, output(7, 'older burst')).cursor, cursor, 'bursts older than the snapshot are stale');
  assert.equal(applyDeliveryEnvelope(cursor, output(10, 'current and more')).cursor.output?.text, 'current and more');
});

test('a new epoch while hidden keeps output suppressed', () => {
  const cursor = setDeliveryOutputSuppressed(applyDeliveryEnvelope(emptyDeliveryCursor('b', 's1'), snapshot(5, 'x')).cursor, true);
  const epoch = applyDeliveryEnvelope(cursor, state(1, { epoch: 'e2' }));
  assert.equal(epoch.needsSnapshot, true);
  assert.equal(epoch.cursor.outputSuppressed, true);
  assert.equal(applyDeliveryEnvelope(epoch.cursor, snapshot(1, 'fresh', { epoch: 'e2' })).cursor.output, null);
});

test('primary attention puts pending requests ahead of failures and completion', () => {
  const record = (category: string) => ({ id: category, category, summary: category, createdVersion: 1 });
  assert.equal(primaryDeliveryAttention(null), undefined);
  assert.equal(primaryDeliveryAttention({ attention: [] }), undefined);
  assert.equal(primaryDeliveryAttention({ attention: [record('completed'), record('failure')] as never })?.category, 'failure');
  assert.equal(primaryDeliveryAttention({ attention: [record('cancelled'), record('input'), record('blocked')] as never })?.category, 'input');
  assert.equal(primaryDeliveryAttention({ attention: [record('input'), record('permission')] as never })?.category, 'permission');
});
