import type { ProjectMilestone, Task } from '../types.ts';

export type ArchiveVisibility = 'active' | 'archived' | 'all';

export function isArchived(record: { archived?: boolean }): boolean {
  return record.archived === true;
}

export function filterByArchiveVisibility<T extends { archived?: boolean }>(
  records: T[],
  visibility: ArchiveVisibility = 'active'
): T[] {
  if (visibility === 'all') return records;
  const archived = visibility === 'archived';
  return records.filter(record => isArchived(record) === archived);
}

export function filterTasksByArchiveVisibility<T extends { archived?: boolean }>(tasks: T[], visibility: ArchiveVisibility = 'active'): T[] {
  return filterByArchiveVisibility(tasks, visibility);
}

export function filterMilestonesByArchiveVisibility(
  milestones: ProjectMilestone[],
  visibility: ArchiveVisibility = 'active'
): ProjectMilestone[] {
  return filterByArchiveVisibility(milestones, visibility);
}

export function getBlockedArchiveTaskIds(tasks: Task[], requestedIds: ReadonlySet<string>): Set<string> {
  const active = new Map(tasks.filter(task => !isArchived(task)).map(task => [task.id, task]));
  const neighbors = new Map<string, Set<string>>();
  for (const task of active.values()) {
    for (const id of task.dependencyIds || []) {
      if (!active.has(id)) continue;
      if (!neighbors.has(task.id)) neighbors.set(task.id, new Set());
      if (!neighbors.has(id)) neighbors.set(id, new Set());
      neighbors.get(task.id)!.add(id);
      neighbors.get(id)!.add(task.id);
    }
  }
  // Any active dependency outside the batch blocks its whole selected component.
  const blocked = new Set<string>();
  const queue = [...active.keys()].filter(id => !requestedIds.has(id));
  for (let index = 0; index < queue.length; index += 1) {
    for (const id of neighbors.get(queue[index]) || []) {
      if (!requestedIds.has(id) || blocked.has(id)) continue;
      blocked.add(id);
      queue.push(id);
    }
  }
  return blocked;
}

export function getRequiredArchivedDependencyIds(task: Task, tasksById: ReadonlyMap<string, Task>): string[] {
  const required = new Set<string>();
  const visit = (taskId: string) => {
    const dependency = tasksById.get(taskId);
    if (!dependency || !isArchived(dependency)) return;
    if (required.has(taskId)) return;
    required.add(taskId);
    dependency.dependencyIds?.forEach(visit);
  };

  task.dependencyIds?.forEach(visit);
  return [...required];
}
