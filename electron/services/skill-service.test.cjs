const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { getBundledSkillsRoot, getUserSkillsRoot, listBundledSkills, listAvailableSkills, getAvailableSkill } = require('./skill-service.cjs');

const skillsRoot = path.resolve(__dirname, '../../src/skills');

test('bundled skill catalog resolves from the local source tree', () => {
  assert.equal(getBundledSkillsRoot({ skillsRoot }), skillsRoot);
  const skills = listBundledSkills({ skillsRoot });
  assert.ok(skills.length >= 15);
  assert.ok(skills.some(skill => skill.skillId === 'business-problem-framing'));
  assert.ok(skills.every(skill => skill.source === 'omvra-bundled'));
});

test('bundled skill reads are constrained to manifest entries', () => {
  const skill = getAvailableSkill('process-modeler', { skillsRoot, userDataPath: path.resolve(__dirname, '../../.tmp-skill-user-data') });
  assert.equal(skill.skillId, 'process-modeler');
  assert.match(skill.content, /process model/i);
  assert.equal(getAvailableSkill('not-installed', { skillsRoot, userDataPath: path.resolve(__dirname, '../../.tmp-skill-user-data') }), null);
});

test('user-local skills are discovered outside the packaged bundle', () => {
  const userDataPath = path.resolve(__dirname, '../../.tmp-skill-user-data');
  const userSkillsRoot = getUserSkillsRoot({ userDataPath });
  const fs = require('node:fs');
  fs.mkdirSync(path.join(userSkillsRoot, 'custom'), { recursive: true });
  fs.writeFileSync(path.join(userSkillsRoot, 'custom', 'release-readiness.md'), '# Release readiness\n');
  const skills = listAvailableSkills({ skillsRoot, userDataPath });
  assert.ok(skills.some(skill => skill.skillId === 'release-readiness' && skill.source === 'omvra-user'));
  fs.rmSync(path.resolve(__dirname, '../../.tmp-skill-user-data'), { recursive: true, force: true });
});
