import type { Person, Task, TaskPriority, TimelineSwimlane } from '../types.ts';
import {
  persistJSONWithElectronMirror,
  readInitialWorkspaceJSON,
} from './storage.ts';

export const KANBAN_TASK_FILTERS_STORAGE_KEY = 'plumy.filters.v1';
export const UNASSIGNED_ASSIGNEE_FILTER_VALUE = '__plumy_unassigned__';

export type TaskAssigneeFilterValue =
  | string
  | typeof UNASSIGNED_ASSIGNEE_FILTER_VALUE;

export interface KanbanTaskFilters {
  projectId?: string;
  priority?: TaskPriority;
  assigneeId?: TaskAssigneeFilterValue;
}

export type KanbanTaskFilterKey = keyof KanbanTaskFilters;

export const EMPTY_KANBAN_TASK_FILTERS: KanbanTaskFilters = {};

const TASK_PRIORITIES: readonly TaskPriority[] = ['urgent', 'moderate', 'normal', 'low'];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && TASK_PRIORITIES.includes(value as TaskPriority);
}

export function isUnassignedAssigneeFilter(value: unknown): value is typeof UNASSIGNED_ASSIGNEE_FILTER_VALUE {
  return value === UNASSIGNED_ASSIGNEE_FILTER_VALUE;
}

export function sanitizeKanbanTaskFilters(
  value: unknown,
  projects: TimelineSwimlane[],
  people: Person[]
): KanbanTaskFilters {
  if (!isObject(value)) return EMPTY_KANBAN_TASK_FILTERS;

  const validProjectIds = new Set(projects.map(project => project.id));
  const validPersonIds = new Set(people.map(person => person.id));
  const projectId = normalizeOptionalString(value.projectId);
  const assigneeId = normalizeOptionalString(value.assigneeId);
  const nextFilters: KanbanTaskFilters = {};

  if (projectId && validProjectIds.has(projectId)) {
    nextFilters.projectId = projectId;
  }

  if (isTaskPriority(value.priority)) {
    nextFilters.priority = value.priority;
  }

  if (isUnassignedAssigneeFilter(assigneeId) || (assigneeId && validPersonIds.has(assigneeId))) {
    nextFilters.assigneeId = assigneeId;
  }

  return nextFilters;
}

export function readInitialKanbanTaskFilters(
  projects: TimelineSwimlane[],
  people: Person[]
): KanbanTaskFilters {
  const stored = readInitialWorkspaceJSON<unknown>(
    KANBAN_TASK_FILTERS_STORAGE_KEY,
    EMPTY_KANBAN_TASK_FILTERS
  );
  return sanitizeKanbanTaskFilters(stored, projects, people);
}

export function persistKanbanTaskFilters(filters: KanbanTaskFilters): void {
  persistJSONWithElectronMirror(KANBAN_TASK_FILTERS_STORAGE_KEY, filters);
}

export function clearKanbanTaskFilter(
  filters: KanbanTaskFilters,
  key: KanbanTaskFilterKey
): KanbanTaskFilters {
  const { [key]: _cleared, ...remainingFilters } = filters;
  return remainingFilters;
}

export function clearAllKanbanTaskFilters(): KanbanTaskFilters {
  return EMPTY_KANBAN_TASK_FILTERS;
}

export function hasActiveKanbanTaskFilters(filters: KanbanTaskFilters): boolean {
  return Boolean(filters.projectId || filters.priority || filters.assigneeId);
}

export function taskMatchesKanbanFilters(task: Task, filters: KanbanTaskFilters): boolean {
  if (filters.projectId) {
    const taskProjectIds = task.projectIds?.length
      ? task.projectIds
      : task.swimlaneId
        ? [task.swimlaneId]
        : [];

    if (!taskProjectIds.includes(filters.projectId)) {
      return false;
    }
  }

  if (filters.priority && (task.priority || 'normal') !== filters.priority) {
    return false;
  }

  if (filters.assigneeId) {
    if (isUnassignedAssigneeFilter(filters.assigneeId)) {
      return !task.assigneeId;
    }

    if (task.assigneeId !== filters.assigneeId) {
      return false;
    }
  }

  return true;
}

export function filterKanbanTasks(tasks: Task[], filters: KanbanTaskFilters): Task[] {
  if (!hasActiveKanbanTaskFilters(filters)) return tasks;
  return tasks.filter(task => taskMatchesKanbanFilters(task, filters));
}
