const fs = require('fs');
const path = require('path');

const CLEANUP_FILES = ['project.md', 'roster.md'];
const GOAL_ARTIFACTS_DIRECTORY = 'goal-artifacts';

function getGoalArtifactsRoot({ userDataPath, pathModule = path } = {}) {
  if (typeof userDataPath !== 'string' || !userDataPath.trim()) return null;
  return pathModule.resolve(userDataPath, GOAL_ARTIFACTS_DIRECTORY);
}

function isSafeGoalId(goalId) {
  return typeof goalId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(goalId);
}

function isScopedArtifactDirectory(artifactRoot, goalId, pathModule = path) {
  if (!isSafeGoalId(goalId) || typeof artifactRoot !== 'string' || !artifactRoot.trim()) return false;
  const root = pathModule.resolve(artifactRoot);
  const goalDirectory = pathModule.resolve(root, goalId);
  return goalDirectory !== root && goalDirectory.startsWith(`${root}${pathModule.sep}`);
}

function cleanupGoalArtifacts({
  goalId,
  artifactRoot,
  userDataPath,
  cleanupEnabled,
  durableRecordsVerified,
  finalEvidenceVerified,
  fsModule = fs,
  pathModule = path,
} = {}) {
  const requestedFiles = [...CLEANUP_FILES];
  const resolvedArtifactRoot = artifactRoot || getGoalArtifactsRoot({ userDataPath, pathModule });

  if (!cleanupEnabled) {
    return { ok: true, status: 'skipped', reason: 'setting-disabled', requestedFiles, removedFiles: [] };
  }

  if (!durableRecordsVerified || !finalEvidenceVerified) {
    return { ok: true, status: 'blocked', reason: 'verification-incomplete', requestedFiles, removedFiles: [] };
  }

  if (!isScopedArtifactDirectory(resolvedArtifactRoot, goalId, pathModule)) {
    return { ok: false, status: 'invalid', reason: 'unsafe-artifact-scope', requestedFiles, removedFiles: [] };
  }

  const goalDirectory = pathModule.resolve(pathModule.resolve(resolvedArtifactRoot), goalId);
  const removedFiles = [];
  const failures = [];

  for (const fileName of CLEANUP_FILES) {
    const filePath = pathModule.join(goalDirectory, fileName);
    try {
      const stats = fsModule.lstatSync(filePath);
      if (stats.isSymbolicLink() || !stats.isFile()) {
        failures.push({ file: fileName, reason: 'not-a-regular-file' });
        continue;
      }
      fsModule.unlinkSync(filePath);
      removedFiles.push(fileName);
    } catch (error) {
      if (error && error.code === 'ENOENT') continue;
      failures.push({ file: fileName, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    ok: failures.length === 0,
    status: failures.length === 0 ? 'cleaned' : 'partial-failure',
    reason: failures.length === 0 ? 'verified-and-removed' : 'one-or-more-files-failed',
    requestedFiles,
    removedFiles,
    failures,
  };
}

module.exports = {
  CLEANUP_FILES,
  GOAL_ARTIFACTS_DIRECTORY,
  cleanupGoalArtifacts,
  getGoalArtifactsRoot,
  isSafeGoalId,
  isScopedArtifactDirectory,
};
