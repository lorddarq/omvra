const {POLICY_KEY}=require('../services/agent-work-maintenance.cjs');
const { STORAGE_KEY } = require('../services/agent-work-migration.cjs');
const { SESSION_BINDINGS_KEY, SESSION_EVENTS_KEY } = require('../domain/agent-runtime-session-service.cjs');
function setNestedValue(target, key, value) {
  const segments = key.split('.').filter(Boolean);
  if (segments.length === 0) return;
  let cursor = target;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      cursor[segment] = value;
      return;
    }
    if (!cursor[segment] || typeof cursor[segment] !== 'object' || Array.isArray(cursor[segment])) {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  });
}

function registerStoreIpcHandlers({ ipcMain, store, preferencesKey, onPreferencesSet, onStoreMutation, agentWorkManaged = false }) {
  const protect = keys => {
    if(!agentWorkManaged && !store.get(STORAGE_KEY)) return;
    if(keys.some(key=>[POLICY_KEY,STORAGE_KEY,SESSION_BINDINGS_KEY,SESSION_EVENTS_KEY].some(retired=>key===retired || retired.startsWith(`${key}.`) || key.startsWith(`${retired}.`)))) throw Object.assign(new Error('AGENT_WORK_LEGACY_WRITE_FORBIDDEN'),{code:'AGENT_WORK_LEGACY_WRITE_FORBIDDEN'});
  };
  const read = key => {
    if(agentWorkManaged || store.get(STORAGE_KEY)) {
      if([SESSION_BINDINGS_KEY,SESSION_EVENTS_KEY].some(retired=>key===retired || key.startsWith(`${retired}.`) || retired.startsWith(`${key}.`))) {
        if(key==='omvra') { const value=structuredClone(store.get(key)||{});delete value.acpSessionBindings;delete value.acpSessionEvents;return value; }
        return undefined;
      }
    }
    return store.get(key);
  };
  ipcMain.handle('store/get', (_, key) => read(key));
  ipcMain.handle('store/get-many', (_, keys) => {
    const requestedKeys = Array.isArray(keys) ? keys.filter(key => typeof key === 'string') : [];
    return Object.fromEntries(requestedKeys.map(key => [key, read(key)]));
  });
  ipcMain.handle('store/set', (_, key, value) => {
    protect([key]);
    if (typeof onStoreMutation === 'function' && typeof key === 'string') onStoreMutation([key]);
    const result = store.set(key, value);
    if (key === preferencesKey && typeof onPreferencesSet === 'function') {
      onPreferencesSet(value);
    }
    return result;
  });
  ipcMain.handle('store/set-many', (_, values) => {
    const entries = values && typeof values === 'object' && !Array.isArray(values)
      ? Object.entries(values)
      : [];
    protect(entries.map(([key])=>key));
    if (entries.length === 0) return { count: 0 };
    if (typeof onStoreMutation === 'function') onStoreMutation(entries.map(([key]) => key));

    const storedSnapshot = store.store;
    const current = storedSnapshot && typeof storedSnapshot === 'object' ? storedSnapshot : {};
    const next = { ...current };
    entries.forEach(([key, value]) => setNestedValue(next, key, value));

    let storeDescriptor;
    let storePrototype = store;
    while (storePrototype && !storeDescriptor) {
      storeDescriptor = Object.getOwnPropertyDescriptor(storePrototype, 'store');
      storePrototype = Object.getPrototypeOf(storePrototype);
    }
    if (storeDescriptor?.set) {
      try {
        store.store = next;
      } catch {
        entries.forEach(([key, value]) => store.set(key, value));
      }
    } else {
      entries.forEach(([key, value]) => store.set(key, value));
    }

    const preferenceEntry = entries.find(([key]) => key === preferencesKey);
    if (preferenceEntry && typeof onPreferencesSet === 'function') {
      onPreferencesSet(preferenceEntry[1]);
    }
    return { count: entries.length };
  });
  ipcMain.handle('store/delete', (_, key) => {
    protect([key]);
    if (typeof onStoreMutation === 'function' && typeof key === 'string') onStoreMutation([key]);
    return store.delete(key);
  });
  ipcMain.handle('store/export', () => {
    const snapshot = structuredClone(store.store);
    if(agentWorkManaged || store.get(STORAGE_KEY)) {
      for(const key of [POLICY_KEY,STORAGE_KEY,SESSION_BINDINGS_KEY,SESSION_EVENTS_KEY]) delete snapshot[key];
      delete snapshot.omvra?.agentWorkStorage;
      delete snapshot.omvra?.agentWorkPolicy;
      delete snapshot.omvra?.acpSessionBindings;
      delete snapshot.omvra?.acpSessionEvents;
      setNestedValue(snapshot, 'omvra.agentWorkBackup.v1', {schemaVersion:1,included:false,reason:'workspace-only-export'});
    }
    return snapshot;
  });
}

module.exports = { registerStoreIpcHandlers };
