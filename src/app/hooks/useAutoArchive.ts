import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { AutoArchivePolicy, StatusColumn, Task } from '../types.ts';
import { reconcileAutoArchive } from '../../../electron/domain/auto-archive.mjs';

// Electron owns the policy in its main process. This supplies the browser preview.
export function useAutoArchive(tasks: Task[], columns: StatusColumn[], policy: AutoArchivePolicy | undefined, hydrated: boolean, setTasks: Dispatch<SetStateAction<Task[]>>) {
  const previous = useRef<Task[] | null>(null);
  const [now, setNow] = useState(Date.now);
  const desktop = typeof window !== 'undefined' && Boolean(window.electron?.storeGetMany);
  useEffect(() => {
    if (desktop || !hydrated) return;
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, [desktop, hydrated]);
  useEffect(() => {
    if (desktop || !hydrated) return;
    const next = reconcileAutoArchive(tasks, previous.current ?? tasks, columns, policy, Date.now());
    previous.current = next;
    if (next !== tasks) setTasks(current => current === tasks ? next : current);
  }, [columns, desktop, hydrated, now, policy, setTasks, tasks]);
}
