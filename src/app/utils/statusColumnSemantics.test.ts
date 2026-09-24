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
    { id: 'task-1', title: 'Active', status: 'open', startDate: '2026-01-01', endDate: '2026-01-02' },
    { id: 'task-2', title: 'Released', status: 'shipped', startDate: '2026-01-01', endDate: '2026-01-02' },
  ] as Task[];

  assert.deepEqual(filterTimelineTasks(tasks, columns, false).map(task => task.id), ['task-1']);
  assert.deepEqual(filterTimelineTasks(tasks, columns, true).map(task => task.id), ['task-1', 'task-2']);
});

test('filterTimelineTasks supports archive-heavy restored data explicitly', () => {
  const columns: StatusColumn[] = [{ id: 'open', title: 'Open', color: '#06b6d4', roadmapStage: 'not-started' }];
  const tasks = [
    { id: 'active', title: 'Active', status: 'open', startDate: '2026-01-01', endDate: '2026-01-02' },
    { id: 'archived', title: 'Historical', status: 'open', startDate: '2026-01-01', endDate: '2026-01-02', archived: true, archivedAt: '2025-01-01T00:00:00.000Z' },
  ] as Task[];

  assert.deepEqual(filterTimelineTasks(tasks, columns, false).map(task => task.id), ['active']);
  assert.deepEqual(filterTimelineTasks(tasks, columns, false, 'archived').map(task => task.id), ['archived']);
  assert.deepEqual(filterTimelineTasks(tasks, columns, false, 'all').map(task => task.id), ['active', 'archived']);
});

test('filterTimelineTasks keeps unscheduled tasks off the Timeline independently of status and archive state', () => {
  const columns: StatusColumn[] = [
    { id: 'open', title: 'Open', color: '#06b6d4', roadmapStage: 'not-started' },
    { id: 'done', title: 'Done', color: '#10b981', roadmapStage: 'complete' },
  ];
  const tasks = [
    { id: 'scheduled', title: 'Scheduled', status: 'open', startDate: '2026-09-24', endDate: '2026-09-29' },
    { id: 'one-day', title: 'Start only', status: 'open', startDate: '2026-09-24' },
    { id: 'unscheduled', title: 'Parked', status: 'open' },
    { id: 'unscheduled-done', title: 'Parked done', status: 'done' },
    { id: 'unscheduled-archived', title: 'Parked archived', status: 'open', archived: true },
    { id: 'end-only', title: 'End only', status: 'open', endDate: '2026-09-24' },
    { id: 'inverted', title: 'Inverted', status: 'open', startDate: '2026-09-29', endDate: '2026-09-24' },
  ] as Task[];

  assert.deepEqual(filterTimelineTasks(tasks, columns, true, 'all').map(task => task.id), ['scheduled', 'one-day']);
});

test('rescheduling an unscheduled task returns it to the Timeline without touching other fields', () => {
  const columns: StatusColumn[] = [{ id: 'in-progress', title: 'In Progress', color: '#06b6d4', roadmapStage: 'in-progress' }];
  const parked = {
    id: 'parked',
    title: 'Parked',
    status: 'in-progress',
    assigneeId: 'agent-1',
    dependencyIds: ['dep-1'],
    archived: false,
    collaboration: { schemaVersion: 1, contributions: [] },
  } as unknown as Task;
  assert.deepEqual(filterTimelineTasks([parked], columns, false), []);

  const rescheduled = { ...parked, startDate: '2026-10-01', endDate: '2026-10-03' };
  const [visible] = filterTimelineTasks([rescheduled], columns, false);
  assert.equal(visible, rescheduled);
  const { startDate: _start, endDate: _end, ...unchanged } = visible;
  assert.deepEqual(unchanged, parked);
});
