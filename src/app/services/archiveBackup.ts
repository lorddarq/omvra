import type { Person, ProjectMilestone, StatusColumn, Task, TimelineSwimlane } from '../types.ts';
import { sanitizeMilestones, sanitizePeople, sanitizeStatusColumns, sanitizeTasks, sanitizeTimelineSwimlanes } from './workspaceBackup.ts';

type ArchiveWorkspace = {
  tasks: Task[];
  milestones: ProjectMilestone[];
  projects: TimelineSwimlane[];
  people: Person[];
  statusColumns: StatusColumn[];
};

export function buildArchiveBackup(workspace: ArchiveWorkspace) {
  return {
    kind: 'omvra-archive',
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: workspace.tasks.filter(task => task.archived === true),
    milestones: workspace.milestones.filter(milestone => milestone.archived === true),
    projects: workspace.projects,
    people: workspace.people.map(({ id, name, role, kind, color }) => ({ id, name, role, kind, color })),
    statusColumns: workspace.statusColumns,
  };
}

function mergeMissing<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const ids = new Set(existing.map(record => record.id));
  return [...existing, ...incoming.filter(record => !ids.has(record.id))];
}

export function mergeArchiveBackup(value: unknown, workspace: ArchiveWorkspace): ArchiveWorkspace {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an archive JSON object.');
  const payload = value as Record<string, unknown>;
  if (payload.kind !== 'omvra-archive' || payload.version !== 1) throw new Error('Unsupported archive format or version.');
  for (const key of ['tasks', 'milestones', 'projects', 'people', 'statusColumns']) {
    const records = payload[key];
    if (!Array.isArray(records)) throw new Error(`Archive is missing ${key}.`);
    const ids = new Set<string>();
    for (const record of records) {
      if (!record || typeof record !== 'object' || typeof record.id !== 'string' || !record.id.trim() || ids.has(record.id)) {
        throw new Error(`Archive contains invalid or duplicate ${key} IDs.`);
      }
      ids.add(record.id);
      const label = key === 'projects' || key === 'people' ? record.name : record.title;
      if (typeof label !== 'string') throw new Error(`Archive contains invalid ${key} labels.`);
      if (key === 'tasks' && (typeof record.status !== 'string' || !record.status.trim())) throw new Error('Archived tasks must include a status.');
      for (const field of ['dependencyIds', 'projectIds', 'linkedTaskIds']) {
        if (record[field] !== undefined && (!Array.isArray(record[field]) || record[field].some((id: unknown) => typeof id !== 'string'))) {
          throw new Error(`Archive contains invalid ${field}.`);
        }
      }
      if ((key === 'tasks' || key === 'milestones') && (record.archived !== true || typeof record.title !== 'string')) {
        throw new Error('Only archived tasks and milestones can be imported here.');
      }
    }
  }
  const projects = mergeMissing(workspace.projects, sanitizeTimelineSwimlanes(payload.projects, []));
  const people = mergeMissing(workspace.people, sanitizePeople(payload.people));
  const statusColumns = mergeMissing(workspace.statusColumns, sanitizeStatusColumns(payload.statusColumns, []));
  const tasks = sanitizeTasks(payload.tasks, projects);
  const milestones = sanitizeMilestones(payload.milestones, projects);
  if (tasks.length !== (payload.tasks as unknown[]).length || milestones.length !== (payload.milestones as unknown[]).length) {
    throw new Error('Archive contains invalid tasks or milestones; nothing was imported.');
  }
  return {
    tasks: mergeMissing(workspace.tasks, tasks),
    milestones: mergeMissing(workspace.milestones, milestones),
    projects,
    people,
    statusColumns,
  };
}
