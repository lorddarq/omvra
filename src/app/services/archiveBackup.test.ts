import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArchiveBackup, mergeArchiveBackup } from './archiveBackup.ts';
import type { Task } from '../types.ts';

const archived: Task = { id: 'archive', title: 'Archived task', status: 'done', archived: true, archivedAt: '2026-09-21T00:00:00.000Z', dependencyIds: ['dependency'], notes: '- [x] Complete' };
const workspace = { tasks: [archived, { id: 'active', title: 'Active task', status: 'open' } as Task], milestones: [], projects: [], people: [], statusColumns: [] };

test('archive JSON round-trips history and merges without overwriting current records', () => {
  const payload = JSON.parse(JSON.stringify(buildArchiveBackup(workspace)));
  assert.deepEqual(payload.tasks.map((task: Task) => task.id), ['archive']);
  assert.equal(payload.preferences, undefined);
  const imported = mergeArchiveBackup(payload, { ...workspace, tasks: [] });
  assert.equal(imported.tasks[0].archived, true);
  assert.equal(imported.tasks[0].archivedAt, archived.archivedAt);
  assert.equal(imported.tasks[0].notes, archived.notes);
  assert.deepEqual(imported.tasks[0].dependencyIds, archived.dependencyIds);
  const current = { ...archived, title: 'Newer local record', archived: false };
  assert.deepEqual(mergeArchiveBackup(payload, { ...workspace, tasks: [current] }).tasks, [current]);
  assert.deepEqual(mergeArchiveBackup(payload, imported), imported);
});

test('archive import rejects wrong versions, active records, duplicates and invalid milestone data', () => {
  const payload = buildArchiveBackup(workspace);
  for (const invalid of [null, {}, { ...payload, version: 2 }, { ...payload, tasks: workspace.tasks }, { ...payload, tasks: [archived, archived] }, { ...payload, milestones: [{ id: 'bad', title: 'Bad', archived: true }] }]) {
    assert.throws(() => mergeArchiveBackup(invalid, workspace));
  }
});

test('archive-heavy restore preserves 10,000 historical tasks and their Timeline dates', async () => {
  const { createTimelineBenchmarkFixture, TIMELINE_FIXTURE_PROFILES } = await import('../../../scripts/timeline-performance/fixture.ts');
  const { restoreTaskRecords } = await import('../store/workspaceMutations.ts');
  const { filterTasksByArchiveVisibility } = await import('../utils/archiving.ts');
  const fixture = createTimelineBenchmarkFixture(TIMELINE_FIXTURE_PROFILES[2]);
  const archivedTasks = fixture.tasks.map(task => ({ ...task, archived: true }));
  assert.equal(filterTasksByArchiveVisibility(archivedTasks).length, 0);
  const restored = restoreTaskRecords(archivedTasks, archivedTasks.map(task => task.id));
  assert.equal(filterTasksByArchiveVisibility(restored).length, 10000);
  assert.equal(restored[0].startDate, fixture.tasks[0].startDate);
  assert.equal(restored[restored.length - 1].endDate, fixture.tasks[fixture.tasks.length - 1].endDate);
});

test('workspace backups preserve policy and completion timing while archive imports do not enable a policy', async () => {
  const { buildWorkspaceBackupPayload, createDefaultWorkspacePreferences, repairWorkspaceBackupPayload } = await import('./workspaceBackup.ts');
  const preferences = createDefaultWorkspacePreferences([]);
  preferences.autoArchivePolicy = { mode: 'after-completion', days: 30, enabledAt: '2026-09-22T00:00:00.000Z' };
  const completedAt = '2026-08-01T00:00:00.000Z';
  const payload = buildWorkspaceBackupPayload({ ...workspace, tasks: [{ ...archived, completedAt, autoArchiveSuppressed: true }], preferences });
  const repaired = repairWorkspaceBackupPayload(payload, { fallbackPreferences: preferences, fallbackProjects: [], fallbackPeople: [], fallbackStatusColumns: [] });
  assert.equal(repaired.ok, true);
  assert.deepEqual(repaired.preferences.autoArchivePolicy, preferences.autoArchivePolicy);
  assert.equal(repaired.tasks[0].completedAt, completedAt);
  assert.equal(repaired.tasks[0].autoArchiveSuppressed, true);
  assert.equal('preferences' in buildArchiveBackup(workspace), false);
});
