import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Person, ProjectMilestone, Task, TaskStatus, TimelineSwimlane } from '../types.ts';
import { initialTasks, initialTimelineSwimlanes } from '../data/sampleData.ts';
import { initialMilestones } from '../data/sampleMilestones.ts';
import { initialPeople } from '../data/samplePeople.ts';
import { swimlanes as defaultSwimlanes } from '../constants/swimlanes.ts';
import {
  buildLocalMcpAddress,
  DEFAULT_MCP_BIND_HOST,
  DEFAULT_MCP_PORT,
} from '../constants/mcp.ts';
import { shouldBootstrapFromLocalStorage } from '../utils/canonicalHydration.js';
import { getDefaultStatusId } from '../utils/mcpPreferences.ts';
import {
  getPortableStoreValue,
  hasAnyPortableLocalStorageData,
  persistJSONWithElectronMirror,
  readInitialWorkspaceJSON,
  safeReadLocalStorageJSON,
} from '../utils/storage.ts';
import {
  type AgentWatchConfig,
  normalizeTask,
  sanitizeAgentWatchConfigs,
  sanitizeMilestones,
  sanitizePeople,
  sanitizePreferences,
  sanitizeStatusColumns,
  sanitizeTasks,
  sanitizeTimelineSwimlanes,
  type StatusColumnState,
} from '../utils/workspaceSanitizers.ts';
import {
  deleteMilestoneFromWorkspace,
  linkTaskToMilestones,
  removeTaskFromMilestones,
  saveMilestoneRecord,
  syncMilestoneTaskLinks,
  updateRoadmapTaskDependencies,
} from './workspaceMutations.ts';

const TASKS_KEY = 'omvra.tasks.v1';
const SWIMLANES_KEY = 'omvra.swimlanes.v1';
const PEOPLE_KEY = 'omvra.people.v1';
const MILESTONES_KEY = 'omvra.milestones.v1';
const STATUS_COLUMNS_KEY = 'omvra.statusColumns.v1';
const PREFERENCES_KEY = 'omvra.preferences.v1';
const MCP_AGENT_WATCH_CONFIGS_KEY = 'omvra.mcp.agentWatchConfigs.v1';

const ENABLE_SAMPLE_WORKSPACE = Boolean(import.meta.env.DEV);
const DEFAULT_TASKS_SEED = ENABLE_SAMPLE_WORKSPACE ? initialTasks : [];
const DEFAULT_SWIMLANES_SEED = ENABLE_SAMPLE_WORKSPACE ? initialTimelineSwimlanes : [];
const DEFAULT_PEOPLE_SEED = ENABLE_SAMPLE_WORKSPACE ? initialPeople : [];
const DEFAULT_MILESTONES_SEED = ENABLE_SAMPLE_WORKSPACE ? initialMilestones : [];

export interface AppPreferences {
  executionLoadStatusIds: TaskStatus[];
  pipelineLoadStatusIds: TaskStatus[];
  updateChannel: 'stable' | 'rc';
  mcpAgentAccessEnabled: boolean;
  mcpCapabilityProfile: 'read_only' | 'task_write' | 'admin';
  mcpBindHost: string;
  mcpPort: number;
  mcpServerAddress: string;
  mcpAccessToken: string;
  mcpAccessTokenIssuedAt?: string;
  mcpAccessTokenTtlMinutes: number;
}

interface WorkspaceStoreValue {
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  timelineSwimlanes: TimelineSwimlane[];
  setTimelineSwimlanes: Dispatch<SetStateAction<TimelineSwimlane[]>>;
  people: Person[];
  setPeople: Dispatch<SetStateAction<Person[]>>;
  milestones: ProjectMilestone[];
  setMilestones: Dispatch<SetStateAction<ProjectMilestone[]>>;
  statusColumns: StatusColumnState[];
  setStatusColumns: Dispatch<SetStateAction<StatusColumnState[]>>;
  agentWatchConfigs: AgentWatchConfig[];
  setAgentWatchConfigs: Dispatch<SetStateAction<AgentWatchConfig[]>>;
  preferences: AppPreferences;
  setPreferences: Dispatch<SetStateAction<AppPreferences>>;
  replaceWorkspaceSnapshot: (snapshot: {
    tasks: Task[];
    timelineSwimlanes: TimelineSwimlane[];
    people: Person[];
    milestones: ProjectMilestone[];
    statusColumns: StatusColumnState[];
    preferences: AppPreferences;
  }) => void;
  saveMilestone: (milestone: ProjectMilestone) => void;
  deleteMilestone: (milestoneId: string) => void;
  syncMilestoneTaskLinks: (milestone: ProjectMilestone) => void;
  linkTaskMilestone: (taskId: string, nextMilestoneId?: string) => void;
  removeTaskMilestoneLinks: (taskId: string) => void;
  applyRoadmapTaskDependencies: (updates: Array<{ taskId: string; dependencyIds: string[] }>) => void;
  toggleExecutionLoadStatus: (statusId: TaskStatus) => void;
  togglePipelineLoadStatus: (statusId: TaskStatus) => void;
  setUpdateChannel: (channel: AppPreferences['updateChannel']) => void;
  setMcpAgentAccessEnabled: (enabled: boolean) => void;
  setMcpServerAddress: (address: string) => void;
  setMcpBindHost: (host: string) => void;
  setMcpPort: (port: number) => void;
  setMcpAccessToken: (token: string) => void;
  setMcpAccessTokenTtlMinutes: (ttl: number) => void;
  setMcpCapabilityProfile: (profile: AppPreferences['mcpCapabilityProfile']) => void;
  hasHydratedCanonicalWorkspace: boolean;
  resetWorkspaceData: () => void;
}

const WorkspaceStoreContext = createContext<WorkspaceStoreValue | null>(null);

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

function areSerializedValuesEqual(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
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
  } catch {
    // Ignore local mirroring failures so MCP-driven updates stay non-blocking.
  }
}

export function createDefaultAppPreferences(
  statusColumns: StatusColumnState[] = defaultSwimlanes
): AppPreferences {
  return {
    executionLoadStatusIds: [getDefaultStatusId(statusColumns, 'in-progress')],
    pipelineLoadStatusIds: [getDefaultStatusId(statusColumns, 'open')],
    updateChannel: 'stable',
    mcpAgentAccessEnabled: false,
    mcpCapabilityProfile: 'read_only',
    mcpBindHost: DEFAULT_MCP_BIND_HOST,
    mcpPort: DEFAULT_MCP_PORT,
    mcpServerAddress: buildLocalMcpAddress(DEFAULT_MCP_BIND_HOST, DEFAULT_MCP_PORT),
    mcpAccessToken: '',
    mcpAccessTokenIssuedAt: undefined,
    mcpAccessTokenTtlMinutes: 60,
  };
}

export function WorkspaceStoreProvider({ children }: PropsWithChildren) {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const stored = readInitialWorkspaceJSON<Task[]>(TASKS_KEY, DEFAULT_TASKS_SEED);
    const swimlanes = readInitialWorkspaceJSON<TimelineSwimlane[]>(SWIMLANES_KEY, DEFAULT_SWIMLANES_SEED);
    return stored.map(task => normalizeTask(task, swimlanes));
  });
  const [timelineSwimlanes, setTimelineSwimlanes] = useState<TimelineSwimlane[]>(() => {
    const stored = readInitialWorkspaceJSON<TimelineSwimlane[]>(SWIMLANES_KEY, DEFAULT_SWIMLANES_SEED);
    return stored.map(swimlane => ({
      ...swimlane,
      color: swimlane.color || '#3b82f6',
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
      updateChannel: stored.updateChannel === 'rc' ? 'rc' : 'stable',
      mcpAgentAccessEnabled: Boolean(stored.mcpAgentAccessEnabled),
      mcpCapabilityProfile:
        stored.mcpCapabilityProfile === 'task_write' || stored.mcpCapabilityProfile === 'admin'
          ? stored.mcpCapabilityProfile
          : 'read_only',
      mcpBindHost: typeof stored.mcpBindHost === 'string' ? stored.mcpBindHost : DEFAULT_MCP_BIND_HOST,
      mcpPort: Number.isFinite(Number(stored.mcpPort)) ? Number(stored.mcpPort) : DEFAULT_MCP_PORT,
      mcpServerAddress: typeof stored.mcpServerAddress === 'string'
        ? stored.mcpServerAddress
        : buildLocalMcpAddress(DEFAULT_MCP_BIND_HOST, DEFAULT_MCP_PORT),
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

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { timelineSwimlanesRef.current = timelineSwimlanes; }, [timelineSwimlanes]);
  useEffect(() => { peopleRef.current = people; }, [people]);
  useEffect(() => { statusColumnsRef.current = statusColumns; }, [statusColumns]);
  useEffect(() => { preferencesRef.current = preferences; }, [preferences]);
  useEffect(() => { agentWatchConfigsRef.current = agentWatchConfigs; }, [agentWatchConfigs]);

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
      setTimelineSwimlanes(previous => areSerializedValuesEqual(previous, nextProjects) ? previous : nextProjects);
    }

    if (exportedPeople !== undefined) {
      const nextPeople = sanitizePeople(exportedPeople, DEFAULT_PEOPLE_SEED);
      mirrorCanonicalJsonToLocalStorage(PEOPLE_KEY, nextPeople);
      setPeople(previous => areSerializedValuesEqual(previous, nextPeople) ? previous : nextPeople);
    }

    if (exportedMilestones !== undefined) {
      const nextMilestones = sanitizeMilestones(exportedMilestones, nextProjects, DEFAULT_MILESTONES_SEED);
      mirrorCanonicalJsonToLocalStorage(MILESTONES_KEY, nextMilestones);
      setMilestones(previous => areSerializedValuesEqual(previous, nextMilestones) ? previous : nextMilestones);
    }

    if (exportedStatusColumns !== undefined) {
      nextStatusColumns = sanitizeStatusColumns(exportedStatusColumns, defaultSwimlanes);
      mirrorCanonicalJsonToLocalStorage(STATUS_COLUMNS_KEY, nextStatusColumns);
      setStatusColumns(previous => areSerializedValuesEqual(previous, nextStatusColumns) ? previous : nextStatusColumns);
    }

    if (exportedPreferences !== undefined) {
      const nextPreferences = sanitizePreferences(exportedPreferences, nextStatusColumns, preferencesRef.current);
      mirrorCanonicalJsonToLocalStorage(PREFERENCES_KEY, nextPreferences);
      setPreferences(previous => areSerializedValuesEqual(previous, nextPreferences) ? previous : nextPreferences);
    }

    if (exportedAgentWatchConfigs !== undefined) {
      const nextAgentWatchConfigs = sanitizeAgentWatchConfigs(exportedAgentWatchConfigs, []);
      mirrorCanonicalJsonToLocalStorage(MCP_AGENT_WATCH_CONFIGS_KEY, nextAgentWatchConfigs);
      setAgentWatchConfigs(previous => (
        areSerializedValuesEqual(previous, nextAgentWatchConfigs) ? previous : nextAgentWatchConfigs
      ));
    }

    if (exportedTasks !== undefined) {
      const nextTasks = sanitizeTasks(exportedTasks, nextProjects, DEFAULT_TASKS_SEED);
      mirrorCanonicalJsonToLocalStorage(TASKS_KEY, nextTasks);
      setTasks(previous => areSerializedValuesEqual(previous, nextTasks) ? previous : nextTasks);
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
          const hasCanonicalWorkspaceData =
            exportedTasks !== undefined ||
            exportedProjects !== undefined ||
            exportedPeople !== undefined ||
            exportedMilestones !== undefined ||
            exportedStatusColumns !== undefined ||
            exportedPreferences !== undefined ||
            exportedAgentWatchConfigs !== undefined;

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
              preferencesRef.current
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

          syncCanonicalWorkspaceFromExport(exported);
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

  const replaceWorkspaceSnapshot = useCallback((snapshot: {
    tasks: Task[];
    timelineSwimlanes: TimelineSwimlane[];
    people: Person[];
    milestones: ProjectMilestone[];
    statusColumns: StatusColumnState[];
    preferences: AppPreferences;
  }) => {
    setTimelineSwimlanes(snapshot.timelineSwimlanes);
    setTasks(snapshot.tasks);
    setMilestones(snapshot.milestones);
    setPeople(snapshot.people);
    setStatusColumns(snapshot.statusColumns);
    setPreferences(snapshot.preferences);
  }, []);

  const applyMilestoneTaskLinks = useCallback((milestone: ProjectMilestone) => {
    setTasks(prevTasks => syncMilestoneTaskLinks(prevTasks, milestone));
  }, []);

  const upsertMilestone = useCallback((milestone: ProjectMilestone) => {
    setMilestones(prevMilestones => saveMilestoneRecord(prevMilestones, milestone));
    applyMilestoneTaskLinks(milestone);
  }, [applyMilestoneTaskLinks]);

  const removeMilestone = useCallback((milestoneId: string) => {
    const nextWorkspace = deleteMilestoneFromWorkspace(tasksRef.current, milestones, milestoneId);
    setMilestones(nextWorkspace.milestones);
    setTasks(nextWorkspace.tasks);
  }, [milestones]);

  const linkTaskMilestone = useCallback((taskId: string, nextMilestoneId?: string) => {
    setMilestones(prevMilestones => linkTaskToMilestones(prevMilestones, taskId, nextMilestoneId));
  }, []);

  const removeTaskMilestoneLinks = useCallback((taskId: string) => {
    setMilestones(prevMilestones => removeTaskFromMilestones(prevMilestones, taskId));
  }, []);

  const applyRoadmapDependencies = useCallback((updates: Array<{ taskId: string; dependencyIds: string[] }>) => {
    setTasks(prevTasks => updateRoadmapTaskDependencies(prevTasks, updates));
  }, []);

  const toggleExecutionLoadStatus = useCallback((statusId: TaskStatus) => {
    setPreferences(previous => ({
      ...previous,
      executionLoadStatusIds: previous.executionLoadStatusIds.includes(statusId)
        ? previous.executionLoadStatusIds.filter(id => id !== statusId)
        : [...previous.executionLoadStatusIds, statusId],
    }));
  }, []);

  const togglePipelineLoadStatus = useCallback((statusId: TaskStatus) => {
    setPreferences(previous => ({
      ...previous,
      pipelineLoadStatusIds: previous.pipelineLoadStatusIds.includes(statusId)
        ? previous.pipelineLoadStatusIds.filter(id => id !== statusId)
        : [...previous.pipelineLoadStatusIds, statusId],
    }));
  }, []);

  const setUpdateChannel = useCallback((channel: AppPreferences['updateChannel']) => {
    setPreferences(previous => ({
      ...previous,
      updateChannel: channel === 'rc' ? 'rc' : 'stable',
    }));
  }, []);

  const setMcpAgentAccessEnabled = useCallback((enabled: boolean) => {
    setPreferences(previous => ({ ...previous, mcpAgentAccessEnabled: enabled }));
  }, []);

  const setMcpServerAddress = useCallback((address: string) => {
    setPreferences(previous => ({ ...previous, mcpServerAddress: address }));
  }, []);

  const setMcpBindHost = useCallback((host: string) => {
    setPreferences(previous => ({
      ...previous,
      mcpBindHost: host,
      mcpServerAddress: buildLocalMcpAddress(host, previous.mcpPort),
    }));
  }, []);

  const setMcpPort = useCallback((port: number) => {
    setPreferences(previous => ({
      ...previous,
      mcpPort: port,
      mcpServerAddress: buildLocalMcpAddress(previous.mcpBindHost, port),
    }));
  }, []);

  const setMcpAccessToken = useCallback((token: string) => {
    setPreferences(previous => ({
      ...previous,
      mcpAccessToken: token,
      mcpAccessTokenIssuedAt: token ? new Date().toISOString() : undefined,
    }));
  }, []);

  const setMcpAccessTokenTtlMinutes = useCallback((ttl: number) => {
    setPreferences(previous => ({
      ...previous,
      mcpAccessTokenTtlMinutes: Math.max(1, Math.min(1440, ttl || 60)),
    }));
  }, []);

  const setMcpCapabilityProfile = useCallback((profile: AppPreferences['mcpCapabilityProfile']) => {
    setPreferences(previous => ({ ...previous, mcpCapabilityProfile: profile }));
  }, []);

  const resetWorkspaceData = useCallback(() => {
    setTasks([]);
    setTimelineSwimlanes([]);
    setPeople([]);
    setMilestones([]);
    setStatusColumns(defaultSwimlanes);
    setAgentWatchConfigs([]);
    setPreferences(createDefaultAppPreferences(defaultSwimlanes));
  }, []);

  const value = useMemo<WorkspaceStoreValue>(() => ({
    tasks,
    setTasks,
    timelineSwimlanes,
    setTimelineSwimlanes,
    people,
    setPeople,
    milestones,
    setMilestones,
    statusColumns,
    setStatusColumns,
    agentWatchConfigs,
    setAgentWatchConfigs,
    preferences,
    setPreferences,
    replaceWorkspaceSnapshot,
    saveMilestone: upsertMilestone,
    deleteMilestone: removeMilestone,
    syncMilestoneTaskLinks: applyMilestoneTaskLinks,
    linkTaskMilestone,
    removeTaskMilestoneLinks,
    applyRoadmapTaskDependencies: applyRoadmapDependencies,
    toggleExecutionLoadStatus,
    togglePipelineLoadStatus,
    setUpdateChannel,
    setMcpAgentAccessEnabled,
    setMcpServerAddress,
    setMcpBindHost,
    setMcpPort,
    setMcpAccessToken,
    setMcpAccessTokenTtlMinutes,
    setMcpCapabilityProfile,
    hasHydratedCanonicalWorkspace,
    resetWorkspaceData,
  }), [
    agentWatchConfigs,
    applyMilestoneTaskLinks,
    applyRoadmapDependencies,
    hasHydratedCanonicalWorkspace,
    linkTaskMilestone,
    milestones,
    people,
    preferences,
    removeMilestone,
    removeTaskMilestoneLinks,
    replaceWorkspaceSnapshot,
    resetWorkspaceData,
    setMcpAccessToken,
    setMcpAccessTokenTtlMinutes,
    setMcpAgentAccessEnabled,
    setMcpBindHost,
    setMcpCapabilityProfile,
    setMcpPort,
    setMcpServerAddress,
    setUpdateChannel,
    statusColumns,
    tasks,
    timelineSwimlanes,
    toggleExecutionLoadStatus,
    togglePipelineLoadStatus,
    upsertMilestone,
  ]);

  return (
    <WorkspaceStoreContext.Provider value={value}>
      {children}
    </WorkspaceStoreContext.Provider>
  );
}

export function useWorkspaceStore(): WorkspaceStoreValue {
  const context = useContext(WorkspaceStoreContext);
  if (!context) {
    throw new Error('useWorkspaceStore must be used within WorkspaceStoreProvider.');
  }
  return context;
}
