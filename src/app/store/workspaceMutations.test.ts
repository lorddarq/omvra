import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProjectMilestone, Task } from '../types.ts';
import {
  deleteMilestoneFromWorkspace,
  archiveTaskRecords,
  archiveMilestoneRecords,
  linkTaskToMilestones,
  restoreMilestoneRecords,
  restoreTaskRecords,
  saveMilestoneRecord,
  syncMilestoneTaskLinks,
  updateRoadmapTaskDependencies,
} from './workspaceMutations.ts';

test('saveMilestoneRecord upserts milestones and syncMilestoneTaskLinks applies linked task ids', () => {
  const milestone: ProjectMilestone = {
    id: 'milestone-1',
    title: 'Store rollout',
    endDate: '2026-08-01',
    projectId: 'project-1',
    projectIds: ['project-1'],
    linkedTaskIds: ['task-1'],
  };
  const tasks: Task[] = [
    { id: 'task-1', title: 'Wire provider', status: 'open' } as Task,
    { id: 'task-2', title: 'Clean App', status: 'open', milestoneId: 'milestone-1', dependencyIds: ['task-1'] } as Task,
  ];

  assert.deepEqual(saveMilestoneRecord([], milestone), [milestone]);

  const syncedTasks = syncMilestoneTaskLinks(tasks, milestone);
  assert.equal(syncedTasks[0].milestoneId, 'milestone-1');
  assert.equal(syncedTasks[1].milestoneId, undefined);
  assert.deepEqual(syncedTasks[1].dependencyIds, []);
});

test('linkTaskToMilestones moves links and deleteMilestoneFromWorkspace clears task links and dependencies', () => {
  const milestones: ProjectMilestone[] = [
    {
      id: 'milestone-1',
      title: 'Store rollout',
      endDate: '2026-08-01',
      projectId: 'project-1',
      projectIds: ['project-1'],
      linkedTaskIds: ['task-1'],
    },
    {
      id: 'milestone-2',
      title: 'Polish',
      endDate: '2026-08-15',
      projectId: 'project-1',
      projectIds: ['project-1'],
      linkedTaskIds: [],
    },
  ];
  const relinked = linkTaskToMilestones(milestones, 'task-1', 'milestone-2');
  assert.deepEqual(relinked[0].linkedTaskIds, []);
  assert.deepEqual(relinked[1].linkedTaskIds, ['task-1']);

  const workspaceAfterDelete = deleteMilestoneFromWorkspace(
    [
      { id: 'task-1', title: 'Wire provider', status: 'open', milestoneId: 'milestone-2', dependencyIds: ['task-9'] } as Task,
      { id: 'task-2', title: 'Polish tests', status: 'open', dependencyIds: [] } as Task,
    ],
    relinked,
    'milestone-2'
  );

  assert.deepEqual(workspaceAfterDelete.milestones.map(milestone => milestone.id), ['milestone-1']);
  assert.equal(workspaceAfterDelete.tasks[0].milestoneId, undefined);
  assert.deepEqual(workspaceAfterDelete.tasks[0].dependencyIds, []);
});

test('updateRoadmapTaskDependencies replaces dependency ids by task id', () => {
  const tasks: Task[] = [
    { id: 'task-1', title: 'Wire provider', status: 'open', dependencyIds: [] } as Task,
    { id: 'task-2', title: 'Polish tests', status: 'open', dependencyIds: ['task-1'] } as Task,
  ];

  const updated = updateRoadmapTaskDependencies(tasks, [
    { taskId: 'task-2', dependencyIds: ['task-9', 'task-10'] },
  ]);

  assert.deepEqual(updated[0].dependencyIds, []);
  assert.deepEqual(updated[1].dependencyIds, ['task-9', 'task-10']);
});

test('archiveTaskRecords blocks active dependency conflicts and archives safe tasks', () => {
  const tasks: Task[] = [
    { id: 'dependency', title: 'Dependency', status: 'open', archived: false } as Task,
    { id: 'blocked', title: 'Blocked', status: 'done', dependencyIds: ['dependency'] } as Task,
    { id: 'safe', title: 'Safe', status: 'done' } as Task,
  ];
  const result = archiveTaskRecords(tasks, ['blocked', 'safe'], '2026-09-21T00:00:00.000Z');
  assert.deepEqual(result.blockedTaskIds, ['blocked']);
  assert.equal(result.tasks.find(task => task.id === 'blocked')?.archived, undefined);
  assert.equal(result.tasks.find(task => task.id === 'safe')?.archived, true);
});

test('restoreTaskRecords restores required archived dependencies and milestones restore linked tasks', () => {
  const tasks: Task[] = [
    { id: 'root', title: 'Root', status: 'done', archived: true, dependencyIds: [] } as Task,
    { id: 'linked', title: 'Linked', status: 'done', archived: true, dependencyIds: ['root'] } as Task,
  ];
  const restored = restoreTaskRecords(tasks, ['linked']);
  assert.equal(restored.every(task => task.archived === false), true);

  const milestone: ProjectMilestone = {
    id: 'milestone-1', title: 'Archived milestone', endDate: '2026-08-01', projectIds: ['project-1'], linkedTaskIds: ['linked'], archived: true,
  };
  const restoredMilestone = restoreMilestoneRecords(tasks, [milestone], ['milestone-1']);
  assert.equal(restoredMilestone.milestones[0].archived, false);
  assert.equal(restoredMilestone.tasks.find(task => task.id === 'linked')?.archived, false);
});

test('archiveMilestoneRecords archives milestones without changing linked tasks', () => {
  const milestone: ProjectMilestone = {
    id: 'milestone-1', title: 'Release', endDate: '2026-08-01', projectIds: ['project-1'], linkedTaskIds: ['task-1'],
  };
  const archived = archiveMilestoneRecords([milestone], ['milestone-1'], '2026-09-21T00:00:00.000Z');
  assert.equal(archived[0].archived, true);
  assert.deepEqual(archived[0].linkedTaskIds, ['task-1']);
});

test('bulk archive accepts complete dependency groups and preserves archive timestamps', () => {
  const tasks = [{ id: 'a', title: 'A', status: 'done' }, { id: 'b', title: 'B', status: 'done', dependencyIds: ['a'] }] as Task[];
  const result = archiveTaskRecords(tasks, ['a', 'b'], '2026-09-21T00:00:00.000Z');
  assert.deepEqual(result.blockedTaskIds, []);
  assert.equal(result.tasks.every(task => task.archived), true);
  assert.deepEqual(archiveTaskRecords(result.tasks, ['a', 'b'], '2026-09-22T00:00:00.000Z').tasks, result.tasks);
});
