const test = require('node:test');
const assert = require('node:assert/strict');

const { createRequestDispatcher } = require('./mcp-http-server.cjs');
const {
  MILESTONES_KEY,
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
    name: 'Omvra',
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
  assert.ok(response.result.tools.every(tool => /^[a-zA-Z0-9_-]{1,64}$/.test(tool.name)));
  assert.ok(response.result.tools.some(tool => tool.name === 'workspace_get_snapshot'));
  assert.ok(response.result.tools.some(tool => tool.name === 'boards_watch_poll'));
  assert.ok(response.result.tools.some(tool => tool.name === 'milestones_list'));
  assert.ok(response.result.tools.some(tool => tool.name === 'task_write'));
  assert.ok(response.result.tools.some(tool => tool.name === 'tasks_update'));
  assert.ok(response.result.tools.some(tool => tool.name === 'tasks_update_description'));
  assert.ok(response.result.tools.some(tool => tool.name === 'tasks_attach_file'));
  assert.ok(response.result.tools.some(tool => tool.name === 'tasks_remove_attachment'));
  assert.ok(response.result.tools.some(tool => tool.name === 'tasks_delete'));
  assert.ok(response.result.tools.some(tool => tool.name === 'tasks_log_time'));
  assert.ok(response.result.tools.some(tool => tool.name === 'milestones_create'));
  assert.ok(response.result.tools.some(tool => tool.name === 'milestones_update'));
  assert.ok(response.result.tools.some(tool => tool.name === 'milestones_link_tasks'));
  assert.ok(response.result.tools.some(tool => tool.name === 'milestones_delete'));
  assert.ok(response.result.tools.some(tool => tool.name === 'tasks_move_to_status'));
  assert.ok(response.result.tools.some(tool => tool.name === 'tasks_move_to_ready_for_human_review'));
  assert.ok(response.result.tools.some(tool => tool.name === 'tasks_complete_and_request_review'));
  assert.ok(response.result.tools.some(tool => tool.name === 'tasks_assign'));
  assert.ok(response.result.tools.some(tool => tool.name === 'tasks_add_comment'));
  assert.ok(response.result.tools.some(tool => tool.name === 'tasks_add_activity_entry'));
});

test('tool schemas advertise one canonical roadmap write path', () => {
  const dispatch = createRequestDispatcher(makeStoreFromFixture('workspace-basic'));
  const response = dispatch({
    jsonrpc: '2.0',
    id: 'tool-schema-roadmap-1',
    method: 'tools/list',
    params: {},
  }, makeReq());

  const toolsByName = new Map(response.result.tools.map(tool => [tool.name, tool]));
  const taskUpdateProperties = toolsByName.get('tasks_update').inputSchema.properties;
  assert.equal(Object.prototype.hasOwnProperty.call(taskUpdateProperties, 'milestoneId'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(taskUpdateProperties, 'dependencyIds'), false);
  assert.match(toolsByName.get('tasks_update').description, /milestones_link_tasks/);
  assert.match(toolsByName.get('milestones_link_tasks').description, /Canonical roadmap write/);
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
  assert.ok(response.result.resources.some(resource => resource.uri === 'omvra://agent/guide'));
  assert.ok(response.result.resources.some(resource => resource.uri === 'omvra://schema/task-execution'));
  assert.ok(response.result.resources.some(resource => resource.uri === 'omvra://milestones'));
  assert.ok(response.result.resourceTemplates.some(template => template.uriTemplate === 'omvra://milestones/{milestoneId}'));
  assert.ok(response.result.resourceTemplates.some(template => template.uriTemplate === 'omvra://agents/{personId}/assigned'));
  assert.ok(response.result.resourceTemplates.some(template => template.uriTemplate === 'omvra://projects/{projectId}/tasks'));
  assert.ok(response.result.resourceTemplates.some(template => template.uriTemplate === 'omvra://boards/{statusId}/tasks'));
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

test('underscore tool aliases dispatch to the canonical handlers', () => {
  const dispatch = createRequestDispatcher(makeStoreFromFixture('workspace-basic'));
  const response = dispatch({
    jsonrpc: '2.0',
    id: 'alias-list-1',
    method: 'tools/call',
    params: {
      name: 'tasks_list',
      arguments: {},
    },
  }, makeReq());

  assert.equal(response.jsonrpc, '2.0');
  assert.equal(response.id, 'alias-list-1');
  assert.ok(Array.isArray(response.result.structuredContent));
  assert.ok(response.result.structuredContent.some(task => task.id === 'task-1'));
});

test('MCP persists dependency IDs and approximate time fields through task writes', () => {
  const store = makeStoreFromFixture('workspace-basic', {
    [MILESTONES_KEY]: [
      {
        id: 'milestone-1',
        title: 'Release Alpha',
        projectIds: ['lane-1'],
        projectId: 'lane-1',
        endDate: '2026-04-01',
        linkedTaskIds: [],
      },
    ],
  });
  const dispatch = createRequestDispatcher(store);

  const createResponse = dispatch({
    jsonrpc: '2.0',
    id: 'metadata-create-1',
    method: 'tools/call',
    params: {
      name: 'tasks_create',
      arguments: {
        title: 'Create roadmap metadata task',
        projectIds: ['Project A'],
        milestoneId: 'milestone-1',
        dependencyIds: ['task-1'],
        timeSpentMinutes: 25,
        timeSpentNote: 'Initial estimate',
      },
    },
  }, makeReq({}, 'stdio'));

  assert.equal(createResponse.jsonrpc, '2.0');
  const task = createResponse.result.structuredContent.task;
  assert.equal(task.milestoneId, 'milestone-1');
  assert.deepEqual(task.dependencyIds, ['task-1']);
  assert.equal(task.timeSpentMinutes, 25);

  const updateResponse = dispatch({
    jsonrpc: '2.0',
    id: 'metadata-update-1',
    method: 'tools/call',
    params: {
      name: 'tasks_update',
      arguments: {
        taskId: task.id,
        dependencyIds: ['task-2'],
        expectedRevision: task.__mcpRevision,
      },
    },
  }, makeReq({}, 'stdio'));

  assert.equal(updateResponse.result.structuredContent.task.dependencyIds[0], 'task-2');

  const getResponse = dispatch({
    jsonrpc: '2.0',
    id: 'metadata-get-1',
    method: 'tools/call',
    params: {
      name: 'tasks_get',
      arguments: { taskId: task.id },
    },
  }, makeReq({}, 'stdio'));

  assert.deepEqual(getResponse.result.structuredContent.dependencyIds, ['task-2']);
  assert.equal(getResponse.result.structuredContent.timeSpentMinutes, 25);
});

test('MCP logs approximate task time and creates linked milestones', () => {
  const dispatch = createRequestDispatcher(makeStoreFromFixture('workspace-basic'));

  const timeResponse = dispatch({
    jsonrpc: '2.0',
    id: 'time-log-1',
    method: 'tools/call',
    params: {
      name: 'tasks_log_time',
      arguments: {
        taskId: 'task-2',
        minutes: 50,
        note: 'Approximate debugging time',
        expectedRevision: 0,
      },
    },
  }, makeReq({}, 'stdio'));

  assert.equal(timeResponse.result.structuredContent.task.timeSpentMinutes, 50);
  assert.equal(timeResponse.result.structuredContent.task.timeEntries[0].minutes, 50);

  const milestoneResponse = dispatch({
    jsonrpc: '2.0',
    id: 'milestone-create-1',
    method: 'tools/call',
    params: {
      name: 'milestones_create',
      arguments: {
        title: 'Release Alpha',
        projectIds: ['Project A'],
        endDate: '2026-04-01',
        description: 'First agent-created roadmap milestone.',
        linkedTaskIds: ['task-1', 'task-2'],
      },
    },
  }, makeReq({}, 'stdio'));

  const milestone = milestoneResponse.result.structuredContent.result.milestone;
  assert.equal(milestone.title, 'Release Alpha');
  assert.deepEqual(milestone.linkedTaskIds, ['task-1', 'task-2']);

  const listResponse = dispatch({
    jsonrpc: '2.0',
    id: 'milestone-list-1',
    method: 'tools/call',
    params: {
      name: 'milestones_list',
      arguments: {},
    },
  }, makeReq({}, 'stdio'));

  assert.ok(listResponse.result.structuredContent.some(item => item.id === milestone.id));
});

test('MCP updates milestone linked tasks and clears removed task milestone links', () => {
  const dispatch = createRequestDispatcher(makeStoreFromFixture('workspace-basic'));

  const milestoneResponse = dispatch({
    jsonrpc: '2.0',
    id: 'milestone-update-create-1',
    method: 'tools/call',
    params: {
      name: 'milestones_create',
      arguments: {
        title: 'Release Alpha',
        projectIds: ['Project A'],
        endDate: '2026-04-01',
        linkedTaskIds: ['task-1', 'task-2'],
      },
    },
  }, makeReq({}, 'stdio'));

  const milestone = milestoneResponse.result.structuredContent.result.milestone;
  const updateResponse = dispatch({
    jsonrpc: '2.0',
    id: 'milestone-update-1',
    method: 'tools/call',
    params: {
      name: 'milestones_update',
      arguments: {
        milestoneId: milestone.id,
        linkedTaskIds: ['task-1'],
        expectedRevision: milestone.__mcpRevision,
      },
    },
  }, makeReq({}, 'stdio'));

  const updatedMilestone = updateResponse.result.structuredContent.result.milestone;
  assert.deepEqual(updatedMilestone.linkedTaskIds, ['task-1']);
  assert.equal(updatedMilestone.__mcpRevision, 1);

  const removedTaskResponse = dispatch({
    jsonrpc: '2.0',
    id: 'milestone-update-task-get-1',
    method: 'tools/call',
    params: {
      name: 'tasks_get',
      arguments: { taskId: 'task-2' },
    },
  }, makeReq({}, 'stdio'));

  assert.equal(removedTaskResponse.result.structuredContent.milestoneId, undefined);
});

test('MCP atomically links milestone tasks and intertask dependencies', () => {
  const dispatch = createRequestDispatcher(makeStoreFromFixture('workspace-basic'));

  const milestoneResponse = dispatch({
    jsonrpc: '2.0',
    id: 'milestone-link-create-1',
    method: 'tools/call',
    params: {
      name: 'milestones_create',
      arguments: {
        title: 'Release Alpha',
        projectIds: ['Project A'],
        endDate: '2026-04-01',
        linkedTaskIds: ['task-1'],
      },
    },
  }, makeReq({}, 'stdio'));

  const milestone = milestoneResponse.result.structuredContent.result.milestone;
  const linkResponse = dispatch({
    jsonrpc: '2.0',
    id: 'milestone-link-tasks-1',
    method: 'tools/call',
    params: {
      name: 'milestones_link_tasks',
      arguments: {
        milestoneId: milestone.id,
        taskIds: ['task-2', 'task-3'],
        dependencyUpdates: [
          { taskId: 'task-3', dependencyIds: ['task-2'] },
        ],
        expectedRevision: milestone.__mcpRevision,
      },
    },
  }, makeReq({}, 'stdio'));

  const result = linkResponse.result.structuredContent.result;
  assert.deepEqual(result.milestone.linkedTaskIds, ['task-1', 'task-2', 'task-3']);
  assert.deepEqual(result.linkedTaskIdsAdded, ['task-2', 'task-3']);
  assert.deepEqual(result.changedTaskIds.sort(), ['task-2', 'task-3']);
  assert.equal(linkResponse.result.structuredContent.revision, 1);

  const taskResponse = dispatch({
    jsonrpc: '2.0',
    id: 'milestone-link-task-get-1',
    method: 'tools/call',
    params: {
      name: 'tasks_get',
      arguments: { taskId: 'task-3' },
    },
  }, makeReq({}, 'stdio'));

  assert.equal(taskResponse.result.structuredContent.milestoneId, milestone.id);
  assert.deepEqual(taskResponse.result.structuredContent.dependencyIds, ['task-2']);
});

test('MCP deletes milestones and clears linked task roadmap metadata', () => {
  const dispatch = createRequestDispatcher(makeStoreFromFixture('workspace-basic'));
  const req = makeReq({}, 'stdio');

  const milestoneResponse = dispatch({
    jsonrpc: '2.0',
    id: 'milestone-delete-create-1',
    method: 'tools/call',
    params: {
      name: 'milestones_create',
      arguments: {
        title: 'Release Alpha',
        projectIds: ['Project A'],
        endDate: '2026-04-01',
        linkedTaskIds: ['task-1', 'task-2'],
      },
    },
  }, req);
  const milestone = milestoneResponse.result.structuredContent.result.milestone;

  const dependencyUpdate = dispatch({
    jsonrpc: '2.0',
    id: 'milestone-delete-dependency-1',
    method: 'tools/call',
    params: {
      name: 'tasks_update',
      arguments: {
        taskId: 'task-1',
        dependencyIds: ['task-2'],
        expectedRevision: 1,
      },
    },
  }, req);
  assert.deepEqual(dependencyUpdate.result.structuredContent.task.dependencyIds, ['task-2']);

  const deleteResponse = dispatch({
    jsonrpc: '2.0',
    id: 'milestone-delete-1',
    method: 'tools/call',
    params: {
      name: 'milestones_delete',
      arguments: {
        milestoneId: milestone.id,
        expectedRevision: milestone.__mcpRevision,
      },
    },
  }, req);

  assert.equal(deleteResponse.result.structuredContent.result.deletedMilestoneId, milestone.id);
  assert.deepEqual(deleteResponse.result.structuredContent.result.cleanup.clearedMilestoneTaskIds.sort(), ['task-1', 'task-2']);
  assert.deepEqual(deleteResponse.result.structuredContent.result.cleanup.clearedDependencyTaskIds, ['task-1']);

  const taskResponse = dispatch({
    jsonrpc: '2.0',
    id: 'milestone-delete-task-read-1',
    method: 'tools/call',
    params: {
      name: 'tasks_get',
      arguments: { taskId: 'task-1' },
    },
  }, req);
  assert.equal(taskResponse.result.structuredContent.milestoneId, undefined);
  assert.deepEqual(taskResponse.result.structuredContent.dependencyIds, []);
});

test('tasks.update_description replaces notes through MCP and audits the write', () => {
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
    id: 'update-description-1',
    method: 'tools/call',
    params: {
      name: 'tasks.update_description',
      arguments: {
        taskId: 'task-2',
        description: 'Updated full task description.',
        expectedRevision: 0,
      },
    },
  }, req);

  assert.equal(response.jsonrpc, '2.0');
  assert.equal(response.id, 'update-description-1');
  assert.equal(response.result.structuredContent.action, 'tasks.update_description');
  assert.equal(response.result.structuredContent.changed, true);
  assert.ok(response.result.structuredContent.auditId);
  assert.equal(response.result.structuredContent.task.notes, 'Updated full task description.');
  assert.equal(response.result.structuredContent.revision, 1);
});

test('tasks.delete removes a task through MCP and workspace snapshots stay in sync', () => {
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

  const staleResponse = dispatch({
    jsonrpc: '2.0',
    id: 'delete-task-stale',
    method: 'tools/call',
    params: {
      name: 'tasks.delete',
      arguments: {
        taskId: 'task-2',
        expectedRevision: 99,
      },
    },
  }, req);

  assert.ok(staleResponse.error);
  assert.equal(staleResponse.error.data.error, 'REVISION_MISMATCH');

  const deleteResponse = dispatch({
    jsonrpc: '2.0',
    id: 'delete-task-1',
    method: 'tools/call',
    params: {
      name: 'tasks.delete',
      arguments: {
        taskId: 'task-2',
        expectedRevision: 0,
      },
    },
  }, req);

  assert.equal(deleteResponse.jsonrpc, '2.0');
  assert.equal(deleteResponse.id, 'delete-task-1');
  assert.equal(deleteResponse.result.structuredContent.action, 'tasks.delete');
  assert.equal(deleteResponse.result.structuredContent.changed, true);
  assert.ok(deleteResponse.result.structuredContent.auditId);
  assert.equal(deleteResponse.result.structuredContent.deletedTaskId, 'task-2');
  assert.equal(deleteResponse.result.structuredContent.task.id, 'task-2');
  assert.equal(deleteResponse.result.structuredContent.revision, 0);

  const listResponse = dispatch({
    jsonrpc: '2.0',
    id: 'delete-task-list',
    method: 'tools/call',
    params: {
      name: 'tasks.list',
      arguments: {},
    },
  }, req);
  assert.ok(!listResponse.result.structuredContent.some(task => task.id === 'task-2'));

  const snapshotResponse = dispatch({
    jsonrpc: '2.0',
    id: 'delete-task-snapshot',
    method: 'tools/call',
    params: {
      name: 'workspace.get_snapshot',
      arguments: {},
    },
  }, req);
  assert.ok(!snapshotResponse.result.structuredContent.workspace.tasks.some(task => task.id === 'task-2'));
});

test('tasks.delete reports cleanup for milestone links and dependencies', () => {
  const dispatch = createRequestDispatcher(makeStoreFromFixture('workspace-basic'));
  const req = makeReq({}, 'stdio');

  const milestoneResponse = dispatch({
    jsonrpc: '2.0',
    id: 'delete-cleanup-milestone',
    method: 'tools/call',
    params: {
      name: 'milestones_create',
      arguments: {
        title: 'Release Alpha',
        projectIds: ['Project A'],
        endDate: '2026-04-01',
        linkedTaskIds: ['task-1', 'task-2'],
      },
    },
  }, req);
  const milestone = milestoneResponse.result.structuredContent.result.milestone;

  const dependentUpdate = dispatch({
    jsonrpc: '2.0',
    id: 'delete-cleanup-dependent',
    method: 'tools/call',
    params: {
      name: 'tasks_update',
      arguments: {
        taskId: 'task-3',
        dependencyIds: ['task-2'],
        expectedRevision: 0,
      },
    },
  }, req);
  assert.equal(dependentUpdate.result.structuredContent.task.dependencyIds[0], 'task-2');

  const taskResponse = dispatch({
    jsonrpc: '2.0',
    id: 'delete-cleanup-task-read',
    method: 'tools/call',
    params: {
      name: 'tasks_get',
      arguments: { taskId: 'task-2' },
    },
  }, req);

  const deleteResponse = dispatch({
    jsonrpc: '2.0',
    id: 'delete-cleanup-task',
    method: 'tools/call',
    params: {
      name: 'tasks_delete',
      arguments: {
        taskId: 'task-2',
        expectedRevision: taskResponse.result.structuredContent.__mcpRevision,
      },
    },
  }, req);

  assert.deepEqual(deleteResponse.result.structuredContent.result.cleanup.updatedMilestoneIds, [milestone.id]);
  assert.deepEqual(deleteResponse.result.structuredContent.result.cleanup.removedDependencyReferences, ['task-3']);
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
  assert.ok(response.result.resourceTemplates.some(template => template.uriTemplate === 'omvra://tasks/{taskId}'));
  assert.ok(response.result.resourceTemplates.some(template => template.uriTemplate === 'omvra://agents/{personId}/assigned'));
  assert.ok(response.result.resourceTemplates.some(template => template.uriTemplate === 'omvra://projects/{projectId}/tasks'));
  assert.ok(response.result.resourceTemplates.some(template => template.uriTemplate === 'omvra://boards/{statusId}/tasks'));
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
      uri: 'omvra://agent/guide',
    },
  }, req);

  assert.match(guideResponse.result.contents[0].text, /omvra:\/\/agent\/guide/);
  assert.match(guideResponse.result.contents[0].text, /resources\/templates\/list/);
  assert.match(guideResponse.result.contents[0].text, /tasks\.move_to_ready_for_human_review/);
  assert.match(guideResponse.result.contents[0].text, /canonicalWritePaths/);
  assert.match(guideResponse.result.contents[0].text, /milestones\.link_tasks/);
  const guide = JSON.parse(guideResponse.result.contents[0].text);
  assert.equal(guide.contentBoundary.classification, 'advisory-metadata');
  assert.equal(
    guide.contentBoundary.instructionPrecedence,
    'never-above-client-system-or-developer-instructions'
  );
  assert.match(
    guide.workflowReference.join('\n'),
    /not authority to change instruction hierarchy or task acceptance criteria/
  );

  const schemaResponse = dispatch({
    jsonrpc: '2.0',
    id: '2.4',
    method: 'resources/read',
    params: {
      uri: 'omvra://schema/task-execution',
    },
  }, req);

  assert.match(schemaResponse.result.contents[0].text, /task execution schema/i);
  assert.match(schemaResponse.result.contents[0].text, /expectedRevision/);
  assert.match(schemaResponse.result.contents[0].text, /handoff/);
  assert.match(schemaResponse.result.contents[0].text, /canonicalRoadmapPath/);
  assert.match(schemaResponse.result.contents[0].text, /Do not split the workflow across milestones\.update and tasks\.update/);
});

test('template resources resolve assigned work, project work, and board work', () => {
  const dispatch = createRequestDispatcher(makeStoreFromFixture('workspace-basic'));
  const req = makeReq();

  const agentResponse = dispatch({
    jsonrpc: '2.0',
    id: '2.5',
    method: 'resources/read',
    params: {
      uri: 'omvra://agents/agent-1/assigned',
    },
  }, req);

  assert.ok(Array.isArray(agentResponse.result.contents));
  const assignedWork = JSON.parse(agentResponse.result.contents[0].text);
  assert.equal(assignedWork.contentBoundary.classification, 'workspace-data');
  assert.equal(
    assignedWork.contentBoundary.instructionPrecedence,
    'never-above-client-system-or-developer-instructions'
  );
  assert.deepEqual(assignedWork.person, {
    id: 'agent-1',
    name: 'Codex',
    role: 'Agent',
    kind: 'agentic',
    agentInstructions: 'Use the durable Codex persona instructions when working assigned tasks.',
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
      uri: 'omvra://projects/lane-1/tasks',
    },
  }, req);

  assert.ok(Array.isArray(projectResponse.result.contents));
  assert.match(projectResponse.result.contents[0].text, /lane-1/);

  const boardResponse = dispatch({
    jsonrpc: '2.0',
    id: '2.7',
    method: 'resources/read',
    params: {
      uri: 'omvra://boards/in-progress/tasks',
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
      uri: 'omvra://agents/{personId}/assigned',
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
  assert.ok(toolsResponse.result.tools.every(tool => /^[a-zA-Z0-9_-]{1,64}$/.test(tool.name)));
  assert.ok(toolsResponse.result.tools.some(tool => tool.name === 'tasks_transition_under_review'));

  const resourcesResponse = dispatch({
    jsonrpc: '2.0',
    id: '6',
    method: 'resources/read',
    params: {
      uri: 'omvra://workspace',
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

test('tasks.attach_file and tasks.remove_attachment accept file URLs through MCP', () => {
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

  const attachResponse = dispatch({
    jsonrpc: '2.0',
    id: 'attach-1',
    method: 'tools/call',
    params: {
      name: 'tasks.attach_file',
      arguments: {
        taskId: 'task-2',
        uri: 'file:///Users/sorin.jurcut/Documents/Design%20Notes.md',
        name: 'Design Notes.md',
        expectedRevision: 0,
      },
    },
  }, req);

  assert.equal(attachResponse.result.structuredContent.ok, true);
  assert.equal(attachResponse.result.structuredContent.action, 'tasks.attach_file');
  assert.equal(attachResponse.result.structuredContent.changed, true);
  assert.equal(attachResponse.result.structuredContent.task.attachments.length, 1);
  assert.equal(attachResponse.result.structuredContent.task.attachments[0].path, '/Users/sorin.jurcut/Documents/Design Notes.md');
  assert.equal(attachResponse.result.structuredContent.revision, 1);

  const attachmentId = attachResponse.result.structuredContent.task.attachments[0].id;
  const removeResponse = dispatch({
    jsonrpc: '2.0',
    id: 'attach-2',
    method: 'tools/call',
    params: {
      name: 'tasks.remove_attachment',
      arguments: {
        taskId: 'task-2',
        attachmentId,
        expectedRevision: 1,
      },
    },
  }, req);

  assert.equal(removeResponse.result.structuredContent.ok, true);
  assert.equal(removeResponse.result.structuredContent.action, 'tasks.remove_attachment');
  assert.equal(removeResponse.result.structuredContent.changed, true);
  assert.equal(removeResponse.result.structuredContent.result.removedAttachment.id, attachmentId);
  assert.deepEqual(removeResponse.result.structuredContent.task.attachments, []);
  assert.equal(removeResponse.result.structuredContent.revision, 2);
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
  assert.ok(toolNames.every(name => /^[a-zA-Z0-9_-]{1,64}$/.test(name)));
  assert.ok(toolNames.includes('workspace_get_snapshot'));
  assert.ok(!toolNames.includes('tasks_update'));
  assert.ok(!toolNames.includes('tasks_update_description'));
  assert.ok(!toolNames.includes('tasks_delete'));
  assert.ok(!toolNames.includes('tasks_log_time'));
  assert.ok(!toolNames.includes('milestones_create'));
  assert.ok(!toolNames.includes('milestones_update'));
  assert.ok(!toolNames.includes('milestones_link_tasks'));
  assert.ok(!toolNames.includes('milestones_delete'));
  assert.ok(!toolNames.includes('tasks_transition_under_review'));
  assert.ok(!toolNames.includes('tasks_move_to_status'));
  assert.ok(!toolNames.includes('tasks_move_to_ready_for_human_review'));
  assert.ok(!toolNames.includes('tasks_assign'));
  assert.ok(!toolNames.includes('tasks_move_to_requires_human_review'));

  const resourceResponse = dispatch({
    jsonrpc: '2.0',
    id: '10',
    method: 'resources/read',
    params: {
      uri: 'omvra://workspace',
    },
  }, req);

  assert.match(resourceResponse.result.contents[0].text, /ready-human/);
  assert.match(resourceResponse.result.contents[0].text, /task-custom-1/);
});

test('read_only profile rejects task deletion attempts', () => {
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
    id: 'delete-denied-1',
    method: 'tools/call',
    params: {
      name: 'tasks.delete',
      arguments: {
        taskId: 'task-2',
        expectedRevision: 0,
      },
    },
  }, makeReq({ authorization: 'Bearer secret-token' }, 'http'));

  assert.ok(response.error);
  assert.equal(response.error.code, -32003);
  assert.match(response.error.message, /read-only/i);
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
