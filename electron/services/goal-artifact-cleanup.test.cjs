const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { cleanupGoalArtifacts, getGoalArtifactsRoot } = require('./goal-artifact-cleanup.cjs');

function makeArtifactFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'omvra-goal-artifacts-'));
  const goalDirectory = path.join(root, 'goal-1');
  fs.mkdirSync(goalDirectory);
  fs.writeFileSync(path.join(goalDirectory, 'project.md'), 'working context');
  fs.writeFileSync(path.join(goalDirectory, 'roster.md'), 'recruitment context');
  fs.writeFileSync(path.join(root, 'durable-events.jsonl'), 'must remain');
  return { root, goalDirectory };
}

test('cleanup is disabled by default and preserves artifacts', () => {
  const fixture = makeArtifactFixture();
  const result = cleanupGoalArtifacts({
    goalId: 'goal-1',
    artifactRoot: fixture.root,
    cleanupEnabled: false,
    durableRecordsVerified: true,
    finalEvidenceVerified: true,
  });

  assert.equal(result.status, 'skipped');
  assert.equal(fs.existsSync(path.join(fixture.goalDirectory, 'project.md')), true);
  assert.equal(fs.existsSync(path.join(fixture.goalDirectory, 'roster.md')), true);
  assert.equal(fs.existsSync(path.join(fixture.root, 'durable-events.jsonl')), true);
});

test('cleanup fails closed until durable records and final evidence are verified', () => {
  const fixture = makeArtifactFixture();
  const result = cleanupGoalArtifacts({
    goalId: 'goal-1',
    artifactRoot: fixture.root,
    cleanupEnabled: true,
    durableRecordsVerified: true,
    finalEvidenceVerified: false,
  });

  assert.equal(result.status, 'blocked');
  assert.equal(fs.existsSync(path.join(fixture.goalDirectory, 'project.md')), true);
  assert.equal(fs.existsSync(path.join(fixture.goalDirectory, 'roster.md')), true);
});

test('verified cleanup removes only the two working-context files and is idempotent', () => {
  const fixture = makeArtifactFixture();
  const input = {
    goalId: 'goal-1',
    artifactRoot: fixture.root,
    cleanupEnabled: true,
    durableRecordsVerified: true,
    finalEvidenceVerified: true,
  };

  const first = cleanupGoalArtifacts(input);
  const second = cleanupGoalArtifacts(input);

  assert.equal(first.status, 'cleaned');
  assert.deepEqual(first.removedFiles, ['project.md', 'roster.md']);
  assert.equal(second.status, 'cleaned');
  assert.deepEqual(second.removedFiles, []);
  assert.equal(fs.existsSync(path.join(fixture.root, 'durable-events.jsonl')), true);
});

test('userDataPath resolves to the recoverable Electron goal-artifacts directory', () => {
  const userDataPath = path.join(os.tmpdir(), 'Omvra');
  assert.equal(
    getGoalArtifactsRoot({ userDataPath }),
    path.join(userDataPath, 'goal-artifacts')
  );
});

test('unsafe goal ids are rejected before any deletion', () => {
  const fixture = makeArtifactFixture();
  const result = cleanupGoalArtifacts({
    goalId: '../outside',
    artifactRoot: fixture.root,
    cleanupEnabled: true,
    durableRecordsVerified: true,
    finalEvidenceVerified: true,
  });

  assert.equal(result.status, 'invalid');
  assert.equal(fs.existsSync(path.join(fixture.goalDirectory, 'project.md')), true);
  assert.equal(fs.existsSync(path.join(fixture.goalDirectory, 'roster.md')), true);
});
