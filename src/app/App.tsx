import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProjectMilestone, Task, TaskStatus, TimelineSwimlane, Person } from './types';
import { initialTasks, initialTimelineSwimlanes } from './data/sampleData';
import { initialMilestones } from './data/sampleMilestones';
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
import { buildWorkspaceReadModel } from './domain/workspaceReadModel';
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
  sanitizeMilestones,
  sanitizePeople,
  sanitizePreferences,
  sanitizeStatusColumns,
  sanitizeTasks,
  sanitizeTimelineSwimlanes,
  type StatusColumnState,
} from './utils/workspaceSanitizers';

// LocalStorage keys
const TASKS_KEY = 'omvra.tasks.v1';
const SWIMLANES_KEY = 'omvra.swimlanes.v1';
const PEOPLE_KEY = 'omvra.people.v1';
const MILESTONES_KEY = 'omvra.milestones.v1';
const STATUS_COLUMNS_KEY = 'omvra.statusColumns.v1';
const PREFERENCES_KEY = 'omvra.preferences.v1';
const TIMELINE_VIEW_STATE_KEY = 'omvra_viewstate_timeline';
const KANBAN_VIEW_STATE_KEY = 'omvra_viewstate_kanban';
const MONTH_WIDTHS_KEY = 'omvra.monthWidths.v1';
const LEFT_COL_WIDTH_KEY = 'omvra.leftColWidth.v1';
const MCP_AGENT_WATCH_CONFIGS_KEY = 'omvra.mcp.agentWatchConfigs.v1';

const ENABLE_SAMPLE_WORKSPACE = Boolean(import.meta.env.DEV);
const DEFAULT_TASKS_SEED = ENABLE_SAMPLE_WORKSPACE ? initialTasks : [];
const DEFAULT_SWIMLANES_SEED = ENABLE_SAMPLE_WORKSPACE ? initialTimelineSwimlanes : [];
const DEFAULT_PEOPLE_SEED = ENABLE_SAMPLE_WORKSPACE ? initialPeople : [];
const DEFAULT_MILESTONES_SEED = ENABLE_SAMPLE_WORKSPACE ? initialMilestones : [];

interface AppPreferences {
  executionLoadStatusIds: TaskStatus[];
  pipelineLoadStatusIds: TaskStatus[];
  mcpAgentAccessEnabled: boolean;
  mcpCapabilityProfile: 'read_only' | 'task_write' | 'admin';
  mcpBindHost: string;
  mcpPort: number;
  mcpServerAddress: string;
  mcpAccessToken: string;
  mcpAccessTokenIssuedAt?: string;
  mcpAccessTokenTtlMinutes: number;
}

function normalizeLoadStatusIds(
  value: unknown,
  fallback: TaskStatus[],
  statusColumns: Array<{ id: string }>
): TaskStatus[] {
  const validIds = new Set(statusColumns.map(column => column.id));
  const candidates = Array.isArray(value) ? value : typeof value === 'string' ? [value] : fallback;
  const normalized = candidates.filter((statusId): statusId is TaskStatus => (
    typeof statusId === 'string' && validIds.has(statusId)
  ));

  return Array.from(new Set(normalized));
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

interface ImportFeedbackState {
  type: 'success' | 'error';
  message: string;
}

function areSerializedValuesEqual(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch (error) {
    return false;
  }
}

function mirrorCanonicalJsonToLocalStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;

  try {
    if (value === undefined) {
      window.localStorage.removeItem(key);
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Ignore local mirroring failures so MCP-driven updates stay non-blocking.
  }
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
  const kanbanScrollStateRef = useRef<{ scrollLeft: number; scrollTop: number }>({
    scrollLeft: 0,
    scrollTop: 0,
  });
  const [importFeedback, setImportFeedback] = useState<ImportFeedbackState | null>(null);

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
    return sanitizePeople(stored, DEFAULT_PEOPLE_SEED);
  });

  const [milestones, setMilestones] = useState<ProjectMilestone[]>(() => {
    const stored = readInitialWorkspaceJSON<ProjectMilestone[]>(MILESTONES_KEY, DEFAULT_MILESTONES_SEED);
    const projects = readInitialWorkspaceJSON<TimelineSwimlane[]>(SWIMLANES_KEY, DEFAULT_SWIMLANES_SEED);
    return sanitizeMilestones(stored, projects, DEFAULT_MILESTONES_SEED);
  });

  const [statusColumns, setStatusColumns] = useState<StatusColumnState[]>(() =>
    readInitialWorkspaceJSON<StatusColumnState[]>(STATUS_COLUMNS_KEY, defaultSwimlanes)
  );
  const [agentWatchConfigs, setAgentWatchConfigs] = useState<AgentWatchConfig[]>(() =>
    readInitialWorkspaceJSON<AgentWatchConfig[]>(MCP_AGENT_WATCH_CONFIGS_KEY, [])
  );
  const [preferences, setPreferences] = useState<AppPreferences>(() => {
    const stored = readInitialWorkspaceJSON<Partial<AppPreferences> & {
      executionLoadStatusId?: TaskStatus;
      pipelineLoadStatusId?: TaskStatus;
    }>(PREFERENCES_KEY, {});
    const executionDefault = getDefaultStatusId(defaultSwimlanes, 'in-progress');
    const pipelineDefault = getDefaultStatusId(defaultSwimlanes, 'open');
    const bindHost = normalizeMcpBindHost(stored.mcpBindHost);
    const port = normalizeMcpPort(stored.mcpPort);

    return {
      executionLoadStatusIds: normalizeLoadStatusIds(
        stored.executionLoadStatusIds ?? stored.executionLoadStatusId,
        [executionDefault],
        defaultSwimlanes
      ),
      pipelineLoadStatusIds: normalizeLoadStatusIds(
        stored.pipelineLoadStatusIds ?? stored.pipelineLoadStatusId,
        [pipelineDefault],
        defaultSwimlanes
      ),
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
  const tasksRef = useRef(tasks);
  const timelineSwimlanesRef = useRef(timelineSwimlanes);
  const peopleRef = useRef(people);
  const statusColumnsRef = useRef(statusColumns);
  const preferencesRef = useRef(preferences);
  const agentWatchConfigsRef = useRef(agentWatchConfigs);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    timelineSwimlanesRef.current = timelineSwimlanes;
  }, [timelineSwimlanes]);

  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  useEffect(() => {
    statusColumnsRef.current = statusColumns;
  }, [statusColumns]);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    agentWatchConfigsRef.current = agentWatchConfigs;
  }, [agentWatchConfigs]);

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
    if (!hasHydratedCanonicalWorkspace) return;
    persistJSONWithElectronMirror(MILESTONES_KEY, milestones);
  }, [hasHydratedCanonicalWorkspace, milestones]);

  const syncCanonicalWorkspaceFromExport = useCallback((exported: Record<string, unknown>) => {
    const exportedTasks = getPortableStoreValue<Task[]>(exported, TASKS_KEY);
    const exportedProjects = getPortableStoreValue<TimelineSwimlane[]>(exported, SWIMLANES_KEY);
    const exportedPeople = getPortableStoreValue<Person[]>(exported, PEOPLE_KEY);
    const exportedMilestones = getPortableStoreValue<ProjectMilestone[]>(exported, MILESTONES_KEY);
    const exportedStatusColumns = getPortableStoreValue<StatusColumnState[]>(exported, STATUS_COLUMNS_KEY);
    const exportedPreferences = getPortableStoreValue<Partial<AppPreferences>>(exported, PREFERENCES_KEY);
    const exportedAgentWatchConfigs = getPortableStoreValue<AgentWatchConfig[]>(exported, MCP_AGENT_WATCH_CONFIGS_KEY);

    let nextProjects = timelineSwimlanesRef.current;
    let nextStatusColumns = statusColumnsRef.current;

    if (exportedProjects !== undefined) {
      nextProjects = sanitizeTimelineSwimlanes(exportedProjects, DEFAULT_SWIMLANES_SEED);
      mirrorCanonicalJsonToLocalStorage(SWIMLANES_KEY, nextProjects);
      setTimelineSwimlanes(previous =>
        areSerializedValuesEqual(previous, nextProjects) ? previous : nextProjects
      );
    }

    if (exportedPeople !== undefined) {
      const nextPeople = sanitizePeople(exportedPeople, DEFAULT_PEOPLE_SEED);
      mirrorCanonicalJsonToLocalStorage(PEOPLE_KEY, nextPeople);
      setPeople(previous =>
        areSerializedValuesEqual(previous, nextPeople) ? previous : nextPeople
      );
    }

    if (exportedMilestones !== undefined) {
      const nextMilestones = sanitizeMilestones(exportedMilestones, nextProjects, DEFAULT_MILESTONES_SEED);
      mirrorCanonicalJsonToLocalStorage(MILESTONES_KEY, nextMilestones);
      setMilestones(previous =>
        areSerializedValuesEqual(previous, nextMilestones) ? previous : nextMilestones
      );
    }

    if (exportedStatusColumns !== undefined) {
      nextStatusColumns = sanitizeStatusColumns(exportedStatusColumns, defaultSwimlanes);
      mirrorCanonicalJsonToLocalStorage(STATUS_COLUMNS_KEY, nextStatusColumns);
      setStatusColumns(previous =>
        areSerializedValuesEqual(previous, nextStatusColumns) ? previous : nextStatusColumns
      );
    }

    if (exportedPreferences !== undefined) {
      const nextPreferences = sanitizePreferences(
        exportedPreferences,
        nextStatusColumns,
        preferencesRef.current
      );
      mirrorCanonicalJsonToLocalStorage(PREFERENCES_KEY, nextPreferences);
      setPreferences(previous =>
        areSerializedValuesEqual(previous, nextPreferences) ? previous : nextPreferences
      );
    }

    if (exportedAgentWatchConfigs !== undefined) {
      const nextAgentWatchConfigs = sanitizeAgentWatchConfigs(exportedAgentWatchConfigs, []);
      mirrorCanonicalJsonToLocalStorage(MCP_AGENT_WATCH_CONFIGS_KEY, nextAgentWatchConfigs);
      setAgentWatchConfigs(previous =>
        areSerializedValuesEqual(previous, nextAgentWatchConfigs) ? previous : nextAgentWatchConfigs
      );
    }

    if (exportedTasks !== undefined) {
      const nextTasks = sanitizeTasks(exportedTasks, nextProjects, DEFAULT_TASKS_SEED);
      mirrorCanonicalJsonToLocalStorage(TASKS_KEY, nextTasks);
      setTasks(previous =>
        areSerializedValuesEqual(previous, nextTasks) ? previous : nextTasks
      );
    }
  }, []);

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
          const exportedMilestones = getPortableStoreValue<ProjectMilestone[]>(exported, MILESTONES_KEY);
          const exportedStatusColumns = getPortableStoreValue<StatusColumnState[]>(exported, STATUS_COLUMNS_KEY);
          const exportedPreferences = getPortableStoreValue<Partial<AppPreferences>>(exported, PREFERENCES_KEY);
          const exportedAgentWatchConfigs = getPortableStoreValue<AgentWatchConfig[]>(exported, MCP_AGENT_WATCH_CONFIGS_KEY);
          const hasTasks = exportedTasks !== undefined;
          const hasProjects = exportedProjects !== undefined;
          const hasPeople = exportedPeople !== undefined;
          const hasMilestones = exportedMilestones !== undefined;
          const hasStatusColumns = exportedStatusColumns !== undefined;
          const hasPreferences = exportedPreferences !== undefined;
          const hasAgentWatchConfigs = exportedAgentWatchConfigs !== undefined;
          const hasCanonicalWorkspaceData = hasTasks || hasProjects || hasPeople || hasMilestones || hasStatusColumns || hasPreferences;

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
            const migratedMilestones = sanitizeMilestones(
              safeReadLocalStorageJSON<ProjectMilestone[]>(MILESTONES_KEY, DEFAULT_MILESTONES_SEED),
              migratedProjects,
              DEFAULT_MILESTONES_SEED
            );

            setTimelineSwimlanes(migratedProjects);
            setPeople(migratedPeople);
            setMilestones(migratedMilestones);
            setStatusColumns(migratedStatusColumns);
            setPreferences(migratedPreferences);
            setAgentWatchConfigs(migratedAgentWatchConfigs);
            setTasks(migratedTasks);
            return;
          }

          if (hasProjects || hasPeople || hasMilestones || hasStatusColumns || hasPreferences || hasAgentWatchConfigs || hasTasks) {
            syncCanonicalWorkspaceFromExport(exported);
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
  }, [syncCanonicalWorkspaceFromExport]);

  useEffect(() => {
    if (!hasHydratedCanonicalWorkspace) return;

    const unsubscribe = window.electron?.onStoreChanged?.(() => {
      void window.electron?.storeExport?.().then(exported => {
        if (!exported || typeof exported !== 'object') return;
        syncCanonicalWorkspaceFromExport(exported);
      }).catch(() => {
        // Ignore external sync failures; the app remains usable with current state.
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, [hasHydratedCanonicalWorkspace, syncCanonicalWorkspaceFromExport]);

  const [viewRefreshKey, setViewRefreshKey] = useState(0);
  const {
    isTaskDialogOpen,
    isTaskDetailsOpen,
    setIsTaskDetailsOpen,
    isSwimlaneDialogOpen,
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
      milestones,
      statusColumns,
      preferences,
    ],
  });

  const [selectedMilestone, setSelectedMilestone] = useState<ProjectMilestone | null>(null);
  const [detailsMilestoneId, setDetailsMilestoneId] = useState<string | null>(null);
  const [isMilestoneDialogOpen, setIsMilestoneDialogOpen] = useState(false);
  const detailsMilestone = detailsMilestoneId
    ? milestones.find(milestone => milestone.id === detailsMilestoneId) ?? null
    : null;
  const workspaceReadModel = useMemo(
    () => buildWorkspaceReadModel({
      tasks,
      milestones,
      projects: timelineSwimlanes,
      people,
      statusColumns,
    }),
    [milestones, people, statusColumns, tasks, timelineSwimlanes]
  );

  const syncMilestoneTaskLinks = useCallback((milestone: ProjectMilestone) => {
    const linkedTaskIds = new Set(milestone.linkedTaskIds || []);
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (linkedTaskIds.has(task.id)) {
          return { ...task, milestoneId: milestone.id };
        }
        if (task.milestoneId === milestone.id) {
          return { ...task, milestoneId: undefined, dependencyIds: [] };
        }
        return task;
      })
    );
  }, []);

  const syncTaskMilestoneLink = useCallback((taskId: string, nextMilestoneId?: string) => {
    setMilestones(prevMilestones =>
      prevMilestones.map(milestone => {
        const linkedTaskIds = milestone.linkedTaskIds || [];
        const shouldLink = milestone.id === nextMilestoneId;
        const isLinked = linkedTaskIds.includes(taskId);

        if (shouldLink && !isLinked) {
          return { ...milestone, linkedTaskIds: [...linkedTaskIds, taskId] };
        }
        if (!shouldLink && isLinked) {
          return { ...milestone, linkedTaskIds: linkedTaskIds.filter(id => id !== taskId) };
        }
        return milestone;
      })
    );
  }, []);

  const removeTaskFromMilestones = useCallback((taskId: string) => {
    setMilestones(prevMilestones =>
      prevMilestones.map(milestone => ({
        ...milestone,
        linkedTaskIds: (milestone.linkedTaskIds || []).filter(id => id !== taskId),
      }))
    );
  }, []);

  const {
    saveTask: handleSaveTask,
    addTaskComment: handleAddTaskComment,
    updateTaskAttachments: handleUpdateTaskAttachments,
    deleteTask: handleDeleteTask,
    moveTask: handleMoveTask,
    moveAgentTaskToReview: handleMoveAgentTaskToReview,
    updateTaskDates: handleUpdateTaskDates,
  } = useTaskActions({
    people,
    setTasks,
    onTaskMilestoneChange: syncTaskMilestoneLink,
    onTaskDeleted: removeTaskFromMilestones,
  });
  const {
    saveSwimlane: handleSaveSwimlane,
    deleteSwimlane: deleteSwimlaneBase,
    reorderSwimlanes: handleReorderSwimlanes,
  } = useProjectActions({
    timelineSwimlanes,
    setTimelineSwimlanes,
    setTasks,
  });
  const handleDeleteSwimlane = useCallback((swimlaneId: string) => {
    deleteSwimlaneBase(swimlaneId);
    setMilestones(prevMilestones =>
      prevMilestones
        .map(milestone => {
          const projectIds = (milestone.projectIds || (milestone.projectId ? [milestone.projectId] : []))
            .filter(projectId => projectId !== swimlaneId);
          return { ...milestone, projectIds, projectId: projectIds[0] };
        })
        .filter(milestone => milestone.projectIds.length > 0)
    );
  }, [deleteSwimlaneBase]);
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
  const [preferencesInitialAnchor, setPreferencesInitialAnchor] = useState('task-load');

  const handleOpenPreferences = useCallback(() => {
    setPreferencesInitialAnchor('task-load');
    setIsPreferencesOpen(true);
  }, []);

  const handleClosePreferences = useCallback(() => {
    setIsPreferencesOpen(false);
  }, []);

  const handleOpenPeoplePanel = useCallback(() => {
    setPreferencesInitialAnchor('people');
    setIsPreferencesOpen(true);
  }, []);

  const handleOpenAgentsPanel = useCallback(() => {
    setPreferencesInitialAnchor('agents');
    setIsPreferencesOpen(true);
  }, []);

  const handleCloseTaskDetails = useCallback(() => {
    setIsTaskDetailsOpen(false);
  }, []);

  const handleMilestoneTaskClick = useCallback((task: Task) => {
    setDetailsMilestoneId(null);
    handleTaskClick(task);
  }, [handleTaskClick]);

  const handleTimelineScroll = useCallback((state: { scrollLeft: number; scrollTop: number }) => {
    timelineScrollStateRef.current = state;
  }, []);

  useEffect(() => {
    const handleKanbanScroll = (event: Event) => {
      const { scrollLeft = 0, scrollTop = 0 } = (event as CustomEvent<{
        scrollLeft?: number;
        scrollTop?: number;
      }>).detail ?? {};

      kanbanScrollStateRef.current = { scrollLeft, scrollTop };
      viewState.viewStatesRef.current.kanban = {
        ...viewState.viewStatesRef.current.kanban,
        scrollLeft,
        scrollTop,
      };
    };

    document.addEventListener('kanbanScroll', handleKanbanScroll);
    return () => document.removeEventListener('kanbanScroll', handleKanbanScroll);
  }, [viewState.viewStatesRef]);

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

  const handleAddMilestone = useCallback(() => {
    setSelectedMilestone(null);
    setIsMilestoneDialogOpen(true);
  }, []);

  const handleMilestoneClick = useCallback((milestone: ProjectMilestone) => {
    setDetailsMilestoneId(milestone.id);
  }, []);

  const handleEditMilestoneFromDetails = useCallback((milestone: ProjectMilestone) => {
    setSelectedMilestone(milestone);
    setDetailsMilestoneId(null);
    setIsMilestoneDialogOpen(true);
  }, []);

  const handleCloseMilestoneDialog = useCallback(() => {
    setIsMilestoneDialogOpen(false);
    setSelectedMilestone(null);
  }, []);

  const handleSaveMilestone = useCallback((milestone: ProjectMilestone) => {
    setMilestones(prevMilestones => {
      const exists = prevMilestones.some(item => item.id === milestone.id);
      return exists
        ? prevMilestones.map(item => (item.id === milestone.id ? milestone : item))
        : [milestone, ...prevMilestones];
    });
    syncMilestoneTaskLinks(milestone);
    setSelectedMilestone(null);
    setDetailsMilestoneId(null);
    setIsMilestoneDialogOpen(false);
  }, [syncMilestoneTaskLinks]);

  const handleUpdateRoadmapTaskDependencies = useCallback((
    updates: Array<{ taskId: string; dependencyIds: string[] }>
  ) => {
    const updatesByTaskId = new Map(updates.map(update => [update.taskId, update.dependencyIds]));
    setTasks(prevTasks =>
      prevTasks.map(task => {
        const dependencyIds = updatesByTaskId.get(task.id);
        if (!dependencyIds) return task;
        return { ...task, dependencyIds };
      })
    );
  }, []);

  const handleDeleteMilestone = useCallback((milestoneId: string) => {
    const milestoneTaskIds = new Set(
      tasks
        .filter(task => task.milestoneId === milestoneId)
        .map(task => task.id)
    );
    const milestone = milestones.find(item => item.id === milestoneId);
    (milestone?.linkedTaskIds || []).forEach(taskId => milestoneTaskIds.add(taskId));

    setMilestones(prevMilestones => prevMilestones.filter(milestone => milestone.id !== milestoneId));
    setTasks(prevTasks =>
      prevTasks.map(task => {
        const shouldClearMilestone = task.milestoneId === milestoneId;
        const shouldClearDependencies = milestoneTaskIds.has(task.id);

        return {
          ...task,
          milestoneId: shouldClearMilestone ? undefined : task.milestoneId,
          dependencyIds: shouldClearDependencies ? [] : task.dependencyIds,
        };
      })
    );
    setSelectedMilestone(null);
    setDetailsMilestoneId(null);
    setIsMilestoneDialogOpen(false);
  }, [milestones, tasks]);

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
    setMilestones([]);
    setStatusColumns(defaultSwimlanes);
    setPreferences({
      executionLoadStatusIds: [getDefaultStatusId(defaultSwimlanes, 'in-progress')],
      pipelineLoadStatusIds: [getDefaultStatusId(defaultSwimlanes, 'open')],
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
        scrollLeft: kanbanScrollStateRef.current.scrollLeft,
        scrollTop: kanbanScrollStateRef.current.scrollTop,
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
            scrollLeft: kanbanScrollStateRef.current.scrollLeft,
            scrollTop: kanbanScrollStateRef.current.scrollTop,
          }
        : safeReadLocalStorageJSON<Record<string, unknown>>(KANBAN_VIEW_STATE_KEY, viewState.getViewState('kanban'));
    const payload = buildWorkspaceBackupPayload({
      tasks,
      milestones,
      projects: timelineSwimlanes,
      people,
      statusColumns,
      preferences,
      ui: {
        currentView: viewState.currentView,
        viewState: {
          timeline: currentTimelineViewState,
          kanban: currentKanbanViewState,
          roadmap: safeReadLocalStorageJSON<Record<string, unknown>>('omvra_viewstate_roadmap', viewState.getViewState('roadmap')),
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
    link.download = `omvra-backup-${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleImportTasksAndProjects = async (file: File) => {
    try {
      setImportFeedback(null);
      const text = await file.text();
      const parsed = parseWorkspaceBackupJson(text);
      if (!parsed.ok || !parsed.payload) {
        setImportFeedback({
          type: 'error',
          message: parsed.error || 'Could not import backup. Please select a valid JSON export file.',
        });
        return;
      }

      const parsedPayload = parsed.payload as Record<string, unknown>;

      if (!Array.isArray(parsedPayload.tasks) || !Array.isArray(parsedPayload.projects)) {
        setImportFeedback({
          type: 'error',
          message: 'Invalid backup format. Expected "tasks" and "projects" arrays.',
        });
        return;
      }

      const repaired = repairWorkspaceBackupPayload(parsedPayload, {
        fallbackProjects: timelineSwimlanes,
        fallbackPeople: people,
        fallbackStatusColumns: statusColumns,
        fallbackPreferences: preferences,
        fallbackTasks: tasks,
        fallbackMilestones: milestones,
        allowFallbackForMissingArrays: false,
      });

      if (!repaired.ok) {
        setImportFeedback({
          type: 'error',
          message: repaired.error || 'Could not import backup. Please select a valid JSON export file.',
        });
        return;
      }

      await restorePortableStorageSnapshot(repaired.storageSnapshot, repaired.electronStoreSnapshot);

      setTimelineSwimlanes(repaired.projects);
      setTasks(repaired.tasks);
      setMilestones(repaired.milestones);
      setPeople(repaired.people);
      setStatusColumns(repaired.statusColumns);
      setPreferences(repaired.preferences);

      if (repaired.ui?.viewState?.timeline) {
        viewState.saveViewState('timeline', repaired.ui.viewState.timeline);
      }
      if (repaired.ui?.viewState?.kanban) {
        viewState.saveViewState('kanban', repaired.ui.viewState.kanban);
      }
      if (repaired.ui?.viewState?.roadmap) {
        viewState.saveViewState('roadmap', repaired.ui.viewState.roadmap);
      }
      if (repaired.ui?.timeline?.monthWidths && typeof repaired.ui.timeline.monthWidths === 'object') {
        safeWriteRaw(MONTH_WIDTHS_KEY, JSON.stringify(repaired.ui.timeline.monthWidths));
      }
      if (Number.isFinite(Number(repaired.ui?.timeline?.leftColWidth))) {
        safeWriteRaw(LEFT_COL_WIDTH_KEY, String(repaired.ui?.timeline?.leftColWidth));
      }
      if (
        repaired.ui?.currentView === 'timeline' ||
        repaired.ui?.currentView === 'kanban' ||
        repaired.ui?.currentView === 'roadmap'
      ) {
        viewState.switchView(repaired.ui.currentView as ViewType);
      }
      setImportFeedback({
        type: 'success',
        message: `Restored ${repaired.tasks.length} tasks, ${repaired.projects.length} projects, ${repaired.people.length} people, and ${repaired.milestones.length} milestones from backup.`,
      });
      setViewRefreshKey(prev => prev + 1);
    } catch (err) {
      setImportFeedback({
        type: 'error',
        message: 'Could not import backup. Please select a valid JSON export file.',
      });
    }
  };

  useEffect(() => {
    setPreferences(prev => {
      const nextExecution = normalizeLoadStatusIds(prev.executionLoadStatusIds, [], statusColumns);
      const nextPipeline = normalizeLoadStatusIds(prev.pipelineLoadStatusIds, [], statusColumns);

      if (
        areSerializedValuesEqual(nextExecution, prev.executionLoadStatusIds) &&
        areSerializedValuesEqual(nextPipeline, prev.pipelineLoadStatusIds)
      ) {
        return prev;
      }

      return {
        ...prev,
        executionLoadStatusIds: nextExecution,
        pipelineLoadStatusIds: nextPipeline,
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
    <div className="flex h-dvh flex-col bg-gray-50">
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
              scrollLeft: kanbanScrollStateRef.current.scrollLeft,
              scrollTop: kanbanScrollStateRef.current.scrollTop,
            });
          } else if (viewState.currentView === 'roadmap') {
            viewState.saveViewState('roadmap', viewState.getViewState('roadmap'));
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
        onOpenAgents={handleOpenAgentsPanel}
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
        agentWatchConfigs={agentWatchConfigs}
        agentWatchRuntime={agentWatchRuntime}
        mcpAgentAccessEnabled={preferences.mcpAgentAccessEnabled}
        mcpListenerStatus={mcpListenerStatus}
        mcpRestartPending={isMcpRestartPending}
        statusColumns={statusColumns}
        milestones={milestones}
        readModel={workspaceReadModel}
        timelineInitialScrollLeft={viewState.getViewState('timeline').scrollLeft || 0}
        kanbanInitialScrollLeft={viewState.getViewState('kanban').scrollLeft || 0}
        kanbanInitialScrollTop={viewState.getViewState('kanban').scrollTop || 0}
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
        onRoadmapAddMilestone={handleAddMilestone}
        onRoadmapMilestoneClick={handleMilestoneClick}
        onRoadmapTaskClick={handleTaskClick}
      />

      <AppPanels
        isTaskDialogOpen={isTaskDialogOpen}
        isTaskDetailsOpen={isTaskDetailsOpen}
        isSwimlaneDialogOpen={isSwimlaneDialogOpen}
        isPreferencesOpen={isPreferencesOpen}
        preferencesInitialAnchor={preferencesInitialAnchor}
        selectedTask={selectedTask}
        detailsTask={detailsTask}
        selectedMilestone={selectedMilestone}
        detailsMilestone={detailsMilestone}
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
        milestones={milestones}
        readModel={workspaceReadModel}
        isMilestoneDialogOpen={isMilestoneDialogOpen}
        executionLoadStatusIds={preferences.executionLoadStatusIds}
        pipelineLoadStatusIds={preferences.pipelineLoadStatusIds}
        agentWatchConfigs={agentWatchConfigs}
        agentWatchRuntime={agentWatchRuntime}
        storageMeter={storageMeter}
        importFeedback={importFeedback}
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
        mcpRestartPending={isMcpRestartPending}
        onCloseTaskDialog={handleCloseTaskDialog}
        onSaveTask={handleSaveTask}
        onDeleteTask={handleDeleteTask}
        onCloseTaskDetails={handleCloseTaskDetails}
        onEditTaskFromDetails={handleEditTaskFromDetails}
        onMoveAgentTaskToReview={handleMoveAgentTaskToReview}
        onAddTaskComment={handleAddTaskComment}
        onUpdateTaskAttachments={handleUpdateTaskAttachments}
        onCloseMilestoneDialog={handleCloseMilestoneDialog}
        onSaveMilestone={handleSaveMilestone}
        onDeleteMilestone={handleDeleteMilestone}
        onUpdateRoadmapTaskDependencies={handleUpdateRoadmapTaskDependencies}
        onCloseMilestoneDetails={() => setDetailsMilestoneId(null)}
        onEditMilestoneFromDetails={handleEditMilestoneFromDetails}
        onMilestoneTaskClick={handleMilestoneTaskClick}
        onCloseSwimlaneDialog={handleCloseSwimlaneDialog}
        onSaveSwimlane={handleSaveSwimlane}
        onDeleteSwimlane={handleDeleteSwimlane}
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
          setPreferences(prev => ({
            ...prev,
            executionLoadStatusIds: prev.executionLoadStatusIds.includes(statusId)
              ? prev.executionLoadStatusIds.filter(id => id !== statusId)
              : [...prev.executionLoadStatusIds, statusId],
          }))
        }
        onPipelineLoadStatusChange={(statusId) =>
          setPreferences(prev => ({
            ...prev,
            pipelineLoadStatusIds: prev.pipelineLoadStatusIds.includes(statusId)
              ? prev.pipelineLoadStatusIds.filter(id => id !== statusId)
              : [...prev.pipelineLoadStatusIds, statusId],
          }))
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
