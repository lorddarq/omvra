const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');

const {
  createDefaultUpdateState,
  createUpdateController,
  normalizeUpdateChannel,
  sanitizeDebugUpdateFixture,
  sanitizeUpdateInfo,
} = require('./update-service.cjs');

class FakeUpdater extends EventEmitter {
  constructor() {
    super();
    this.allowPrerelease = false;
    this.allowDowngrade = false;
    this.autoDownload = true;
    this.autoInstallOnAppQuit = true;
    this.quitCalls = 0;
  }

  async checkForUpdates() {
    this.emit('checking-for-update');
    this.emit('update-available', {
      version: '0.2.0-rc.1',
      releaseName: '0.2.0 RC 1',
      releaseNotes: ['First note', 'Second note'],
      releaseDate: '2026-07-02T10:00:00.000Z',
    });
  }

  async downloadUpdate() {
    this.emit('download-progress', { percent: 42.4 });
    this.emit('update-downloaded', {
      version: '0.2.0-rc.1',
      releaseName: '0.2.0 RC 1',
      releaseNotes: 'Ready to install',
      releaseDate: '2026-07-02T10:00:00.000Z',
    });
  }

  quitAndInstall() {
    this.quitCalls += 1;
  }
}

test('normalizeUpdateChannel falls back to stable', () => {
  assert.equal(normalizeUpdateChannel('rc'), 'rc');
  assert.equal(normalizeUpdateChannel('beta'), 'stable');
  assert.equal(normalizeUpdateChannel(undefined), 'stable');
});

test('sanitizeUpdateInfo normalizes release notes and prerelease state', () => {
  const updateInfo = sanitizeUpdateInfo({
    version: '1.2.3-rc.1',
    releaseNotes: ['Alpha', 'Beta'],
    releaseName: 'Preview',
    releaseDate: '2026-07-02T00:00:00.000Z',
  });

  assert.deepEqual(updateInfo, {
    version: '1.2.3-rc.1',
    releaseDate: '2026-07-02T00:00:00.000Z',
    releaseName: 'Preview',
    releaseNotes: 'Alpha\n\nBeta',
    isPrerelease: true,
  });
});

test('sanitizeDebugUpdateFixture forces a supported packaged update state', () => {
  const fixture = sanitizeDebugUpdateFixture({
    status: 'available',
    version: '1.2.3-rc.1',
    releaseNotes: '- Debug path',
  });

  assert.equal(fixture.supported, true);
  assert.equal(fixture.packaged, true);
  assert.equal(fixture.status, 'available');
  assert.equal(fixture.requiresBackup, true);
  assert.equal(fixture.update?.version, '1.2.3-rc.1');
});

test('createUpdateController reports unsupported state for unpackaged builds', () => {
  const controller = createUpdateController({
    app: { isPackaged: false },
    updater: null,
  });

  assert.deepEqual(controller.getState(), createDefaultUpdateState({
    supported: false,
    packaged: false,
    channel: 'stable',
    unsupportedReason: 'unpackaged',
    unsupportedDetails: null,
  }));
});

test('createUpdateController reports updater-unavailable for packaged builds without electron-updater', () => {
  const controller = createUpdateController({
    app: { isPackaged: true },
    updater: null,
    unsupportedReason: 'updater-unavailable',
    unsupportedDetails: 'Cannot find module electron-updater',
  });

  assert.deepEqual(controller.getState(), createDefaultUpdateState({
    supported: false,
    packaged: true,
    channel: 'stable',
    unsupportedReason: 'updater-unavailable',
    unsupportedDetails: 'Cannot find module electron-updater',
  }));
});

test('createUpdateController tracks packaged update flow and backup requirement', async () => {
  const updater = new FakeUpdater();
  const snapshots = [];
  const controller = createUpdateController({
    app: { isPackaged: true },
    updater,
    onStateChange: snapshot => snapshots.push(snapshot),
  });

  controller.setChannel('rc');
  assert.equal(updater.allowPrerelease, true);
  assert.equal(updater.allowDowngrade, true);

  await controller.checkForUpdates();
  assert.equal(controller.getState().status, 'available');
  assert.equal(controller.getState().requiresBackup, true);
  assert.equal(controller.getState().update?.version, '0.2.0-rc.1');

  await controller.downloadUpdate();
  assert.equal(controller.getState().status, 'downloaded');
  assert.equal(controller.getState().progressPercent, 100);

  assert.equal(controller.quitAndInstall(), true);
  assert.equal(updater.quitCalls, 1);

  controller.dismiss();
  assert.equal(controller.getState().status, 'idle');
  assert.equal(controller.getState().update, null);

  controller.dispose();
  assert.ok(snapshots.length >= 4);
});

test('createUpdateController can simulate update flow in unpackaged debug mode', async () => {
  const snapshots = [];
  const controller = createUpdateController({
    app: { isPackaged: false },
    updater: null,
    debugUpdateFixture: {
      status: 'available',
      version: '0.3.99-rc.1',
      releaseNotes: ['Mock release'],
    },
    onStateChange: snapshot => snapshots.push(snapshot),
  });

  assert.equal(controller.getState().supported, true);
  assert.equal(controller.getState().packaged, true);
  assert.equal(controller.getState().status, 'available');
  assert.equal(controller.getState().requiresBackup, true);

  controller.setChannel('rc');
  await controller.checkForUpdates();
  assert.equal(controller.getState().status, 'available');

  await controller.downloadUpdate();
  assert.equal(controller.getState().status, 'downloaded');
  assert.equal(controller.getState().progressPercent, 100);

  assert.equal(controller.quitAndInstall(), true);
  assert.ok(snapshots.length >= 3);
});
