import test from 'node:test';
import assert from 'node:assert/strict';
import type { Task } from '../types.ts';
import {
  applyTimelineTaskDrop,
  canDropTimelineTaskInRow,
  getTimelineTaskProjectIds,
} from './timelineTaskDrop.ts';

test('project-mode drops are limited to assigned project rows', () => {
  const task: Task = {
    id: 'task-1',
    title: 'Implement drag rule',
    status: 'open',
    projectIds: ['lane-1', 'lane-2'],
    swimlaneId: 'lane-1',
    startDate: '2026-03-28',
    endDate: '2026-03-29',
  };

  assert.equal(canDropTimelineTaskInRow(task, 'lane-2', 'projects'), true);
  assert.equal(canDropTimelineTaskInRow(task, 'lane-3', 'projects'), false);
});

test('project-mode drops fall back to swimlaneId when projectIds are missing', () => {
  const task: Task = {
    id: 'task-2',
    title: 'Legacy project task',
    status: 'open',
    swimlaneId: 'lane-9',
  };

  assert.deepEqual(getTimelineTaskProjectIds(task), ['lane-9']);
  assert.equal(canDropTimelineTaskInRow(task, 'lane-9', 'projects'), true);
  assert.equal(canDropTimelineTaskInRow(task, 'lane-1', 'projects'), false);
});

test('applyTimelineTaskDrop blocks invalid project moves and preserves the original task', () => {
  const task: Task = {
    id: 'task-3',
    title: 'Stay in assigned project',
    status: 'in-progress',
    projectIds: ['lane-1'],
    swimlaneId: 'lane-1',
    startDate: '2026-03-28',
    endDate: '2026-03-29',
  };

  const unchanged = applyTimelineTaskDrop(task, 'lane-2', 'projects', '2026-03-30', '2026-03-31');
  assert.equal(unchanged, task);
});

test('applyTimelineTaskDrop still allows people-mode reassignment', () => {
  const task: Task = {
    id: 'task-4',
    title: 'Reassign owner',
    status: 'under-review',
    projectIds: ['lane-1'],
    swimlaneId: 'lane-1',
    assigneeId: 'person-1',
  };

  const updated = applyTimelineTaskDrop(task, 'person-2', 'people');

  assert.notEqual(updated, task);
  assert.equal(updated.assigneeId, 'person-2');
  assert.equal(updated.swimlaneId, 'lane-1');
});
