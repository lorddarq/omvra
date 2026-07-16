const fs = require('fs');
const path = require('path');

const PREFERENCES_KEY = 'omvra.preferences.v1';
const TASKS_KEY = 'omvra.tasks.v1';
const MILESTONES_KEY = 'omvra.milestones.v1';
const PEOPLE_KEY = 'omvra.people.v1';
const SWIMLANES_KEY = 'omvra.swimlanes.v1';
const STATUS_COLUMNS_KEY = 'omvra.statusColumns.v1';
const GOALS_KEY = 'omvra.goals.v1';

const SENSITIVE_MCP_INPUTS = Object.freeze({
  payload: 'payload-secret-must-not-persist',
  accessToken: 'access-token-must-not-persist',
  authorization: 'Bearer authorization-must-not-persist',
  cookie: 'session-cookie-must-not-persist',
  userAgent: 'Codex/1.0 identifying-user-agent-must-not-persist',
  taskTitle: 'Private task title must not persist',
});

class MemoryStore {
  constructor(seed = {}) {
    this.map = new Map(Object.entries(seed));
  }

  get(key) {
    return this.map.get(key);
  }

  set(key, value) {
    this.map.set(key, value);
  }
}

function loadFixture(name) {
  const fixturePath = path.join(__dirname, 'fixtures', `${name}.json`);
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

function makeStoreFromFixture(name, overrides = {}) {
  const fixture = loadFixture(name);
  return new MemoryStore({
    ...fixture,
    ...overrides,
  });
}

module.exports = {
  MemoryStore,
  PREFERENCES_KEY,
  TASKS_KEY,
  MILESTONES_KEY,
  PEOPLE_KEY,
  SWIMLANES_KEY,
  STATUS_COLUMNS_KEY,
  GOALS_KEY,
  SENSITIVE_MCP_INPUTS,
  loadFixture,
  makeStoreFromFixture,
};
