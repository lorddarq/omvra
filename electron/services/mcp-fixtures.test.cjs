const test = require('node:test');
const assert = require('node:assert/strict');

const { buildMcpCapabilitySnapshot, getWorkspaceSnapshot, listTasks } = require('./workspace-service.cjs');
const { makeStoreFromFixture, loadFixture } = require('./test-fixtures.cjs');

test('workspace-basic fixture remains structurally portable for MCP tests', () => {
  const fixture = loadFixture('workspace-basic');
  assert.ok(Array.isArray(fixture['plumy.tasks.v1']));
  assert.ok(Array.isArray(fixture['plumy.people.v1']));
  assert.ok(Array.isArray(fixture['plumy.swimlanes.v1']));
  assert.ok(Array.isArray(fixture['plumy.statusColumns.v1']));
  assert.equal(fixture['plumy.preferences.v1'].mcpCapabilityProfile, 'task_write');
});

test('workspace-custom-status fixture keeps custom statuses visible in snapshots', () => {
  const store = makeStoreFromFixture('workspace-custom-status');
  const snapshot = getWorkspaceSnapshot(store);
  const customColumnIds = snapshot.workspace.statusColumns.map(column => column.id);

  assert.ok(customColumnIds.includes('ideas'));
  assert.ok(customColumnIds.includes('ready-human'));
  assert.ok(snapshot.workspace.tasks.some(task => task.status === 'ideas'));
});

test('workspace-mcp-security fixture keeps listener and auth settings portable', () => {
  const fixture = loadFixture('workspace-mcp-security');
  assert.equal(fixture['plumy.preferences.v1'].mcpAgentAccessEnabled, true);
  assert.equal(fixture['plumy.preferences.v1'].mcpCapabilityProfile, 'task_write');
  assert.equal(fixture['plumy.preferences.v1'].mcpPort, 3456);
  assert.equal(fixture['plumy.preferences.v1'].mcpAccessToken, 'fixture-token');
});

test('canonical store fixture ignores legacy localStorage-only clutter', () => {
  const store = makeStoreFromFixture('workspace-canonical-store');
  const snapshot = getWorkspaceSnapshot(store);

  assert.equal(snapshot.meta.counts.tasks, 1);
  assert.equal(snapshot.meta.counts.people, 1);
  assert.equal(snapshot.meta.counts.projects, 1);
  assert.ok(snapshot.workspace.tasks.some(task => task.id === 'task-canonical-1'));
  assert.ok(snapshot.workspace.people.some(person => person.kind === 'agentic'));
  assert.equal(store.get('legacy.localStorageOnly'), '{"should-not":"be-read"}');
});

test('capability snapshots differ by fixture profile', () => {
  const readOnlyStore = makeStoreFromFixture('workspace-custom-status');
  const writeStore = makeStoreFromFixture('workspace-basic');

  const readOnlyCapabilities = buildMcpCapabilitySnapshot(readOnlyStore);
  const writeCapabilities = buildMcpCapabilitySnapshot(writeStore);

  assert.equal(readOnlyCapabilities.readOnly, true);
  assert.equal(readOnlyCapabilities.writeBoundary.writeToolsEnabled, false);
  assert.equal(writeCapabilities.readOnly, false);
  assert.equal(writeCapabilities.writeBoundary.writeToolsEnabled, true);
});

test('fixture task filters cover status, assignee, search, and project semantics', () => {
  const store = makeStoreFromFixture('workspace-basic');

  assert.deepEqual(listTasks(store, { status: 'in-progress' }).map(task => task.id), ['task-1']);
  assert.deepEqual(listTasks(store, { assigneeId: 'person-1' }).map(task => task.id), ['task-2']);
  assert.deepEqual(listTasks(store, { search: 'mission control' }).map(task => task.id), ['task-3']);
  assert.deepEqual(listTasks(store, { projectId: 'lane-2' }).map(task => task.id), ['task-2']);
});
