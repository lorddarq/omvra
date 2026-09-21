import test from 'node:test';
import assert from 'node:assert/strict';
import { createMcpReadService } from './service.ts';

const workspaceSnapshot = {
  workspace: {
    tasks: [{ id: 'task-1', title: 'Test task', status: 'open' }],
    people: [],
    swimlanes: [],
    statusColumns: [{ id: 'open', title: 'Open', color: '#999999' }],
  },
};

function setWindowMock() {
  const previousWindow = (globalThis as any).window;
  (globalThis as any).window = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  };

  return () => {
    if (previousWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = previousWindow;
    }
  };
}

function jsonRpcResponse(result: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: 'test', result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

test('validateHealth treats underscore MCP tool aliases as canonical tools', async () => {
  const restoreWindow = setWindowMock();
  const previousFetch = globalThis.fetch;
  let sessionHeader: string | null = null;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body || '{}'));
    const headers = init?.headers as Record<string, string> | undefined;

    if (body.method === 'initialize') {
      const response = jsonRpcResponse({
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'Omvra', version: '0.0.1' },
        capabilities: {},
      }, { 'Mcp-Session-Id': 'session-1' });
      return response;
    }

    if (body.method !== 'notifications/initialized') sessionHeader = headers?.['Mcp-Session-Id'] ?? null;

    if (body.method === 'tools/list') {
      return jsonRpcResponse({
        tools: [
          { name: 'workspace_get_snapshot' },
          { name: 'tasks_list' },
          { name: 'tasks_get' },
          { name: 'cards_kanban_list' },
          { name: 'cards_timeline_list' },
        ],
      });
    }

    if (body.method === 'resources/read') {
      return jsonRpcResponse({
        contents: [{ uri: body.params.uri, text: JSON.stringify(workspaceSnapshot) }],
      });
    }

    if (body.method === 'tools/call' && body.params?.name === 'workspace.get_snapshot') {
      return jsonRpcResponse({ structuredContent: workspaceSnapshot });
    }

    return jsonRpcResponse({});
  };

  try {
    const service = createMcpReadService({
      endpoint: 'http://127.0.0.1:3456/mcp',
      enabled: true,
      timeoutMs: 1000,
    });
    const result = await service.validateHealth({
      counts: { tasks: 1, people: 0, swimlanes: 0, statusColumns: 1 },
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.missingTools, []);
    assert.deepEqual(result.toolsAvailable, [
      'workspace_get_snapshot',
      'tasks_list',
      'tasks_get',
      'cards_kanban_list',
      'cards_timeline_list',
    ]);
    assert.equal(sessionHeader, 'session-1');
  } finally {
    globalThis.fetch = previousFetch;
    restoreWindow();
  }
});

test('snapshot fallback filters archived task and card reads consistently', async () => {
  const restoreWindow = setWindowMock();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body || '{}'));
    if (body.method === 'initialize') return jsonRpcResponse({ protocolVersion: '2024-11-05', capabilities: {} });
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
    const snapshot = { workspace: { ...workspaceSnapshot.workspace, tasks: [...workspaceSnapshot.workspace.tasks, { id: 'archived', title: 'Historical task', status: 'done', archived: true, archivedAt: '2026-09-21T00:00:00.000Z' }] } };
    return jsonRpcResponse({ contents: [{ uri: body.params?.uri, text: JSON.stringify(snapshot) }] });
  };
  try {
    const service = createMcpReadService({ enabled: true, endpoint: 'http://localhost:3456/mcp' });
    for (const read of [service.listTasks, service.listKanbanCards, service.listTimelineCards]) {
      assert.deepEqual((await read({ archiveVisibility: 'active' })).map(task => task.id), ['task-1']);
      assert.deepEqual((await read({ archiveVisibility: 'archived' })).map(task => task.id), ['archived']);
      assert.equal((await read({ archiveVisibility: 'all' })).length, 2);
    }
  } finally {
    globalThis.fetch = previousFetch;
    restoreWindow();
  }
});
