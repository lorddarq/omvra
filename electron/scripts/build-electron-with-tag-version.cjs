#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function readPackageVersion() {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return pkg.version;
}

function normalizeTagToVersion(tag) {
  if (!tag) return null;
  const cleaned = String(tag).trim().replace(/^refs\/tags\//, '').replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(cleaned)) return null;
  return cleaned;
}

function getVersionFromTag() {
  const refType = process.env.GITHUB_REF_TYPE;
  const refName = process.env.GITHUB_REF_NAME;
  if (refType === 'tag' && refName) {
    const v = normalizeTagToVersion(refName);
    if (v) return v;
  }

  const latestTag = spawnSync(
    'git',
    ['for-each-ref', '--sort=-creatordate', '--format', '%(refname:short)', 'refs/tags'],
    { encoding: 'utf8' }
  );
  if (latestTag.status === 0) {
    const firstTag = latestTag.stdout.split(/\r?\n/).find(Boolean);
    const v = normalizeTagToVersion(firstTag);
    if (v) return v;
  }

  return null;
}

function hasExplicitMacSigningConfiguration(env) {
  const signingKeys = [
    'CSC_LINK',
    'CSC_KEY_PASSWORD',
    'CSC_NAME',
    'APPLE_ID',
    'APPLE_APP_SPECIFIC_PASSWORD',
    'APPLE_TEAM_ID',
    'APPLE_API_KEY',
    'APPLE_API_KEY_ID',
    'APPLE_API_ISSUER',
  ];

  return signingKeys.some(key => Boolean(env[key]));
}

function run() {
  const packageVersion = readPackageVersion();
  const tagVersion = getVersionFromTag();
  const resolvedVersion = tagVersion || packageVersion;

  console.log(`[build-electron] package.json version: ${packageVersion}`);
  console.log(`[build-electron] resolved build version: ${resolvedVersion}${tagVersion ? ' (from tag)' : ' (fallback)'}`);

  const bin = process.platform === 'win32'
    ? path.resolve(process.cwd(), 'node_modules', '.bin', 'electron-builder.cmd')
    : path.resolve(process.cwd(), 'node_modules', '.bin', 'electron-builder');

  const args = ['--config.extraMetadata.version=' + resolvedVersion];
  const buildEnv = { ...process.env };

  // On macOS, electron-builder may auto-discover a locally installed signing
  // identity. Disable that unless signing was configured explicitly so local
  // builds do not accidentally embed a contributor's personal certificate info.
  if (
    process.platform === 'darwin'
    && !buildEnv.CSC_IDENTITY_AUTO_DISCOVERY
    && !hasExplicitMacSigningConfiguration(buildEnv)
  ) {
    buildEnv.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
    console.log('[build-electron] mac signing auto-discovery disabled (no explicit signing credentials configured)');
  }

  const result = spawnSync(bin, args, { stdio: 'inherit', env: buildEnv });
  process.exit(result.status || 0);
}

run();
