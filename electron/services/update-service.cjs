const { EventEmitter } = require('events');

function normalizeUpdateChannel(value) {
  return value === 'rc' ? 'rc' : 'stable';
}

function isPrereleaseVersion(version) {
  return typeof version === 'string' && version.includes('-');
}

function sanitizeReleaseNotes(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (!Array.isArray(value)) return null;

  const combined = value
    .map(entry => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean)
    .join('\n\n');

  return combined || null;
}

function sanitizeUpdateInfo(info) {
  if (!info || typeof info !== 'object') return null;

  const version = typeof info.version === 'string' ? info.version : '';
  if (!version) return null;

  return {
    version,
    releaseDate: typeof info.releaseDate === 'string' ? info.releaseDate : null,
    releaseName: typeof info.releaseName === 'string' ? info.releaseName : null,
    releaseNotes: sanitizeReleaseNotes(info.releaseNotes),
    isPrerelease: isPrereleaseVersion(version),
  };
}

function createDefaultUpdateState(options = {}) {
  return {
    supported: Boolean(options.supported),
    packaged: Boolean(options.packaged),
    channel: normalizeUpdateChannel(options.channel),
    status: options.supported ? 'idle' : 'unsupported',
    update: null,
    progressPercent: null,
    error: null,
    requiresBackup: false,
    lastCheckedAt: null,
  };
}

function sanitizeDebugUpdateFixture(fixture) {
  if (!fixture || typeof fixture !== 'object') return null;

  const status = ['available', 'downloading', 'downloaded', 'error', 'not-available', 'idle']
    .includes(fixture.status)
    ? fixture.status
    : 'available';
  const update = sanitizeUpdateInfo(fixture.update || {
    version: typeof fixture.version === 'string' ? fixture.version : '0.0.0-debug',
    releaseName: typeof fixture.releaseName === 'string' ? fixture.releaseName : 'Debug Update',
    releaseNotes: typeof fixture.releaseNotes === 'string' ? fixture.releaseNotes : '- Debug update path\n- Popup preview',
    releaseDate: typeof fixture.releaseDate === 'string' ? fixture.releaseDate : new Date().toISOString(),
  });

  return {
    supported: true,
    packaged: true,
    channel: normalizeUpdateChannel(fixture.channel),
    status,
    update,
    progressPercent: Number.isFinite(Number(fixture.progressPercent))
      ? Math.max(0, Math.min(100, Math.round(Number(fixture.progressPercent))))
      : (status === 'downloading' ? 42 : status === 'downloaded' ? 100 : null),
    error: typeof fixture.error === 'string' ? fixture.error : null,
    requiresBackup: fixture.requiresBackup === true || Boolean(update?.isPrerelease),
    lastCheckedAt: typeof fixture.lastCheckedAt === 'string' ? fixture.lastCheckedAt : new Date().toISOString(),
  };
}

function createUpdateController({ app, updater, onStateChange, debugUpdateFixture } = {}) {
  const debugFixture = sanitizeDebugUpdateFixture(debugUpdateFixture);
  const packaged = debugFixture ? true : Boolean(app && app.isPackaged);
  const supported = Boolean(debugFixture) || (packaged && Boolean(updater && typeof updater.on === 'function'));
  let state = debugFixture || createDefaultUpdateState({
    supported,
    packaged,
    channel: 'stable',
  });

  const listeners = new Set();
  const subscriptions = [];

  function emitState() {
    const snapshot = { ...state };
    listeners.forEach(listener => listener(snapshot));
    if (typeof onStateChange === 'function') {
      onStateChange(snapshot);
    }
  }

  function setState(patch) {
    state = {
      ...state,
      ...patch,
    };
    emitState();
    return { ...state };
  }

  function setChannel(channel) {
    const normalized = normalizeUpdateChannel(channel);

    if (supported && updater) {
      updater.allowPrerelease = normalized === 'rc';
      updater.allowDowngrade = normalized === 'rc';
    }

    return setState({
      channel: normalized,
      requiresBackup: Boolean(state.update?.isPrerelease),
    });
  }

  function handleError(error, message) {
    const fallbackMessage = message || error?.message || String(error || 'Unknown update error');
    setState({
      status: 'error',
      error: fallbackMessage,
      progressPercent: null,
    });
  }

  if (supported && !debugFixture) {
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;

    const eventMap = {
      'checking-for-update': () => {
        setState({
          status: 'checking',
          error: null,
          progressPercent: null,
          lastCheckedAt: new Date().toISOString(),
        });
      },
      'update-available': (info) => {
        const update = sanitizeUpdateInfo(info);
        setState({
          status: 'available',
          update,
          error: null,
          progressPercent: null,
          requiresBackup: Boolean(update?.isPrerelease),
        });
      },
      'update-not-available': () => {
        setState({
          status: 'not-available',
          update: null,
          error: null,
          progressPercent: null,
          requiresBackup: false,
          lastCheckedAt: new Date().toISOString(),
        });
      },
      'download-progress': (progress) => {
        const percent = Number(progress?.percent);
        setState({
          status: 'downloading',
          error: null,
          progressPercent: Number.isFinite(percent)
            ? Math.max(0, Math.min(100, Math.round(percent)))
            : null,
        });
      },
      'update-downloaded': (info) => {
        const update = sanitizeUpdateInfo(info) || state.update;
        setState({
          status: 'downloaded',
          update,
          error: null,
          progressPercent: 100,
          requiresBackup: Boolean(update?.isPrerelease),
          lastCheckedAt: new Date().toISOString(),
        });
      },
      error: handleError,
    };

    Object.entries(eventMap).forEach(([eventName, handler]) => {
      updater.on(eventName, handler);
      subscriptions.push(() => updater.removeListener(eventName, handler));
    });
  }

  return {
    subscribe(listener) {
      if (typeof listener !== 'function') {
        return () => {};
      }

      listeners.add(listener);
      listener({ ...state });
      return () => {
        listeners.delete(listener);
      };
    },
    getState() {
      return { ...state };
    },
    setChannel,
    async checkForUpdates() {
      if (!supported) return { ...state };
      if (debugFixture) {
        emitState();
        return { ...state };
      }

      try {
        await updater.checkForUpdates();
      } catch (error) {
        handleError(error);
      }

      return { ...state };
    },
    async downloadUpdate() {
      if (!supported) return { ...state };
      if (debugFixture) {
        return setState({
          status: 'downloaded',
          error: null,
          progressPercent: 100,
          requiresBackup: Boolean(state.update?.isPrerelease),
          lastCheckedAt: state.lastCheckedAt || new Date().toISOString(),
        });
      }

      try {
        await updater.downloadUpdate();
      } catch (error) {
        handleError(error);
      }

      return { ...state };
    },
    quitAndInstall() {
      if (!supported || state.status !== 'downloaded') {
        return false;
      }
      if (debugFixture || !updater) {
        return true;
      }

      updater.quitAndInstall();
      return true;
    },
    dismiss() {
      return setState({
        status: 'idle',
        update: null,
        progressPercent: null,
        error: null,
        requiresBackup: false,
      });
    },
    dispose() {
      subscriptions.forEach(unsubscribe => unsubscribe());
      listeners.clear();
    },
  };
}

module.exports = {
  createDefaultUpdateState,
  createUpdateController,
  normalizeUpdateChannel,
  sanitizeDebugUpdateFixture,
  sanitizeUpdateInfo,
};
