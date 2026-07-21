const fs = require('fs');
const path = require('path');

function resolveWorkspaceUserDataPath({ appDataPath, appName = 'Omvra', isDev, fileSystem = fs } = {}) {
  if (!isDev || typeof appDataPath !== 'string' || !appDataPath.trim()) return null;
  const legacyPath = path.join(appDataPath, '@figma', 'my-make-file');
  return fileSystem.existsSync(legacyPath) ? legacyPath : path.join(appDataPath, appName);
}

module.exports = { resolveWorkspaceUserDataPath };
