#!/usr/bin/env node
const { spawn, spawnSync } = require('child_process');
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

function hasExplicitMacNotarizationConfiguration(env) {
  const hasAppleIdFlow = Boolean(env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID);
  const hasApiKeyFlow = Boolean(env.APPLE_API_KEY && env.APPLE_API_KEY_ID && env.APPLE_API_ISSUER);
  return hasAppleIdFlow || hasApiKeyFlow;
}

function isTaggedReleaseBuild(env) {
  if (env.GITHUB_REF_TYPE === 'tag' && env.GITHUB_REF_NAME) {
    return true;
  }

  const tagFromRef = typeof env.GITHUB_REF === 'string' ? env.GITHUB_REF : '';
  return /^refs\/tags\/v/.test(tagFromRef);
}

function getReleaseDirectory() {
  return path.resolve(process.cwd(), 'release');
}

function listBuiltMacAppBundles(releaseDir = getReleaseDirectory()) {
  if (!fs.existsSync(releaseDir)) {
    return [];
  }

  return fs.readdirSync(releaseDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('mac'))
    .flatMap(entry => {
      const dirPath = path.join(releaseDir, entry.name);
      return fs.readdirSync(dirPath, { withFileTypes: true })
        .filter(child => child.isDirectory() && child.name.endsWith('.app'))
        .map(child => path.join(dirPath, child.name));
    });
}

function inspectCodesign(appPath) {
  const result = spawnSync('codesign', ['-dv', '--verbose=4', appPath], { encoding: 'utf8' });
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');

  if (result.status !== 0) {
    throw new Error(`codesign inspection failed for ${appPath}\n${output}`.trim());
  }

  return output;
}

function verifyCodesign(appPath) {
  const result = spawnSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], { encoding: 'utf8' });
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');

  if (result.status !== 0) {
    throw new Error(`codesign verification failed for ${appPath}\n${output}`.trim());
  }

  return output;
}

function parseCodesignDetails(output) {
  const details = {
    signature: null,
    teamIdentifier: null,
    authorities: [],
  };

  for (const rawLine of String(output).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('Signature=')) {
      details.signature = line.slice('Signature='.length).trim();
      continue;
    }

    if (line.startsWith('TeamIdentifier=')) {
      details.teamIdentifier = line.slice('TeamIdentifier='.length).trim();
      continue;
    }

    if (line.startsWith('Authority=')) {
      details.authorities.push(line.slice('Authority='.length).trim());
    }
  }

  return details;
}

function validateMacReleaseSignature(details) {
  if (!details || typeof details !== 'object') {
    return { ok: false, reason: 'Missing codesign metadata.' };
  }

  if (!details.signature || details.signature === 'adhoc') {
    return { ok: false, reason: 'App bundle is ad-hoc signed.' };
  }

  if (!details.teamIdentifier || details.teamIdentifier === 'not set') {
    return { ok: false, reason: 'App bundle has no TeamIdentifier.' };
  }

  if (!details.authorities.some(authority => authority.includes('Developer ID Application:'))) {
    return { ok: false, reason: 'App bundle is not signed with a Developer ID Application certificate.' };
  }

  return { ok: true, reason: null };
}

function assertTaggedMacReleaseArtifactsAreSigned() {
  const appBundles = listBuiltMacAppBundles();
  if (appBundles.length === 0) {
    throw new Error('No built macOS app bundle was found under release/mac* for signature verification.');
  }

  for (const appPath of appBundles) {
    verifyCodesign(appPath);
    const details = parseCodesignDetails(inspectCodesign(appPath));
    const validation = validateMacReleaseSignature(details);

    if (!validation.ok) {
      throw new Error(`${validation.reason} (${appPath})`);
    }

    console.log(
      `[build-electron] verified macOS release signature for ${path.basename(appPath)} using team ${details.teamIdentifier}`
    );
  }
}

function pipeFilteredStream(stream, writer, onFilteredLine) {
  let buffer = '';

  stream.on('data', chunk => {
    buffer += chunk.toString();

    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      if (!onFilteredLine(line)) {
        writer.write(line + '\n');
      }

      newlineIndex = buffer.indexOf('\n');
    }
  });

  stream.on('end', () => {
    if (buffer && !onFilteredLine(buffer)) {
      writer.write(buffer);
    }
  });
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

  const args = ['--config.extraMetadata.version=' + resolvedVersion, '--publish=never'];
  const buildEnv = { ...process.env };
  const isWindows = process.platform === 'win32';
  const hasMacSigning = hasExplicitMacSigningConfiguration(buildEnv);
  const hasMacNotarization = hasExplicitMacNotarizationConfiguration(buildEnv);

  if (process.platform === 'darwin' && isTaggedReleaseBuild(buildEnv) && !hasMacSigning) {
    console.error(
      '[build-electron] refusing to package tagged macOS release without explicit signing credentials; unsigned or mismatched signatures will break auto-update installation'
    );
    process.exit(1);
  }

  if (process.platform === 'darwin' && isTaggedReleaseBuild(buildEnv) && !hasMacNotarization) {
    console.error(
      '[build-electron] refusing to package tagged macOS release without notarization credentials; signed-but-unnotarized builds will not pass Gatekeeper cleanly'
    );
    process.exit(1);
  }

  // On macOS, electron-builder may auto-discover a locally installed signing
  // identity. Disable that unless signing was configured explicitly so local
  // builds do not accidentally embed a contributor's personal certificate info.
  if (
    process.platform === 'darwin'
    && !buildEnv.CSC_IDENTITY_AUTO_DISCOVERY
    && !hasMacSigning
  ) {
    buildEnv.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
    console.log('[build-electron] mac signing auto-discovery disabled (no explicit signing credentials configured)');
  }

  const builder = spawn(bin, args, {
    env: buildEnv,
    shell: isWindows,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  builder.on('error', error => {
    console.error(`[build-electron] failed to launch electron-builder: ${error.message}`);
    process.exit(1);
  });

  let duplicateDependencyWarningShown = false;
  const filterDuplicateDependencyLine = line => {
    if (!line.includes('duplicate dependency references')) {
      return false;
    }

    if (!duplicateDependencyWarningShown) {
      duplicateDependencyWarningShown = true;
      process.stdout.write(
        '[build-electron] electron-builder reported duplicate transitive dependency references while scanning node_modules; verbose list suppressed\n'
      );
    }

    return true;
  };

  pipeFilteredStream(builder.stdout, process.stdout, filterDuplicateDependencyLine);
  pipeFilteredStream(builder.stderr, process.stderr, filterDuplicateDependencyLine);

  builder.on('close', code => {
    if (code === 0 && process.platform === 'darwin' && isTaggedReleaseBuild(buildEnv)) {
      try {
        assertTaggedMacReleaseArtifactsAreSigned();
      } catch (error) {
        console.error(`[build-electron] ${error.message}`);
        process.exit(1);
      }
    }

    process.exit(code || 0);
  });
}

if (require.main === module) {
  run();
}

module.exports = {
  hasExplicitMacNotarizationConfiguration,
  hasExplicitMacSigningConfiguration,
  inspectCodesign,
  isTaggedReleaseBuild,
  listBuiltMacAppBundles,
  parseCodesignDetails,
  validateMacReleaseSignature,
  verifyCodesign,
};
