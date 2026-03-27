import type { Task, TaskStatus, TimelineSwimlane, Person, StatusColumn } from '../types.ts';
import { buildLocalMcpAddress, normalizeMcpBindHost, normalizeMcpPort, normalizeMcpServerAddress } from '../constants/mcp.ts';

export type StatusColumnState = StatusColumn;

export interface AppPreferencesLike {
  executionLoadStatusId: TaskStatus;
  pipelineLoadStatusId: TaskStatus;
  mcpAgentAccessEnabled: boolean;
  mcpCapabilityProfile: 'read_only' | 'task_write' | 'admin';
  mcpBindHost: string;
  mcpPort: number;
  mcpServerAddress: string;
  mcpAccessToken: string;
  mcpAccessTokenIssuedAt?: string;
  mcpAccessTokenTtlMinutes: number;
}

export type AgentWatchAction =
  | 'inspect_only'
  | 'inspect_and_work'
  | 'move_to_ready_for_human_review';

export interface AgentWatchConfig {
  personId: string;
  enabled: boolean;
  statusId: string;
  projectId?: string;
  search?: string;
  action: AgentWatchAction;
  intervalSeconds: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getDefaultStatusId(
  columns: StatusColumn[],
  preferred: TaskStatus
): TaskStatus {
  const preferredColumn = columns.find(column => column.id === preferred);
  if (preferredColumn) return preferredColumn.id as TaskStatus;
  return (columns[0]?.id as TaskStatus) || preferred;
}

export function normalizeTask(task: Task, swimlanes: TimelineSwimlane[]): Task {
  const projectIds = task.projectIds?.length
    ? task.projectIds
    : (task.swimlaneId ? [task.swimlaneId] : []);
  const projectName = projectIds
    .map(projectId => swimlanes.find(s => s.id === projectId)?.name)
    .filter(Boolean)
    .join(', ');

  return {
    ...task,
    projectIds,
    project: projectName || task.project,
    size: task.size || 'm',
    complexity: task.complexity || 'medium',
    blocked: Boolean(task.blocked),
    priority: task.priority || 'normal',
  };
}

export function sanitizeStatusColumns(
  columns: unknown,
  fallback: StatusColumnState[]
): StatusColumnState[] {
  if (!Array.isArray(columns)) return fallback;

  const sanitized = columns
    .filter(isObject)
    .map(column => {
      if (typeof column.id !== 'string' || typeof column.title !== 'string') {
        return null;
      }

      return {
        id: column.id,
        title: column.title,
        color: typeof column.color === 'string' ? column.color : '#9ca3af',
      };
    })
    .filter((column): column is StatusColumnState & { color: string } => Boolean(column));

  return sanitized.length > 0 ? sanitized : fallback;
}

export function deriveStatusColumnsFromTasks(
  taskList: Task[],
  currentColumns: StatusColumnState[]
): StatusColumnState[] {
  const columns = [...currentColumns];
  const knownIds = new Set(columns.map(column => column.id));

  taskList.forEach(task => {
    if (!task.status || knownIds.has(task.status)) {
      return;
    }

    knownIds.add(task.status);
    columns.push({
      id: task.status,
      title: `Imported column ${columns.length + 1}`,
      color: '#9ca3af',
    });
  });

  return columns;
}

export function sanitizeTimelineSwimlanes(
  value: unknown,
  fallback: TimelineSwimlane[] = []
): TimelineSwimlane[] {
  if (!Array.isArray(value)) return fallback;

  const sanitized = value
    .filter(isObject)
    .map(item => {
      if (typeof item.id !== 'string' || typeof item.name !== 'string') {
        return null;
      }

      return {
        id: item.id,
        name: item.name,
        subtitle: typeof item.subtitle === 'string' ? item.subtitle : undefined,
        color: typeof item.color === 'string' ? item.color : '#3b82f6',
      };
    })
    .filter(item => item !== null) as TimelineSwimlane[];

  return sanitized;
}

export function sanitizePeople(value: unknown, fallback: Person[] = []): Person[] {
  if (!Array.isArray(value)) return fallback;

  const defaultColors = ['#ec4899', '#f97316', '#eab308', '#06b6d4', '#8b5cf6', '#10b981'];
  const sanitized = value
    .filter(isObject)
    .map((item, index) => {
      if (typeof item.id !== 'string' || typeof item.name !== 'string') {
        return null;
      }

      return {
        id: item.id,
        name: item.name,
        role: typeof item.role === 'string' ? item.role : 'Team Member',
        kind: (item.kind === 'agentic' ? 'agentic' : 'human') as Person['kind'],
        avatar: typeof item.avatar === 'string' ? item.avatar : undefined,
        color: typeof item.color === 'string' ? item.color : defaultColors[index % defaultColors.length],
      };
    })
    .filter(item => item !== null) as Person[];

  return sanitized;
}

export function sanitizeTasks(
  value: unknown,
  swimlanes: TimelineSwimlane[],
  fallback: Task[] = []
): Task[] {
  if (!Array.isArray(value)) return fallback.map(task => normalizeTask(task, swimlanes));

  const sanitized = value
    .filter(isObject)
    .map(item => {
      if (typeof item.id !== 'string' || typeof item.title !== 'string') {
        return null;
      }

      return normalizeTask(item as unknown as Task, swimlanes);
    })
    .filter(item => item !== null) as Task[];

  return sanitized;
}

export function sanitizePreferences(
  preferences: Partial<AppPreferencesLike> | undefined,
  statusColumns: Array<{ id: string; title: string; color?: string }>,
  fallback: AppPreferencesLike
): AppPreferencesLike {
  if (!preferences) {
    return {
      ...fallback,
      executionLoadStatusId: statusColumns.some(col => col.id === fallback.executionLoadStatusId)
        ? fallback.executionLoadStatusId
        : getDefaultStatusId(statusColumns, 'in-progress'),
      pipelineLoadStatusId: statusColumns.some(col => col.id === fallback.pipelineLoadStatusId)
        ? fallback.pipelineLoadStatusId
        : getDefaultStatusId(statusColumns, 'open'),
    };
  }

  const bindHost = normalizeMcpBindHost(preferences.mcpBindHost || fallback.mcpBindHost);
  const port = normalizeMcpPort(preferences.mcpPort || fallback.mcpPort);
  const executionLoadStatusId =
    preferences.executionLoadStatusId && statusColumns.some(col => col.id === preferences.executionLoadStatusId)
      ? preferences.executionLoadStatusId
      : getDefaultStatusId(statusColumns, 'in-progress');
  const pipelineLoadStatusId =
    preferences.pipelineLoadStatusId && statusColumns.some(col => col.id === preferences.pipelineLoadStatusId)
      ? preferences.pipelineLoadStatusId
      : getDefaultStatusId(statusColumns, 'open');

  return {
    executionLoadStatusId,
    pipelineLoadStatusId,
    mcpAgentAccessEnabled: Boolean(preferences.mcpAgentAccessEnabled),
    mcpCapabilityProfile:
      preferences.mcpCapabilityProfile === 'task_write' || preferences.mcpCapabilityProfile === 'admin'
        ? preferences.mcpCapabilityProfile
        : 'read_only',
    mcpBindHost: bindHost,
    mcpPort: port,
    mcpServerAddress: normalizeMcpServerAddress(
      preferences.mcpServerAddress || buildLocalMcpAddress(bindHost, port)
    ),
    mcpAccessToken: typeof preferences.mcpAccessToken === 'string' ? preferences.mcpAccessToken : '',
    mcpAccessTokenIssuedAt:
      typeof preferences.mcpAccessTokenIssuedAt === 'string' ? preferences.mcpAccessTokenIssuedAt : undefined,
    mcpAccessTokenTtlMinutes: Number.isFinite(Number(preferences.mcpAccessTokenTtlMinutes))
      ? Math.max(1, Math.min(1440, Number(preferences.mcpAccessTokenTtlMinutes)))
      : fallback.mcpAccessTokenTtlMinutes,
  };
}

export function sanitizeAgentWatchConfigs(
  value: unknown,
  fallback: AgentWatchConfig[] = []
): AgentWatchConfig[] {
  if (!Array.isArray(value)) return fallback;

  const sanitized = value
    .filter(isObject)
    .map(item => {
      if (typeof item.personId !== 'string' || typeof item.statusId !== 'string') {
        return null;
      }

      return {
        personId: item.personId,
        enabled: item.enabled !== false,
        statusId: item.statusId,
        projectId: typeof item.projectId === 'string' && item.projectId.trim() ? item.projectId.trim() : undefined,
        search: typeof item.search === 'string' && item.search.trim() ? item.search.trim() : undefined,
        action: (
          item.action === 'inspect_only' || item.action === 'move_to_ready_for_human_review'
            ? item.action
            : 'inspect_and_work'
        ) as AgentWatchAction,
        intervalSeconds: Number.isFinite(Number(item.intervalSeconds))
          ? Math.max(15, Math.min(3600, Math.floor(Number(item.intervalSeconds))))
          : 60,
      };
    })
    .filter(item => item !== null) as AgentWatchConfig[];

  return sanitized;
}
