const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { resolveWorkspaceUserDataPath } = require('./workspace-paths.cjs');

test('development workspace path consistently prefers the legacy workspace when present', () => {
  const appDataPath = path.join('/tmp', 'omvra-app-data');
  assert.equal(resolveWorkspaceUserDataPath({ appDataPath, isDev: true, fileSystem: { existsSync: value => value === path.join(appDataPath, '@figma', 'my-make-file') } }), path.join(appDataPath, '@figma', 'my-make-file'));
  assert.equal(resolveWorkspaceUserDataPath({ appDataPath, isDev: true, fileSystem: { existsSync: () => false } }), path.join(appDataPath, 'Omvra'));
  assert.equal(resolveWorkspaceUserDataPath({ appDataPath, isDev: false }), null);
});
