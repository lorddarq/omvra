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

export { getBlockedArchiveTaskIds } from '../../../electron/domain/auto-archive.mjs';

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
