const test = require('node:test');
const assert = require('node:assert/strict');

test('canonical bootstrap prefers electron-store when available', async () => {
  const mod = await import('../../src/app/utils/canonicalHydration.js');
  const { shouldBootstrapFromLocalStorage } = mod;

  const originalWindow = global.window;

  try {
    delete global.window;
    assert.equal(shouldBootstrapFromLocalStorage(), false);

    global.window = {};
    assert.equal(shouldBootstrapFromLocalStorage(), true);

    global.window = {
      electron: {
        storeGet: async () => null,
      },
    };
    assert.equal(shouldBootstrapFromLocalStorage(), false);
  } finally {
    if (typeof originalWindow === 'undefined') {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});
