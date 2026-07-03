import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import TestRenderer from 'react-test-renderer';
import { useAppUpdateState } from './useAppUpdateState.ts';

const { act, create } = TestRenderer as any;

type AppUpdateStateHarness = Awaited<ReturnType<typeof renderUpdateHook>>;

async function renderUpdateHook() {
  let currentResult: ReturnType<typeof useAppUpdateState> | undefined;
  let stateChangedListener: ((nextState: AppUpdateState) => void) | null = null;
  let dismissCalls = 0;

  const restoreWindow = setWindowMock({
    electron: {
      app: {},
      updates: {
        getState: async () => ({
          supported: true,
          packaged: true,
          channel: 'stable',
          status: 'available',
          update: {
            version: '0.3.32',
            releaseDate: '2026-07-03T00:00:00.000Z',
            releaseName: '0.3.32',
            releaseNotes: '- Auto-update capabilities',
            isPrerelease: false,
          },
          progressPercent: null,
          error: null,
          requiresBackup: false,
          lastCheckedAt: '2026-07-03T00:00:00.000Z',
        }),
        check: async () => null,
        download: async () => null,
        install: async () => ({ success: true }),
        dismiss: async () => {
          dismissCalls += 1;
          return {
            supported: true,
            packaged: true,
            channel: 'stable',
            status: 'idle',
            update: null,
            progressPercent: null,
            error: null,
            requiresBackup: false,
            lastCheckedAt: null,
          };
        },
        setChannel: async () => null,
        onStateChanged: (listener: (nextState: AppUpdateState) => void) => {
          stateChangedListener = listener;
          return () => {
            stateChangedListener = null;
          };
        },
      },
    },
  });

  function Probe() {
    currentResult = useAppUpdateState({
      updateChannel: 'stable',
      onUpdateChannelChange: () => {},
      onExportWorkspaceBackup: async () => true,
    });
    return null;
  }

  let renderer: any;
  await act(async () => {
    renderer = create(React.createElement(Probe));
  });

  return {
    result: () => {
      if (!currentResult) {
        throw new Error('Hook result not ready.');
      }
      return currentResult;
    },
    emitState: async (nextState: AppUpdateState) => {
      await act(async () => {
        stateChangedListener?.(nextState);
      });
    },
    dismissCalls: () => dismissCalls,
    unmount: async () => {
      await act(async () => {
        renderer.unmount();
      });
      restoreWindow();
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

test('useAppUpdateState keeps available-update reminder as a session-only dismissal', async () => {
  const harness: AppUpdateStateHarness = await renderUpdateHook();

  try {
    assert.equal(harness.result().updateState.status, 'available');
    assert.equal(harness.result().isAvailableDismissedForSession, false);

    await act(async () => {
      await harness.result().handleRemindLater();
    });

    assert.equal(harness.result().isAvailableDismissedForSession, true);
    assert.equal(harness.dismissCalls(), 0);

    await harness.emitState({
      supported: true,
      packaged: true,
      channel: 'stable',
      status: 'downloaded',
      update: {
        version: '0.3.32',
        releaseDate: '2026-07-03T00:00:00.000Z',
        releaseName: '0.3.32',
        releaseNotes: 'Ready to install',
        isPrerelease: false,
      },
      progressPercent: 100,
      error: null,
      requiresBackup: false,
      lastCheckedAt: '2026-07-03T00:00:00.000Z',
    });

    assert.equal(harness.result().isAvailableDismissedForSession, false);

    await act(async () => {
      await harness.result().handleCloseUpdate();
    });

    assert.equal(harness.dismissCalls(), 1);
    assert.equal(harness.result().updateState.status, 'idle');
  } finally {
    await harness.unmount();
  }
});

test('useAppUpdateState opens the backup gate only after the update action is requested', async () => {
  const harness: AppUpdateStateHarness = await renderUpdateHook();

  try {
    await harness.emitState({
      supported: true,
      packaged: true,
      channel: 'rc',
      status: 'available',
      update: {
        version: '0.3.33-rc.1',
        releaseDate: '2026-07-03T00:00:00.000Z',
        releaseName: '0.3.33 RC 1',
        releaseNotes: 'Preview build',
        isPrerelease: true,
      },
      progressPercent: null,
      error: null,
      requiresBackup: true,
      lastCheckedAt: '2026-07-03T00:00:00.000Z',
    });

    assert.equal(harness.result().installBlocked, false);

    await act(async () => {
      await harness.result().handleUpdatePrimaryAction();
    });

    assert.equal(harness.result().installBlocked, true);
  } finally {
    await harness.unmount();
  }
});

test('useAppUpdateState closes the backup gate when dismissing an available prerelease update', async () => {
  const harness: AppUpdateStateHarness = await renderUpdateHook();

  try {
    await harness.emitState({
      supported: true,
      packaged: true,
      channel: 'rc',
      status: 'available',
      update: {
        version: '0.3.33-rc.1',
        releaseDate: '2026-07-03T00:00:00.000Z',
        releaseName: '0.3.33 RC 1',
        releaseNotes: 'Preview build',
        isPrerelease: true,
      },
      progressPercent: null,
      error: null,
      requiresBackup: true,
      lastCheckedAt: '2026-07-03T00:00:00.000Z',
    });

    await act(async () => {
      await harness.result().handleUpdatePrimaryAction();
    });

    assert.equal(harness.result().installBlocked, true);

    await act(async () => {
      await harness.result().handleCloseUpdate();
    });

    assert.equal(harness.result().installBlocked, false);
    assert.equal(harness.result().isAvailableDismissedForSession, true);
    assert.equal(harness.dismissCalls(), 0);
  } finally {
    await harness.unmount();
  }
});
