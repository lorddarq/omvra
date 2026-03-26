const test = require('node:test');
const assert = require('node:assert/strict');
const { STATUS_COLUMNS_KEY, TASKS_KEY, makeStoreFromFixture } = require('./test-fixtures.cjs');

const {
  MCP_TASK_REV_FIELD,
  MCP_BOARD_WATCHERS_KEY,
  getMcpServerConfig,
  getMcpAccessTokenStatus,
  isMcpAccessTokenExpired,
  buildMcpListenerStatus,
  appendMcpAuditLog,
  getWorkspaceSnapshot,
  listTasks,
  listKanbanCards,
  listTimelineCards,
  listMcpAuditLog,
  listBoardWatcherStates,
  pollBoardWatcher,
  transitionTaskToUnderReview,
  updateTaskAgentSummary,
  addTaskComment,
  addTaskActivityEntry,
  updateTaskCompletionDescription,
  moveTasksToRequiresHumanReviewBoard,
  moveTaskToStatus,
  moveTaskToReadyForHumanReview,
  assignTaskToPerson,
  REQUIRES_HUMAN_REVIEW_STATUS_ID,
} = require('./workspace-service.cjs');

test('workspace snapshot contract has expected keys and stable counts', () => {
  const store = makeStoreFromFixture('workspace-basic');
  const snapshot = getWorkspaceSnapshot(store);

  assert.equal(snapshot.schemaVersion, '1');
  assert.equal(snapshot.readOnly, true);
  assert.ok(snapshot.generatedAt);
  assert.ok(snapshot.workspace);
  assert.ok(Array.isArray(snapshot.workspace.tasks));
  assert.ok(Array.isArray(snapshot.workspace.people));
  assert.ok(Array.isArray(snapshot.workspace.projects));
  assert.ok(Array.isArray(snapshot.workspace.statusColumns));
  assert.equal(snapshot.meta.counts.tasks, snapshot.workspace.tasks.length);
  assert.equal(snapshot.meta.counts.people, snapshot.workspace.people.length);
  assert.equal(snapshot.meta.counts.projects, snapshot.workspace.projects.length);
  assert.equal(snapshot.meta.counts.statusColumns, snapshot.workspace.statusColumns.length);
});

test('listener status reflects runtime state and token expiry details', () => {
  const store = makeStoreFromFixture('workspace-mcp-security');
  const serverConfig = getMcpServerConfig(store);
  const tokenStatus = getMcpAccessTokenStatus(serverConfig, Date.parse('2026-03-26T09:59:00.000Z'));

  assert.equal(tokenStatus.configured, true);
  assert.equal(tokenStatus.status, 'active');
  assert.equal(isMcpAccessTokenExpired(serverConfig, Date.parse('2026-03-26T09:59:00.000Z')), false);

  const listenerStatus = buildMcpListenerStatus(store, {
    status: 'running',
    listening: true,
    boundAddress: '127.0.0.1:3456',
    boundUrl: 'http://127.0.0.1:3456/mcp',
    lastStartedAt: '2026-03-26T09:58:00.000Z',
  });

  assert.equal(listenerStatus.enabled, true);
  assert.equal(listenerStatus.status, 'running');
  assert.equal(listenerStatus.listening, true);
  assert.equal(listenerStatus.boundUrl, 'http://127.0.0.1:3456/mcp');
  assert.equal(listenerStatus.token.status, 'active');
  assert.equal(listenerStatus.authMode, 'token');
});

test('audit log returns most recent entries first and respects limit', () => {
  const store = makeStoreFromFixture('workspace-basic');

  appendMcpAuditLog(store, { type: 'mcp_write_attempt', toolName: 'tasks.assign', outcome: 'allowed' });
  appendMcpAuditLog(store, { type: 'mcp_write_attempt', toolName: 'tasks.move_to_status', outcome: 'allowed' });
  appendMcpAuditLog(store, { type: 'mcp_write_attempt', toolName: 'tasks.update_agent_summary', outcome: 'denied' });

  const recent = listMcpAuditLog(store, { limit: 2 });
  assert.equal(recent.length, 2);
  assert.equal(recent[0].toolName, 'tasks.update_agent_summary');
  assert.equal(recent[1].toolName, 'tasks.move_to_status');
  assert.ok(recent.every(entry => typeof entry.auditId === 'string' && entry.auditId.startsWith('audit-')));
});

test('kanban cards parity: cards.kanban.list aligns with listTasks filters by id', () => {
  const store = makeStoreFromFixture('workspace-basic');
  const filters = { status: 'in-progress', assigneeId: 'agent-1', search: 'drag' };

  const taskIds = listTasks(store, filters).map(task => task.id).sort();
  const cardIds = listKanbanCards(store, filters).map(card => card.id).sort();

  assert.deepEqual(cardIds, taskIds);
});

test('timeline cards parity: cards.timeline.list aligns with lane/date semantics', () => {
  const store = makeStoreFromFixture('workspace-basic');
  const filters = { laneId: 'lane-1', startDate: '2026-03-17', endDate: '2026-03-21' };

  const timelineCards = listTimelineCards(store, filters);
  const timelineIds = timelineCards.map(card => card.id).sort();

  assert.deepEqual(timelineIds, ['task-1']);
});

test('safe write transition uses optimistic revision and agentic constraints', () => {
  const store = makeStoreFromFixture('workspace-basic');
  const firstRead = listTasks(store, { status: 'in-progress', assigneeId: 'agent-1' })[0];
  const revision = firstRead[MCP_TASK_REV_FIELD];

  const mismatch = transitionTaskToUnderReview(store, {
    taskId: firstRead.id,
    expectedRevision: revision + 1,
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.error, 'REVISION_MISMATCH');

  const success = transitionTaskToUnderReview(store, {
    taskId: firstRead.id,
    expectedRevision: revision,
  });
  assert.equal(success.ok, true);
  assert.equal(success.task.status, 'under-review');
  assert.equal(success.task[MCP_TASK_REV_FIELD], revision + 1);
});

test('moveTaskToStatus validates target by title and id', () => {
  const store = makeStoreFromFixture('workspace-basic');
  const task = listTasks(store, { status: 'open' })[0];
  const revision = task[MCP_TASK_REV_FIELD];

  const byTitle = moveTaskToStatus(store, {
    taskId: task.id,
    statusTitle: 'Done',
    expectedRevision: revision,
  });
  assert.equal(byTitle.ok, true);
  assert.equal(byTitle.task.status, 'done');
  assert.equal(byTitle.task[MCP_TASK_REV_FIELD], revision + 1);

  const byId = moveTaskToStatus(store, {
    taskId: task.id,
    statusId: 'in-progress',
    expectedRevision: byTitle.task[MCP_TASK_REV_FIELD],
  });
  assert.equal(byId.ok, true);
  assert.equal(byId.task.status, 'in-progress');
  assert.equal(byId.task[MCP_TASK_REV_FIELD], revision + 2);
});

test('moveTaskToReadyForHumanReview creates the board and moves the task', () => {
  const store = makeStoreFromFixture('workspace-basic');
  const task = listTasks(store, { status: 'under-review' })[0];
  const revision = task[MCP_TASK_REV_FIELD];

  const result = moveTaskToReadyForHumanReview(store, {
    taskId: task.id,
    expectedRevision: revision,
  });

  assert.equal(result.ok, true);
  assert.equal(result.statusId, 'ready-human');
  assert.equal(result.statusCreated, true);
  assert.equal(result.task.status, 'ready-human');
  assert.equal(result.task[MCP_TASK_REV_FIELD], revision + 1);
});

test('assignTaskToPerson resolves assignees by name and id', () => {
  const store = makeStoreFromFixture('workspace-basic');
  const task = listTasks(store, { status: 'open' })[0];
  const revision = task[MCP_TASK_REV_FIELD];

  const byName = assignTaskToPerson(store, {
    taskId: task.id,
    assigneeName: 'Codex',
    assigneeKind: 'agentic',
    expectedRevision: revision,
  });
  assert.equal(byName.ok, true);
  assert.equal(byName.task.assigneeId, 'agent-1');
  assert.equal(byName.task[MCP_TASK_REV_FIELD], revision + 1);

  const byId = assignTaskToPerson(store, {
    taskId: task.id,
    assigneeId: 'person-1',
    assigneeKind: 'human',
    expectedRevision: byName.task[MCP_TASK_REV_FIELD],
  });
  assert.equal(byId.ok, true);
  assert.equal(byId.task.assigneeId, 'person-1');
  assert.equal(byId.task[MCP_TASK_REV_FIELD], revision + 2);
});

test('agent summary update requires revision and increments revision', () => {
  const store = makeStoreFromFixture('workspace-basic');
  const task = listTasks(store, { status: 'open' })[0];
  const revision = task[MCP_TASK_REV_FIELD];

  const updated = updateTaskAgentSummary(store, {
    taskId: task.id,
    summary: 'Implemented and ready for review',
    expectedRevision: revision,
  });

  assert.equal(updated.ok, true);
  assert.equal(updated.task.agentSummary, 'Implemented and ready for review');
  assert.equal(updated.task[MCP_TASK_REV_FIELD], revision + 1);
});

test('task comments are appended structurally and increment revision', () => {
  const store = makeStoreFromFixture('workspace-basic');
  const task = listTasks(store, { status: 'open' })[0];
  const revision = task[MCP_TASK_REV_FIELD];

  const commented = addTaskComment(store, {
    taskId: task.id,
    comment: 'Need a pass on hover states before merging.',
    author: 'Codex',
    expectedRevision: revision,
  });

  assert.equal(commented.ok, true);
  assert.equal(commented.task.comments.length, 1);
  assert.equal(commented.task.comments[0].author, 'Codex');
  assert.equal(commented.task.comments[0].content, 'Need a pass on hover states before merging.');
  assert.equal(commented.task[MCP_TASK_REV_FIELD], revision + 1);
});

test('task activity entries are appended structurally and increment revision', () => {
  const store = makeStoreFromFixture('workspace-basic');
  const task = listTasks(store, { status: 'open' })[0];
  const revision = task[MCP_TASK_REV_FIELD];

  const updated = addTaskActivityEntry(store, {
    taskId: task.id,
    message: 'Agent picked up the task and started repository inspection.',
    type: 'activity',
    expectedRevision: revision,
  });

  assert.equal(updated.ok, true);
  assert.equal(updated.task.activityLog.length, 1);
  assert.equal(updated.task.activityLog[0].type, 'activity');
  assert.match(updated.task.activityLog[0].message, /started repository inspection/);
  assert.equal(updated.task[MCP_TASK_REV_FIELD], revision + 1);
});

test('task normalization extracts project context from description notes', () => {
  const store = makeStoreFromFixture('workspace-basic');
  const task = listTasks(store, { status: 'under-review' })[0];
  assert.ok(task.descriptionProjectContext);
  assert.deepEqual(task.descriptionProjectContext.projectMentions, ['Mission Control']);
  assert.ok(task.descriptionProjectContext.repoHints.some(value => value.includes('github.com/acme/plumy')));
  assert.ok(task.descriptionProjectContext.urls.some(value => value.includes('github.com/acme/plumy/issues/10')));
});

test('creates Requires human review board and moves qualifying tasks', () => {
  const store = makeStoreFromFixture('workspace-basic');
  const result = moveTasksToRequiresHumanReviewBoard(store, { includeDone: false });

  assert.equal(result.statusId, REQUIRES_HUMAN_REVIEW_STATUS_ID);
  assert.equal(result.totalMoved, 1);
  assert.ok(result.movedTaskIds.includes('task-3'));

  const statusColumns = store.get(STATUS_COLUMNS_KEY);
  assert.ok(statusColumns.some(col => col.id === REQUIRES_HUMAN_REVIEW_STATUS_ID));

  const updatedTasks = store.get(TASKS_KEY);
  const moved = updatedTasks.filter(task => result.movedTaskIds.includes(task.id));
  assert.ok(moved.every(task => task.status === REQUIRES_HUMAN_REVIEW_STATUS_ID));
});

test('completion description update appends brief completion section and is idempotent', () => {
  const store = makeStoreFromFixture('workspace-basic');
  const task = listTasks(store, { status: 'open' })[0];
  const rev = task[MCP_TASK_REV_FIELD];

  const first = updateTaskCompletionDescription(store, {
    taskId: task.id,
    completion: 'Implemented final drag behaviour and fixed edge-case snapping.',
    expectedRevision: rev,
  });
  assert.equal(first.ok, true);
  assert.match(first.task.notes, /### Agent Completion/);
  assert.match(first.task.notes, /Implemented final drag behaviour/);

  const second = updateTaskCompletionDescription(store, {
    taskId: task.id,
    completion: 'Reworked it again with a shorter update.',
    expectedRevision: rev + 1,
  });
  assert.equal(second.ok, true);
  const sectionCount = (second.task.notes.match(/### Agent Completion/g) || []).length;
  assert.equal(sectionCount, 1);
  assert.match(second.task.notes, /Reworked it again with a shorter update\./);
});

test('custom status fixture is preserved in workspace snapshot and task filters', () => {
  const store = makeStoreFromFixture('workspace-custom-status');
  const snapshot = getWorkspaceSnapshot(store);
  const task = listTasks(store, { status: 'ideas' })[0];

  assert.ok(snapshot.workspace.statusColumns.some(column => column.id === 'ideas'));
  assert.equal(task.id, 'task-custom-1');
  assert.equal(task.status, 'ideas');
});

test('board watcher poll suppresses duplicates and persists watcher state', () => {
  const store = makeStoreFromFixture('workspace-basic');

  const first = pollBoardWatcher(store, {
    statusId: 'in-progress',
    assigneeId: 'agent-1',
  });

  assert.equal(first.ok, true);
  assert.equal(first.changes.newTasks.length, 1);
  assert.equal(first.changes.updatedTasks.length, 0);
  assert.equal(first.changes.removedTaskIds.length, 0);
  assert.equal(first.board.taskCount, 1);
  assert.equal(first.changes.newTasks[0].id, 'task-1');

  const persisted = listBoardWatcherStates(store);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].watcherId, first.watcherState.watcherId);
  assert.deepEqual(persisted[0].lastSeenTaskIds, ['task-1']);
  assert.ok(persisted[0].lastProcessedAt);

  const second = pollBoardWatcher(store, {
    watcherId: first.watcherState.watcherId,
    statusId: 'in-progress',
    assigneeId: 'agent-1',
  });

  assert.equal(second.ok, true);
  assert.equal(second.changes.newTasks.length, 0);
  assert.equal(second.changes.updatedTasks.length, 0);
  assert.equal(second.changes.removedTaskIds.length, 0);

  const tasks = store.get(TASKS_KEY);
  store.set(require('./test-fixtures.cjs').TASKS_KEY, tasks.map(task => {
    if (task.id !== 'task-1') return task;
    return {
      ...task,
      title: 'Build timeline and watcher',
      notes: `${task.notes} with a fresh pass`,
      [MCP_TASK_REV_FIELD]: Number(task[MCP_TASK_REV_FIELD] || 0) + 1,
    };
  }));

  const third = pollBoardWatcher(store, {
    watcherId: first.watcherState.watcherId,
    statusId: 'in-progress',
    assigneeId: 'agent-1',
  });

  assert.equal(third.ok, true);
  assert.equal(third.changes.newTasks.length, 0);
  assert.deepEqual(third.changes.updatedTasks.map(task => task.id), ['task-1']);
  assert.equal(third.changes.removedTaskIds.length, 0);
  assert.match(third.changes.updatedTasks[0].notes, /fresh pass/);

  const watcherStoreValue = store.get(MCP_BOARD_WATCHERS_KEY);
  assert.ok(Array.isArray(watcherStoreValue));
  assert.equal(watcherStoreValue[0].watcherId, first.watcherState.watcherId);
});
