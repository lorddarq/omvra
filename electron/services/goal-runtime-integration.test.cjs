const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequestDispatcher } = require('./mcp-http-server.cjs');
const { createGoalLifecycleService } = require('./goal-lifecycle-service.cjs');
const { createGoalRuntimeService } = require('./goal-runtime-service.cjs');
const { updateGoal } = require('./workspace-service.cjs');
const { makeStoreFromFixture, GOALS_KEY } = require('./test-fixtures.cjs');

function request(name, argumentsValue) {
  return {
    jsonrpc: '2.0',
    id: `integration-${name}`,
    method: 'tools/call',
    params: { name, arguments: argumentsValue },
  };
}

function req() {
  return { headers: {}, transport: 'http', socket: { remoteAddress: '127.0.0.1' } };
}

test('renderer/MCP/lifecycle writes converge and rejected writes do not partially mutate canonical records', () => {
  const store = makeStoreFromFixture('workspace-basic', {
    [GOALS_KEY]: [{ id: 'goal-integration', title: 'Integration goal', revision: 0, elements: [{ id: 'node-1', type: 'subgoal', title: 'First', x: 0, y: 0 }] }],
  });
  store.set('omvra.preferences.v1', { mcpAgentAccessEnabled: true, mcpCapabilityProfile: 'task_write' });
  const runtime = createGoalRuntimeService({ store, now: () => '2026-07-20T10:00:00.000Z' });
  const dispatch = createRequestDispatcher(store, { emitRuntimeChange: runtime.emit });

  const rendererUpdate = updateGoal(store, {
    goalId: 'goal-integration', expectedRevision: 0, actor: 'renderer', title: 'Renderer goal',
    elements: [{ id: 'node-1', type: 'subgoal', title: 'Renderer edit', x: 5, y: 5 }], emitRuntimeChange: runtime.emit,
  });
  assert.equal(rendererUpdate.ok, true);
  assert.equal(store.get(GOALS_KEY)[0].revision, 1);
  assert.equal(store.get('omvra.goalRuntimeEvents.v1').at(-1).changeType, 'graph.updated');

  const graphUpdate = dispatch(request('goals.update', {
    goalId: 'goal-integration', expectedRevision: 1, humanConfirmed: true, title: 'Integration goal',
    elements: [{ id: 'node-1', type: 'subgoal', title: 'Updated', x: 10, y: 20 }],
  }), req());
  assert.equal(graphUpdate.result.structuredContent.revision, 2);
  assert.equal(store.get(GOALS_KEY)[0].elements[0].title, 'Updated');

  const beforeRejected = JSON.parse(JSON.stringify(store.get(GOALS_KEY)));
  const stale = dispatch(request('goals.update', {
    goalId: 'goal-integration', expectedRevision: 0, humanConfirmed: true, title: 'Should not apply',
  }), req());
  assert.equal(stale.error.code, -32602);
  assert.equal(stale.error.data.error, 'REVISION_MISMATCH');
  assert.deepEqual(JSON.parse(JSON.stringify(store.get(GOALS_KEY))), beforeRejected);
  assert.equal(store.get('omvra.goalExecutions.v1'), undefined);
  assert.equal(store.get('omvra.goalPolicy.v1'), undefined);
  assert.equal(runtime.get('goal-integration').goal.elements[0].title, 'Updated');
  assert.equal(store.get('omvra.goalRuntimeEvents.v1').at(-1).scope, 'conflict');

  const lifecycle = createGoalLifecycleService({ store, onRuntimeChange: runtime.emit, now: () => '2026-07-20T10:00:01.000Z' });
  const started = lifecycle.execute({ goalId: 'goal-integration', command: 'start', expectedRevision: 0, commandId: 'integration-start' });
  assert.equal(started.ok, true);
  const projection = runtime.get('goal-integration');
  assert.equal(projection.execution.policyRevision, projection.execution.contractPacket.policyRevision);
  assert.equal(projection.execution.executionAttemptId, projection.execution.id);
  assert.equal(store.get('omvra.goalRuntimeEvents.v1').some(event => event.changeType === 'lifecycle.start'), true);
});
