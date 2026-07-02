const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

function loadPreloadBridge() {
  const preloadPath = path.resolve(__dirname, '../preload.cjs');
  const originalLoad = Module._load;
  const invokeCalls = [];
  const onCalls = [];
  const removeCalls = [];
  let exposed = null;

  const mockElectron = {
    contextBridge: {
      exposeInMainWorld(name, value) {
        exposed = { name, value };
      },
    },
    ipcRenderer: {
      invoke(...args) {
        invokeCalls.push(args);
        return Promise.resolve(args);
      },
      on(channel, listener) {
        onCalls.push([channel, listener]);
      },
      removeListener(channel, listener) {
        removeCalls.push([channel, listener]);
      },
    },
  };

  delete require.cache[preloadPath];
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') {
      return mockElectron;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    require(preloadPath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[preloadPath];
  }

  return {
    exposed,
    invokeCalls,
    onCalls,
    removeCalls,
  };
}

test('preload exposes the intended update bridge methods', async () => {
  const { exposed, invokeCalls } = loadPreloadBridge();

  assert.equal(exposed.name, 'electron');
  assert.deepEqual(Object.keys(exposed.value.updates), [
    'getState',
    'check',
    'download',
    'install',
    'dismiss',
    'setChannel',
    'onStateChanged',
  ]);

  await exposed.value.updates.getState();
  await exposed.value.updates.check();
  await exposed.value.updates.download();
  await exposed.value.updates.install();
  await exposed.value.updates.dismiss();
  await exposed.value.updates.setChannel('rc');

  assert.deepEqual(invokeCalls, [
    ['updates/get-state'],
    ['updates/check'],
    ['updates/download'],
    ['updates/install'],
    ['updates/dismiss'],
    ['updates/set-channel', 'rc'],
  ]);
});

test('preload forwards update state events and unsubscribes cleanly', () => {
  const { exposed, onCalls, removeCalls } = loadPreloadBridge();
  const payloads = [];

  const unsubscribe = exposed.value.updates.onStateChanged((payload) => {
    payloads.push(payload);
  });

  assert.equal(onCalls.length, 1);
  assert.equal(onCalls[0][0], 'updates/state-changed');

  const listener = onCalls[0][1];
  listener(null, { status: 'available', update: { version: '0.3.33' } });

  assert.deepEqual(payloads, [
    { status: 'available', update: { version: '0.3.33' } },
  ]);

  unsubscribe();

  assert.equal(removeCalls.length, 1);
  assert.equal(removeCalls[0][0], 'updates/state-changed');
  assert.equal(removeCalls[0][1], listener);
});
