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

function jsonRpcResponse(result: unknown) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: 'test', result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('validateHealth treats underscore MCP tool aliases as canonical tools', async () => {
  const restoreWindow = setWindowMock();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body || '{}'));

    if (body.method === 'initialize') {
      return jsonRpcResponse({
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'Omvra', version: '0.0.1' },
        capabilities: {},
      });
    }

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
  } finally {
    globalThis.fetch = previousFetch;
    restoreWindow();
  }
});
