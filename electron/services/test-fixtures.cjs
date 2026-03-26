const fs = require('fs');
const path = require('path');

const PREFERENCES_KEY = 'plumy.preferences.v1';
const TASKS_KEY = 'plumy.tasks.v1';
const PEOPLE_KEY = 'plumy.people.v1';
const SWIMLANES_KEY = 'plumy.swimlanes.v1';
const STATUS_COLUMNS_KEY = 'plumy.statusColumns.v1';

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
  PEOPLE_KEY,
  SWIMLANES_KEY,
  STATUS_COLUMNS_KEY,
  loadFixture,
  makeStoreFromFixture,
};
