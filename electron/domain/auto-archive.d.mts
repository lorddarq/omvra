import type { AutoArchivePolicy, Task, StatusColumn } from '../../src/app/types.ts';
export function normalizeAutoArchivePolicy(value: unknown): AutoArchivePolicy;
export function getBlockedArchiveTaskIds(tasks: Task[], requestedIds: ReadonlySet<string>): Set<string>;
export function reconcileAutoArchive(tasks: Task[], previousTasks: Task[], columns: StatusColumn[], policy: unknown, now?: number, busyTaskIds?: ReadonlySet<string>): Task[];
