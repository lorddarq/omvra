import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultWorkspacePreferences,
  getPortableElectronStoreSnapshotFromExport,
  getPortableStorageSnapshotFromEntries,
  repairWorkspaceBackupPayload,
} from './workspaceBackup.ts';

const fallbackStatusColumns = [
  { id: 'open', title: 'Open Tasks', color: '#999999' },
  { id: 'in-progress', title: 'In Progress', color: '#2563eb' },
];

test('legacy Plumy backup storage keys are restored under the Omvra namespace', () => {
  const tasksJson = JSON.stringify([{ id: 'task-1', title: 'Legacy task', status: 'open' }]);
  const snapshot = getPortableStorageSnapshotFromEntries({
    'plumy.tasks.v1': tasksJson,
    'plumy_viewstate_timeline': '{"zoom":1}',
    'other.key': 'ignored',
  });

  assert.deepEqual(snapshot, {
    'omvra.tasks.v1': tasksJson,
    'omvra_viewstate_timeline': '{"zoom":1}',
  });
});

test('legacy Plumy backup payload snapshots normalize before restore', () => {
  const repaired = repairWorkspaceBackupPayload(
    {
      version: 2,
      exportedAt: '2026-06-22T00:00:00.000Z',
      tasks: [{ id: 'task-1', title: 'Legacy task', status: 'open' }],
      projects: [{ id: 'project-1', name: 'Legacy Project', color: '#80ffe5' }],
      people: [{ id: 'person-1', name: 'Legacy User', role: 'Designer' }],
      statusColumns: fallbackStatusColumns,
      preferences: {},
      storage: {
        'plumy.tasks.v1': '[{"id":"task-1"}]',
        'plumy_viewstate_kanban': '{"collapsed":[]}',
      },
      electronStore: {
        plumy: {
          preferences: {
            v1: {
              mcpAgentAccessEnabled: true,
            },
          },
        },
        plumy_viewstate_roadmap: '{"scale":"month"}',
      },
    },
    {
      fallbackStatusColumns,
      fallbackPreferences: createDefaultWorkspacePreferences(fallbackStatusColumns),
    }
  );

  assert.equal(repaired.ok, true);
  assert.deepEqual(repaired.storageSnapshot, {
    'omvra.tasks.v1': '[{"id":"task-1"}]',
    'omvra_viewstate_kanban': '{"collapsed":[]}',
  });
  assert.deepEqual(repaired.electronStoreSnapshot, {
    'omvra.preferences.v1.mcpAgentAccessEnabled': true,
    'omvra_viewstate_roadmap': '{"scale":"month"}',
  });
});

test('legacy Plumy electron-store exports normalize under Omvra keys', () => {
  const snapshot = getPortableElectronStoreSnapshotFromExport({
    plumy: {
      tasks: {
        v1: [{ id: 'task-1' }],
      },
    },
    plumy_viewstate_timeline: { scrollLeft: 120 },
  });

  assert.deepEqual(snapshot, {
    'omvra.tasks.v1': [{ id: 'task-1' }],
    'omvra_viewstate_timeline.scrollLeft': 120,
  });
});
