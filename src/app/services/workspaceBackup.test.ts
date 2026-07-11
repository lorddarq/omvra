import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkspaceBackupFileName,
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

test('workspace backup preferences preserve rc update channel and filenames use exported date', () => {
  const repaired = repairWorkspaceBackupPayload(
    {
      version: 2,
      exportedAt: '2026-07-02T12:34:56.000Z',
      tasks: [],
      projects: [],
      people: [],
      milestones: [],
      statusColumns: [],
      preferences: {
        updateChannel: 'rc',
      },
    },
    {
      fallbackStatusColumns,
      fallbackPreferences: createDefaultWorkspacePreferences(fallbackStatusColumns),
      allowFallbackForMissingArrays: true,
    }
  );

  assert.equal(repaired.preferences.updateChannel, 'rc');
  assert.equal(buildWorkspaceBackupFileName('2026-07-02T12:34:56.000Z'), 'omvra-backup-2026-07-02.json');
});

test('workspace backup preserves shared MCP and UI task relationships and agent context', () => {
  const repaired = repairWorkspaceBackupPayload(
    {
      version: 2,
      exportedAt: '2026-08-12T00:00:00.000Z',
      projects: [{ id: 'project-1', name: 'Omvra', color: '#2563eb' }],
      people: [{
        id: 'agent-1',
        name: 'Edgar',
        role: 'Quality agent',
        kind: 'agentic',
        agentInstructions: 'Protect the shared contract.',
        agentOperationalInstructions: 'Run the smallest complete verification.',
      }],
      statusColumns: fallbackStatusColumns,
      milestones: [{
        id: 'milestone-1',
        title: 'Contract release',
        projectIds: ['project-1'],
        endDate: '2026-08-30',
        linkedTaskIds: ['task-1'],
      }],
      tasks: [{
        id: 'task-1',
        title: 'Verify shared writes',
        status: 'in-progress',
        projectIds: ['project-1'],
        swimlaneId: 'project-1',
        assigneeId: 'agent-1',
        milestoneId: 'milestone-1',
        dependencyIds: ['task-2'],
        timeSpentMinutes: 45,
        timeSpentNote: 'Contract pass',
        timeEntries: [{ id: 'time-1', minutes: 45, note: 'Contract pass', loggedAt: '2026-08-12T01:00:00.000Z' }],
        comments: [{ id: 'comment-1', author: 'Edgar', content: 'Ready', createdAt: '2026-08-12T01:00:00.000Z' }],
        activityLog: [{ id: 'activity-1', type: 'activity', message: 'Verified', createdAt: '2026-08-12T01:00:00.000Z' }],
        agentSummary: 'Shared contract verified.',
      }, {
        id: 'task-2',
        title: 'Provide fixture',
        status: 'open',
        projectIds: ['project-1'],
      }],
      preferences: {},
    },
    {
      fallbackStatusColumns,
      fallbackPreferences: createDefaultWorkspacePreferences(fallbackStatusColumns),
    }
  );

  assert.equal(repaired.ok, true);
  assert.deepEqual(repaired.tasks[0].dependencyIds, ['task-2']);
  assert.equal(repaired.tasks[0].milestoneId, 'milestone-1');
  assert.equal(repaired.tasks[0].timeSpentMinutes, 45);
  assert.equal(repaired.tasks[0].timeEntries?.[0].minutes, 45);
  assert.equal(repaired.tasks[0].comments?.[0].content, 'Ready');
  assert.equal(repaired.tasks[0].activityLog?.[0].message, 'Verified');
  assert.equal(repaired.tasks[0].agentSummary, 'Shared contract verified.');
  assert.deepEqual(repaired.milestones[0].linkedTaskIds, ['task-1']);
  assert.equal(repaired.people[0].agentInstructions, 'Protect the shared contract.');
  assert.equal(repaired.people[0].agentOperationalInstructions, 'Run the smallest complete verification.');
});
