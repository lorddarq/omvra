import { reconcileAutoArchive } from '../domain/auto-archive.mjs';

// Main-process ownership covers UI writes, MCP writes, startup and closed windows.
export function startAutoArchiveService(store, getBusyTaskIds = () => new Set()) {
  const tasksKey = 'omvra.tasks.v1';
  let previous = store.get(tasksKey) || [];
  let applying = false;
  let scheduled = false;
  let stopped = false;
  function check() {
    if (applying || stopped) return;
    applying = true;
    try {
      const tasks = store.get(tasksKey) || [];
      const next = reconcileAutoArchive(tasks, previous, store.get('omvra.statusColumns.v1') || [], store.get('omvra.preferences.v1')?.autoArchivePolicy, Date.now(), getBusyTaskIds());
      if (next !== tasks) store.set(tasksKey, next);
      previous = next;
    } catch (error) {
      console.error('[auto-archive] Could not apply archive policy:', error);
    } finally {
      applying = false;
    }
  }
  const schedule = () => {
    if (scheduled || stopped) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; check(); });
  };
  const unsubscribes = [tasksKey, 'omvra.statusColumns.v1', 'omvra.preferences.v1', 'omvra.acpSessionBindings.v1']
    .map(key => store.onDidChange(key, schedule));
  const interval = setInterval(check, 60000);
  interval.unref?.();
  check();
  return () => { stopped = true; clearInterval(interval); unsubscribes.forEach(unsubscribe => unsubscribe()); };
}
