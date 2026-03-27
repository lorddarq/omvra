import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Task, TaskStatus, TimelineSwimlane, Person } from './types';
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
import { useAgentWatchRuntime } from './hooks/useAgentWatchRuntime';
import { useMcpPanelState } from './hooks/useMcpPanelState';
import { usePeopleActions } from './hooks/usePeopleActions';
import { useProjectActions } from './hooks/useProjectActions';
import { useStorageMeter } from './hooks/useStorageMeter';
import { useStatusColumnActions } from './hooks/useStatusColumnActions';
import { useTaskActions } from './hooks/useTaskActions';
import { useWorkspaceDialogs } from './hooks/useWorkspaceDialogs';
import { createMcpReadService } from './services/mcp/service';
import {
  buildWorkspaceBackupPayload,
  parseWorkspaceBackupJson,
  repairWorkspaceBackupPayload,
  WORKSPACE_BACKUP_SCHEMA_VERSION,
} from './services/workspaceBackup';
import { AppHeader } from './components/AppHeader';
import { AppMainViews } from './components/AppMainViews';
import { AppPanels } from './components/AppPanels';
import { swimlanes as defaultSwimlanes } from './constants/swimlanes';
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
import {
  generateMcpAccessToken,
  getDefaultStatusId,
  getMcpSettingsSignature,
  syncLocalMcpServerAddress,
} from './utils/mcpPreferences';
import {
  clearPortableElectronStoreKeys,
  getPortableElectronStoreSnapshot,
  getPortableStorageSnapshot,
  getPortableStoreValue,
  hasAnyPortableLocalStorageData,
  persistJSONWithElectronMirror,
  readInitialWorkspaceJSON,
  restorePortableStorageSnapshot,
  safeReadLocalStorageJSON,
  safeReadRaw,
  safeWriteRaw,
} from './utils/storage';
import {
  type AgentWatchConfig,
  deriveStatusColumnsFromTasks,
  normalizeTask,
  sanitizeAgentWatchConfigs,
  sanitizePeople,
  sanitizePreferences,
  sanitizeStatusColumns,
  sanitizeTasks,
  sanitizeTimelineSwimlanes,
  type StatusColumnState,
} from './utils/workspaceSanitizers';

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

const ENABLE_SAMPLE_WORKSPACE = Boolean(import.meta.env.DEV);
const DEFAULT_TASKS_SEED = ENABLE_SAMPLE_WORKSPACE ? initialTasks : [];
const DEFAULT_SWIMLANES_SEED = ENABLE_SAMPLE_WORKSPACE ? initialTimelineSwimlanes : [];
const DEFAULT_PEOPLE_SEED = ENABLE_SAMPLE_WORKSPACE ? initialPeople : [];

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
    const stored = readInitialWorkspaceJSON<Task[]>(TASKS_KEY, DEFAULT_TASKS_SEED);
    const swimlanes = readInitialWorkspaceJSON<TimelineSwimlane[]>(SWIMLANES_KEY, DEFAULT_SWIMLANES_SEED);

    // Migrate: Ensure project names and multi-project ids are present.
    return stored.map(task => normalizeTask(task, swimlanes));
  });
  
  const [timelineSwimlanes, setTimelineSwimlanes] = useState<TimelineSwimlane[]>(() => {
    const stored = readInitialWorkspaceJSON<TimelineSwimlane[]>(SWIMLANES_KEY, DEFAULT_SWIMLANES_SEED);
    
    // Migrate: Ensure all swimlanes have colors
    return stored.map(swimlane => ({
      ...swimlane,
      color: swimlane.color || '#3b82f6' // Default blue if no color
    }));
  });
  
  const [people, setPeople] = useState<Person[]>(() => {
    const stored = readInitialWorkspaceJSON<Person[]>(PEOPLE_KEY, DEFAULT_PEOPLE_SEED);
    
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

          const exportedTasks = getPortableStoreValue<Task[]>(exported, TASKS_KEY);
          const exportedProjects = getPortableStoreValue<TimelineSwimlane[]>(exported, SWIMLANES_KEY);
          const exportedPeople = getPortableStoreValue<Person[]>(exported, PEOPLE_KEY);
          const exportedStatusColumns = getPortableStoreValue<StatusColumnState[]>(exported, STATUS_COLUMNS_KEY);
          const exportedPreferences = getPortableStoreValue<Partial<AppPreferences>>(exported, PREFERENCES_KEY);
          const exportedAgentWatchConfigs = getPortableStoreValue<AgentWatchConfig[]>(exported, MCP_AGENT_WATCH_CONFIGS_KEY);
          const hasTasks = exportedTasks !== undefined;
          const hasProjects = exportedProjects !== undefined;
          const hasPeople = exportedPeople !== undefined;
          const hasStatusColumns = exportedStatusColumns !== undefined;
          const hasPreferences = exportedPreferences !== undefined;
          const hasAgentWatchConfigs = exportedAgentWatchConfigs !== undefined;
          const hasCanonicalWorkspaceData = hasTasks || hasProjects || hasPeople || hasStatusColumns || hasPreferences;

          if (!hasCanonicalWorkspaceData && hasAnyPortableLocalStorageData()) {
            const migratedProjects = sanitizeTimelineSwimlanes(
              safeReadLocalStorageJSON<TimelineSwimlane[]>(SWIMLANES_KEY, DEFAULT_SWIMLANES_SEED),
              DEFAULT_SWIMLANES_SEED
            );
            const migratedPeople = sanitizePeople(
              safeReadLocalStorageJSON<Person[]>(PEOPLE_KEY, DEFAULT_PEOPLE_SEED),
              DEFAULT_PEOPLE_SEED
            );
            const migratedStatusColumns = sanitizeStatusColumns(
              safeReadLocalStorageJSON<StatusColumnState[]>(STATUS_COLUMNS_KEY, defaultSwimlanes),
              defaultSwimlanes
            );
            const migratedPreferences = sanitizePreferences(
              safeReadLocalStorageJSON<Partial<AppPreferences>>(PREFERENCES_KEY, {}),
              migratedStatusColumns,
              preferences
            );
            const migratedAgentWatchConfigs = sanitizeAgentWatchConfigs(
              safeReadLocalStorageJSON<AgentWatchConfig[]>(MCP_AGENT_WATCH_CONFIGS_KEY, []),
              []
            );
            const migratedTasks = sanitizeTasks(
              safeReadLocalStorageJSON<Task[]>(TASKS_KEY, DEFAULT_TASKS_SEED),
              migratedProjects,
              DEFAULT_TASKS_SEED
            );

            setTimelineSwimlanes(migratedProjects);
            setPeople(migratedPeople);
            setStatusColumns(migratedStatusColumns);
            setPreferences(migratedPreferences);
            setAgentWatchConfigs(migratedAgentWatchConfigs);
            setTasks(migratedTasks);
            return;
          }

          const canonicalProjects = hasProjects
            ? sanitizeTimelineSwimlanes(exportedProjects, DEFAULT_SWIMLANES_SEED)
            : timelineSwimlanes;
          const canonicalPeople = hasPeople
            ? sanitizePeople(exportedPeople, DEFAULT_PEOPLE_SEED)
            : people;
          const canonicalStatusColumns = hasStatusColumns
            ? sanitizeStatusColumns(exportedStatusColumns, defaultSwimlanes)
            : statusColumns;

          if (hasProjects) setTimelineSwimlanes(canonicalProjects);
          if (hasPeople) setPeople(canonicalPeople);
          if (hasStatusColumns) setStatusColumns(canonicalStatusColumns);
          if (hasPreferences) {
            setPreferences(prev => sanitizePreferences(exportedPreferences, canonicalStatusColumns, prev));
          }
          if (hasAgentWatchConfigs) {
            setAgentWatchConfigs(sanitizeAgentWatchConfigs(exportedAgentWatchConfigs, []));
          }
          if (hasTasks) {
            const canonicalTasks = sanitizeTasks(exportedTasks, canonicalProjects, DEFAULT_TASKS_SEED);
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

  const [viewRefreshKey, setViewRefreshKey] = useState(0);
  const {
    isTaskDialogOpen,
    isTaskDetailsOpen,
    setIsTaskDetailsOpen,
    isSwimlaneDialogOpen,
    isPeoplePanelOpen,
    setIsPeoplePanelOpen,
    isPreferencesOpen,
    setIsPreferencesOpen,
    selectedTask,
    detailsTask,
    selectedSwimlane,
    defaultStatus,
    defaultDate,
    defaultEndDate,
    defaultSwimlaneId,
    defaultAssigneeId,
    handleTaskClick,
    handleEditTaskFromKanban,
    handleEditTaskFromDetails,
    handleAddTaskFromTimeline,
    handleAddTaskFromSwimlane,
    handleCloseTaskDialog,
    handleEditSwimlane,
    handleAddSwimlane,
    handleCloseSwimlaneDialog,
  } = useWorkspaceDialogs(tasks);

  const storageMeter = useStorageMeter({
    enabled: isPreferencesOpen,
    dependencies: [
      tasks,
      timelineSwimlanes,
      people,
      statusColumns,
      preferences,
    ],
  });

  const {
    saveTask: handleSaveTask,
    addTaskComment: handleAddTaskComment,
    deleteTask: handleDeleteTask,
    moveTask: handleMoveTask,
    moveAgentTaskToReview: handleMoveAgentTaskToReview,
    updateTaskDates: handleUpdateTaskDates,
  } = useTaskActions({
    people,
    setTasks,
  });
  const {
    saveSwimlane: handleSaveSwimlane,
    deleteSwimlane: handleDeleteSwimlane,
    reorderSwimlanes: handleReorderSwimlanes,
  } = useProjectActions({
    timelineSwimlanes,
    setTimelineSwimlanes,
    setTasks,
  });
  const {
    renameStatusColumn: handleRenameStatusColumn,
    changeStatusColumnColor: handleChangeStatusColumnColor,
    reorderStatusColumns: handleReorderStatusColumns,
    addStatusColumn: handleAddStatusColumn,
    deleteStatusColumn: handleDeleteStatusColumn,
  } = useStatusColumnActions({
    statusColumns,
    tasks,
    setStatusColumns,
    setTasks,
  });

  const mcpReadService = useMemo(() => createMcpReadService({
    enabled: preferences.mcpAgentAccessEnabled,
    endpoint: preferences.mcpServerAddress,
    headers: preferences.mcpAccessToken
      ? { Authorization: `Bearer ${preferences.mcpAccessToken}` }
      : undefined,
  }), [preferences.mcpAccessToken, preferences.mcpAgentAccessEnabled, preferences.mcpServerAddress]);
  const mcpHealth = useMcpHealthValidation({
    enabled: preferences.mcpAgentAccessEnabled,
    endpoint: preferences.mcpServerAddress,
    headers: preferences.mcpAccessToken
      ? {
          Authorization: `Bearer ${preferences.mcpAccessToken}`,
        }
      : undefined,
    expectation: {
      counts: {
        tasks: tasks.length,
        people: people.length,
        swimlanes: timelineSwimlanes.length,
        statusColumns: statusColumns.length,
      },
      requiredTaskKeys: ['id', 'title', 'status'],
      requiredPersonKeys: ['id', 'name'],
      requiredStatusColumnKeys: ['id', 'title'],
    },
  });
  const {
    appliedMcpSettingsSignature,
    mcpListenerStatus,
    mcpAuditLog,
    refreshMcpListenerStatus,
    refreshMcpAuditLog,
    handleRestartMcpServer,
    handleRotateMcpAccessToken,
    isMcpRestartPending,
  } = useMcpPanelState({
    preferences,
    setPreferences,
    runHealthCheck: mcpHealth.runHealthCheck,
  });
  const {
    agentWatchRuntime,
    pollAgentWatcher,
    upsertAgentWatchConfig,
    removeAgentWatchConfig,
  } = useAgentWatchRuntime({
    mcpReadService,
    enabled: preferences.mcpAgentAccessEnabled,
    agentWatchConfigs,
    setAgentWatchConfigs,
  });

  const handleOpenPreferences = useCallback(() => {
    setIsPreferencesOpen(true);
  }, []);

  const handleClosePreferences = useCallback(() => {
    setIsPreferencesOpen(false);
  }, []);

  const handleOpenPeoplePanel = useCallback(() => {
    setIsPeoplePanelOpen(true);
  }, []);

  const handleClosePeoplePanel = useCallback(() => {
    setIsPeoplePanelOpen(false);
  }, []);

  const handleCloseTaskDetails = useCallback(() => {
    setIsTaskDetailsOpen(false);
  }, []);

  const handleTimelineScroll = useCallback((state: { scrollLeft: number; scrollTop: number }) => {
    timelineScrollStateRef.current = state;
  }, []);

  const handlePollAgentWatchFromPanel = useCallback((personId: string) => {
    const config = agentWatchConfigs.find(item => item.personId === personId) || {
      personId,
      enabled: true,
      statusId: statusColumns[0]?.id || 'open',
      action: 'inspect_and_work' as const,
      intervalSeconds: 60,
    };
    void pollAgentWatcher(config);
  }, [agentWatchConfigs, pollAgentWatcher, statusColumns]);
  const {
    addPerson: handleAddPerson,
    deletePerson: handleDeletePerson,
    updatePerson: handleUpdatePerson,
    reorderPeople: handleReorderPeople,
  } = usePeopleActions({
    setPeople,
    setTasks,
    onDeleteAgentWatchConfig: removeAgentWatchConfig,
  });

  const handleReorderTasks = (reorderedTasks: Task[]) => {
    setTasks(reorderedTasks);
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
    const payload = buildWorkspaceBackupPayload({
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
      version: WORKSPACE_BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
    });
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
      const parsed = parseWorkspaceBackupJson(text);
      if (!parsed.ok || !parsed.payload) {
        window.alert(parsed.error || 'Could not import backup. Please select a valid JSON export file.');
        return;
      }

      const parsedPayload = parsed.payload as Record<string, unknown>;

      if (!Array.isArray(parsedPayload.tasks) || !Array.isArray(parsedPayload.projects)) {
        window.alert('Invalid backup format. Expected "tasks" and "projects" arrays.');
        return;
      }

      const repaired = repairWorkspaceBackupPayload(parsedPayload, {
        fallbackProjects: timelineSwimlanes,
        fallbackPeople: people,
        fallbackStatusColumns: statusColumns,
        fallbackPreferences: preferences,
        fallbackTasks: tasks,
        allowFallbackForMissingArrays: false,
      });

      if (!repaired.ok) {
        window.alert(repaired.error || 'Could not import backup. Please select a valid JSON export file.');
        return;
      }

      await restorePortableStorageSnapshot(repaired.storageSnapshot, repaired.electronStoreSnapshot);

      setTimelineSwimlanes(repaired.projects);
      setTasks(repaired.tasks);
      setPeople(repaired.people);
      setStatusColumns(repaired.statusColumns);
      setPreferences(repaired.preferences);

      if (repaired.ui?.viewState?.timeline) {
        viewState.saveViewState('timeline', repaired.ui.viewState.timeline);
      }
      if (repaired.ui?.viewState?.kanban) {
        viewState.saveViewState('kanban', repaired.ui.viewState.kanban);
      }
      if (repaired.ui?.timeline?.monthWidths && typeof repaired.ui.timeline.monthWidths === 'object') {
        safeWriteRaw(MONTH_WIDTHS_KEY, JSON.stringify(repaired.ui.timeline.monthWidths));
      }
      if (Number.isFinite(Number(repaired.ui?.timeline?.leftColWidth))) {
        safeWriteRaw(LEFT_COL_WIDTH_KEY, String(repaired.ui?.timeline?.leftColWidth));
      }
      if (repaired.ui?.currentView === 'timeline' || repaired.ui?.currentView === 'kanban') {
        viewState.switchView(repaired.ui.currentView as ViewType);
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
    const validStatuses = new Set<string>(statusColumns.map(column => column.id));

    setAgentWatchConfigs(prev => prev.filter(config => validPeople.has(config.personId) && validStatuses.has(config.statusId)));
  }, [people, statusColumns]);

  useEffect(() => {
    if (!isPreferencesOpen) return;
    void refreshMcpListenerStatus();
    void refreshMcpAuditLog();
  }, [isPreferencesOpen, refreshMcpAuditLog, refreshMcpListenerStatus]);

  useMcpDiagnostics({
    enabled: preferences.mcpAgentAccessEnabled,
    endpoint: preferences.mcpServerAddress,
  });

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <AppHeader
        currentView={viewState.currentView}
        onViewChange={(view) => {
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

          viewState.switchView(view);

          setTimeout(() => {
            const savedState = viewState.getViewState(view);
            if (view === 'kanban' && kanbanContainerRef.current) {
              kanbanContainerRef.current.scrollLeft = savedState.scrollLeft || 0;
              kanbanContainerRef.current.scrollTop = savedState.scrollTop || 0;
            }
          }, 0);
        }}
        onOpenPreferences={handleOpenPreferences}
        onOpenPeople={handleOpenPeoplePanel}
      />

      <AppMainViews
        currentView={viewState.currentView}
        viewRefreshKey={viewRefreshKey}
        timelineContainerRef={timelineContainerRef}
        kanbanContainerRef={kanbanContainerRef}
        timelineScrollStateRef={timelineScrollStateRef}
        tasks={tasks}
        timelineSwimlanes={timelineSwimlanes}
        people={people}
        statusColumns={statusColumns}
        timelineInitialScrollLeft={viewState.getViewState('timeline').scrollLeft || 0}
        onTimelineTaskClick={handleTaskClick}
        onTimelineAddTask={handleAddTaskFromTimeline}
        onTimelineUpdateTaskDates={handleUpdateTaskDates}
        onTimelineEditSwimlane={handleEditSwimlane}
        onTimelineAddSwimlane={handleAddSwimlane}
        onTimelineReorderSwimlanes={handleReorderSwimlanes}
        onTimelineReorderPeople={handleReorderPeople}
        onTimelineReorderTasks={handleReorderTasks}
        onTimelineScroll={handleTimelineScroll}
        onKanbanTaskClick={handleTaskClick}
        onKanbanEditTask={handleEditTaskFromKanban}
        onKanbanAddTask={handleAddTaskFromSwimlane}
        onKanbanMoveTask={handleMoveTask}
        onKanbanReorderTasks={handleReorderTasks}
        onKanbanReorderColumns={handleReorderStatusColumns}
        onKanbanRenameColumn={handleRenameStatusColumn}
        onKanbanChangeColumnColor={handleChangeStatusColumnColor}
        onKanbanAddColumn={handleAddStatusColumn}
        onKanbanDeleteColumn={handleDeleteStatusColumn}
      />

      <AppPanels
        isTaskDialogOpen={isTaskDialogOpen}
        isTaskDetailsOpen={isTaskDetailsOpen}
        isSwimlaneDialogOpen={isSwimlaneDialogOpen}
        isPeoplePanelOpen={isPeoplePanelOpen}
        isPreferencesOpen={isPreferencesOpen}
        selectedTask={selectedTask}
        detailsTask={detailsTask}
        selectedSwimlane={selectedSwimlane}
        defaultStatus={defaultStatus}
        defaultDate={defaultDate}
        defaultEndDate={defaultEndDate}
        defaultSwimlaneId={defaultSwimlaneId}
        defaultAssigneeId={defaultAssigneeId}
        tasks={tasks}
        timelineSwimlanes={timelineSwimlanes}
        people={people}
        statusColumns={statusColumns}
        executionLoadStatusId={preferences.executionLoadStatusId}
        pipelineLoadStatusId={preferences.pipelineLoadStatusId}
        agentWatchConfigs={agentWatchConfigs}
        agentWatchRuntime={agentWatchRuntime}
        storageMeter={storageMeter}
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
        mcpHealthResult={mcpHealth.result}
        mcpHealthCheckRunning={mcpHealth.isRunning}
        showMcpHealthDiagnostics={mcpHealth.isDevEnvironment}
        mcpRestartPending={isMcpRestartPending}
        onCloseTaskDialog={handleCloseTaskDialog}
        onSaveTask={handleSaveTask}
        onDeleteTask={handleDeleteTask}
        onCloseTaskDetails={handleCloseTaskDetails}
        onEditTaskFromDetails={handleEditTaskFromDetails}
        onMoveAgentTaskToReview={handleMoveAgentTaskToReview}
        onAddTaskComment={handleAddTaskComment}
        onCloseSwimlaneDialog={handleCloseSwimlaneDialog}
        onSaveSwimlane={handleSaveSwimlane}
        onDeleteSwimlane={handleDeleteSwimlane}
        onClosePeoplePanel={handleClosePeoplePanel}
        onAddPerson={handleAddPerson}
        onUpdatePerson={handleUpdatePerson}
        onDeletePerson={handleDeletePerson}
        onSaveAgentWatchConfig={upsertAgentWatchConfig}
        onRemoveAgentWatchConfig={removeAgentWatchConfig}
        onPollAgentWatch={handlePollAgentWatchFromPanel}
        onClosePreferences={handleClosePreferences}
        onNukeLocalData={handleNukeLocalData}
        onExportTasksAndProjects={handleExportTasksAndProjects}
        onImportTasksAndProjects={handleImportTasksAndProjects}
        onExecutionLoadStatusChange={(statusId) =>
          setPreferences(prev => ({ ...prev, executionLoadStatusId: statusId }))
        }
        onPipelineLoadStatusChange={(statusId) =>
          setPreferences(prev => ({ ...prev, pipelineLoadStatusId: statusId }))
        }
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
        onRunMcpHealthCheck={mcpHealth.runHealthCheck}
        onRefreshMcpAuditLog={refreshMcpAuditLog}
      />
    </div>
  );
}

export default App;
