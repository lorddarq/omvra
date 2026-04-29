const test = require('node:test');
const assert = require('node:assert/strict');

const { createRequestDispatcher } = require('./mcp-http-server.cjs');
const {
  PREFERENCES_KEY,
  makeStoreFromFixture,
} = require('./test-fixtures.cjs');

function makeReq(headers = {}, transport = 'http') {
  return {
    headers,
    transport,
    socket: {
      remoteAddress: '127.0.0.1',
    },
  };
}

test('initialize returns MCP server identity and capabilities', () => {
  const dispatch = createRequestDispatcher(makeStoreFromFixture('workspace-basic'));
  const response = dispatch({
    jsonrpc: '2.0',
    id: '1',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'Codex', version: '1.0.0' },
      capabilities: {},
    },
  }, makeReq());

  assert.equal(response.jsonrpc, '2.0');
  assert.equal(response.id, '1');
  assert.ok(response.result);
  assert.equal(response.result.protocolVersion, '2024-11-05');
  assert.deepEqual(response.result.serverInfo, {
    name: 'Plumy',
    version: '0.0.1',
  });
  assert.ok(response.result.capabilities);
  assert.ok(response.result.capabilities.resources);
  assert.ok(response.result.capabilities.tools);
  assert.ok(response.result.capabilities.prompts);
});

test('notifications/initialized is accepted without a JSON-RPC response payload', () => {
  const dispatch = createRequestDispatcher(makeStoreFromFixture('workspace-basic'));
  const response = dispatch({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {},
  }, makeReq());

  assert.equal(response, null);
});

test('tools/list remains available after initialize handshake', () => {
  const dispatch = createRequestDispatcher(makeStoreFromFixture('workspace-basic'));
  const response = dispatch({
    jsonrpc: '2.0',
    id: '2',
    method: 'tools/list',
    params: {},
  }, makeReq());

  assert.equal(response.jsonrpc, '2.0');
  assert.equal(response.id, '2');
  assert.ok(Array.isArray(response.result.tools));
  assert.ok(response.result.tools.some(tool => tool.name === 'workspace.get_snapshot'));
  assert.ok(response.result.tools.some(tool => tool.name === 'boards.watch.poll'));
  assert.ok(response.result.tools.some(tool => tool.name === 'task_write'));
  assert.ok(response.result.tools.some(tool => tool.name === 'tasks.update'));
  assert.ok(response.result.tools.some(tool => tool.name === 'tasks.move_to_status'));
  assert.ok(response.result.tools.some(tool => tool.name === 'tasks.move_to_ready_for_human_review'));
  assert.ok(response.result.tools.some(tool => tool.name === 'tasks.complete_and_request_review'));
  assert.ok(response.result.tools.some(tool => tool.name === 'tasks.assign'));
  assert.ok(response.result.tools.some(tool => tool.name === 'tasks.add_comment'));
  assert.ok(response.result.tools.some(tool => tool.name === 'tasks.add_activity_entry'));
});

test('resources/list exposes the guide, schema, and lookup templates', () => {
  const dispatch = createRequestDispatcher(makeStoreFromFixture('workspace-basic'));
  const response = dispatch({
    jsonrpc: '2.0',
    id: '2.1',
    method: 'resources/list',
    params: {},
  }, makeReq());

  assert.equal(response.jsonrpc, '2.0');
  assert.equal(response.id, '2.1');
  assert.ok(Array.isArray(response.result.resources));
  assert.ok(Array.isArray(response.result.resourceTemplates));
  assert.ok(response.result.resources.some(resource => resource.uri === 'plumy://agent/guide'));
  assert.ok(response.result.resources.some(resource => resource.uri === 'plumy://schema/task-execution'));
  assert.ok(response.result.resourceTemplates.some(template => template.uriTemplate === 'plumy://agents/{personId}/assigned'));
  assert.ok(response.result.resourceTemplates.some(template => template.uriTemplate === 'plumy://projects/{projectId}/tasks'));
  assert.ok(response.result.resourceTemplates.some(template => template.uriTemplate === 'plumy://boards/{statusId}/tasks'));
});

test('task_write creates a new task through the MCP write surface with metadata', () => {
  const dispatch = createRequestDispatcher(makeStoreFromFixture('workspace-basic'));
  const response = dispatch({
    jsonrpc: '2.0',
    id: 'create-1',
    method: 'tools/call',
    params: {
      name: 'task_write',
      arguments: {
        title: 'Capture bug bash follow-up',
        notes: 'Created by automated bug hunting run',
        statusId: 'open',
        assigneeId: 'agent-1',
        projectIds: ['lane-1'],
        swimlaneId: 'lane-1',
        startDate: '2026-03-25',
        endDate: '2026-03-26',
        priority: 'urgent',
      },
    },
  }, makeReq());

  assert.equal(response.jsonrpc, '2.0');
  assert.equal(response.id, 'create-1');
  assert.equal(response.result.structuredContent.action, 'task_write');
  assert.equal(response.result.structuredContent.task.title, 'Capture bug bash follow-up');
  assert.equal(response.result.structuredContent.task.assigneeId, 'agent-1');
  assert.equal(response.result.structuredContent.task.swimlaneId, 'lane-1');
  assert.deepEqual(response.result.structuredContent.task.projectIds, ['lane-1']);
  assert.equal(response.result.structuredContent.task.priority, 'urgent');
  assert.equal(response.result.structuredContent.revision, 0);
});

test('resources/templates/list returns the same lookup templates for clients that query them directly', () => {
  const dispatch = createRequestDispatcher(makeStoreFromFixture('workspace-basic'));
  const response = dispatch({
    jsonrpc: '2.0',
    id: '2.2',
    method: 'resources/templates/list',
    params: {},
  }, makeReq());

  assert.equal(response.jsonrpc, '2.0');
  assert.equal(response.id, '2.2');
  assert.ok(Array.isArray(response.result.resourceTemplates));
  assert.ok(response.result.resourceTemplates.some(template => template.uriTemplate === 'plumy://tasks/{taskId}'));
  assert.ok(response.result.resourceTemplates.some(template => template.uriTemplate === 'plumy://agents/{personId}/assigned'));
  assert.ok(response.result.resourceTemplates.some(template => template.uriTemplate === 'plumy://projects/{projectId}/tasks'));
  assert.ok(response.result.resourceTemplates.some(template => template.uriTemplate === 'plumy://boards/{statusId}/tasks'));
});

test('prompts/list and prompts/get expose guided agent workflows', () => {
  const dispatch = createRequestDispatcher(makeStoreFromFixture('workspace-basic'));

  const listResponse = dispatch({
    jsonrpc: '2.0',
    id: '2.2.1',
    method: 'prompts/list',
    params: {},
  }, makeReq());

  assert.ok(Array.isArray(listResponse.result.prompts));
  assert.ok(listResponse.result.prompts.some(prompt => prompt.name === 'agent.find_assigned_work'));
  assert.ok(listResponse.result.prompts.some(prompt => prompt.name === 'agent.complete_and_handoff'));

  const getResponse = dispatch({
    jsonrpc: '2.0',
    id: '2.2.2',
    method: 'prompts/get',
    params: {
      name: 'agent.complete_and_handoff',
      arguments: {
        taskId: 'task-1',
      },
    },
  }, makeReq());

  assert.match(getResponse.result.description, /human review/i);
  assert.ok(Array.isArray(getResponse.result.messages));
  assert.match(getResponse.result.messages[0].content.text, /tasks\.complete_and_request_review/);
});

test('guide and execution schema resources explain the task workflow', () => {
  const dispatch = createRequestDispatcher(makeStoreFromFixture('workspace-basic'));
  const req = makeReq();

  const guideResponse = dispatch({
    jsonrpc: '2.0',
    id: '2.3',
    method: 'resources/read',
    params: {
      uri: 'plumy://agent/guide',
    },
  }, req);

  assert.match(guideResponse.result.contents[0].text, /plumy:\/\/agent\/guide/);
  assert.match(guideResponse.result.contents[0].text, /resources\/templates\/list/);
  assert.match(guideResponse.result.contents[0].text, /tasks\.move_to_ready_for_human_review/);

  const schemaResponse = dispatch({
    jsonrpc: '2.0',
    id: '2.4',
    method: 'resources/read',
    params: {
      uri: 'plumy://schema/task-execution',
    },
  }, req);

  assert.match(schemaResponse.result.contents[0].text, /task execution schema/i);
  assert.match(schemaResponse.result.contents[0].text, /expectedRevision/);
  assert.match(schemaResponse.result.contents[0].text, /handoff/);
});

test('template resources resolve assigned work, project work, and board work', () => {
  const dispatch = createRequestDispatcher(makeStoreFromFixture('workspace-basic'));
  const req = makeReq();

  const agentResponse = dispatch({
    jsonrpc: '2.0',
    id: '2.5',
    method: 'resources/read',
    params: {
      uri: 'plumy://agents/agent-1/assigned',
    },
  }, req);

  assert.ok(Array.isArray(agentResponse.result.contents));
  const assignedWork = JSON.parse(agentResponse.result.contents[0].text);
  assert.deepEqual(assignedWork.person, {
    id: 'agent-1',
    name: 'Codex',
    role: 'Agent',
    kind: 'agentic',
  });
  assert.equal(assignedWork.summary.totalTasks, 2);
  assert.deepEqual(
    assignedWork.tasks.map(task => task.id).sort(),
    ['task-1', 'task-3']
  );
  assert.equal(assignedWork.filters.status, null);

  const projectResponse = dispatch({
    jsonrpc: '2.0',
    id: '2.6',
    method: 'resources/read',
    params: {
      uri: 'plumy://projects/lane-1/tasks',
    },
  }, req);

  assert.ok(Array.isArray(projectResponse.result.contents));
  assert.match(projectResponse.result.contents[0].text, /lane-1/);

  const boardResponse = dispatch({
    jsonrpc: '2.0',
    id: '2.7',
    method: 'resources/read',
    params: {
      uri: 'plumy://boards/in-progress/tasks',
    },
  }, req);

  assert.ok(Array.isArray(boardResponse.result.contents));
  assert.match(boardResponse.result.contents[0].text, /in-progress/);
});

test('reading a literal template URI returns a guided validation error', () => {
  const dispatch = createRequestDispatcher(makeStoreFromFixture('workspace-basic'));
  const response = dispatch({
    jsonrpc: '2.0',
    id: '2.7.1',
    method: 'resources/read',
    params: {
      uri: 'plumy://agents/{personId}/assigned',
    },
  }, makeReq());

  assert.ok(response.error);
  assert.match(response.error.message, /is a template/i);
});

test('complete_and_request_review updates the completion note and moves the task to review', () => {
  const store = makeStoreFromFixture('workspace-basic');
  store.set(PREFERENCES_KEY, {
    mcpAgentAccessEnabled: true,
    mcpCapabilityProfile: 'task_write',
    mcpAccessToken: 'secret-token',
    mcpAccessTokenIssuedAt: new Date().toISOString(),
    mcpAccessTokenTtlMinutes: 60,
  });

  const dispatch = createRequestDispatcher(store);
  const req = makeReq({ authorization: 'Bearer secret-token' }, 'http');

  const response = dispatch({
    jsonrpc: '2.0',
    id: '2.8',
    method: 'tools/call',
    params: {
      name: 'tasks.complete_and_request_review',
      arguments: {
        taskId: 'task-1',
        completion: 'Completed the timeline handoff.',
        expectedRevision: 0,
      },
    },
  }, req);

  assert.equal(response.jsonrpc, '2.0');
  assert.equal(response.id, '2.8');
  assert.equal(response.result.structuredContent.action, 'tasks.complete_and_request_review');
  assert.ok(response.result.structuredContent.auditId);
  assert.equal(response.result.structuredContent.changed, true);
  assert.equal(response.result.structuredContent.statusId, 'ready-human');
  assert.equal(response.result.structuredContent.statusCreated, true);
  assert.equal(response.result.structuredContent.task.status, 'ready-human');
  assert.match(response.result.structuredContent.task.notes, /Agent Completion/);
  assert.match(response.result.structuredContent.task.notes, /Completed the timeline handoff/);
  assert.equal(response.result.structuredContent.revision, 1);
});

test('stdio transport bypasses HTTP token gating and still initializes', () => {
  const store = makeStoreFromFixture('workspace-basic');
  store.set(PREFERENCES_KEY, {
    mcpAgentAccessEnabled: true,
    mcpCapabilityProfile: 'read_only',
    mcpAccessToken: 'secret-token',
    mcpAccessTokenIssuedAt: new Date().toISOString(),
    mcpAccessTokenTtlMinutes: 60,
  });

  const dispatch = createRequestDispatcher(store);
  const response = dispatch({
    jsonrpc: '2.0',
    id: '3',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'Claude', version: '1.0.0' },
      capabilities: {},
    },
  }, makeReq({}, 'stdio'));

  assert.equal(response.jsonrpc, '2.0');
  assert.equal(response.id, '3');
  assert.equal(response.result.protocolVersion, '2024-11-05');
});

test('http transport rejects missing bearer token when token auth is enabled', () => {
  const store = makeStoreFromFixture('workspace-basic');
  store.set(PREFERENCES_KEY, {
    mcpAgentAccessEnabled: true,
    mcpCapabilityProfile: 'read_only',
    mcpAccessToken: 'secret-token',
    mcpAccessTokenIssuedAt: new Date().toISOString(),
    mcpAccessTokenTtlMinutes: 60,
  });

  const dispatch = createRequestDispatcher(store);
  const response = dispatch({
    jsonrpc: '2.0',
    id: '4',
    method: 'tools/list',
    params: {},
  }, makeReq());

  assert.equal(response.jsonrpc, '2.0');
  assert.equal(response.id, '4');
  assert.ok(response.error);
  assert.equal(response.error.code, -32002);
  assert.match(response.error.message, /Unauthorized MCP request/);
  assert.equal(response.error.data.reason, 'unauthorized');
  assert.equal(response.error.data.tokenConfigured, true);
  assert.equal(response.error.data.tokenStatus, 'active');
});

test('remote http transport can read resources and expose write tools with valid token', () => {
  const store = makeStoreFromFixture('workspace-basic');
  store.set(PREFERENCES_KEY, {
    mcpAgentAccessEnabled: true,
    mcpCapabilityProfile: 'task_write',
    mcpAccessToken: 'secret-token',
    mcpAccessTokenIssuedAt: new Date().toISOString(),
    mcpAccessTokenTtlMinutes: 60,
  });

  const dispatch = createRequestDispatcher(store);
  const req = makeReq({ authorization: 'Bearer secret-token' }, 'http');

  const toolsResponse = dispatch({
    jsonrpc: '2.0',
    id: '5',
    method: 'tools/list',
    params: {},
  }, req);

  assert.ok(Array.isArray(toolsResponse.result.tools));
  assert.ok(toolsResponse.result.tools.some(tool => tool.name === 'tasks.transition_under_review'));

  const resourcesResponse = dispatch({
    jsonrpc: '2.0',
    id: '6',
    method: 'resources/read',
    params: {
      uri: 'plumy://workspace',
    },
  }, req);

  assert.ok(Array.isArray(resourcesResponse.result.contents));
  assert.ok(resourcesResponse.result.contents.length > 0);
  assert.match(resourcesResponse.result.contents[0].text, /workspace/);
});

test('write tools return a consistent envelope for move, ready-review, and assign flows', () => {
  const store = makeStoreFromFixture('workspace-basic');
  store.set(PREFERENCES_KEY, {
    mcpAgentAccessEnabled: true,
    mcpCapabilityProfile: 'task_write',
    mcpAccessToken: 'secret-token',
    mcpAccessTokenIssuedAt: new Date().toISOString(),
    mcpAccessTokenTtlMinutes: 60,
  });

  const dispatch = createRequestDispatcher(store);
  const req = makeReq({ authorization: 'Bearer secret-token' }, 'http');

  const moveResponse = dispatch({
    jsonrpc: '2.0',
    id: '6.1',
    method: 'tools/call',
    params: {
      name: 'tasks.move_to_status',
      arguments: {
        taskId: 'task-2',
        statusTitle: 'Done',
        expectedRevision: 0,
      },
    },
  }, req);

  assert.equal(moveResponse.result.structuredContent.ok, true);
  assert.equal(moveResponse.result.structuredContent.action, 'tasks.move_to_status');
  assert.ok(moveResponse.result.structuredContent.auditId);
  assert.equal(moveResponse.result.structuredContent.changed, true);
  assert.equal(moveResponse.result.structuredContent.task.status, 'done');
  assert.equal(moveResponse.result.structuredContent.revision, 1);

  const readyResponse = dispatch({
    jsonrpc: '2.0',
    id: '6.2',
    method: 'tools/call',
    params: {
      name: 'tasks.move_to_ready_for_human_review',
      arguments: {
        taskId: 'task-3',
        expectedRevision: 0,
      },
    },
  }, req);

  assert.equal(readyResponse.result.structuredContent.ok, true);
  assert.equal(readyResponse.result.structuredContent.action, 'tasks.move_to_ready_for_human_review');
  assert.ok(readyResponse.result.structuredContent.auditId);
  assert.equal(readyResponse.result.structuredContent.statusId, 'ready-human');
  assert.equal(readyResponse.result.structuredContent.task.status, 'ready-human');
  assert.equal(readyResponse.result.structuredContent.revision, 1);

  const assignResponse = dispatch({
    jsonrpc: '2.0',
    id: '6.3',
    method: 'tools/call',
    params: {
      name: 'tasks.assign',
      arguments: {
        taskId: 'task-2',
        assigneeName: 'Codex',
        assigneeKind: 'agentic',
        expectedRevision: 1,
      },
    },
  }, req);

  assert.equal(assignResponse.result.structuredContent.ok, true);
  assert.equal(assignResponse.result.structuredContent.action, 'tasks.assign');
  assert.ok(assignResponse.result.structuredContent.auditId);
  assert.equal(assignResponse.result.structuredContent.task.assigneeId, 'agent-1');
  assert.equal(assignResponse.result.structuredContent.revision, 2);

  const commentResponse = dispatch({
    jsonrpc: '2.0',
    id: '6.4',
    method: 'tools/call',
    params: {
      name: 'tasks.add_comment',
      arguments: {
        taskId: 'task-2',
        comment: 'Please sanity-check the card spacing before review.',
        author: 'Codex',
        expectedRevision: 2,
      },
    },
  }, req);

  assert.equal(commentResponse.result.structuredContent.ok, true);
  assert.equal(commentResponse.result.structuredContent.action, 'tasks.add_comment');
  assert.ok(commentResponse.result.structuredContent.auditId);
  assert.equal(commentResponse.result.structuredContent.task.comments.length, 1);
  assert.equal(commentResponse.result.structuredContent.task.comments[0].author, 'Codex');
  assert.equal(commentResponse.result.structuredContent.revision, 3);

  const activityResponse = dispatch({
    jsonrpc: '2.0',
    id: '6.5',
    method: 'tools/call',
    params: {
      name: 'tasks.add_activity_entry',
      arguments: {
        taskId: 'task-2',
        message: 'Agent prepared a brief implementation plan.',
        type: 'activity',
        expectedRevision: 3,
      },
    },
  }, req);

  assert.equal(activityResponse.result.structuredContent.ok, true);
  assert.equal(activityResponse.result.structuredContent.action, 'tasks.add_activity_entry');
  assert.ok(activityResponse.result.structuredContent.auditId);
  assert.equal(activityResponse.result.structuredContent.task.activityLog.length, 1);
  assert.equal(activityResponse.result.structuredContent.task.activityLog[0].type, 'activity');
  assert.equal(activityResponse.result.structuredContent.revision, 4);
});

test('move_to_requires_human_review returns the same write envelope shape', () => {
  const store = makeStoreFromFixture('workspace-basic');
  store.set(PREFERENCES_KEY, {
    mcpAgentAccessEnabled: true,
    mcpCapabilityProfile: 'task_write',
    mcpAccessToken: 'secret-token',
    mcpAccessTokenIssuedAt: new Date().toISOString(),
    mcpAccessTokenTtlMinutes: 60,
  });

  const dispatch = createRequestDispatcher(store);
  const req = makeReq({ authorization: 'Bearer secret-token' }, 'http');

  const response = dispatch({
    jsonrpc: '2.0',
    id: '6.4',
    method: 'tools/call',
    params: {
      name: 'tasks.move_to_requires_human_review',
      arguments: {
        taskIds: ['task-3'],
        expectedRevisions: {
          'task-3': 0,
        },
      },
    },
  }, req);

  assert.equal(response.result.structuredContent.ok, true);
  assert.equal(response.result.structuredContent.action, 'tasks.move_to_requires_human_review');
  assert.ok(response.result.structuredContent.auditId);
  assert.equal(response.result.structuredContent.changed, true);
  assert.equal(response.result.structuredContent.statusId, 'requires-human-review');
  assert.equal(response.result.structuredContent.result.totalMoved, 1);
  assert.equal(response.result.structuredContent.result.movedTaskIds[0], 'task-3');
});

test('http transport rejects expired tokens before servicing requests', () => {
  const store = makeStoreFromFixture('workspace-basic');
  store.set(PREFERENCES_KEY, {
    mcpAgentAccessEnabled: true,
    mcpCapabilityProfile: 'read_only',
    mcpAccessToken: 'secret-token',
    mcpAccessTokenIssuedAt: '2020-01-01T00:00:00.000Z',
    mcpAccessTokenTtlMinutes: 1,
  });

  const dispatch = createRequestDispatcher(store);
  const response = dispatch({
    jsonrpc: '2.0',
    id: '7',
    method: 'tools/list',
    params: {},
  }, makeReq({ authorization: 'Bearer secret-token' }, 'http'));

  assert.equal(response.jsonrpc, '2.0');
  assert.equal(response.id, '7');
  assert.ok(response.error);
  assert.equal(response.error.code, -32002);
  assert.match(response.error.message, /expired/i);
  assert.equal(response.error.data.reason, 'token_expired');
  assert.equal(response.error.data.tokenStatus, 'expired');
});

test('denied write attempts are rejected when the bearer token is wrong', () => {
  const store = makeStoreFromFixture('workspace-basic');
  store.set(PREFERENCES_KEY, {
    mcpAgentAccessEnabled: true,
    mcpCapabilityProfile: 'task_write',
    mcpAccessToken: 'secret-token',
    mcpAccessTokenIssuedAt: new Date().toISOString(),
    mcpAccessTokenTtlMinutes: 60,
  });

  const dispatch = createRequestDispatcher(store);
  const response = dispatch({
    jsonrpc: '2.0',
    id: '8',
    method: 'tools/call',
    params: {
      name: 'tasks.transition_under_review',
      arguments: {
        taskId: 'task-1',
        expectedRevision: 0,
      },
    },
  }, makeReq({ authorization: 'Bearer wrong-token' }, 'http'));

  assert.equal(response.jsonrpc, '2.0');
  assert.equal(response.id, '8');
  assert.ok(response.error);
  assert.equal(response.error.code, -32002);
  assert.match(response.error.message, /Unauthorized MCP request/i);
});

test('read_only fixture only exposes read tools and preserves custom resources', () => {
  const store = makeStoreFromFixture('workspace-custom-status');
  store.set(PREFERENCES_KEY, {
    ...store.get(PREFERENCES_KEY),
    mcpAccessTokenIssuedAt: new Date().toISOString(),
  });
  const dispatch = createRequestDispatcher(store);
  const req = makeReq({ authorization: 'Bearer secret-token' }, 'http');

  const toolsResponse = dispatch({
    jsonrpc: '2.0',
    id: '9',
    method: 'tools/list',
    params: {},
  }, req);

  const toolNames = toolsResponse.result.tools.map(tool => tool.name);
  assert.ok(toolNames.includes('workspace.get_snapshot'));
  assert.ok(!toolNames.includes('tasks.update'));
  assert.ok(!toolNames.includes('tasks.transition_under_review'));
  assert.ok(!toolNames.includes('tasks.move_to_status'));
  assert.ok(!toolNames.includes('tasks.move_to_ready_for_human_review'));
  assert.ok(!toolNames.includes('tasks.assign'));
  assert.ok(!toolNames.includes('tasks.move_to_requires_human_review'));

  const resourceResponse = dispatch({
    jsonrpc: '2.0',
    id: '10',
    method: 'resources/read',
    params: {
      uri: 'plumy://workspace',
    },
  }, req);

  assert.match(resourceResponse.result.contents[0].text, /ready-human/);
  assert.match(resourceResponse.result.contents[0].text, /task-custom-1/);
});

test('boards.watch.poll exposes board deltas and suppresses duplicate processing', () => {
  const store = makeStoreFromFixture('workspace-basic');
  const dispatch = createRequestDispatcher(store);
  const req = makeReq({}, 'http');

  const first = dispatch({
    jsonrpc: '2.0',
    id: '11',
    method: 'tools/call',
    params: {
      name: 'boards.watch.poll',
      arguments: {
        statusId: 'in-progress',
        assigneeId: 'agent-1',
      },
    },
  }, req);

  assert.equal(first.jsonrpc, '2.0');
  assert.equal(first.id, '11');
  assert.equal(first.result.structuredContent.ok, true);
  assert.equal(first.result.structuredContent.changes.newTasks.length, 1);
  assert.equal(first.result.structuredContent.changes.updatedTasks.length, 0);
  assert.equal(first.result.structuredContent.changes.removedTaskIds.length, 0);

  const second = dispatch({
    jsonrpc: '2.0',
    id: '12',
    method: 'tools/call',
    params: {
      name: 'boards.watch.poll',
      arguments: {
        watcherId: first.result.structuredContent.watcherState.watcherId,
        statusId: 'in-progress',
        assigneeId: 'agent-1',
      },
    },
  }, req);

  assert.equal(second.result.structuredContent.changes.newTasks.length, 0);
  assert.equal(second.result.structuredContent.changes.updatedTasks.length, 0);
  assert.equal(second.result.structuredContent.changes.removedTaskIds.length, 0);
});
