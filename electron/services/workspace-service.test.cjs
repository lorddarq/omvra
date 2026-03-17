const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MCP_TASK_REV_FIELD,
  getWorkspaceSnapshot,
  listTasks,
  listKanbanCards,
  listTimelineCards,
  transitionTaskToUnderReview,
  updateTaskAgentSummary,
  moveTasksToRequiresHumanReviewBoard,
  REQUIRES_HUMAN_REVIEW_STATUS_ID,
} = require('./workspace-service.cjs');

const PREFERENCES_KEY = 'plumy.preferences.v1';
const TASKS_KEY = 'plumy.tasks.v1';
const PEOPLE_KEY = 'plumy.people.v1';
const SWIMLANES_KEY = 'plumy.swimlanes.v1';
const STATUS_COLUMNS_KEY = 'plumy.statusColumns.v1';

class MemoryStore {
  constructor(seed = {}) {
    this.map = new Map(Object.entries(seed));
  }

  get(key) {
    return this.map.get(key);
  }

  set(key, value) {
    this.map.set(key, value);
  }
}

function makeStore() {
  return new MemoryStore({
    [PREFERENCES_KEY]: {
      mcpAgentAccessEnabled: true,
      mcpCapabilityProfile: 'task_write',
    },
    [SWIMLANES_KEY]: [
      { id: 'lane-1', name: 'Project A' },
      { id: 'lane-2', name: 'Project B' },
    ],
    [STATUS_COLUMNS_KEY]: [
      { id: 'open', title: 'Open' },
      { id: 'in-progress', title: 'In Progress' },
      { id: 'under-review', title: 'In Review' },
    ],
    [PEOPLE_KEY]: [
      { id: 'person-1', name: 'Alex', kind: 'human' },
      { id: 'agent-1', name: 'Codex', kind: 'agentic' },
    ],
    [TASKS_KEY]: [
      {
        id: 'task-1',
        title: 'Build timeline',
        notes: 'Implement drag',
        status: 'in-progress',
        assigneeId: 'agent-1',
        swimlaneId: 'lane-1',
        startDate: '2026-03-17',
        endDate: '2026-03-20',
        projectIds: ['lane-1'],
      },
      {
        id: 'task-2',
        title: 'Review cards',
        notes: 'Card checks',
        status: 'open',
        assigneeId: 'person-1',
        swimlaneId: 'lane-2',
        startDate: '2026-03-18',
        endDate: '2026-03-19',
        projectIds: ['lane-2'],
      },
      {
        id: 'task-3',
        title: 'Write docs',
        notes: [
          'Project: Mission Control',
          'Repo: github.com/acme/plumy',
          'See https://github.com/acme/plumy/issues/10',
        ].join('\n'),
        status: 'under-review',
        assigneeId: 'agent-1',
        swimlaneId: 'lane-1',
        startDate: '2026-03-25',
        endDate: '2026-03-27',
        projectIds: ['lane-1'],
      },
    ],
  });
}

test('workspace snapshot contract has expected keys and stable counts', () => {
  const store = makeStore();
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

test('kanban cards parity: cards.kanban.list aligns with listTasks filters by id', () => {
  const store = makeStore();
  const filters = { status: 'in-progress', assigneeId: 'agent-1', search: 'drag' };

  const taskIds = listTasks(store, filters).map(task => task.id).sort();
  const cardIds = listKanbanCards(store, filters).map(card => card.id).sort();

  assert.deepEqual(cardIds, taskIds);
});

test('timeline cards parity: cards.timeline.list aligns with lane/date semantics', () => {
  const store = makeStore();
  const filters = { laneId: 'lane-1', startDate: '2026-03-17', endDate: '2026-03-21' };

  const timelineCards = listTimelineCards(store, filters);
  const timelineIds = timelineCards.map(card => card.id).sort();

  assert.deepEqual(timelineIds, ['task-1']);
});

test('safe write transition uses optimistic revision and agentic constraints', () => {
  const store = makeStore();
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

test('agent summary update requires revision and increments revision', () => {
  const store = makeStore();
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

test('task normalization extracts project context from description notes', () => {
  const store = makeStore();
  const task = listTasks(store, { status: 'under-review' })[0];
  assert.ok(task.descriptionProjectContext);
  assert.deepEqual(task.descriptionProjectContext.projectMentions, ['Mission Control']);
  assert.ok(task.descriptionProjectContext.repoHints.some(value => value.includes('github.com/acme/plumy')));
  assert.ok(task.descriptionProjectContext.urls.some(value => value.includes('github.com/acme/plumy/issues/10')));
});

test('creates Requires human review board and moves qualifying tasks', () => {
  const store = makeStore();
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
