import test from 'node:test';
import assert from 'node:assert/strict';
import type { StatusColumn, Task } from '../types.ts';
import { filterTimelineTasks } from './statusColumnSemantics.ts';

test('filterTimelineTasks hides complete-stage tasks until requested', () => {
  const columns: StatusColumn[] = [
    { id: 'open', title: 'Open', color: '#06b6d4', roadmapStage: 'not-started' },
    { id: 'shipped', title: 'Shipped', color: '#10b981', roadmapStage: 'complete' },
  ];
  const tasks = [
    { id: 'task-1', title: 'Active', status: 'open' },
    { id: 'task-2', title: 'Released', status: 'shipped' },
  ] as Task[];

  assert.deepEqual(filterTimelineTasks(tasks, columns, false).map(task => task.id), ['task-1']);
  assert.deepEqual(filterTimelineTasks(tasks, columns, true).map(task => task.id), ['task-1', 'task-2']);
});
