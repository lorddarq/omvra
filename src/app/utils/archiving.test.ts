import test from 'node:test';
import assert from 'node:assert/strict';
import type { Task } from '../types.ts';
import { normalizeTask, sanitizeMilestones } from './workspaceSanitizers.ts';
import {
  buildWorkspaceBackupPayload,
  repairWorkspaceBackupPayload,
  sanitizeTasks as sanitizeBackupTasks,
  sanitizeMilestones as sanitizeBackupMilestones,
} from '../services/workspaceBackup.ts';
import {
  filterTasksByArchiveVisibility,
  getRequiredArchivedDependencyIds,
  getBlockedArchiveTaskIds,
} from './archiving.ts';

const task = (id: string, dependencyIds: string[] = [], archived = false): Task => ({
  id,
  title: id,
  status: 'done',
  dependencyIds,
  archived,
});

test('archive visibility defaults to active and supports explicit archived/all views', () => {
  const tasks = [task('active'), task('archived', [], true)];
  assert.deepEqual(filterTasksByArchiveVisibility(tasks).map(item => item.id), ['active']);
  assert.deepEqual(filterTasksByArchiveVisibility(tasks, 'archived').map(item => item.id), ['archived']);
  assert.deepEqual(filterTasksByArchiveVisibility(tasks, 'all').map(item => item.id), ['active', 'archived']);
});

test('archive conflicts protect both ends of active dependencies and allow a complete batch', () => {
  const tasks = [task('root'), task('middle', ['root']), task('leaf', ['middle']), task('safe')];
  assert.deepEqual([...getBlockedArchiveTaskIds(tasks, new Set(['root']))], ['root']);
  assert.deepEqual([...getBlockedArchiveTaskIds(tasks, new Set(['middle', 'leaf']))], ['middle', 'leaf']);
  assert.equal(getBlockedArchiveTaskIds(tasks, new Set(tasks.map(item => item.id))).size, 0);
  assert.equal(getBlockedArchiveTaskIds([task('stale', ['deleted'])], new Set(['stale'])).size, 0);
});

test('standalone restore returns archived dependencies recursively', () => {
  const root = task('root', [], true);
  const middle = task('middle', [root.id], true);
  const candidate = task('candidate', [middle.id]);
  const tasks = new Map([root, middle, candidate].map(item => [item.id, item]));
  assert.deepEqual(getRequiredArchivedDependencyIds(candidate, tasks), ['middle', 'root']);
});

test('task and milestone sanitizers preserve archive metadata', () => {
  const normalized = normalizeTask({ ...task('archived-task', [], true), archivedAt: '2026-09-21T00:00:00.000Z' }, []);
  assert.equal(normalized.archived, true);
  assert.equal(normalized.archivedAt, '2026-09-21T00:00:00.000Z');

  const milestones = sanitizeMilestones([{
    id: 'milestone-1',
    title: 'Archived milestone',
    projectIds: ['project-1'],
    endDate: '2026-09-21',
    archived: true,
    archivedAt: '2026-09-21T00:00:00.000Z',
  }], [{ id: 'project-1', name: 'Project' }]);
  assert.equal(milestones[0]?.archived, true);
  assert.equal(milestones[0]?.archivedAt, '2026-09-21T00:00:00.000Z');
});

test('backup sanitizers preserve archive metadata for round-trip repair', () => {
  const archivedAt = '2026-09-21T00:00:00.000Z';
  const tasks = sanitizeBackupTasks([{ ...task('backup-task', [], true), archivedAt }], []);
  const milestones = sanitizeBackupMilestones([{
    id: 'backup-milestone', title: 'Archived milestone', projectIds: ['project-1'], endDate: '2026-09-21', archived: true, archivedAt,
  }], [{ id: 'project-1', name: 'Project' }]);
  assert.equal(tasks[0]?.archivedAt, archivedAt);
  assert.equal(milestones[0]?.archivedAt, archivedAt);
});

test('workspace backup build and repair retain archive metadata', () => {
  const archivedAt = '2026-09-21T00:00:00.000Z';
  const payload = buildWorkspaceBackupPayload({
    tasks: [{ ...task('backup-task', [], true), archivedAt }],
    milestones: [{ id: 'backup-milestone', title: 'Archived milestone', projectIds: ['project-1'], endDate: '2026-09-21', archived: true, archivedAt }],
    projects: [{ id: 'project-1', name: 'Project' }],
    people: [],
    statusColumns: [{ id: 'done', title: 'Done', color: '#000000' }],
    preferences: {} as never,
  });
  const repaired = repairWorkspaceBackupPayload(payload, {
    fallbackProjects: [],
    fallbackPeople: [],
    fallbackStatusColumns: [{ id: 'done', title: 'Done', color: '#000000' }],
    fallbackPreferences: {} as never,
  });
  assert.equal(repaired.ok, true);
  assert.equal(repaired.tasks[0]?.archivedAt, archivedAt);
  assert.equal(repaired.milestones[0]?.archivedAt, archivedAt);
});
