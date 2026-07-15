const test = require('node:test');
const assert = require('node:assert/strict');

const { registerMcpIpcHandlers } = require('../ipc/mcp.cjs');
const { makeStoreFromFixture } = require('./test-fixtures.cjs');

test('MCP IPC exposes listener status from the main runtime state', async () => {
  const store = makeStoreFromFixture('workspace-mcp-security');
  const handlers = new Map();
  const ipcMain = {
    handle(name, handler) {
      handlers.set(name, handler);
    },
  };

  registerMcpIpcHandlers({
    ipcMain,
    store,
    getListenerStatus: () => ({
      status: 'running',
      listening: true,
      boundUrl: 'http://127.0.0.1:3456/mcp',
      boundAddress: '127.0.0.1:3456',
    }),
  });

  const handler = handlers.get('mcp/get-listener-status');
  assert.equal(typeof handler, 'function');

  const response = await handler();
  assert.equal(response.ok, true);
  assert.equal(response.data.status, 'running');
  assert.equal(response.data.boundUrl, 'http://127.0.0.1:3456/mcp');
});

test('MCP IPC exposes recent audit log entries', async () => {
  const store = makeStoreFromFixture('workspace-basic');
  store.set('omvra.mcp.audit.v1', [
    {
      auditId: 'audit-1',
      timestamp: '2026-03-26T10:00:00.000Z',
      type: 'mcp_write_attempt',
      toolName: 'tasks.assign',
      outcome: 'allowed',
    },
  ]);
  const handlers = new Map();
  const ipcMain = {
    handle(name, handler) {
      handlers.set(name, handler);
    },
  };

  registerMcpIpcHandlers({
    ipcMain,
    store,
    getListenerStatus: () => ({ status: 'running', listening: true }),
  });

  const handler = handlers.get('mcp/get-audit-log');
  assert.equal(typeof handler, 'function');

  const response = await handler(null, { limit: 10 });
  assert.equal(response.ok, true);
  assert.equal(Array.isArray(response.data), true);
  assert.equal(response.data[0].auditId, 'audit-1');
  assert.equal(response.data[0].toolName, 'tasks.assign');
});

test('MCP IPC exposes bounded audit summaries', async () => {
  const store = makeStoreFromFixture('workspace-basic');
  store.set('omvra.mcp.audit.v1', [
    {
      auditId: 'audit-summary-1',
      timestamp: '2026-03-26T10:00:00.000Z',
      agent: 'codex',
      outcome: 'allowed',
      toolName: 'tasks.list',
      durationMs: 12,
    },
  ]);
  const handlers = new Map();
  const ipcMain = {
    handle(name, handler) {
      handlers.set(name, handler);
    },
  };

  registerMcpIpcHandlers({
    ipcMain,
    store,
    getListenerStatus: () => ({ status: 'running', listening: true }),
  });

  const response = await handlers.get('mcp/get-audit-summary')(null, { agent: 'codex' });
  assert.equal(response.ok, true);
  assert.equal(response.data.sampleSize, 1);
  assert.equal(response.data.overall.successCount, 1);
  assert.equal(response.data.by.agent[0].key, 'codex');
});
