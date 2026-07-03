const test = require('node:test');
const assert = require('node:assert/strict');

const { registerUpdateIpcHandlers } = require('./update-ipc.cjs');

function createIpcHarness() {
  const handlers = new Map();
  const ipcMain = {
    handle(name, handler) {
      handlers.set(name, handler);
    },
  };

  return { ipcMain, handlers };
}

test('update IPC exposes fallback state when no controller is available', async () => {
  const { ipcMain, handlers } = createIpcHarness();
  let storedChannel = null;

  registerUpdateIpcHandlers({
    ipcMain,
    app: { isPackaged: false },
    getUpdateController: () => null,
    setStoredUpdateChannel: (channel) => {
      storedChannel = channel === 'rc' ? 'rc' : 'stable';
      return storedChannel;
    },
  });

  const getState = handlers.get('updates/get-state');
  const check = handlers.get('updates/check');
  const download = handlers.get('updates/download');
  const install = handlers.get('updates/install');
  const dismiss = handlers.get('updates/dismiss');
  const setChannel = handlers.get('updates/set-channel');

  assert.deepEqual(getState(), {
    supported: false,
    packaged: false,
    channel: 'stable',
    status: 'unsupported',
    unsupportedReason: 'unpackaged',
    unsupportedDetails: null,
    update: null,
    progressPercent: null,
    error: null,
    requiresBackup: false,
    lastCheckedAt: null,
  });
  assert.deepEqual(await check(), getState());
  assert.deepEqual(await download(), getState());
  assert.deepEqual(install(), { success: false, error: 'Could not start the installer.' });
  assert.deepEqual(dismiss(), getState());
  assert.deepEqual(setChannel(null, 'rc'), { channel: 'rc' });
  assert.equal(storedChannel, 'rc');
});

test('update IPC delegates to the active update controller', async () => {
  const { ipcMain, handlers } = createIpcHarness();
  const calls = [];
  const controller = {
    getState() {
      calls.push('getState');
      return { status: 'idle' };
    },
    async checkForUpdates() {
      calls.push('checkForUpdates');
      return { status: 'checking' };
    },
    async downloadUpdate() {
      calls.push('downloadUpdate');
      return { status: 'downloading' };
    },
    quitAndInstall() {
      calls.push('quitAndInstall');
      return true;
    },
    dismiss() {
      calls.push('dismiss');
      return { status: 'idle' };
    },
    setChannel(channel) {
      calls.push(`setChannel:${channel}`);
      return { channel };
    },
  };

  registerUpdateIpcHandlers({
    ipcMain,
    app: { isPackaged: true },
    getUpdateController: () => controller,
    setStoredUpdateChannel: (channel) => (channel === 'rc' ? 'rc' : 'stable'),
  });

  assert.deepEqual(handlers.get('updates/get-state')(), { status: 'idle' });
  assert.deepEqual(await handlers.get('updates/check')(), { status: 'checking' });
  assert.deepEqual(await handlers.get('updates/download')(), { status: 'downloading' });
  assert.deepEqual(handlers.get('updates/install')(), { success: true, error: null });
  assert.deepEqual(handlers.get('updates/dismiss')(), { status: 'idle' });
  assert.deepEqual(handlers.get('updates/set-channel')(null, 'rc'), { channel: 'rc' });

  assert.deepEqual(calls, [
    'getState',
    'checkForUpdates',
    'downloadUpdate',
    'quitAndInstall',
    'getState',
    'dismiss',
    'setChannel:rc',
  ]);
});
