import { useEffect, useState } from 'react';

interface UseAppUpdateStateOptions {
  updateChannel: 'stable' | 'rc';
  onUpdateChannelChange: (channel: 'stable' | 'rc') => void;
  onExportWorkspaceBackup: () => Promise<boolean>;
}

const INITIAL_UPDATE_STATE: AppUpdateState = {
  supported: false,
  packaged: false,
  channel: 'stable',
  status: 'idle',
  update: null,
  progressPercent: null,
  error: null,
  requiresBackup: false,
  lastCheckedAt: null,
};

export function useAppUpdateState({
  updateChannel,
  onUpdateChannelChange,
  onExportWorkspaceBackup,
}: UseAppUpdateStateOptions) {
  const [updateState, setUpdateState] = useState<AppUpdateState>({
    ...INITIAL_UPDATE_STATE,
    channel: updateChannel,
  });
  const [backupExportedAt, setBackupExportedAt] = useState<string | null>(null);
  const [dismissedAvailableUpdateKey, setDismissedAvailableUpdateKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const syncUpdateState = async () => {
      if (!window.electron?.updates?.getState) return;

      try {
        const nextState = await window.electron.updates.getState();
        if (!cancelled) {
          setUpdateState(nextState);
        }
      } catch {
        if (!cancelled) {
          setUpdateState(previous => ({
            ...previous,
            supported: false,
            packaged: Boolean(window.electron?.app),
            error: 'Could not load update state.',
            status: 'error',
          }));
        }
      }
    };

    void syncUpdateState();

    const unsubscribe = window.electron?.updates?.onStateChanged?.((nextState) => {
      if (!cancelled) {
        setUpdateState(nextState);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    setUpdateState(previous => ({ ...previous, channel: updateChannel }));
  }, [updateChannel]);

  useEffect(() => {
    setBackupExportedAt(null);
  }, [updateState.update?.version]);

  useEffect(() => {
    if (updateState.status !== 'available' && dismissedAvailableUpdateKey !== null) {
      setDismissedAvailableUpdateKey(null);
    }
  }, [dismissedAvailableUpdateKey, updateState.status]);

  const handleCheckForUpdates = async () => {
    try {
      const nextState = await window.electron?.updates?.check?.();
      if (nextState) {
        setUpdateState(nextState);
      }
    } catch {
      setUpdateState(previous => ({
        ...previous,
        status: 'error',
        error: 'Could not check for updates.',
      }));
    }
  };

  const handleDownloadUpdate = async () => {
    try {
      const nextState = await window.electron?.updates?.download?.();
      if (nextState) {
        setUpdateState(nextState);
      }
    } catch {
      setUpdateState(previous => ({
        ...previous,
        status: 'error',
        error: 'Could not start the update download.',
      }));
    }
  };

  const handleDismissUpdate = async () => {
    try {
      const nextState = await window.electron?.updates?.dismiss?.();
      if (nextState) {
        setUpdateState(nextState);
      }
    } finally {
      setBackupExportedAt(null);
    }
  };

  const handleRemindLater = async () => {
    if (updateState.status === 'available') {
      setDismissedAvailableUpdateKey(getAvailableUpdateKey(updateState));
      return;
    }

    await handleDismissUpdate();
  };

  const handleCloseUpdate = async () => {
    await handleRemindLater();
  };

  const handleInstallUpdate = async () => {
    try {
      await window.electron?.updates?.install?.();
    } catch {
      setUpdateState(previous => ({
        ...previous,
        status: 'error',
        error: 'Could not start the installer.',
      }));
    }
  };

  const handleExportBackup = async () => {
    const didExport = await onExportWorkspaceBackup();
    if (didExport) {
      setBackupExportedAt(new Date().toISOString());
    }
    return didExport;
  };

  const handleUpdateChannelSelect = (channel: 'stable' | 'rc') => {
    onUpdateChannelChange(channel);
  };

  return {
    updateState,
    backupExportedAt,
    installBlocked: updateState.requiresBackup && !backupExportedAt,
    isAvailableDismissedForSession: updateState.status === 'available'
      && dismissedAvailableUpdateKey === getAvailableUpdateKey(updateState),
    handleCheckForUpdates,
    handleCloseUpdate,
    handleDownloadUpdate,
    handleDismissUpdate,
    handleInstallUpdate,
    handleExportBackup,
    handleRemindLater,
    handleUpdateChannelSelect,
  };
}

function getAvailableUpdateKey(updateState: AppUpdateState) {
  return updateState.update?.version
    || updateState.update?.releaseDate
    || updateState.update?.releaseName
    || 'available-update';
}
