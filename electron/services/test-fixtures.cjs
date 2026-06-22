const fs = require('fs');
const path = require('path');

const PREFERENCES_KEY = 'omvra.preferences.v1';
const TASKS_KEY = 'omvra.tasks.v1';
const MILESTONES_KEY = 'omvra.milestones.v1';
const PEOPLE_KEY = 'omvra.people.v1';
const SWIMLANES_KEY = 'omvra.swimlanes.v1';
const STATUS_COLUMNS_KEY = 'omvra.statusColumns.v1';

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
  loadFixture,
  makeStoreFromFixture,
};
