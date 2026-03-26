import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Task, TaskStatus, TimelineSwimlane, Person, TaskComment } from './types';
import { initialTasks, initialTimelineSwimlanes } from './data/sampleData';
import { initialPeople } from './data/samplePeople';
import { TimelineView } from './components/TimelineView';
import { KanbanView } from './components/KanbanView';
import { ViewToggle } from './components/ViewToggle';
import { useViewState, ViewType } from './hooks/useViewState';
import { useSharedHorizontalScroll } from './hooks/useSharedHorizontalScroll';
import { useVirtualizedTimeline } from './hooks/useVirtualizedTimeline';
import { useMcpDiagnostics } from './hooks/useMcpDiagnostics';
import { useMcpHealthValidation } from './hooks/useMcpHealthValidation';
import { createMcpReadService } from './services/mcp/service';
import { McpBoardWatchResult } from './services/mcp/types';
import {
  DEFAULT_MCP_BIND_HOST,
  DEFAULT_MCP_PORT,
  DEFAULT_MCP_SERVER_ADDRESS,
  buildLocalMcpAddress,
  normalizeMcpBindHost,
  normalizeMcpPort,
  normalizeMcpServerAddress,
} from './constants/mcp';
import { shouldBootstrapFromLocalStorage } from './utils/canonicalHydration.js';
import { deleteStoredValue, persistJSONWithElectronMirror, persistRawWithElectronMirror } from './utils/storage';

// LocalStorage keys
const TASKS_KEY = 'plumy.tasks.v1';
const SWIMLANES_KEY = 'plumy.swimlanes.v1';
const PEOPLE_KEY = 'plumy.people.v1';
const STATUS_COLUMNS_KEY = 'plumy.statusColumns.v1';
const PREFERENCES_KEY = 'plumy.preferences.v1';
const TIMELINE_VIEW_STATE_KEY = 'plumy_viewstate_timeline';
const KANBAN_VIEW_STATE_KEY = 'plumy_viewstate_kanban';
const MONTH_WIDTHS_KEY = 'plumy.monthWidths.v1';
const LEFT_COL_WIDTH_KEY = 'plumy.leftColWidth.v1';
const MCP_AGENT_WATCH_CONFIGS_KEY = 'plumy.mcp.agentWatchConfigs.v1';
const BACKUP_SCHEMA_VERSION = 2;

function safeReadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch (err) {
    return fallback;
  }
}

function generateMcpAccessToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `mcp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readInitialWorkspaceJSON<T>(key: string, fallback: T): T {
  return shouldBootstrapFromLocalStorage() ? safeReadJSON(key, fallback) : fallback;
}

function normalizeTask(task: Task, swimlanes: TimelineSwimlane[]): Task {
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
import { SwimlanesView } from './components/SwimlanesView';
import { TaskDialog } from './components/TaskDialog';
import { SwimlaneDialog } from './components/SwimlaneDialog';
import { PeoplePanel } from './components/PeoplePanel';
import { PreferencesPanel } from './components/PreferencesPanel';
import { TaskDetailsDialog } from './components/TaskDetailsDialog';
import logo from './images/logo.svg';
import { Button } from './components/ui/button';
import { Settings, User } from 'lucide-react';
import { swimlanes as defaultSwimlanes } from './constants/swimlanes';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

interface AppPreferences {
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

interface StorageMeterState {
  usedBytes: number;
  totalBytes: number;
  usagePercent: number;
  sourceLabel: string;
}

interface McpAuditSummaryEntry extends McpAuditEntry {
  auditId: string;
  timestamp: string;
}

type StatusColumnState = { id: TaskStatus; title: string; color?: string };

interface StatusColumnBackup {
  id: string;
  title: string;
  color?: string;
}

interface UiBackupState {
  currentView?: ViewType;
  viewState?: {
    timeline?: Record<string, unknown>;
    kanban?: Record<string, unknown>;
  };
  timeline?: {
    leftColWidth?: number;
    monthWidths?: Record<string, number>;
  };
}

interface BackupFile {
  version: number;
  exportedAt: string;
  tasks?: Task[];
  projects?: TimelineSwimlane[];
  people?: Person[];
  statusColumns?: StatusColumnBackup[];
  preferences?: Partial<AppPreferences>;
  ui?: UiBackupState;
  storage?: Record<string, string>;
  electronStore?: Record<string, unknown>;
}

type AgentWatchAction =
  | 'inspect_only'
  | 'inspect_and_work'
  | 'move_to_ready_for_human_review';

interface AgentWatchConfig {
  personId: string;
  enabled: boolean;
  statusId: string;
  projectId?: string;
  search?: string;
  action: AgentWatchAction;
  intervalSeconds: number;
}

interface AgentWatchRuntimeState {
  personId: string;
  watcherId?: string;
  lastCheckedAt?: string;
  newTaskCount: number;
  updatedTaskCount: number;
  removedTaskCount: number;
  latestTaskTitles: string[];
  error?: string;
}

function getMcpSettingsSignature(preferences: AppPreferences): string {
  return JSON.stringify({
    enabled: preferences.mcpAgentAccessEnabled,
    profile: preferences.mcpCapabilityProfile,
    bindHost: preferences.mcpBindHost,
    port: preferences.mcpPort,
    address: preferences.mcpServerAddress,
    token: preferences.mcpAccessToken,
    tokenIssuedAt: preferences.mcpAccessTokenIssuedAt,
    tokenTtlMinutes: preferences.mcpAccessTokenTtlMinutes,
  });
}

function getDefaultStatusId(
  columns: Array<{ id: TaskStatus; title: string; color?: string }>,
  preferred: TaskStatus
): TaskStatus {
  const preferredCol = columns.find(col => col.id === preferred);
  if (preferredCol) return preferredCol.id;
  return columns[0]?.id || preferred;
}

function getLocalStorageUsageBytes(): number {
  if (typeof window === 'undefined') return 0;
  try {
    let totalChars = 0;
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const value = window.localStorage.getItem(key) || '';
      totalChars += key.length + value.length;
    }
    // localStorage strings are UTF-16 in browsers, so ~2 bytes/char.
    return totalChars * 2;
  } catch (err) {
    return 0;
  }
}

function safeReadRaw(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    return null;
  }
}

function safeWriteRaw(key: string, value: string): void {
  persistRawWithElectronMirror(key, value);
}

function safeReadLocalStorageJSON<T>(key: string, fallback: T): T {
  const raw = safeReadRaw(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    return fallback;
  }
}

function isPortableStorageKey(key: string): boolean {
  return key.startsWith('plumy.') || key.startsWith('plumy_viewstate_');
}

function getPortableStorageSnapshot(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const snapshot: Record<string, string> = {};

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !isPortableStorageKey(key)) continue;
      const value = window.localStorage.getItem(key);
      if (typeof value === 'string') {
        snapshot[key] = value;
      }
    }
  } catch (err) {
    return {};
  }

  return snapshot;
}

async function getPortableElectronStoreSnapshot(): Promise<Record<string, unknown>> {
  try {
    const exported = await window.electron?.storeExport?.();
    if (!exported || typeof exported !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(exported).filter(([key]) => isPortableStorageKey(key))
    );
  } catch (err) {
    return {};
  }
}

function clearPortableStorageKeys(): void {
  if (typeof window === 'undefined') return;

  try {
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && isPortableStorageKey(key)) {
        keys.push(key);
      }
    }

    keys.forEach(key => {
      window.localStorage.removeItem(key);
    });
  } catch (err) {
    // ignore
  }
}

async function clearPortableElectronStoreKeys(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const exported = await window.electron?.storeExport?.();
    if (!exported || typeof exported !== 'object') return;

    const keys = Object.keys(exported).filter(isPortableStorageKey);
    await Promise.all(keys.map(key => deleteStoredValue(key).catch(() => undefined)));
  } catch (err) {
    // ignore
  }
}

async function restorePortableStorageSnapshot(
  storageSnapshot?: Record<string, string>,
  electronStoreSnapshot?: Record<string, unknown>
): Promise<void> {
  clearPortableStorageKeys();
  await clearPortableElectronStoreKeys();

  if (storageSnapshot && typeof storageSnapshot === 'object') {
    Object.entries(storageSnapshot).forEach(([key, value]) => {
      if (!isPortableStorageKey(key) || typeof value !== 'string') return;
      safeWriteRaw(key, value);
    });
  }

  if (electronStoreSnapshot && typeof electronStoreSnapshot === 'object') {
    const storeSet = window.electron?.storeSet;
    if (typeof storeSet === 'function') {
      await Promise.all(
        Object.entries(electronStoreSnapshot)
          .filter(([key]) => isPortableStorageKey(key))
          .map(([key, value]) => storeSet(key, value).catch(() => undefined))
      );
    }
  }
}

function sanitizeStatusColumns(
  columns: unknown,
  fallback: StatusColumnState[]
): StatusColumnState[] {
  if (!Array.isArray(columns)) return fallback;

  const sanitized = columns
    .filter(column => column && typeof column === 'object')
    .map(column => {
      const candidate = column as Record<string, unknown>;
      if (typeof candidate.id !== 'string' || typeof candidate.title !== 'string') {
        return null;
      }
      return {
        id: candidate.id as TaskStatus,
        title: candidate.title,
        color: typeof candidate.color === 'string' ? candidate.color : '#9ca3af',
      };
    })
    .filter((column): column is StatusColumnState & { color: string } => Boolean(column));

  return sanitized.length > 0 ? sanitized : fallback;
}

function deriveStatusColumnsFromTasks(
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
      id: task.status as TaskStatus,
      title: `Imported column ${columns.length + 1}`,
      color: '#9ca3af',
    });
  });

  return columns;
}

function sanitizeTimelineSwimlanes(value: unknown): TimelineSwimlane[] {
  if (!Array.isArray(value)) return initialTimelineSwimlanes;

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
    .filter((item): item is TimelineSwimlane => Boolean(item));

  return sanitized;
}

function sanitizePeople(value: unknown): Person[] {
  if (!Array.isArray(value)) return initialPeople;

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
        kind: candidate.kind === 'agentic' ? 'agentic' : 'human',
        avatar: typeof candidate.avatar === 'string' ? candidate.avatar : undefined,
        color: typeof candidate.color === 'string' ? candidate.color : defaultColors[index % defaultColors.length],
      };
    })
    .filter((item): item is Person => Boolean(item));

  return sanitized;
}

function sanitizeTasks(value: unknown, swimlanes: TimelineSwimlane[]): Task[] {
  if (!Array.isArray(value)) return initialTasks.map(task => normalizeTask(task, swimlanes));

  return value
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const candidate = item as Task;
      if (typeof candidate.id !== 'string' || typeof candidate.title !== 'string') {
        return null;
      }
      return normalizeTask(candidate, swimlanes);
    })
    .filter((item): item is Task => Boolean(item));
}

function sanitizePreferences(
  preferences: Partial<AppPreferences> | undefined,
  statusColumns: Array<{ id: TaskStatus; title: string; color?: string }>,
  fallback: AppPreferences
): AppPreferences {
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

function sanitizeAgentWatchConfigs(value: unknown): AgentWatchConfig[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const candidate = item as Record<string, unknown>;
      if (typeof candidate.personId !== 'string' || typeof candidate.statusId !== 'string') {
        return null;
      }
      return {
        personId: candidate.personId,
        enabled: candidate.enabled !== false,
        statusId: candidate.statusId,
        projectId: typeof candidate.projectId === 'string' && candidate.projectId.trim() ? candidate.projectId.trim() : undefined,
        search: typeof candidate.search === 'string' && candidate.search.trim() ? candidate.search.trim() : undefined,
        action:
          candidate.action === 'inspect_only' || candidate.action === 'move_to_ready_for_human_review'
            ? candidate.action
            : 'inspect_and_work',
        intervalSeconds: Number.isFinite(Number(candidate.intervalSeconds))
          ? Math.max(15, Math.min(3600, Math.floor(Number(candidate.intervalSeconds))))
          : 60,
      };
    })
    .filter((item): item is AgentWatchConfig => Boolean(item));
}

function syncLocalMcpServerAddress(
  previousPreferences: AppPreferences,
  nextHost: string,
  nextPort: number
): string {
  const previousLocalAddress = buildLocalMcpAddress(
    previousPreferences.mcpBindHost,
    previousPreferences.mcpPort
  );
  const nextLocalAddress = buildLocalMcpAddress(nextHost, nextPort);
  const previousAddress = normalizeMcpServerAddress(previousPreferences.mcpServerAddress);

  return previousAddress === previousLocalAddress
    ? nextLocalAddress
    : previousAddress;
}

function App() {
  // Initialize hooks for view management
  const viewState = useViewState('timeline');
  const scroll = useSharedHorizontalScroll();
  const timeline = useVirtualizedTimeline();

  // Refs for view containers (to capture scroll position)
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const kanbanContainerRef = useRef<HTMLDivElement>(null);
  const timelineScrollStateRef = useRef<{ scrollLeft: number; scrollTop: number }>({
    scrollLeft: 0,
    scrollTop: 0,
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    const stored = readInitialWorkspaceJSON<Task[]>(TASKS_KEY, initialTasks);
    const swimlanes = readInitialWorkspaceJSON<TimelineSwimlane[]>(SWIMLANES_KEY, initialTimelineSwimlanes);

    // Migrate: Ensure project names and multi-project ids are present.
    return stored.map(task => normalizeTask(task, swimlanes));
  });
  
  const [timelineSwimlanes, setTimelineSwimlanes] = useState<TimelineSwimlane[]>(() => {
    const stored = readInitialWorkspaceJSON<TimelineSwimlane[]>(SWIMLANES_KEY, initialTimelineSwimlanes);
    
    // Migrate: Ensure all swimlanes have colors
    return stored.map(swimlane => ({
      ...swimlane,
      color: swimlane.color || '#3b82f6' // Default blue if no color
    }));
  });
  
  const [people, setPeople] = useState<Person[]>(() => {
    const stored = readInitialWorkspaceJSON<Person[]>(PEOPLE_KEY, initialPeople);
    
    // Migrate: Ensure all people have colors
    const defaultColors = ['#ec4899', '#f97316', '#eab308', '#06b6d4', '#8b5cf6', '#10b981'];
    return stored.map((person, index) => ({
      ...person,
      kind: person.kind === 'agentic' ? 'agentic' : 'human',
      color: person.color || defaultColors[index % defaultColors.length]
    }));
  });

  const [statusColumns, setStatusColumns] = useState<StatusColumnState[]>(() =>
    readInitialWorkspaceJSON<StatusColumnState[]>(STATUS_COLUMNS_KEY, defaultSwimlanes)
  );
  const [agentWatchConfigs, setAgentWatchConfigs] = useState<AgentWatchConfig[]>(() =>
    readInitialWorkspaceJSON<AgentWatchConfig[]>(MCP_AGENT_WATCH_CONFIGS_KEY, [])
  );
  const [preferences, setPreferences] = useState<AppPreferences>(() => {
    const stored = readInitialWorkspaceJSON<Partial<AppPreferences>>(PREFERENCES_KEY, {});
    const executionDefault = getDefaultStatusId(defaultSwimlanes, 'in-progress');
    const pipelineDefault = getDefaultStatusId(defaultSwimlanes, 'open');
    const bindHost = normalizeMcpBindHost(stored.mcpBindHost);
    const port = normalizeMcpPort(stored.mcpPort);

    return {
      executionLoadStatusId: stored.executionLoadStatusId || executionDefault,
      pipelineLoadStatusId: stored.pipelineLoadStatusId || pipelineDefault,
      mcpAgentAccessEnabled: Boolean(stored.mcpAgentAccessEnabled),
      mcpCapabilityProfile:
        stored.mcpCapabilityProfile === 'task_write' || stored.mcpCapabilityProfile === 'admin'
          ? stored.mcpCapabilityProfile
          : 'read_only',
      mcpBindHost: bindHost,
      mcpPort: port,
      mcpServerAddress: normalizeMcpServerAddress(
        stored.mcpServerAddress || buildLocalMcpAddress(bindHost, port)
      ),
      mcpAccessToken: typeof stored.mcpAccessToken === 'string' ? stored.mcpAccessToken : '',
      mcpAccessTokenIssuedAt: typeof stored.mcpAccessTokenIssuedAt === 'string' ? stored.mcpAccessTokenIssuedAt : undefined,
      mcpAccessTokenTtlMinutes: Number.isFinite(Number(stored.mcpAccessTokenTtlMinutes))
        ? Math.max(1, Math.min(1440, Number(stored.mcpAccessTokenTtlMinutes)))
        : 60,
    };
  });
  const [hasHydratedCanonicalWorkspace, setHasHydratedCanonicalWorkspace] = useState<boolean>(
    () => shouldBootstrapFromLocalStorage()
  );
  const [storageMeter, setStorageMeter] = useState<StorageMeterState>({
    usedBytes: 0,
    totalBytes: 5 * 1024 * 1024,
    usagePercent: 0,
    sourceLabel: 'Estimated localStorage capacity',
  });

  useEffect(() => {
    if (!hasHydratedCanonicalWorkspace) return;
    persistJSONWithElectronMirror(STATUS_COLUMNS_KEY, statusColumns);
  }, [hasHydratedCanonicalWorkspace, statusColumns]);
  useEffect(() => {
    if (!hasHydratedCanonicalWorkspace) return;
    persistJSONWithElectronMirror(PREFERENCES_KEY, preferences);
  }, [hasHydratedCanonicalWorkspace, preferences]);
  useEffect(() => {
    if (!hasHydratedCanonicalWorkspace) return;
    persistJSONWithElectronMirror(MCP_AGENT_WATCH_CONFIGS_KEY, agentWatchConfigs);
  }, [agentWatchConfigs, hasHydratedCanonicalWorkspace]);

  // Persist tasks and swimlanes to localStorage whenever they change
  useEffect(() => {
    if (!hasHydratedCanonicalWorkspace) return;
    persistJSONWithElectronMirror(TASKS_KEY, tasks);
  }, [hasHydratedCanonicalWorkspace, tasks]);

  useEffect(() => {
    if (!hasHydratedCanonicalWorkspace) return;
    persistJSONWithElectronMirror(SWIMLANES_KEY, timelineSwimlanes);
  }, [hasHydratedCanonicalWorkspace, timelineSwimlanes]);

  useEffect(() => {
    if (!hasHydratedCanonicalWorkspace) return;
    persistJSONWithElectronMirror(PEOPLE_KEY, people);
  }, [hasHydratedCanonicalWorkspace, people]);

  useEffect(() => {
    let cancelled = false;

    const hydrateFromCanonicalStore = async () => {
      if (typeof window !== 'undefined') {
        try {
          const exported = await window.electron?.storeExport?.();
          if (cancelled || !exported || typeof exported !== 'object') return;

          const hasTasks = Object.prototype.hasOwnProperty.call(exported, TASKS_KEY);
          const hasProjects = Object.prototype.hasOwnProperty.call(exported, SWIMLANES_KEY);
          const hasPeople = Object.prototype.hasOwnProperty.call(exported, PEOPLE_KEY);
          const hasStatusColumns = Object.prototype.hasOwnProperty.call(exported, STATUS_COLUMNS_KEY);
          const hasPreferences = Object.prototype.hasOwnProperty.call(exported, PREFERENCES_KEY);
          const hasAgentWatchConfigs = Object.prototype.hasOwnProperty.call(exported, MCP_AGENT_WATCH_CONFIGS_KEY);

          const canonicalProjects = hasProjects
            ? sanitizeTimelineSwimlanes(exported[SWIMLANES_KEY])
            : timelineSwimlanes;
          const canonicalPeople = hasPeople
            ? sanitizePeople(exported[PEOPLE_KEY])
            : people;
          const canonicalStatusColumns = hasStatusColumns
            ? sanitizeStatusColumns(exported[STATUS_COLUMNS_KEY], defaultSwimlanes)
            : statusColumns;

          if (hasProjects) setTimelineSwimlanes(canonicalProjects);
          if (hasPeople) setPeople(canonicalPeople);
          if (hasStatusColumns) setStatusColumns(canonicalStatusColumns);
          if (hasPreferences) {
            setPreferences(prev => sanitizePreferences(exported[PREFERENCES_KEY], canonicalStatusColumns, prev));
          }
          if (hasAgentWatchConfigs) {
            setAgentWatchConfigs(sanitizeAgentWatchConfigs(exported[MCP_AGENT_WATCH_CONFIGS_KEY]));
          }
          if (hasTasks) {
            const canonicalTasks = sanitizeTasks(exported[TASKS_KEY], canonicalProjects);
            setTasks(canonicalTasks);
          }
        } finally {
          if (!cancelled) {
            setHasHydratedCanonicalWorkspace(true);
          }
        }
      } else if (!cancelled) {
        setHasHydratedCanonicalWorkspace(true);
      }
    };

    void hydrateFromCanonicalStore();

    return () => {
      cancelled = true;
    };
  }, []);

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
  const [isSwimlaneDialogOpen, setIsSwimlaneDialogOpen] = useState(false);
  const [isPeoplePanelOpen, setIsPeoplePanelOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailsTaskId, setDetailsTaskId] = useState<string | null>(null);
  const [selectedSwimlane, setSelectedSwimlane] = useState<TimelineSwimlane | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('open');
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(undefined);
  const [defaultEndDate, setDefaultEndDate] = useState<Date | undefined>(undefined);
  const [defaultSwimlaneId, setDefaultSwimlaneId] = useState<string | undefined>(undefined);
  const [defaultAssigneeId, setDefaultAssigneeId] = useState<string | undefined>(undefined);
  const [viewRefreshKey, setViewRefreshKey] = useState(0);
  const [appliedMcpSettingsSignature, setAppliedMcpSettingsSignature] = useState(() =>
    getMcpSettingsSignature(preferences)
  );
  const [mcpListenerStatus, setMcpListenerStatus] = useState<McpListenerStatus | null>(null);
  const [mcpAuditLog, setMcpAuditLog] = useState<McpAuditSummaryEntry[]>([]);
  const [agentWatchRuntime, setAgentWatchRuntime] = useState<Record<string, AgentWatchRuntimeState>>({});

  const detailsTask = detailsTaskId ? tasks.find(t => t.id === detailsTaskId) ?? null : null;
  const mcpReadService = useMemo(() => createMcpReadService({
    enabled: preferences.mcpAgentAccessEnabled,
    endpoint: preferences.mcpServerAddress,
    headers: preferences.mcpAccessToken
      ? { Authorization: `Bearer ${preferences.mcpAccessToken}` }
      : undefined,
  }), [preferences.mcpAccessToken, preferences.mcpAgentAccessEnabled, preferences.mcpServerAddress]);

  const refreshMcpListenerStatus = useCallback(async () => {
    try {
      if (window.electron?.mcp?.getListenerStatus) {
        const result = await window.electron.mcp.getListenerStatus();
        if (result?.ok) {
          setMcpListenerStatus(result.data);
        }
      }
    } catch (error) {
      // Keep the last known listener state if the bridge is temporarily unavailable.
    }
  }, []);

  const refreshMcpAuditLog = useCallback(async () => {
    try {
      if (window.electron?.mcp?.getAuditLog) {
        const result = await window.electron.mcp.getAuditLog({ limit: 25 });
        if (result?.ok && Array.isArray(result.data)) {
          setMcpAuditLog(
            result.data.filter(
              (entry): entry is McpAuditSummaryEntry =>
                Boolean(entry && typeof entry.auditId === 'string' && typeof entry.timestamp === 'string')
            )
          );
        }
      }
    } catch (error) {
      // Keep the last known audit log if the bridge is temporarily unavailable.
    }
  }, []);

  const pollAgentWatcher = useCallback(async (config: AgentWatchConfig) => {
    try {
      const result = await mcpReadService.pollBoardWatcher({
        watcherId: `agent:${config.personId}`,
        statusId: config.statusId,
        assigneeId: config.personId,
        projectId: config.projectId,
        search: config.search,
        persist: true,
      });
      const watchResult = result as McpBoardWatchResult;
      const changes = watchResult.changes || { newTasks: [], updatedTasks: [], removedTaskIds: [] };
      setAgentWatchRuntime(prev => ({
        ...prev,
        [config.personId]: {
          personId: config.personId,
          watcherId: watchResult.watcherState?.watcherId,
          lastCheckedAt: watchResult.watcherState?.lastProcessedAt || new Date().toISOString(),
          newTaskCount: Array.isArray(changes.newTasks) ? changes.newTasks.length : 0,
          updatedTaskCount: Array.isArray(changes.updatedTasks) ? changes.updatedTasks.length : 0,
          removedTaskCount: Array.isArray(changes.removedTaskIds) ? changes.removedTaskIds.length : 0,
          latestTaskTitles: [
            ...(Array.isArray(changes.newTasks) ? changes.newTasks : []),
            ...(Array.isArray(changes.updatedTasks) ? changes.updatedTasks : []),
          ]
            .map(task => String(task?.title || '').trim())
            .filter(Boolean)
            .slice(0, 4),
        },
      }));
      return watchResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAgentWatchRuntime(prev => ({
        ...prev,
        [config.personId]: {
          personId: config.personId,
          newTaskCount: 0,
          updatedTaskCount: 0,
          removedTaskCount: 0,
          latestTaskTitles: [],
          lastCheckedAt: new Date().toISOString(),
          error: message,
        },
      }));
      return null;
    }
  }, [mcpReadService]);

  const upsertAgentWatchConfig = useCallback((nextConfig: AgentWatchConfig) => {
    setAgentWatchConfigs(prev => {
      const sanitized = sanitizeAgentWatchConfigs([nextConfig])[0];
      if (!sanitized) return prev;
      const existingIndex = prev.findIndex(config => config.personId === sanitized.personId);
      if (existingIndex < 0) {
        return [...prev, sanitized];
      }
      const next = [...prev];
      next[existingIndex] = sanitized;
      return next;
    });
  }, []);

  const removeAgentWatchConfig = useCallback((personId: string) => {
    setAgentWatchConfigs(prev => prev.filter(config => config.personId !== personId));
    setAgentWatchRuntime(prev => {
      if (!prev[personId]) return prev;
      const next = { ...prev };
      delete next[personId];
      return next;
    });
  }, []);

  const handleTaskClick = (task: Task) => {
    setDetailsTaskId(task.id);
    setIsTaskDetailsOpen(true);
  };

  const handleEditTaskFromKanban = (task: Task) => {
    setSelectedTask(task);
    setDefaultStatus(task.status);
    setDefaultDate(undefined);
    setDefaultSwimlaneId(task.swimlaneId);
    setIsTaskDialogOpen(true);
  };

  const handleEditTaskFromDetails = (task: Task) => {
    setIsTaskDetailsOpen(false);
    handleEditTaskFromKanban(task);
  };

  const handleAddTaskFromTimeline = (date: Date, swimlaneId: string, endDate?: Date, mode?: 'projects' | 'people') => {
    setSelectedTask(null);
    setDefaultStatus('open');
    setDefaultDate(date);
    setDefaultEndDate(endDate);
    if (mode === 'people') {
      setDefaultSwimlaneId(undefined);
      setDefaultAssigneeId(swimlaneId);
    } else {
      setDefaultSwimlaneId(swimlaneId);
      setDefaultAssigneeId(undefined);
    }
    setIsTaskDialogOpen(true);
  };

  const handleAddTaskFromSwimlane = (status: TaskStatus) => {
    setSelectedTask(null);
    setDefaultStatus(status);
    setDefaultDate(undefined);
    setDefaultSwimlaneId(undefined);
    setIsTaskDialogOpen(true);
  };

  const handleSaveTask = (taskData: Partial<Task>) => {
    if (taskData.id) {
      // Update existing task
      setTasks(prevTasks => prevTasks.map(t => (t.id === taskData.id ? { ...t, ...taskData } : t)));
    } else {
      // Create new task
      const newTask: Task = {
        id: Date.now().toString(),
        title: taskData.title!,
        status: taskData.status || 'open',
        notes: taskData.notes,
        size: taskData.size || 'm',
        complexity: taskData.complexity || 'medium',
        blocked: Boolean(taskData.blocked),
        priority: taskData.priority || 'normal',
        startDate: taskData.startDate,
        endDate: taskData.endDate,
        projectIds: taskData.projectIds || [],
        project: taskData.project,
        swimlaneOnly: taskData.swimlaneOnly,
        swimlaneId: taskData.swimlaneId,
        assigneeId: taskData.assigneeId,
        comments: taskData.comments || [],
      };
      setTasks(prevTasks => [...prevTasks, newTask]);
    }
  };

  const handleAddTaskComment = (taskId: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const nextComment: TaskComment = {
      id: `comment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      author: 'You',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setTasks(prevTasks => prevTasks.map(task => (
      task.id === taskId
        ? { ...task, comments: [...(task.comments || []), nextComment] }
        : task
    )));
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
  };

  const handleMoveTask = (taskId: string, newStatus: TaskStatus) => {
    setTasks(prevTasks => prevTasks.map(t => (t.id === taskId ? { ...t, status: newStatus } : t)));
  };

  const handleMoveAgentTaskToReview = (taskId: string) => {
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (task.id !== taskId) return task;
        if (task.status !== 'in-progress') return task;
        const assignee = task.assigneeId ? people.find(person => person.id === task.assigneeId) : null;
        if (!assignee || assignee.kind !== 'agentic') return task;
        return { ...task, status: 'under-review' };
      })
    );
  };

  const handleUpdateTaskDates = (taskId: string, startDate: string, endDate: string) => {
    setTasks(prevTasks => prevTasks.map(t => (t.id === taskId ? { ...t, startDate, endDate } : t)));
  };

  const handleCloseTaskDialog = () => {
    setIsTaskDialogOpen(false);
    setSelectedTask(null);
    setDefaultDate(undefined);
    setDefaultSwimlaneId(undefined);
    setDefaultAssigneeId(undefined);
  };

  const handleEditSwimlane = (swimlane: TimelineSwimlane) => {
    setSelectedSwimlane(swimlane);
    setIsSwimlaneDialogOpen(true);
  };

  const handleAddSwimlane = () => {
    setSelectedSwimlane(null);
    setIsSwimlaneDialogOpen(true);
  };

  const handleSaveSwimlane = (swimlaneData: Partial<TimelineSwimlane>) => {
    if (swimlaneData.id) {
      // Update existing swimlane
      setTimelineSwimlanes(
        timelineSwimlanes.map(s => (s.id === swimlaneData.id ? { ...s, ...swimlaneData } : s))
      );
    } else {
      // Create new swimlane
      const newSwimlane: TimelineSwimlane = {
        id: Date.now().toString(),
        name: swimlaneData.name!,
      };
      setTimelineSwimlanes([...timelineSwimlanes, newSwimlane]);
    }
  };

  const handleDeleteSwimlane = (swimlaneId: string) => {
    // Remove swimlane
    const remainingSwimlanes = timelineSwimlanes.filter(s => s.id !== swimlaneId);
    setTimelineSwimlanes(remainingSwimlanes);

    // Update tasks to remove swimlane references and deleted project membership
    setTasks(prevTasks => prevTasks.map(task => {
      const nextProjectIds = (task.projectIds || []).filter(id => id !== swimlaneId);
      const nextProject = nextProjectIds
        .map(projectId => remainingSwimlanes.find(s => s.id === projectId)?.name)
        .filter(Boolean)
        .join(', ') || undefined;

      return {
        ...task,
        swimlaneId: task.swimlaneId === swimlaneId ? undefined : task.swimlaneId,
        projectIds: nextProjectIds,
        project: nextProject,
        swimlaneOnly: nextProjectIds.length === 0 || !task.swimlaneId || task.swimlaneId === swimlaneId,
      };
    }));
  };

  const handleCloseSwimlaneDialog = () => {
    setIsSwimlaneDialogOpen(false);
    setSelectedSwimlane(null);
  };

  const handleAddPerson = (personData: Omit<Person, 'id'>) => {
    const newPerson: Person = {
      id: Date.now().toString(),
      name: personData.name,
      role: personData.role,
      kind: personData.kind === 'agentic' ? 'agentic' : 'human',
      avatar: personData.avatar,
    };
    setPeople(prevPeople => [...prevPeople, newPerson]);
  };

  const handleDeletePerson = (personId: string) => {
    setPeople(prevPeople => prevPeople.filter(p => p.id !== personId));
    setTasks(prevTasks => prevTasks.map(t => (t.assigneeId === personId ? { ...t, assigneeId: undefined } : t)));
    removeAgentWatchConfig(personId);
  };

  const handleUpdatePerson = (personId: string, updates: Pick<Person, 'name' | 'role' | 'kind'>) => {
    setPeople(prevPeople => prevPeople.map(p => (p.id === personId ? { ...p, ...updates } : p)));
  };

  const handleReorderSwimlanes = (reorderedSwimlanes: TimelineSwimlane[]) => {
    setTimelineSwimlanes(reorderedSwimlanes);
  };

  const handleReorderPeople = (reorderedPeople: Person[]) => {
    setPeople(reorderedPeople);
  };

  const handleReorderTasks = (reorderedTasks: Task[]) => {
    setTasks(reorderedTasks);
  };

  // Status columns management (kanban/swimlane columns)
  const handleRenameStatusColumn = (colId: string, newTitle: string) => {
    setStatusColumns((cols: any[]) => cols.map(c => c.id === colId ? { ...c, title: newTitle } : c));
  };

  const handleChangeStatusColumnColor = (colId: string, newColorClass: string) => {
    setStatusColumns((cols: any[]) => cols.map(c => c.id === colId ? { ...c, color: newColorClass } : c));
  };

  const handleReorderStatusColumns = (fromIndex: number, toIndex: number) => {
    setStatusColumns((cols: any[]) => {
      const copy = [...cols];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  const handleAddStatusColumn = (col: { id?: string; title: string; color?: string }) => {
    const newCol = { id: col.id || Date.now().toString(), title: col.title, color: col.color || '#9ca3af' };
    setStatusColumns((cols: any[]) => [...cols, newCol]);
  };

  const handleDeleteStatusColumn = (colId: string) => {
    // Check if any tasks use this status
    const tasksUsingStatus = tasks.filter(t => t.status === colId);
    if (tasksUsingStatus.length > 0) {
      // Move tasks to first remaining column, or mark as 'open'
      const remainingCols = statusColumns.filter(c => c.id !== colId);
      const fallbackStatus = remainingCols.length > 0 ? remainingCols[0].id : 'open';
      setTasks(prevTasks =>
        prevTasks.map(t =>
          t.status === colId ? { ...t, status: fallbackStatus as TaskStatus } : t
        )
      );
    }
    setStatusColumns((cols: any[]) => cols.filter(c => c.id !== colId));
  };

  const handleNukeLocalData = async () => {
    if (typeof window === 'undefined') return;
    const confirmed = window.confirm(
      'This will clear local storage data for this app and reset your workspace. Continue?'
    );
    if (!confirmed) return;

    try {
      window.localStorage.clear();
      await clearPortableElectronStoreKeys();
    } catch (err) {
      // ignore
    }

    setTasks([]);
    setTimelineSwimlanes([]);
    setPeople([]);
    setStatusColumns(defaultSwimlanes);
    setPreferences({
      executionLoadStatusId: getDefaultStatusId(defaultSwimlanes, 'in-progress'),
      pipelineLoadStatusId: getDefaultStatusId(defaultSwimlanes, 'open'),
      mcpAgentAccessEnabled: false,
      mcpCapabilityProfile: 'read_only',
      mcpBindHost: DEFAULT_MCP_BIND_HOST,
      mcpPort: DEFAULT_MCP_PORT,
      mcpServerAddress: DEFAULT_MCP_SERVER_ADDRESS,
      mcpAccessToken: '',
      mcpAccessTokenIssuedAt: undefined,
      mcpAccessTokenTtlMinutes: 60,
    });
  };

  const handleRestartMcpServer = async () => {
    try {
      if (window.electron?.mcp?.restartServer) {
        const result = await window.electron.mcp.restartServer();
        if (!result?.success) {
          window.alert(`Could not restart MCP server: ${result?.error || 'Unknown error'}`);
          return;
        }
        if (result.listenerStatus) {
          setMcpListenerStatus(result.listenerStatus);
        } else {
          void refreshMcpListenerStatus();
        }
        void refreshMcpAuditLog();
        setAppliedMcpSettingsSignature(getMcpSettingsSignature(preferences));
        void mcpHealth.runHealthCheck();
      }
    } catch (err) {
      window.alert('Could not restart MCP server.');
    }
  };

  const handleRotateMcpAccessToken = () => {
    setPreferences(prev => ({
      ...prev,
      mcpAccessToken: generateMcpAccessToken(),
      mcpAccessTokenIssuedAt: new Date().toISOString(),
    }));
  };

  const handleExportTasksAndProjects = async () => {
    if (typeof window === 'undefined') return;
    if (viewState.currentView === 'timeline') {
      viewState.saveViewState('timeline', {
        ...viewState.getViewState('timeline'),
        scrollLeft: timelineScrollStateRef.current.scrollLeft,
        scrollTop: timelineScrollStateRef.current.scrollTop,
      });
    } else {
      viewState.saveViewState('kanban', {
        ...viewState.getViewState('kanban'),
        scrollLeft: kanbanContainerRef.current?.scrollLeft || 0,
        scrollTop: kanbanContainerRef.current?.scrollTop || 0,
      });
    }

    const currentTimelineViewState =
      viewState.currentView === 'timeline'
        ? {
            ...viewState.getViewState('timeline'),
            scrollLeft: timelineScrollStateRef.current.scrollLeft,
            scrollTop: timelineScrollStateRef.current.scrollTop,
          }
        : safeReadLocalStorageJSON<Record<string, unknown>>(TIMELINE_VIEW_STATE_KEY, viewState.getViewState('timeline'));
    const currentKanbanViewState =
      viewState.currentView === 'kanban'
        ? {
            ...viewState.getViewState('kanban'),
            scrollLeft: kanbanContainerRef.current?.scrollLeft || 0,
            scrollTop: kanbanContainerRef.current?.scrollTop || 0,
          }
        : safeReadLocalStorageJSON<Record<string, unknown>>(KANBAN_VIEW_STATE_KEY, viewState.getViewState('kanban'));
    const payload: BackupFile = {
      version: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      tasks,
      projects: timelineSwimlanes,
      people,
      statusColumns,
      preferences,
      ui: {
        currentView: viewState.currentView,
        viewState: {
          timeline: currentTimelineViewState,
          kanban: currentKanbanViewState,
        },
        timeline: {
          leftColWidth: Number(safeReadRaw(LEFT_COL_WIDTH_KEY) || 200),
          monthWidths: safeReadLocalStorageJSON<Record<string, number>>(MONTH_WIDTHS_KEY, {}),
        },
      },
      storage: getPortableStorageSnapshot(),
      electronStore: await getPortableElectronStoreSnapshot(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `plumy-backup-${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleImportTasksAndProjects = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupFile;

      if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.projects)) {
        window.alert('Invalid backup format. Expected "tasks" and "projects" arrays.');
        return;
      }

      const importedProjects = parsed.projects
        .filter(project => project && typeof project.id === 'string' && typeof project.name === 'string')
        .map(project => ({
          id: project.id,
          name: project.name,
          color: project.color || '#3b82f6',
          subtitle: project.subtitle,
        }));

      const importedTasks = parsed.tasks
        .filter(task => task && typeof task.id === 'string' && typeof task.title === 'string')
        .map(task => normalizeTask(task, importedProjects));

      const importedPeople: Person[] = Array.isArray(parsed.people)
        ? parsed.people
            .filter(person => person && typeof person.id === 'string' && typeof person.name === 'string')
            .map(person => ({
              ...person,
              role: person.role || 'Team Member',
              kind: (person.kind === 'agentic' ? 'agentic' : 'human') as Person['kind'],
            }))
        : people;

      const importedStatusColumns = deriveStatusColumnsFromTasks(
        importedTasks,
        sanitizeStatusColumns(parsed.statusColumns, statusColumns)
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
          .map(projectId => importedProjects.find(item => item.id === projectId)?.name)
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

      const importedPreferences = sanitizePreferences(parsed.preferences, importedStatusColumns, preferences);

      await restorePortableStorageSnapshot(parsed.storage, parsed.electronStore);

      setTimelineSwimlanes(importedProjects);
      setTasks(repairedTasks);
      setPeople(importedPeople);
      setStatusColumns(importedStatusColumns);
      setPreferences(importedPreferences);

      if (parsed.ui?.viewState?.timeline) {
        viewState.saveViewState('timeline', parsed.ui.viewState.timeline);
      }
      if (parsed.ui?.viewState?.kanban) {
        viewState.saveViewState('kanban', parsed.ui.viewState.kanban);
      }
      if (parsed.ui?.timeline?.monthWidths && typeof parsed.ui.timeline.monthWidths === 'object') {
        safeWriteRaw(MONTH_WIDTHS_KEY, JSON.stringify(parsed.ui.timeline.monthWidths));
      }
      if (Number.isFinite(Number(parsed.ui?.timeline?.leftColWidth))) {
        safeWriteRaw(LEFT_COL_WIDTH_KEY, String(parsed.ui?.timeline?.leftColWidth));
      }
      if (parsed.ui?.currentView === 'timeline' || parsed.ui?.currentView === 'kanban') {
        viewState.switchView(parsed.ui.currentView);
      }
      setViewRefreshKey(prev => prev + 1);
    } catch (err) {
      window.alert('Could not import backup. Please select a valid JSON export file.');
    }
  };

  useEffect(() => {
    setPreferences(prev => {
      const nextExecution = statusColumns.some(col => col.id === prev.executionLoadStatusId)
        ? prev.executionLoadStatusId
        : getDefaultStatusId(statusColumns, 'in-progress');
      const nextPipeline = statusColumns.some(col => col.id === prev.pipelineLoadStatusId)
        ? prev.pipelineLoadStatusId
        : getDefaultStatusId(statusColumns, 'open');

      if (nextExecution === prev.executionLoadStatusId && nextPipeline === prev.pipelineLoadStatusId) {
        return prev;
      }

      return {
        ...prev,
        executionLoadStatusId: nextExecution,
        pipelineLoadStatusId: nextPipeline,
      };
    });
  }, [statusColumns]);

  useEffect(() => {
    const validPeople = new Set(people.filter(person => person.kind === 'agentic').map(person => person.id));
    const validStatuses = new Set(statusColumns.map(column => column.id));

    setAgentWatchConfigs(prev => prev.filter(config => validPeople.has(config.personId) && validStatuses.has(config.statusId)));
  }, [people, statusColumns]);

  useEffect(() => {
    if (!isPreferencesOpen || typeof window === 'undefined') return;
    let cancelled = false;

    const refreshStorageMeter = async () => {
      const usedBytes = getLocalStorageUsageBytes();
      let totalBytes = 5 * 1024 * 1024;
      let sourceLabel = 'Estimated localStorage capacity';

      try {
        if (navigator.storage?.estimate) {
          const estimate = await navigator.storage.estimate();
          if (typeof estimate.quota === 'number' && estimate.quota > 0) {
            totalBytes = estimate.quota;
            sourceLabel = 'Browser storage estimate';
          }
        }
      } catch (err) {
        // Keep fallback values.
      }

      const usagePercent = totalBytes > 0
        ? Math.max(0, Math.min(100, Math.round((usedBytes / totalBytes) * 100)))
        : 0;

      if (!cancelled) {
        setStorageMeter({
          usedBytes,
          totalBytes,
          usagePercent,
          sourceLabel,
        });
      }
    };

    refreshStorageMeter();
    return () => {
      cancelled = true;
    };
  }, [
    isPreferencesOpen,
    tasks,
    timelineSwimlanes,
    people,
    statusColumns,
    preferences,
  ]);

  useEffect(() => {
    if (!isPreferencesOpen) return;
    void refreshMcpListenerStatus();
    void refreshMcpAuditLog();
  }, [isPreferencesOpen, refreshMcpAuditLog, refreshMcpListenerStatus]);

  useEffect(() => {
    const enabledConfigs = agentWatchConfigs.filter(config => config.enabled);
    if (!preferences.mcpAgentAccessEnabled || enabledConfigs.length === 0) {
      return undefined;
    }

    let cancelled = false;
    const intervalMs = Math.max(
      15000,
      ...enabledConfigs.map(config => Math.max(15, config.intervalSeconds) * 1000)
    );

    const run = async () => {
      for (const config of enabledConfigs) {
        if (cancelled) return;
        await pollAgentWatcher(config);
      }
    };

    void run();
    const timer = window.setInterval(() => {
      void run();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [agentWatchConfigs, pollAgentWatcher, preferences.mcpAgentAccessEnabled]);

  useMcpDiagnostics({
    enabled: preferences.mcpAgentAccessEnabled,
    endpoint: preferences.mcpServerAddress,
  });

  const mcpHealthExpectation = useMemo(
    () => ({
      counts: {
        tasks: tasks.length,
        people: people.length,
        swimlanes: timelineSwimlanes.length,
        statusColumns: statusColumns.length,
      },
      requiredTaskKeys: ['id', 'title', 'status'],
      requiredPersonKeys: ['id', 'name'],
      requiredStatusColumnKeys: ['id', 'title'],
    }),
    [tasks.length, people.length, timelineSwimlanes.length, statusColumns.length]
  );

  const mcpHealth = useMcpHealthValidation({
    enabled: preferences.mcpAgentAccessEnabled,
    endpoint: preferences.mcpServerAddress,
    headers: preferences.mcpAccessToken
      ? {
          Authorization: `Bearer ${preferences.mcpAccessToken}`,
        }
      : undefined,
    expectation: mcpHealthExpectation,
  });

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Plumy" className="h-10 w-auto antialiased" />
            <p className="text-lg font-semibold">plumy</p>
          </div>
          {/* View Toggle */}
          <ViewToggle
            currentView={viewState.currentView}
            onViewChange={(view) => {
              // Save current view state before switching
              if (viewState.currentView === 'timeline') {
                viewState.saveViewState('timeline', {
                  scrollLeft: timelineScrollStateRef.current.scrollLeft,
                  scrollTop: timelineScrollStateRef.current.scrollTop,
                  collapsedSwimlanes: [],
                  mode: 'projects',
                });
              } else if (viewState.currentView === 'kanban') {
                viewState.saveViewState('kanban', {
                  scrollLeft: kanbanContainerRef.current?.scrollLeft || 0,
                  scrollTop: kanbanContainerRef.current?.scrollTop || 0,
                });
              }
              // Switch to new view
              viewState.switchView(view);

              // Restore scroll position for the new view
              setTimeout(() => {
                const savedState = viewState.getViewState(view);
                if (view === 'kanban' && kanbanContainerRef.current) {
                  kanbanContainerRef.current.scrollLeft = savedState.scrollLeft || 0;
                  kanbanContainerRef.current.scrollTop = savedState.scrollTop || 0;
                }
              }, 0);
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setIsPreferencesOpen(true)}>
            <Settings className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsPeoplePanelOpen(true)}>
            <User className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {/* Timeline View */}
        {viewState.currentView === 'timeline' && (
          <div key={`timeline-${viewRefreshKey}`} ref={timelineContainerRef} className="h-full w-full">
            <TimelineView
              tasks={tasks}
              swimlanes={timelineSwimlanes}
              people={people}
              statusColumns={statusColumns}
              initialScrollLeft={viewState.getViewState('timeline').scrollLeft || 0}
              onTaskClick={handleTaskClick}
              onAddTask={handleAddTaskFromTimeline}
              onUpdateTaskDates={handleUpdateTaskDates}
              onEditSwimlane={handleEditSwimlane}
              onAddSwimlane={handleAddSwimlane}
              onReorderSwimlanes={handleReorderSwimlanes}
              onReorderPeople={handleReorderPeople}
              onReorderTasks={handleReorderTasks}
              onTimelineScroll={(state) => {
                timelineScrollStateRef.current = state;
              }}
            />
          </div>
        )}

        {/* Kanban View */}
        {viewState.currentView === 'kanban' && (
          <div key={`kanban-${viewRefreshKey}`} ref={kanbanContainerRef} className="h-full w-full">
            <DndProvider backend={HTML5Backend}>
              <KanbanView
                tasks={tasks}
                swimlanes={statusColumns}
                onTaskClick={handleTaskClick}
                onEditTask={handleEditTaskFromKanban}
                onAddTask={handleAddTaskFromSwimlane}
                onMoveTask={handleMoveTask}
                onReorderTasks={handleReorderTasks}
                onReorderColumns={handleReorderStatusColumns}
                onRenameColumn={handleRenameStatusColumn}
                onChangeColumnColor={handleChangeStatusColumnColor}
                onAddColumn={handleAddStatusColumn}
                onDeleteColumn={handleDeleteStatusColumn}
              />
            </DndProvider>
          </div>
        )}
      </div>

      {/* Task Dialog */}
      <TaskDialog
        isOpen={isTaskDialogOpen}
        onClose={handleCloseTaskDialog}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        task={selectedTask}
        defaultStatus={defaultStatus}
        defaultDate={defaultDate}
        defaultEndDate={defaultEndDate}
        defaultSwimlaneId={defaultSwimlaneId}
        defaultAssigneeId={defaultAssigneeId}
        swimlanes={timelineSwimlanes}
        statusColumns={statusColumns}
        people={people}
      />

      {/* Task Details Dialog */}
      <TaskDetailsDialog
        isOpen={isTaskDetailsOpen}
        onClose={() => setIsTaskDetailsOpen(false)}
        onEdit={handleEditTaskFromDetails}
        onMoveAgentTaskToReview={handleMoveAgentTaskToReview}
        onAddComment={handleAddTaskComment}
        task={detailsTask}
        swimlanes={timelineSwimlanes}
        people={people}
        statusColumns={statusColumns}
      />

      {/* Swimlane Dialog */}
      <SwimlaneDialog
        isOpen={isSwimlaneDialogOpen}
        onClose={handleCloseSwimlaneDialog}
        onSave={handleSaveSwimlane}
        onDelete={handleDeleteSwimlane}
        swimlane={selectedSwimlane}
      />

      {/* People Panel */}
      <PeoplePanel
        isOpen={isPeoplePanelOpen}
        onClose={() => setIsPeoplePanelOpen(false)}
        people={people}
        tasks={tasks}
        statusColumns={statusColumns}
        executionLoadStatusId={preferences.executionLoadStatusId}
        pipelineLoadStatusId={preferences.pipelineLoadStatusId}
        agentWatchConfigs={agentWatchConfigs}
        agentWatchRuntime={agentWatchRuntime}
        onAddPerson={handleAddPerson}
        onUpdatePerson={handleUpdatePerson}
        onDeletePerson={handleDeletePerson}
        onSaveAgentWatchConfig={upsertAgentWatchConfig}
        onRemoveAgentWatchConfig={removeAgentWatchConfig}
        onPollAgentWatch={(personId) => {
          const config = agentWatchConfigs.find(item => item.personId === personId) || {
            personId,
            enabled: true,
            statusId: statusColumns[0]?.id || 'open',
            action: 'inspect_and_work' as const,
            intervalSeconds: 60,
          };
          if (!config) return;
          void pollAgentWatcher(config);
        }}
      />

      {/* Preferences Panel */}
      <PreferencesPanel
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        statusColumns={statusColumns}
        executionLoadStatusId={preferences.executionLoadStatusId}
        pipelineLoadStatusId={preferences.pipelineLoadStatusId}
        storageMeter={storageMeter}
        onNukeLocalData={handleNukeLocalData}
        onExportTasksAndProjects={handleExportTasksAndProjects}
        onImportTasksAndProjects={handleImportTasksAndProjects}
        onExecutionLoadStatusChange={(statusId) =>
          setPreferences(prev => ({ ...prev, executionLoadStatusId: statusId }))
        }
        onPipelineLoadStatusChange={(statusId) =>
          setPreferences(prev => ({ ...prev, pipelineLoadStatusId: statusId }))
        }
        mcpAgentAccessEnabled={preferences.mcpAgentAccessEnabled}
        mcpAddress={preferences.mcpServerAddress}
        mcpBindHost={preferences.mcpBindHost}
        mcpPort={preferences.mcpPort}
        mcpAccessToken={preferences.mcpAccessToken}
        mcpAccessTokenIssuedAt={preferences.mcpAccessTokenIssuedAt}
        mcpAccessTokenTtlMinutes={preferences.mcpAccessTokenTtlMinutes}
        mcpCapabilityProfile={preferences.mcpCapabilityProfile}
        mcpListenerStatus={mcpListenerStatus}
        mcpAuditLog={mcpAuditLog}
        onMcpAgentAccessToggle={(enabled) =>
          setPreferences(prev => ({ ...prev, mcpAgentAccessEnabled: enabled }))
        }
        onMcpAddressChange={(address) =>
          setPreferences(prev => ({ ...prev, mcpServerAddress: normalizeMcpServerAddress(address) }))
        }
        onMcpBindHostChange={(host) =>
          setPreferences(prev => {
            const nextHost = normalizeMcpBindHost(host);
            return {
              ...prev,
              mcpBindHost: nextHost,
              mcpServerAddress: syncLocalMcpServerAddress(prev, nextHost, prev.mcpPort),
            };
          })
        }
        onMcpPortChange={(port) =>
          setPreferences(prev => {
            const nextPort = normalizeMcpPort(port);
            return {
              ...prev,
              mcpPort: nextPort,
              mcpServerAddress: syncLocalMcpServerAddress(prev, prev.mcpBindHost, nextPort),
            };
          })
        }
        onMcpAccessTokenChange={(token) =>
          setPreferences(prev => ({
            ...prev,
            mcpAccessToken: token,
            mcpAccessTokenIssuedAt: token ? new Date().toISOString() : undefined,
          }))
        }
        onMcpAccessTokenRotate={handleRotateMcpAccessToken}
        onMcpAccessTokenTtlMinutesChange={(ttl) =>
          setPreferences(prev => ({ ...prev, mcpAccessTokenTtlMinutes: Math.max(1, Math.min(1440, ttl || 60)) }))
        }
        onMcpCapabilityProfileChange={(profile) =>
          setPreferences(prev => ({ ...prev, mcpCapabilityProfile: profile }))
        }
        onRestartMcpServer={handleRestartMcpServer}
        showMcpHealthDiagnostics={mcpHealth.isDevEnvironment}
        mcpHealthResult={mcpHealth.result}
        mcpHealthCheckRunning={mcpHealth.isRunning}
        onRunMcpHealthCheck={mcpHealth.runHealthCheck}
        mcpRestartPending={getMcpSettingsSignature(preferences) !== appliedMcpSettingsSignature}
        onRefreshMcpAuditLog={refreshMcpAuditLog}
      />
    </div>
  );
}

export default App;
