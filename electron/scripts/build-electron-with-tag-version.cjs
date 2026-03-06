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
  const result = spawnSync(bin, args, { stdio: 'inherit' });
  process.exit(result.status || 0);
}

run();
