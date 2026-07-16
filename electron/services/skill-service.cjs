const fs = require('fs');
const path = require('path');

const MANIFEST_NAME = 'manifest.json';

function getBundledSkillsRoot({ isPackaged = false, appPath = process.cwd(), resourcesPath = process.resourcesPath } = {}) {
  if (typeof arguments[0]?.skillsRoot === 'string' && arguments[0].skillsRoot.trim()) {
    return path.resolve(arguments[0].skillsRoot);
  }
  return isPackaged
    ? path.join(resourcesPath, 'skills')
    : path.join(appPath, 'src', 'skills');
}

function getUserSkillsRoot({ userDataPath } = {}) {
  const root = typeof userDataPath === 'string' && userDataPath.trim()
    ? userDataPath
    : process.cwd();
  return path.join(root, 'skills');
}

function readManifest(root) {
  const manifestPath = path.join(root, MANIFEST_NAME);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.skills)) {
    throw new Error('Invalid bundled skills manifest.');
  }
  return manifest;
}

function listBundledSkills(options = {}) {
  const root = getBundledSkillsRoot(options);
  const manifest = readManifest(root);
  return manifest.skills.map(skill => ({
    ...skill,
    source: 'omvra-bundled',
    root,
  }));
}

function normalizeSkillId(value) {
  return value
    .replace(/\.md$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function discoverUserSkills(options = {}) {
  const root = getUserSkillsRoot(options);
  if (!fs.existsSync(root)) return [];
  const skills = [];
  const walk = (directory, depth = 0) => {
    if (depth > 2) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath, depth + 1);
        continue;
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue;
      const skillId = normalizeSkillId(entry.name.toLowerCase() === 'skill.md' ? path.basename(directory) : entry.name);
      if (!skillId) continue;
      skills.push({
        skillId,
        path: path.relative(root, entryPath),
        stages: [],
        personas: [],
        source: 'omvra-user',
        root,
        trustStatus: 'user-local',
      });
    }
  };
  walk(root);
  return skills;
}

function listAvailableSkills(options = {}) {
  const available = new Map();
  for (const skill of listBundledSkills(options)) available.set(skill.skillId, skill);
  for (const skill of discoverUserSkills(options)) available.set(skill.skillId, skill);
  return [...available.values()];
}

function readSkillFile(skill, root) {
  const skillPath = path.resolve(root, skill.path);
  if (skillPath !== root && !skillPath.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Skill path escapes root: ${skill.skillId}`);
  }
  return fs.readFileSync(skillPath, 'utf8');
}

function getAvailableSkill(skillId, options = {}) {
  const normalizedId = typeof skillId === 'string' ? skillId.trim() : '';
  if (!normalizedId) return null;
  const skill = listAvailableSkills(options).find(candidate => candidate.skillId === normalizedId);
  if (!skill) return null;
  return {
    ...skill,
    content: readSkillFile(skill, skill.root),
  };
}

module.exports = {
  getBundledSkillsRoot,
  getUserSkillsRoot,
  listBundledSkills,
  discoverUserSkills,
  listAvailableSkills,
  getAvailableSkill,
};
