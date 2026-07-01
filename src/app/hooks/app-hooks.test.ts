import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import TestRenderer from 'react-test-renderer';
import type { Task, Person } from '../types.ts';
import { useTaskActions } from './useTaskActions.ts';
import { useMcpPanelState } from './useMcpPanelState.ts';
import {
  useAgentWatchRuntime,
  getAgentWatchPollingInterval,
} from './useAgentWatchRuntime.ts';
import type { McpPreferencesShape } from '../utils/mcpPreferences.ts';
import type { AgentWatchConfig } from '../utils/workspaceSanitizers.ts';

const { act, create } = TestRenderer as any;

type RenderHookHarness<TProps, TResult> = {
  result: () => TResult;
  rerender: (nextProps?: TProps) => Promise<void>;
  unmount: () => Promise<void>;
};

async function renderHook<TProps, TResult>(
  hook: (props: TProps) => TResult,
  initialProps: TProps
): Promise<RenderHookHarness<TProps, TResult>> {
  let currentResult: TResult | undefined;

  function Probe(props: TProps) {
    currentResult = hook(props);
    return null;
  }

  let renderer: any;
  await act(async () => {
    renderer = create(React.createElement(Probe, initialProps));
  });

  return {
    result: () => {
      if (currentResult === undefined) {
        throw new Error('Hook result is not available yet.');
      }
      return currentResult;
    },
    rerender: async (nextProps: TProps = initialProps) => {
      await act(async () => {
        renderer.update(React.createElement(Probe, nextProps));
      });
    },
    unmount: async () => {
      await act(async () => {
        renderer.unmount();
      });
    },
  };
}

function setWindowMock(mock: Record<string, unknown>) {
  const previousWindow = (globalThis as any).window;
  (globalThis as any).window = mock;
  return () => {
    if (previousWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = previousWindow;
    }
  };
}

test('useTaskActions saves, comments, and promotes agentic tasks to review', async () => {
  let tasks: Task[] = [];
  const setTasks = (updater: React.SetStateAction<Task[]>) => {
    tasks = typeof updater === 'function'
      ? (updater as (prev: Task[]) => Task[])(tasks)
      : updater;
  };
  const people: Person[] = [
    { id: 'human-1', name: 'Alex', role: 'Designer', kind: 'human', color: '#ec4899' },
    { id: 'agent-1', name: 'Codex', role: 'Agent', kind: 'agentic', color: '#f97316' },
  ];

  const harness = await renderHook(
    ({ nextPeople }: { nextPeople: Person[] }) => useTaskActions({ people: nextPeople, setTasks }),
    { nextPeople: people }
  );

  const { saveTask, addTaskComment, moveTask, moveAgentTaskToReview } = harness.result();

  saveTask({
    title: 'Draft watcher docs',
    notes: 'Initial notes',
    status: 'in-progress',
    assigneeId: 'agent-1',
    projectIds: ['lane-1'],
  });

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, 'Draft watcher docs');
  assert.equal(tasks[0].status, 'in-progress');
  assert.equal(tasks[0].assigneeId, 'agent-1');

  saveTask({
    id: tasks[0].id,
    title: 'Draft watcher docs v2',
    projectIds: ['lane-2'],
  });
  assert.equal(tasks[0].title, 'Draft watcher docs v2');
  assert.deepEqual(tasks[0].projectIds, ['lane-2']);

  addTaskComment(tasks[0].id, '   ');
  assert.equal(tasks[0].comments?.length || 0, 0);

  addTaskComment(tasks[0].id, '  Ready for review  ');
  assert.equal(tasks[0].comments?.length, 1);
  assert.equal(tasks[0].comments?.[0].content, 'Ready for review');

  moveTask(tasks[0].id, 'done');
  assert.equal(tasks[0].status, 'done');

  tasks = [
    {
      id: 'task-agent',
      title: 'Watch tasks',
      status: 'in-progress',
      assigneeId: 'agent-1',
    } as Task,
    {
      id: 'task-human',
      title: 'Manual review',
      status: 'in-progress',
      assigneeId: 'human-1',
    } as Task,
  ];

  moveAgentTaskToReview('task-agent');
  moveAgentTaskToReview('task-human');

  assert.equal(tasks[0].status, 'under-review');
  assert.equal(tasks[1].status, 'in-progress');

  await harness.unmount();
});

test('useMcpPanelState tracks listener status, audit logs, and restart flow', async () => {
  let storeChangedListener: (() => void) | null = null;
  let auditLogCalls = 0;
  const originalWindow = setWindowMock({
    electron: {
      onStoreChanged: (listener: () => void) => {
        storeChangedListener = listener;
        return () => {
          storeChangedListener = null;
        };
      },
      mcp: {
        getListenerStatus: async () => ({ ok: true, data: { boundHost: '127.0.0.1', boundPort: 3456 } }),
        getAuditLog: async () => {
          auditLogCalls += 1;
          return {
            ok: true,
            data: [{ auditId: `audit-${auditLogCalls}`, timestamp: '2026-03-27T10:00:00.000Z', type: 'test' }],
          };
        },
        restartServer: async () => ({
          success: true,
          listenerStatus: { boundHost: '127.0.0.1', boundPort: 3456 },
        }),
      },
    },
    alert: () => {},
    setInterval: global.setInterval.bind(global),
    clearInterval: global.clearInterval.bind(global),
  });

  try {
    let preferences: McpPreferencesShape = {
      mcpAgentAccessEnabled: true,
      mcpCapabilityProfile: 'task_write',
      mcpBindHost: '127.0.0.1',
      mcpPort: 3456,
      mcpServerAddress: 'http://127.0.0.1:3456/mcp',
      mcpAccessToken: '',
      mcpAccessTokenTtlMinutes: 60,
    };
    const setPreferences = (updater: React.SetStateAction<McpPreferencesShape>) => {
      preferences = typeof updater === 'function'
        ? (updater as (prev: McpPreferencesShape) => McpPreferencesShape)(preferences)
        : updater;
    };
    let healthCheckRuns = 0;
    const runHealthCheck = async () => {
      healthCheckRuns += 1;
    };

    const harness = await renderHook(
      ({ nextPreferences }: { nextPreferences: McpPreferencesShape }) =>
        useMcpPanelState({
          preferences: nextPreferences,
          setPreferences,
          runHealthCheck,
        }),
      { nextPreferences: preferences }
    );

    const initial = harness.result();
    assert.equal(initial.isMcpRestartPending, false);

    await initial.refreshMcpListenerStatus();
    await initial.refreshMcpAuditLog();
    await harness.rerender({ nextPreferences: preferences });

    const refreshed = harness.result();
    assert.deepEqual(refreshed.mcpListenerStatus, { boundHost: '127.0.0.1', boundPort: 3456 });
    assert.equal(refreshed.mcpAuditLog.length, 1);
    assert.equal(refreshed.mcpAuditLog[0].auditId, 'audit-1');

    await act(async () => {
      storeChangedListener?.();
      await Promise.resolve();
    });
    await harness.rerender({ nextPreferences: preferences });
    assert.equal(harness.result().mcpAuditLog[0].auditId, 'audit-2');

    refreshed.handleRotateMcpAccessToken();
    await harness.rerender({ nextPreferences: preferences });
    assert.equal(preferences.mcpAccessToken.length > 0, true);
    assert.equal(harness.result().isMcpRestartPending, true);

    await harness.result().handleRestartMcpServer();
    await harness.rerender({ nextPreferences: preferences });

    const restarted = harness.result();
    assert.equal(healthCheckRuns, 1);
    assert.equal(restarted.isMcpRestartPending, false);

    await harness.unmount();
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

test('useMcpPanelState refreshes listener status while MCP is starting', async () => {
  const originalWindow = setWindowMock({
    electron: {
      mcp: {
        getListenerStatus: async () => ({
          ok: true,
          data: {
            enabled: true,
            status: 'running',
            listening: true,
            boundUrl: 'http://127.0.0.1:3456/mcp',
          },
        }),
        getAuditLog: async () => ({
          ok: true,
          data: [],
        }),
        restartServer: async () => ({
          success: true,
          listenerStatus: {
            enabled: true,
            status: 'starting',
            listening: false,
          },
        }),
      },
    },
    alert: () => {},
    setInterval: global.setInterval.bind(global),
    clearInterval: global.clearInterval.bind(global),
  });

  try {
    const preferences: McpPreferencesShape = {
      mcpAgentAccessEnabled: true,
      mcpCapabilityProfile: 'task_write',
      mcpBindHost: '127.0.0.1',
      mcpPort: 3456,
      mcpServerAddress: 'http://127.0.0.1:3456/mcp',
      mcpAccessToken: '',
      mcpAccessTokenTtlMinutes: 60,
    };
    const setPreferences: React.Dispatch<React.SetStateAction<McpPreferencesShape>> = () => {};
    const runHealthCheck = async () => {};

    const harness = await renderHook(
      ({ nextPreferences }: { nextPreferences: McpPreferencesShape }) =>
        useMcpPanelState({
          preferences: nextPreferences,
          setPreferences,
          runHealthCheck,
        }),
      { nextPreferences: preferences }
    );

    await harness.result().handleRestartMcpServer();
    await harness.rerender({ nextPreferences: preferences });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 850));
    });
    await harness.rerender({ nextPreferences: preferences });

    assert.equal(harness.result().mcpListenerStatus?.status, 'running');
    assert.equal(harness.result().mcpListenerStatus?.listening, true);

    await harness.unmount();
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

test('useMcpPanelState adopts a running startup listener after preferences hydrate', async () => {
  const hydratedPreferences: McpPreferencesShape = {
    mcpAgentAccessEnabled: true,
    mcpCapabilityProfile: 'task_write',
    mcpBindHost: '127.0.0.1',
    mcpPort: 3456,
    mcpServerAddress: 'http://127.0.0.1:3456/mcp',
    mcpAccessToken: '',
    mcpAccessTokenTtlMinutes: 60,
  };
  const originalWindow = setWindowMock({
    electron: {
      mcp: {
        getListenerStatus: async () => ({
          ok: true,
          data: {
            enabled: true,
            status: 'running',
            listening: true,
            host: '127.0.0.1',
            port: 3456,
            path: '/mcp',
            expectedAddress: 'http://127.0.0.1:3456/mcp',
            boundAddress: '127.0.0.1:3456',
            boundUrl: 'http://127.0.0.1:3456/mcp',
            capabilityProfile: 'task_write',
            authMode: 'none',
            token: {
              configured: false,
              status: 'none',
              expired: false,
              issuedAt: null,
              expiresAt: null,
              remainingMinutes: null,
              ttlMinutes: 60,
            },
            error: null,
            lastStartedAt: '2026-06-20T09:00:00.000Z',
            lastStoppedAt: null,
            lastUpdatedAt: '2026-06-20T09:00:00.000Z',
            restartRequired: false,
          },
        }),
        getAuditLog: async () => ({
          ok: true,
          data: [],
        }),
      },
    },
    alert: () => {},
    setInterval: global.setInterval.bind(global),
    clearInterval: global.clearInterval.bind(global),
  });

  try {
    const initialPreferences: McpPreferencesShape = {
      mcpAgentAccessEnabled: false,
      mcpCapabilityProfile: 'read_only',
      mcpBindHost: '127.0.0.1',
      mcpPort: 3456,
      mcpServerAddress: 'http://127.0.0.1:3456/mcp',
      mcpAccessToken: '',
      mcpAccessTokenTtlMinutes: 60,
    };
    const setPreferences: React.Dispatch<React.SetStateAction<McpPreferencesShape>> = () => {};
    const runHealthCheck = async () => {};

    const harness = await renderHook(
      ({ nextPreferences }: { nextPreferences: McpPreferencesShape }) =>
        useMcpPanelState({
          preferences: nextPreferences,
          setPreferences,
          runHealthCheck,
        }),
      { nextPreferences: initialPreferences }
    );

    await harness.rerender({ nextPreferences: hydratedPreferences });
    await act(async () => {
      await Promise.resolve();
    });
    await harness.rerender({ nextPreferences: hydratedPreferences });

    assert.equal(harness.result().mcpListenerStatus?.status, 'running');
    assert.equal(harness.result().isMcpRestartPending, false);

    await harness.unmount();
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

test('useAgentWatchRuntime polls, persists runtime state, and manages watcher configs', async () => {
  const originalWindow = setWindowMock({
    setInterval: global.setInterval.bind(global),
    clearInterval: global.clearInterval.bind(global),
  });

  try {
    const calls: Array<Record<string, unknown>> = [];
    const mcpReadService = {
      pollBoardWatcher: async (filters: Record<string, unknown>) => {
        calls.push(filters);
        return {
          ok: true,
          watcherState: {
            watcherId: String(filters.watcherId || 'agent:agent-1'),
            statusId: String(filters.statusId),
            lastProcessedAt: '2026-03-27T12:00:00.000Z',
            lastSeenTaskIds: ['task-1'],
            lastSeenRevisions: { 'task-1': 1 },
          },
          board: {
            id: String(filters.statusId),
            taskCount: 1,
            currentTaskIds: ['task-1'],
          },
          changes: {
            newTasks: [{ id: 'task-1', title: 'Watcher task' }],
            updatedTasks: [],
            removedTaskIds: [],
          },
        };
      },
    };

    let configs: AgentWatchConfig[] = [{
      personId: 'agent-1',
      enabled: true,
      statusId: 'in-progress',
      action: 'inspect_and_work',
      intervalSeconds: 20,
      projectId: 'lane-1',
      search: 'watch',
    }];
    const setConfigs = (updater: React.SetStateAction<AgentWatchConfig[]>) => {
      configs = typeof updater === 'function'
        ? (updater as (prev: AgentWatchConfig[]) => AgentWatchConfig[])(configs)
        : updater;
    };

    assert.equal(getAgentWatchPollingInterval([]), 0);
    assert.equal(getAgentWatchPollingInterval([{ ...configs[0], intervalSeconds: 5 }]), 15000);
    assert.equal(getAgentWatchPollingInterval(configs), 20000);

    const harness = await renderHook(
      ({ nextEnabled, nextConfigs }: { nextEnabled: boolean; nextConfigs: AgentWatchConfig[] }) =>
        useAgentWatchRuntime({
          mcpReadService: mcpReadService as any,
          enabled: nextEnabled,
          agentWatchConfigs: nextConfigs,
          setAgentWatchConfigs: setConfigs,
        }),
      { nextEnabled: false, nextConfigs: configs }
    );

    const manual = await harness.result().pollAgentWatcher(configs[0]);
    assert.equal(manual?.ok, true);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      watcherId: 'agent:agent-1',
      statusId: 'in-progress',
      assigneeId: 'agent-1',
      projectId: 'lane-1',
      search: 'watch',
      persist: true,
    });

    await harness.rerender({ nextEnabled: false, nextConfigs: configs });
    let runtime = harness.result().agentWatchRuntime['agent-1'];
    assert.equal(runtime.newTaskCount, 1);
    assert.equal(runtime.updatedTaskCount, 0);
    assert.equal(runtime.removedTaskCount, 0);
    assert.deepEqual(runtime.latestTaskTitles, ['Watcher task']);

    harness.result().upsertAgentWatchConfig({
      personId: 'agent-2',
      enabled: true,
      statusId: 'under-review',
      action: 'inspect_and_work',
      intervalSeconds: 45,
      search: 'docs',
    });
    assert.equal(configs.some(config => config.personId === 'agent-2'), true);

    harness.result().removeAgentWatchConfig('agent-1');
    assert.equal(configs.some(config => config.personId === 'agent-1'), false);

    await harness.unmount();

    const effectHarness = await renderHook(
      ({ nextEnabled, nextConfigs }: { nextEnabled: boolean; nextConfigs: AgentWatchConfig[] }) =>
        useAgentWatchRuntime({
          mcpReadService: mcpReadService as any,
          enabled: nextEnabled,
          agentWatchConfigs: nextConfigs,
          setAgentWatchConfigs: setConfigs,
        }),
      {
        nextEnabled: true,
        nextConfigs: [{
          personId: 'agent-1',
          enabled: true,
          statusId: 'in-progress',
          action: 'inspect_and_work',
          intervalSeconds: 20,
        }],
      }
    );

    assert.equal(calls.length >= 2, true);
    await effectHarness.rerender({
      nextEnabled: true,
      nextConfigs: [{
        personId: 'agent-1',
        enabled: true,
        statusId: 'in-progress',
        action: 'inspect_and_work',
        intervalSeconds: 20,
      }],
    });
    runtime = effectHarness.result().agentWatchRuntime['agent-1'];
    assert.equal(runtime.newTaskCount, 1);
    await effectHarness.unmount();
  } finally {
    (globalThis as any).window = originalWindow;
  }
});
