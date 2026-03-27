import { Task, TaskStatus, TimelineSwimlane, Person, StatusColumn } from '../types';
import {
  buildLocalMcpAddress,
  normalizeMcpBindHost,
  normalizeMcpPort,
  normalizeMcpServerAddress,
} from '../constants/mcp';
import { getDefaultStatusId, syncLocalMcpServerAddress } from '../utils/mcpPreferences';
import { flattenPortableStoreEntries, isPortableStorageKey } from '../utils/storage';

export const WORKSPACE_BACKUP_SCHEMA_VERSION = 2;

export type WorkspaceViewType = 'timeline' | 'kanban';

export interface WorkspacePreferences {
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

export type WorkspaceStatusColumn = StatusColumn;

export interface WorkspaceBackupUiState {
  currentView?: WorkspaceViewType;
  viewState?: {
    timeline?: Record<string, unknown>;
    kanban?: Record<string, unknown>;
  };
  timeline?: {
    leftColWidth?: number;
    monthWidths?: Record<string, number>;
  };
}

export interface WorkspaceBackupPayload {
  version: number;
  exportedAt: string;
  tasks?: Task[];
  projects?: TimelineSwimlane[];
  people?: Person[];
  statusColumns?: WorkspaceStatusColumn[];
  preferences?: Partial<WorkspacePreferences>;
  ui?: WorkspaceBackupUiState;
  storage?: Record<string, string>;
  electronStore?: Record<string, unknown>;
}

export interface WorkspaceBackupBuildInput {
  tasks: Task[];
  projects: TimelineSwimlane[];
  people: Person[];
  statusColumns: WorkspaceStatusColumn[];
  preferences: WorkspacePreferences;
  ui?: WorkspaceBackupUiState;
  storage?: Record<string, string>;
  electronStore?: Record<string, unknown>;
  version?: number;
  exportedAt?: string;
}

export interface WorkspaceBackupRepairOptions {
  fallbackProjects?: TimelineSwimlane[];
  fallbackPeople?: Person[];
  fallbackStatusColumns?: WorkspaceStatusColumn[];
  fallbackPreferences: WorkspacePreferences;
  fallbackTasks?: Task[];
  allowFallbackForMissingArrays?: boolean;
}

export interface WorkspaceBackupRepairResult {
  ok: boolean;
  error?: string;
  warnings: string[];
  version: number;
  exportedAt?: string;
  tasks: Task[];
  projects: TimelineSwimlane[];
  people: Person[];
  statusColumns: WorkspaceStatusColumn[];
  preferences: WorkspacePreferences;
  ui?: WorkspaceBackupUiState;
  storageSnapshot: Record<string, string>;
  electronStoreSnapshot: Record<string, unknown>;
}

export interface WorkspaceBackupParseResult {
  ok: boolean;
  error?: string;
  payload?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneRecord<T extends Record<string, unknown> | Record<string, string>>(value: T): T {
  return { ...value };
}

function normalizeTask(task: Task, swimlanes: TimelineSwimlane[]): Task {
  const projectIds = task.projectIds?.length
    ? task.projectIds
    : (task.swimlaneId ? [task.swimlaneId] : []);
  const projectName = projectIds
    .map(projectId => swimlanes.find(swimlane => swimlane.id === projectId)?.name)
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

export function sanitizeTimelineSwimlanes(
  value: unknown,
  fallback: TimelineSwimlane[] = []
): TimelineSwimlane[] {
  if (!Array.isArray(value)) return fallback;

  const sanitized = value
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const candidate = item as Record<string, unknown>;
      if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') {
        return null;
      }

      return {
        id: candidate.id,
        name: candidate.name,
        subtitle: typeof candidate.subtitle === 'string' ? candidate.subtitle : undefined,
        color: typeof candidate.color === 'string' ? candidate.color : '#3b82f6',
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return sanitized.length > 0 ? sanitized : fallback;
}

export function sanitizePeople(value: unknown, fallback: Person[] = []): Person[] {
  if (!Array.isArray(value)) return fallback;

  const defaultColors = ['#ec4899', '#f97316', '#eab308', '#06b6d4', '#8b5cf6', '#10b981'];
  const sanitized = value
    .filter(item => item && typeof item === 'object')
    .map((item, index) => {
      const candidate = item as Record<string, unknown>;
      if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') {
        return null;
      }

      return {
        id: candidate.id,
        name: candidate.name,
        role: typeof candidate.role === 'string' ? candidate.role : 'Team Member',
        kind: (candidate.kind === 'agentic' ? 'agentic' : 'human') as Person['kind'],
        avatar: typeof candidate.avatar === 'string' ? candidate.avatar : undefined,
        color: typeof candidate.color === 'string' ? candidate.color : defaultColors[index % defaultColors.length],
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return sanitized.length > 0 ? sanitized : fallback;
}

export function sanitizeTasks(
  value: unknown,
  swimlanes: TimelineSwimlane[],
  fallback: Task[] = []
): Task[] {
  if (!Array.isArray(value)) {
    return fallback.map(task => normalizeTask(task, swimlanes));
  }

  const sanitized = value
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const candidate = item as Task;
      if (typeof candidate.id !== 'string' || typeof candidate.title !== 'string') {
        return null;
      }
      return normalizeTask(candidate, swimlanes);
    })
    .filter((item): item is Task => Boolean(item));

  return sanitized.length > 0 ? sanitized : fallback.map(task => normalizeTask(task, swimlanes));
}

export function sanitizeStatusColumns(
  columns: unknown,
  fallback: WorkspaceStatusColumn[]
): WorkspaceStatusColumn[] {
  if (!Array.isArray(columns)) return fallback;

  const sanitized = columns
    .filter(column => column && typeof column === 'object')
    .map(column => {
      const candidate = column as Record<string, unknown>;
      if (typeof candidate.id !== 'string' || typeof candidate.title !== 'string') {
        return null;
      }

      return {
        id: candidate.id,
        title: candidate.title,
        color: typeof candidate.color === 'string' ? candidate.color : '#9ca3af',
      };
    })
    .filter((column): column is NonNullable<typeof column> => column !== null);

  return sanitized.length > 0 ? sanitized : fallback;
}

export function deriveStatusColumnsFromTasks(
  taskList: Task[],
  currentColumns: WorkspaceStatusColumn[]
): WorkspaceStatusColumn[] {
  const columns = [...currentColumns];
  const knownIds = new Set(columns.map(column => column.id));

  taskList.forEach(task => {
    if (!task.status || knownIds.has(task.status)) {
      return;
    }

    knownIds.add(task.status);
    columns.push({
      id: task.status as TaskStatus,
      title: `Imported column ${columns.length + 1}`,
      color: '#9ca3af',
    });
  });

  return columns;
}

export function sanitizePreferences(
  preferences: Partial<WorkspacePreferences> | undefined,
  statusColumns: StatusColumn[],
  fallback: WorkspacePreferences
): WorkspacePreferences {
  if (!preferences) {
    return {
      ...fallback,
      executionLoadStatusId: statusColumns.some(column => column.id === fallback.executionLoadStatusId)
        ? fallback.executionLoadStatusId
        : getDefaultStatusId(statusColumns, 'in-progress'),
      pipelineLoadStatusId: statusColumns.some(column => column.id === fallback.pipelineLoadStatusId)
        ? fallback.pipelineLoadStatusId
        : getDefaultStatusId(statusColumns, 'open'),
    };
  }

  const bindHost = normalizeMcpBindHost(preferences.mcpBindHost || fallback.mcpBindHost);
  const port = normalizeMcpPort(preferences.mcpPort || fallback.mcpPort);
  const executionLoadStatusId =
    preferences.executionLoadStatusId && statusColumns.some(column => column.id === preferences.executionLoadStatusId)
      ? preferences.executionLoadStatusId
      : getDefaultStatusId(statusColumns, 'in-progress');
  const pipelineLoadStatusId =
    preferences.pipelineLoadStatusId && statusColumns.some(column => column.id === preferences.pipelineLoadStatusId)
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

export function getPortableStorageSnapshotFromEntries(entries: Record<string, string>): Record<string, string> {
  const snapshot: Record<string, string> = {};

  for (const [key, value] of Object.entries(entries || {})) {
    if (!isPortableStorageKey(key) || typeof value !== 'string') continue;
    snapshot[key] = value;
  }

  return snapshot;
}

export function getPortableElectronStoreSnapshotFromExport(exported: unknown): Record<string, unknown> {
  if (!isRecord(exported)) return {};

  const flattened = flattenPortableStoreEntries(exported);
  return Object.fromEntries(
    Object.entries(flattened).filter(([key]) => isPortableStorageKey(key))
  );
}

export function parseWorkspaceBackupJson(text: string): WorkspaceBackupParseResult {
  try {
    const payload = JSON.parse(text) as unknown;
    if (!isRecord(payload)) {
      return {
        ok: false,
        error: 'Invalid backup format. Expected a JSON object.',
      };
    }

    return {
      ok: true,
      payload,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not parse backup JSON.',
    };
  }
}

export function buildWorkspaceBackupPayload(input: WorkspaceBackupBuildInput): WorkspaceBackupPayload {
  return {
    version: input.version ?? WORKSPACE_BACKUP_SCHEMA_VERSION,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    tasks: input.tasks,
    projects: input.projects,
    people: input.people,
    statusColumns: input.statusColumns,
    preferences: input.preferences,
    ui: input.ui,
    storage: input.storage,
    electronStore: input.electronStore,
  };
}

export function repairWorkspaceBackupPayload(
  payload: unknown,
  options: WorkspaceBackupRepairOptions
): WorkspaceBackupRepairResult {
  const warnings: string[] = [];
  const fallbackProjects = options.fallbackProjects || [];
  const fallbackPeople = options.fallbackPeople || [];
  const fallbackStatusColumns = options.fallbackStatusColumns || [];
  const fallbackPreferences = options.fallbackPreferences;
  const fallbackTasks = options.fallbackTasks || [];

  if (!isRecord(payload)) {
    return {
      ok: false,
      error: 'Invalid backup format. Expected a JSON object.',
      warnings,
      version: WORKSPACE_BACKUP_SCHEMA_VERSION,
      tasks: [],
      projects: [],
      people: [],
      statusColumns: fallbackStatusColumns,
      preferences: fallbackPreferences,
      storageSnapshot: {},
      electronStoreSnapshot: {},
    };
  }

  const parsedVersion = Number.isFinite(Number(payload.version))
    ? Math.max(1, Math.floor(Number(payload.version)))
    : WORKSPACE_BACKUP_SCHEMA_VERSION;
  const exportedAt = typeof payload.exportedAt === 'string' ? payload.exportedAt : undefined;

  const importedProjects = sanitizeTimelineSwimlanes(
    payload.projects,
    options.allowFallbackForMissingArrays ? fallbackProjects : []
  );
  if (!Array.isArray(payload.projects)) {
    warnings.push('Backup was missing a projects array; using fallback projects.');
  }

  const importedTasks = sanitizeTasks(
    payload.tasks,
    importedProjects,
    options.allowFallbackForMissingArrays ? fallbackTasks : []
  );
  if (!Array.isArray(payload.tasks)) {
    warnings.push('Backup was missing a tasks array; using fallback tasks.');
  }

  const importedPeople = sanitizePeople(
    payload.people,
    options.allowFallbackForMissingArrays ? fallbackPeople : []
  );
  if (!Array.isArray(payload.people)) {
    warnings.push('Backup was missing a people array; using fallback people.');
  }

  const importedStatusColumns = deriveStatusColumnsFromTasks(
    importedTasks,
    sanitizeStatusColumns(payload.statusColumns, fallbackStatusColumns)
  );

  const projectIds = new Set(importedProjects.map(project => project.id));
  const personIds = new Set(importedPeople.map(person => person.id));
  const statusIds = new Set(importedStatusColumns.map(column => column.id));
  const fallbackStatusId = importedStatusColumns[0]?.id || 'open';

  const repairedTasks = importedTasks.map(task => {
    const nextProjectIds = (task.projectIds || []).filter(projectId => projectIds.has(projectId));
    const nextSwimlaneId = task.swimlaneId && projectIds.has(task.swimlaneId) ? task.swimlaneId : undefined;
    const nextAssigneeId = task.assigneeId && personIds.has(task.assigneeId) ? task.assigneeId : undefined;
    const project = nextProjectIds
      .map(projectId => importedProjects.find(project => project.id === projectId)?.name)
      .filter(Boolean)
      .join(', ');

    return {
      ...task,
      status: (statusIds.has(task.status) ? task.status : fallbackStatusId) as TaskStatus,
      projectIds: nextProjectIds,
      project: project || undefined,
      swimlaneId: nextSwimlaneId,
      assigneeId: nextAssigneeId,
    };
  });

  const importedPreferences = sanitizePreferences(
    isRecord(payload.preferences) ? (payload.preferences as Partial<WorkspacePreferences>) : undefined,
    importedStatusColumns,
    fallbackPreferences
  );

  const ui: WorkspaceBackupUiState | undefined = isRecord(payload.ui)
    ? {
        currentView:
          payload.ui.currentView === 'timeline' || payload.ui.currentView === 'kanban'
            ? payload.ui.currentView
            : undefined,
        viewState: isRecord(payload.ui.viewState)
          ? {
              timeline: isRecord(payload.ui.viewState.timeline) ? cloneRecord(payload.ui.viewState.timeline) : undefined,
              kanban: isRecord(payload.ui.viewState.kanban) ? cloneRecord(payload.ui.viewState.kanban) : undefined,
            }
          : undefined,
        timeline: isRecord(payload.ui.timeline)
          ? {
              leftColWidth: Number.isFinite(Number(payload.ui.timeline.leftColWidth))
                ? Number(payload.ui.timeline.leftColWidth)
                : undefined,
              monthWidths: isRecord(payload.ui.timeline.monthWidths)
                ? Object.fromEntries(
                    Object.entries(payload.ui.timeline.monthWidths).reduce<Array<[string, number]>>((acc, [key, value]) => {
                      if (typeof key !== 'string' || !Number.isFinite(Number(value))) {
                        return acc;
                      }
                      acc.push([key, Number(value)]);
                      return acc;
                    }, [])
                  )
                : undefined,
            }
          : undefined,
      }
    : undefined;

  const storageSnapshot: Record<string, string> = isRecord(payload.storage)
    ? Object.fromEntries(
        Object.entries(payload.storage).reduce<Array<[string, string]>>((acc, [key, value]) => {
          if (isPortableStorageKey(key) && typeof value === 'string') {
            acc.push([key, value]);
          }
          return acc;
        }, [])
      )
    : {};
  const electronStoreSnapshot = isRecord(payload.electronStore)
    ? getPortableElectronStoreSnapshotFromExport(payload.electronStore)
    : {};

  if (!Array.isArray(payload.statusColumns)) {
    warnings.push('Backup was missing statusColumns; derived columns from tasks and fallback columns.');
  }

  return {
    ok: true,
    warnings,
    version: parsedVersion,
    exportedAt,
    tasks: repairedTasks,
    projects: importedProjects,
    people: importedPeople,
    statusColumns: importedStatusColumns,
    preferences: importedPreferences,
    ui,
    storageSnapshot,
    electronStoreSnapshot,
  };
}

export function createDefaultWorkspacePreferences(
  statusColumns: StatusColumn[],
  overrides: Partial<WorkspacePreferences> = {}
): WorkspacePreferences {
  const bindHost = normalizeMcpBindHost(overrides.mcpBindHost);
  const port = normalizeMcpPort(overrides.mcpPort);
  const executionLoadStatusId = overrides.executionLoadStatusId || getDefaultStatusId(statusColumns, 'in-progress');
  const pipelineLoadStatusId = overrides.pipelineLoadStatusId || getDefaultStatusId(statusColumns, 'open');
  const serverAddress = normalizeMcpServerAddress(
    overrides.mcpServerAddress || buildLocalMcpAddress(bindHost, port)
  );

  return {
    executionLoadStatusId,
    pipelineLoadStatusId,
    mcpAgentAccessEnabled: Boolean(overrides.mcpAgentAccessEnabled),
    mcpCapabilityProfile:
      overrides.mcpCapabilityProfile === 'task_write' || overrides.mcpCapabilityProfile === 'admin'
        ? overrides.mcpCapabilityProfile
        : 'read_only',
    mcpBindHost: bindHost,
    mcpPort: port,
    mcpServerAddress: syncLocalMcpServerAddress(
      {
        mcpBindHost: bindHost,
        mcpPort: port,
        mcpServerAddress: serverAddress,
      },
      bindHost,
      port
    ),
    mcpAccessToken: typeof overrides.mcpAccessToken === 'string' ? overrides.mcpAccessToken : '',
    mcpAccessTokenIssuedAt:
      typeof overrides.mcpAccessTokenIssuedAt === 'string' ? overrides.mcpAccessTokenIssuedAt : undefined,
    mcpAccessTokenTtlMinutes: Number.isFinite(Number(overrides.mcpAccessTokenTtlMinutes))
      ? Math.max(1, Math.min(1440, Number(overrides.mcpAccessTokenTtlMinutes)))
      : 60,
  };
}
