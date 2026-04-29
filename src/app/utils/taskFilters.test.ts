import test from 'node:test';
import assert from 'node:assert/strict';
import type { Person, Task, TimelineSwimlane } from '../types.ts';
import {
  EMPTY_KANBAN_TASK_FILTERS,
  UNASSIGNED_ASSIGNEE_FILTER_VALUE,
  clearAllKanbanTaskFilters,
  clearKanbanTaskFilter,
  filterKanbanTasks,
  hasActiveKanbanTaskFilters,
  sanitizeKanbanTaskFilters,
  taskMatchesKanbanFilters,
} from './taskFilters.ts';

const projects: TimelineSwimlane[] = [
  { id: 'project-1', name: 'Launch' },
  { id: 'project-2', name: 'Design' },
];

const people: Person[] = [
  { id: 'person-1', name: 'Ada', role: 'Engineer', kind: 'human' },
  { id: 'person-2', name: 'Codex', role: 'Agent', kind: 'agentic' },
];

const tasks: Task[] = [
  {
    id: 'task-1',
    title: 'Ready engine',
    status: 'open',
    projectIds: ['project-1'],
    priority: 'urgent',
    assigneeId: 'person-1',
  },
  {
    id: 'task-2',
    title: 'Draft checklist',
    status: 'in-progress',
    projectIds: ['project-1', 'project-2'],
    priority: 'low',
  },
  {
    id: 'task-3',
    title: 'Legacy design task',
    status: 'under-review',
    swimlaneId: 'project-2',
    priority: 'normal',
    assigneeId: 'person-2',
  },
];

test('sanitizeKanbanTaskFilters keeps valid values and explicit Unassigned', () => {
  assert.deepEqual(
    sanitizeKanbanTaskFilters(
      {
        projectId: ' project-1 ',
        priority: 'urgent',
        assigneeId: UNASSIGNED_ASSIGNEE_FILTER_VALUE,
      },
      projects,
      people
    ),
    {
      projectId: 'project-1',
      priority: 'urgent',
      assigneeId: UNASSIGNED_ASSIGNEE_FILTER_VALUE,
    }
  );
});

test('sanitizeKanbanTaskFilters drops stale project, stale assignee, and invalid priority values', () => {
  assert.deepEqual(
    sanitizeKanbanTaskFilters(
      {
        projectId: 'missing-project',
        priority: 'someday',
        assigneeId: 'missing-person',
      },
      projects,
      people
    ),
    EMPTY_KANBAN_TASK_FILTERS
  );
});

test('taskMatchesKanbanFilters combines project, priority, and assignee with AND behavior', () => {
  assert.equal(
    taskMatchesKanbanFilters(tasks[0], {
      projectId: 'project-1',
      priority: 'urgent',
      assigneeId: 'person-1',
    }),
    true
  );

  assert.equal(
    taskMatchesKanbanFilters(tasks[0], {
      projectId: 'project-1',
      priority: 'low',
      assigneeId: 'person-1',
    }),
    false
  );
});

test('taskMatchesKanbanFilters supports explicit Unassigned assignee filtering', () => {
  assert.equal(
    taskMatchesKanbanFilters(tasks[1], {
      assigneeId: UNASSIGNED_ASSIGNEE_FILTER_VALUE,
    }),
    true
  );

  assert.equal(
    taskMatchesKanbanFilters(tasks[0], {
      assigneeId: UNASSIGNED_ASSIGNEE_FILTER_VALUE,
    }),
    false
  );
});

test('project filtering falls back to swimlaneId for legacy Kanban tasks', () => {
  assert.equal(taskMatchesKanbanFilters(tasks[2], { projectId: 'project-2' }), true);
  assert.equal(taskMatchesKanbanFilters(tasks[2], { projectId: 'project-1' }), false);
});

test('filterKanbanTasks returns tasks matching all active filters', () => {
  assert.deepEqual(
    filterKanbanTasks(tasks, {
      projectId: 'project-1',
      assigneeId: UNASSIGNED_ASSIGNEE_FILTER_VALUE,
    }).map(task => task.id),
    ['task-2']
  );
});

test('clear helpers support individual clear and clear all', () => {
  const filters = {
    projectId: 'project-1',
    priority: 'urgent' as const,
    assigneeId: 'person-1',
  };

  assert.deepEqual(clearKanbanTaskFilter(filters, 'priority'), {
    projectId: 'project-1',
    assigneeId: 'person-1',
  });
  assert.deepEqual(clearAllKanbanTaskFilters(), EMPTY_KANBAN_TASK_FILTERS);
  assert.equal(hasActiveKanbanTaskFilters(filters), true);
  assert.equal(hasActiveKanbanTaskFilters(clearAllKanbanTaskFilters()), false);
});
