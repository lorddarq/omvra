const test = require('node:test');
const assert = require('node:assert/strict');
const modulePromise = import('./auto-archive.mjs');
const now = Date.parse('2026-09-22T12:00:00.000Z');
const day = 86400000;
const columns = [{ id: 'open', roadmapStage: 'not-started' }, { id: 'shipped', roadmapStage: 'complete' }];
const task = (id, changes = {}) => ({ id, title: id, status: 'shipped', completedAt: new Date(now - 365 * day).toISOString(), ...changes });
const delayed = { mode: 'after-completion', days: 365 };

test('policy defaults off and validates duration and enable date', async () => {
  const { normalizeAutoArchivePolicy } = await modulePromise;
  assert.equal(normalizeAutoArchivePolicy(undefined).mode, 'off');
  for (const days of [0, -1, 1.5, Infinity, '30', 36501]) assert.equal(normalizeAutoArchivePolicy({ days }).days, 365);
  assert.equal(normalizeAutoArchivePolicy({ mode: 'on-completion', enabledAt: 'bad' }).enabledAt, undefined);
});

test('completion transitions record time; unknown historical completion is not invented', async () => {
  const { reconcileAutoArchive } = await modulePromise;
  const old = task('a', { status: 'open', completedAt: undefined });
  const current = [{ ...old, status: 'shipped' }];
  const next = reconcileAutoArchive(current, [old], columns, undefined, now);
  assert.equal(next[0].completedAt, new Date(now).toISOString());
  assert.equal(next[0].archived, undefined);
  assert.equal(next[0].__mcpRevision, 1);
  assert.equal(reconcileAutoArchive(next, next, columns, undefined, now), next);
  const legacy = [task('legacy', { completedAt: undefined })];
  assert.equal(reconcileAutoArchive(legacy, legacy, columns, delayed, now), legacy);
});

test('delay is measured from completion, inclusive at the UTC duration boundary', async () => {
  const { reconcileAutoArchive } = await modulePromise;
  const tasks = [task('due'), task('early', { completedAt: new Date(now - 365 * day + 1).toISOString() }), task('future', { completedAt: new Date(now + day).toISOString() })];
  const next = reconcileAutoArchive(tasks, tasks, columns, delayed, now);
  assert.equal(next[0].archived, true);
  assert.equal(next[0].archivedAt, new Date(now).toISOString());
  assert.equal(next[1].archived, undefined);
  assert.equal(next[2].archived, undefined);
});

test('immediate mode includes historical completion without inventing missing dates', async () => {
  const { reconcileAutoArchive } = await modulePromise;
  const policy = { mode: 'on-completion', enabledAt: new Date(now).toISOString() };
  const historical = task('old');
  const before = task('new', { status: 'open', completedAt: undefined });
  const next = reconcileAutoArchive([historical, { ...before, status: 'shipped' }], [historical, before], columns, policy, now + 1);
  assert.equal(next[0].archived, true);
  assert.equal(next[1].archived, true);
  const legacy = task('legacy', { completedAt: undefined });
  const suppressed = task('restored', { autoArchiveSuppressed: true });
  const result = reconcileAutoArchive([legacy, suppressed], [legacy, suppressed], columns, { mode: 'on-completion' }, now);
  assert.equal(result[0].archived, true);
  assert.equal(result[0].completedAt, undefined);
  assert.equal(result[1].archived, undefined);
  assert.equal(reconcileAutoArchive(result, result, columns, policy, now), result);
});

test('active dependencies, running work, pending evidence and blocked tasks remain visible', async () => {
  const { reconcileAutoArchive } = await modulePromise;
  const tasks = [task('dependency'), task('active', { status: 'open', dependencyIds: ['dependency'], completedAt: undefined }), task('running'), task('blocked', { blocked: true }), task('review', { collaboration: { contributions: [{ state: 'submitted' }] } })];
  assert.equal(reconcileAutoArchive(tasks, tasks, columns, delayed, now, new Set(['running'])), tasks);
  const group = [task('a'), task('b', { dependencyIds: ['a'] })];
  assert.ok(reconcileAutoArchive(group, group, columns, delayed, now).every(item => item.archived));
});

test('manual unarchive is sticky until a new completion and policy checks are idempotent', async () => {
  const { reconcileAutoArchive } = await modulePromise;
  const archived = task('a', { archived: true });
  const restored = reconcileAutoArchive([{ ...archived, archived: false }], [archived], columns, delayed, now);
  assert.equal(restored[0].archived, false);
  assert.equal(restored[0].autoArchiveSuppressed, true);
  assert.equal(reconcileAutoArchive(restored, restored, columns, delayed, now + day), restored);
  const reopened = reconcileAutoArchive([{ ...restored[0], status: 'open' }], restored, columns, delayed, now + day);
  assert.equal(reopened[0].completedAt, undefined);
  assert.equal(reopened[0].autoArchiveSuppressed, undefined);
  const completed = reconcileAutoArchive([{ ...reopened[0], status: 'shipped' }], reopened, columns, delayed, now + 2 * day);
  assert.equal(completed[0].completedAt, new Date(now + 2 * day).toISOString());
  assert.equal(completed[0].archived, false);
});

test('desktop service handles external writes, timed checks, startup and shutdown', async t => {
  const { startAutoArchiveService } = await import('../services/auto-archive-service.mjs');
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now });
  const data = new Map([
    ['omvra.tasks.v1', [task('a', { status: 'open', completedAt: undefined })]],
    ['omvra.statusColumns.v1', columns],
    ['omvra.preferences.v1', { autoArchivePolicy: { mode: 'after-completion', days: 1 } }],
  ]);
  const listeners = new Map();
  const store = {
    get: key => data.get(key),
    set: (key, value) => { data.set(key, value); for (const listener of listeners.get(key) || []) listener(); },
    onDidChange: (key, callback) => { listeners.set(key, [...(listeners.get(key) || []), callback]); return () => listeners.set(key, listeners.get(key).filter(item => item !== callback)); },
  };
  const stop = startAutoArchiveService(store);
  store.set('omvra.tasks.v1', [task('a', { completedAt: undefined })]);
  await new Promise(queueMicrotask);
  assert.equal(store.get('omvra.tasks.v1')[0].completedAt, new Date(now).toISOString());
  t.mock.timers.tick(day);
  await new Promise(queueMicrotask);
  assert.equal(store.get('omvra.tasks.v1')[0].archived, true);
  stop();
  assert.ok([...listeners.values()].every(list => !list.length));
  store.set('omvra.tasks.v1', [task('due')]);
  const stopAgain = startAutoArchiveService(store);
  assert.equal(store.get('omvra.tasks.v1')[0].archived, true);
  stopAgain();
});
