import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProjectMilestone, Task } from '../types.ts';
import {
  deleteMilestoneFromWorkspace,
  linkTaskToMilestones,
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
