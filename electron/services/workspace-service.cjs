const { randomUUID } = require('crypto');

const PREFERENCES_KEY = 'plumy.preferences.v1';
const TASKS_KEY = 'plumy.tasks.v1';
const PEOPLE_KEY = 'plumy.people.v1';
const SWIMLANES_KEY = 'plumy.swimlanes.v1';
const STATUS_COLUMNS_KEY = 'plumy.statusColumns.v1';
const MCP_BOARD_WATCHERS_KEY = 'plumy.mcp.boardWatchers.v1';
const REQUIRES_HUMAN_REVIEW_STATUS_ID = 'requires-human-review';
const REQUIRES_HUMAN_REVIEW_STATUS_TITLE = 'Requires human review';
const REQUIRES_HUMAN_REVIEW_STATUS_COLOR = '#f97316';
const MCP_PROTOCOL_VERSION = '2024-11-05';
const MCP_SERVER_NAME = 'Plumy';
const DEFAULT_MCP_HOST = '127.0.0.1';
const DEFAULT_MCP_PORT = 3456;
const DEFAULT_MCP_PATH = '/mcp';
const DEFAULT_MCP_CAPABILITY_PROFILE = 'read_only';
const MCP_CAPABILITY_PROFILES = ['read_only', 'task_write', 'admin'];
const MCP_AUDIT_LOG_KEY = 'plumy.mcp.audit.v1';
const MCP_AUDIT_LOG_MAX_ENTRIES = 200;
const MCP_TASK_REV_FIELD = '__mcpRevision';
const TASK_ACTIVITY_LOG_MAX_ENTRIES = 50;

let appVersionCache = null;

function readObject(store, key) {
  const value = store.get(key);
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function readArray(store, key) {
  const value = store.get(key);
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTaskIdList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const ids = [];
  for (const item of value) {
    const id = normalizeString(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function normalizeRevisionMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [taskId, rawRevision] of Object.entries(value)) {
    const taskKey = normalizeString(taskId);
    if (!taskKey) continue;
    const revision = Number(rawRevision);
    if (!Number.isFinite(revision)) continue;
    out[taskKey] = Math.max(0, Math.floor(revision));
  }
  return out;
}

function normalizeWatcherFilters(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const filters = {};
  const assigneeId = normalizeString(raw.assigneeId);
  const projectId = normalizeString(raw.projectId);
  const search = normalizeString(raw.search);
  if (assigneeId) filters.assigneeId = assigneeId;
  if (projectId) filters.projectId = projectId;
  if (search) filters.search = search;
  return filters;
}

function normalizeBoardWatcherState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const watcherId = normalizeString(value.watcherId || value.id);
  const statusId = normalizeString(value.statusId);
  if (!watcherId || !statusId) return null;

  const lastProcessedAt = typeof value.lastProcessedAt === 'string' ? value.lastProcessedAt : undefined;
  return {
    watcherId,
    statusId,
    filters: normalizeWatcherFilters(value.filters),
    lastSeenTaskIds: normalizeTaskIdList(value.lastSeenTaskIds),
    lastSeenRevisions: normalizeRevisionMap(value.lastSeenRevisions),
    lastProcessedAt,
  };
}

function readBoardWatcherStates(store) {
  return readArray(store, MCP_BOARD_WATCHERS_KEY)
    .map(normalizeBoardWatcherState)
    .filter(Boolean);
}

function listBoardWatcherStates(store) {
  return readBoardWatcherStates(store);
}

function saveBoardWatcherStates(store, watcherStates) {
  const normalized = Array.isArray(watcherStates)
    ? watcherStates.map(normalizeBoardWatcherState).filter(Boolean)
    : [];
  store.set(MCP_BOARD_WATCHERS_KEY, normalized);
  return normalized;
}

function getBoardWatcherState(store, watcherId) {
  const normalizedWatcherId = normalizeString(watcherId);
  if (!normalizedWatcherId) return null;
  return readBoardWatcherStates(store).find(state => state.watcherId === normalizedWatcherId) || null;
}

function upsertBoardWatcherState(store, nextState) {
  const normalized = normalizeBoardWatcherState(nextState);
  if (!normalized) {
    return { ok: false, error: 'INVALID_WATCHER_STATE', message: 'watcherId and statusId are required.' };
  }

  const states = readBoardWatcherStates(store);
  const nextStates = states.filter(state => state.watcherId !== normalized.watcherId).concat(normalized);
  saveBoardWatcherStates(store, nextStates);
  return { ok: true, watcherState: normalized };
}

function buildBoardWatcherStorageKey({ statusId, assigneeId, projectId, search }) {
  return [
    `status:${normalizeString(statusId) || 'any'}`,
    `assignee:${normalizeString(assigneeId) || 'any'}`,
    `project:${normalizeString(projectId) || 'any'}`,
    `search:${normalizeString(search) || 'any'}`,
  ].join('|');
}

function pollBoardWatcher(store, {
  watcherId,
  statusId,
  assigneeId,
  projectId,
  search,
  persist = true,
} = {}) {
  const normalizedStatusId = normalizeString(statusId);
  if (!normalizedStatusId) {
    return {
      ok: false,
      error: 'STATUS_ID_REQUIRED',
      message: 'statusId is required to poll a board.',
    };
  }

  const normalizedWatcherId = normalizeString(watcherId) || buildBoardWatcherStorageKey({
    statusId: normalizedStatusId,
    assigneeId,
    projectId,
    search,
  });
  const nextFilters = normalizeWatcherFilters({ assigneeId, projectId, search });
  const previousState = getBoardWatcherState(store, normalizedWatcherId) || {
    watcherId: normalizedWatcherId,
    statusId: normalizedStatusId,
    filters: nextFilters,
    lastSeenTaskIds: [],
    lastSeenRevisions: {},
  };

  const tasks = listTasks(store, {
    status: normalizedStatusId,
    ...nextFilters,
  });
  const currentTaskIds = tasks.map(task => task.id);
  const currentTaskIdSet = new Set(currentTaskIds);
  const previousTaskIdSet = new Set(previousState.lastSeenTaskIds || []);
  const previousRevisionMap = normalizeRevisionMap(previousState.lastSeenRevisions);
  const currentRevisionMap = {};

  const newTasks = [];
  const updatedTasks = [];

  for (const task of tasks) {
    const currentRevision = Number.isFinite(Number(task[MCP_TASK_REV_FIELD]))
      ? Math.max(0, Math.floor(Number(task[MCP_TASK_REV_FIELD])))
      : 0;
    currentRevisionMap[task.id] = currentRevision;

    if (!previousTaskIdSet.has(task.id)) {
      newTasks.push(task);
      continue;
    }

    if ((previousRevisionMap[task.id] || 0) !== currentRevision) {
      updatedTasks.push(task);
    }
  }

  const removedTaskIds = (previousState.lastSeenTaskIds || []).filter(taskId => !currentTaskIdSet.has(taskId));
  const nextWatcherState = {
    watcherId: normalizedWatcherId,
    statusId: normalizedStatusId,
    filters: nextFilters,
    lastSeenTaskIds: currentTaskIds,
    lastSeenRevisions: currentRevisionMap,
    lastProcessedAt: new Date().toISOString(),
  };

  if (persist) {
    upsertBoardWatcherState(store, nextWatcherState);
  }

  return {
    ok: true,
    watcherState: nextWatcherState,
    board: {
      id: normalizedStatusId,
      taskCount: tasks.length,
      currentTaskIds,
    },
    changes: {
      newTasks,
      updatedTasks,
      removedTaskIds,
    },
  };
}

function isMcpAgentAccessEnabled(store) {
  const preferences = readObject(store, PREFERENCES_KEY);
  return Boolean(preferences.mcpAgentAccessEnabled);
}

function getMcpServerConfig(store) {
  const preferences = readObject(store, PREFERENCES_KEY);
  const host = typeof preferences.mcpBindHost === 'string' && preferences.mcpBindHost.trim()
    ? preferences.mcpBindHost.trim()
    : DEFAULT_MCP_HOST;
  const parsedPort = Number(preferences.mcpPort);
  const port = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
    ? parsedPort
    : DEFAULT_MCP_PORT;
  const path = DEFAULT_MCP_PATH;
  const publicUrl = typeof preferences.mcpServerAddress === 'string' && preferences.mcpServerAddress.trim()
    ? preferences.mcpServerAddress.trim()
    : `http://${host}:${port}${path}`;
  const accessToken = typeof preferences.mcpAccessToken === 'string' ? preferences.mcpAccessToken : '';
  const accessTokenIssuedAt = typeof preferences.mcpAccessTokenIssuedAt === 'string'
    ? preferences.mcpAccessTokenIssuedAt
    : null;
  const accessTokenTtlMinutes = Number.isFinite(Number(preferences.mcpAccessTokenTtlMinutes))
    ? Math.max(1, Math.min(1440, Number(preferences.mcpAccessTokenTtlMinutes)))
    : 60;

  return {
    host,
    port,
    path,
    publicUrl,
    accessToken,
    accessTokenIssuedAt,
    accessTokenTtlMinutes,
  };
}

function isMcpAccessTokenExpired(serverConfig, now = Date.now()) {
  if (!serverConfig?.accessToken) return false;
  if (!serverConfig.accessTokenIssuedAt) return true;

  const issuedAtMs = Date.parse(serverConfig.accessTokenIssuedAt);
  if (!Number.isFinite(issuedAtMs)) return true;

  const ttlMinutes = Number.isFinite(Number(serverConfig.accessTokenTtlMinutes))
    ? Math.max(1, Math.min(1440, Number(serverConfig.accessTokenTtlMinutes)))
    : 60;
  return now > issuedAtMs + (ttlMinutes * 60 * 1000);
}

function getMcpAccessTokenStatus(serverConfig, now = Date.now()) {
  const accessToken = typeof serverConfig?.accessToken === 'string' ? serverConfig.accessToken : '';
  if (!accessToken) {
    return {
      configured: false,
      status: 'none',
      expired: false,
      issuedAt: null,
      expiresAt: null,
      remainingMinutes: null,
      ttlMinutes: Number.isFinite(Number(serverConfig?.accessTokenTtlMinutes))
        ? Math.max(1, Math.min(1440, Number(serverConfig.accessTokenTtlMinutes)))
        : 60,
    };
  }

  const ttlMinutes = Number.isFinite(Number(serverConfig?.accessTokenTtlMinutes))
    ? Math.max(1, Math.min(1440, Number(serverConfig.accessTokenTtlMinutes)))
    : 60;
  const issuedAt = typeof serverConfig?.accessTokenIssuedAt === 'string' ? serverConfig.accessTokenIssuedAt : null;
  const issuedAtMs = issuedAt ? Date.parse(issuedAt) : Number.NaN;

  if (!Number.isFinite(issuedAtMs)) {
    return {
      configured: true,
      status: 'invalid-issued-at',
      expired: true,
      issuedAt,
      expiresAt: null,
      remainingMinutes: null,
      ttlMinutes,
    };
  }

  const expiresAtMs = issuedAtMs + (ttlMinutes * 60 * 1000);
  const remainingMinutes = Math.ceil((expiresAtMs - now) / 60000);
  const expired = now > expiresAtMs;

  return {
    configured: true,
    status: expired ? 'expired' : 'active',
    expired,
    issuedAt,
    expiresAt: new Date(expiresAtMs).toISOString(),
    remainingMinutes: expired ? Math.min(0, remainingMinutes) : Math.max(1, remainingMinutes),
    ttlMinutes,
  };
}

function buildMcpListenerStatus(store, runtimeState = {}) {
  const serverConfig = getMcpServerConfig(store);
  const tokenStatus = getMcpAccessTokenStatus(serverConfig);
  const enabled = isMcpAgentAccessEnabled(store);
  const runtimeStatus = typeof runtimeState.status === 'string' ? runtimeState.status : null;
  const listening = Boolean(runtimeState.listening);
  const status = !enabled
    ? 'disabled'
    : runtimeStatus || (listening ? 'running' : 'stopped');

  return {
    enabled,
    status,
    listening,
    host: serverConfig.host,
    port: serverConfig.port,
    path: serverConfig.path,
    expectedAddress: serverConfig.publicUrl,
    boundAddress: typeof runtimeState.boundAddress === 'string' && runtimeState.boundAddress.trim()
      ? runtimeState.boundAddress.trim()
      : (listening ? `${serverConfig.host}:${serverConfig.port}` : null),
    boundUrl: typeof runtimeState.boundUrl === 'string' && runtimeState.boundUrl.trim()
      ? runtimeState.boundUrl.trim()
      : (listening ? `http://${serverConfig.host}:${serverConfig.port}${serverConfig.path}` : null),
    capabilityProfile: getMcpCapabilityProfile(store),
    authMode: tokenStatus.configured ? 'token' : 'none',
    token: tokenStatus,
    error: typeof runtimeState.error === 'string' && runtimeState.error.trim() ? runtimeState.error.trim() : null,
    lastStartedAt: typeof runtimeState.lastStartedAt === 'string' ? runtimeState.lastStartedAt : null,
    lastStoppedAt: typeof runtimeState.lastStoppedAt === 'string' ? runtimeState.lastStoppedAt : null,
    lastUpdatedAt: typeof runtimeState.lastUpdatedAt === 'string' ? runtimeState.lastUpdatedAt : null,
    restartRequired: Boolean(runtimeState.restartRequired),
  };
}

function getMcpCapabilityProfile(store) {
  const preferences = readObject(store, PREFERENCES_KEY);
  const value = typeof preferences.mcpCapabilityProfile === 'string'
    ? preferences.mcpCapabilityProfile.trim()
    : '';
  return MCP_CAPABILITY_PROFILES.includes(value) ? value : DEFAULT_MCP_CAPABILITY_PROFILE;
}

function getAppVersion() {
  if (appVersionCache) return appVersionCache;
  try {
    // Package version is a better server identifier than a hard-coded string.
    // eslint-disable-next-line global-require
    const packageJson = require('../../package.json');
    appVersionCache = typeof packageJson.version === 'string' ? packageJson.version : '0.0.0';
  } catch (err) {
    appVersionCache = '0.0.0';
  }
  return appVersionCache;
}

function buildMcpCapabilitySnapshot(store) {
  const enabled = isMcpAgentAccessEnabled(store);
  const profile = getMcpCapabilityProfile(store);
  const writeToolsEnabled = profile === 'task_write' || profile === 'admin';

  return {
    enabled,
    readOnly: !writeToolsEnabled,
    protocolVersion: MCP_PROTOCOL_VERSION,
    serverInfo: {
      name: MCP_SERVER_NAME,
      version: getAppVersion(),
    },
    capabilityProfile: profile,
    capabilityProfiles: MCP_CAPABILITY_PROFILES,
    transportModes: ['http', 'stdio'],
    capabilities: {
      workspaceSnapshot: enabled,
      resourcesRead: enabled,
      initialize: enabled,
      toolCalls: enabled,
      writeTools: writeToolsEnabled,
    },
    writeBoundary: {
    writeToolsEnabled,
    enforced: true,
    exposedWriteTools: writeToolsEnabled
        ? [
            'tasks.transition_under_review',
            'tasks.update_agent_summary',
            'tasks.update_completion_description',
            'tasks.move_to_requires_human_review',
            'tasks.move_to_status',
            'tasks.move_to_ready_for_human_review',
            'tasks.assign',
            'tasks.add_comment',
            'tasks.add_activity_entry',
          ]
        : [],
    },
  };
}

function buildMcpInitializeResult(store) {
  const snapshot = buildMcpCapabilitySnapshot(store);
  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    serverInfo: snapshot.serverInfo,
    capabilities: {
      resources: {
        listChanged: false,
      },
      prompts: {
        listChanged: false,
      },
      tools: {
        listChanged: false,
      },
      logging: {},
    },
  };
}

function appendMcpAuditLog(store, entry) {
  const safeEntry = entry && typeof entry === 'object' ? entry : {};
  const existing = readArray(store, MCP_AUDIT_LOG_KEY);
  const nextEntry = {
    auditId: `audit-${randomUUID()}`,
    timestamp: new Date().toISOString(),
    ...safeEntry,
  };
  const nextLog = existing.concat(nextEntry).slice(-MCP_AUDIT_LOG_MAX_ENTRIES);
  store.set(MCP_AUDIT_LOG_KEY, nextLog);
  return nextEntry;
}

function listMcpAuditLog(store, { limit } = {}) {
  const maxEntries = Number.isFinite(Number(limit))
    ? Math.max(1, Math.min(MCP_AUDIT_LOG_MAX_ENTRIES, Math.floor(Number(limit))))
    : MCP_AUDIT_LOG_MAX_ENTRIES;

  return readArray(store, MCP_AUDIT_LOG_KEY)
    .filter(entry => entry && typeof entry === 'object')
    .slice(-maxEntries)
    .reverse();
}

function getWorkspaceSnapshot(store) {
  // TODO(next-phase): unify storage source of truth. The renderer currently persists
  // most workspace state in localStorage; MCP should read from a canonical backend store.
  const tasks = readArray(store, TASKS_KEY).map(normalizeTaskForMcp);
  const people = readArray(store, PEOPLE_KEY);
  const projects = readArray(store, SWIMLANES_KEY);
  const statusColumns = readArray(store, STATUS_COLUMNS_KEY);

  return {
    schemaVersion: '1',
    generatedAt: new Date().toISOString(),
    readOnly: true,
    workspace: {
      tasks,
      people,
      projects,
      // Alias kept for compatibility with existing naming in the app.
      swimlanes: projects,
      statusColumns,
    },
    meta: {
      source: 'electron-store',
      mcpAgentAccessEnabled: isMcpAgentAccessEnabled(store),
      counts: {
        tasks: tasks.length,
        people: people.length,
        projects: projects.length,
        statusColumns: statusColumns.length,
      },
    },
  };
}

function normalizeString(value) {
  return typeof value === 'string' ? value : '';
}

function listTasks(store, filters = {}) {
  const tasks = readArray(store, TASKS_KEY).map(normalizeTaskForMcp);
  const status = normalizeString(filters.status);
  const assigneeId = normalizeString(filters.assigneeId);
  const projectId = normalizeString(filters.projectId);
  const search = normalizeString(filters.search).trim().toLowerCase();

  return tasks.filter(task => {
    if (!task || typeof task !== 'object') return false;
    if (status && task.status !== status) return false;
    if (assigneeId && task.assigneeId !== assigneeId) return false;

    if (projectId) {
      const projectIds = Array.isArray(task.projectIds) ? task.projectIds : [];
      if (!projectIds.includes(projectId) && task.swimlaneId !== projectId) return false;
    }

    if (search) {
      const title = String(task.title || '').toLowerCase();
      const notes = String(task.notes || '').toLowerCase();
      if (!title.includes(search) && !notes.includes(search)) return false;
    }

    return true;
  });
}

function getTaskById(store, taskId) {
  if (typeof taskId !== 'string' || !taskId.trim()) return null;
  const tasks = readArray(store, TASKS_KEY);
  const task = tasks.find(t => t && t.id === taskId) || null;
  return task ? normalizeTaskForMcp(task) : null;
}

function summarizeAssignedTasks(tasks) {
  const byStatus = {};
  const byProjectId = {};

  for (const task of tasks) {
    if (!task || typeof task !== 'object') continue;
    const statusKey = normalizeString(task.status) || 'unknown';
    byStatus[statusKey] = (byStatus[statusKey] || 0) + 1;

    const projectIds = Array.isArray(task.projectIds) ? task.projectIds : [];
    if (projectIds.length === 0 && task.swimlaneId) {
      const laneKey = normalizeString(task.swimlaneId);
      if (laneKey) {
        byProjectId[laneKey] = (byProjectId[laneKey] || 0) + 1;
      }
      continue;
    }

    for (const projectId of projectIds) {
      const key = normalizeString(projectId);
      if (!key) continue;
      byProjectId[key] = (byProjectId[key] || 0) + 1;
    }
  }

  return {
    totalTasks: tasks.length,
    byStatus,
    byProjectId,
  };
}

function listAssignedWorkForAgent(store, {
  personId,
  personName,
  status,
  projectId,
  search,
} = {}) {
  const person = findPersonByReference(store, {
    assigneeId: personId,
    assigneeName: personName,
  });

  if (!person) {
    return {
      ok: false,
      error: 'PERSON_NOT_FOUND',
      message: 'Assigned person not found.',
    };
  }

  if (person.kind !== 'agentic') {
    return {
      ok: false,
      error: 'PERSON_NOT_AGENTIC',
      message: 'Assigned person is not an agentic persona.',
    };
  }

  const filters = {
    assigneeId: person.id,
    status: normalizeString(status),
    projectId: normalizeString(projectId),
    search: normalizeString(search),
  };

  const tasks = listTasks(store, filters);
  const summary = summarizeAssignedTasks(tasks);

  return {
    ok: true,
    person: {
      id: person.id,
      name: person.name,
      role: person.role,
      kind: person.kind,
    },
    filters: {
      status: filters.status || null,
      projectId: filters.projectId || null,
      search: filters.search || null,
    },
    summary,
    tasks,
  };
}

function listKanbanCards(store, filters = {}) {
  const tasks = listTasks(store, filters);

  return tasks.map(task => ({
    id: task.id,
    status: task.status,
    title: task.title,
    assigneeId: task.assigneeId,
    notes: task.notes,
    projectIds: Array.isArray(task.projectIds) ? task.projectIds : [],
  }));
}

function listTimelineCards(store, filters = {}) {
  const tasks = readArray(store, TASKS_KEY).map(normalizeTaskForMcp);
  const laneId = normalizeString(filters.laneId);
  const startDate = normalizeString(filters.startDate);
  const endDate = normalizeString(filters.endDate);

  return tasks
    .filter(task => {
      if (!task || typeof task !== 'object') return false;
      const taskStart = normalizeString(task.startDate);
      const taskEnd = normalizeString(task.endDate || task.startDate);

      if (laneId && task.swimlaneId !== laneId) return false;
      if (startDate && taskEnd && taskEnd < startDate) return false;
      if (endDate && taskStart && taskStart > endDate) return false;
      return true;
    })
    .map(task => ({
      id: task.id,
      title: task.title,
      swimlaneId: task.swimlaneId,
      startDate: task.startDate,
      endDate: task.endDate,
      assigneeId: task.assigneeId,
      status: task.status,
    }));
}

function buildMcpAgentGuide() {
  return {
    schemaVersion: '1',
    resource: 'plumy://agent/guide',
    title: 'Plumy MCP agent guide',
    summary: 'Discovery-first workflow for agents using the Plumy MCP server.',
    recommendedDiscoveryOrder: [
      'initialize',
      'resources/list',
      'resources/templates/list',
      'resources/read plumy://agent/guide',
      'resources/read plumy://schema/task-execution',
      'resources/read plumy://workspace',
      'resources/read plumy://agents/{personId}/assigned',
    ],
    commonResources: [
      'plumy://workspace',
      'plumy://schema/task-execution',
      'plumy://agent/guide',
    ],
    commonResourceTemplates: [
      'plumy://tasks/{taskId}',
      'plumy://agents/{personId}/assigned',
      'plumy://projects/{projectId}/tasks',
      'plumy://boards/{statusId}/tasks',
    ],
    commonTools: [
      'tasks.list',
      'tasks.get',
      'cards.kanban.list',
      'cards.timeline.list',
      'boards.watch.poll',
      'tasks.add_comment',
      'tasks.update_completion_description',
      'tasks.move_to_status',
      'tasks.move_to_ready_for_human_review',
      'tasks.assign',
    ],
    workflow: [
      'Read the guide and task-execution schema before taking action.',
      'Use resources/templates/list to discover stable lookup URIs.',
      'Inspect plumy://workspace for the overall state, then read the assigned task resource.',
      'Read current task data before writing, and pass expectedRevision on every write.',
      'Keep completion notes brief, then move the task to the appropriate review board.',
    ],
    handoffChecklist: [
      'Task context inspected',
      'Relevant board/project/person context read',
      'Brief completion note recorded',
      'Task moved to review when work is ready',
    ],
  };
}

function buildMcpTaskExecutionSchema() {
  return {
    schemaVersion: '1',
    resource: 'plumy://schema/task-execution',
    title: 'Plumy task execution schema',
    summary: 'Expected agent task lifecycle and write sequence.',
    lifecycle: [
      'discover',
      'inspect',
      'work',
      'summarize',
      'handoff',
      'review',
    ],
    writeRules: [
      'Read the task first.',
      'Always pass expectedRevision on writes.',
      'Write a brief completion summary before moving the task to review.',
      'Prefer the narrowest write tool that matches the action.',
    ],
    recommendedWriteSequence: [
      'tasks.add_comment',
      'tasks.update_completion_description',
      'tasks.move_to_status or tasks.move_to_ready_for_human_review',
      'tasks.assign when handing off to another person',
    ],
    reviewTargets: [
      'under-review',
      'ready-human',
      'requires-human-review',
    ],
    lookupHints: [
      'Use tasks.list with assigneeId to find assigned work.',
      'Use boards.watch.poll to watch a board for changes.',
      'Use cards.kanban.list for board-friendly projections.',
    ],
  };
}

function buildMcpPromptCatalog() {
  return [
    {
      name: 'agent.find_assigned_work',
      description: 'Find the tasks assigned to a specific agentic person and summarize what is actionable now.',
      arguments: [
        {
          name: 'personId',
          description: 'The id of the agentic person whose assigned work should be inspected.',
          required: true,
        },
      ],
    },
    {
      name: 'agent.execute_task',
      description: 'Inspect a task, gather the needed context, and prepare a safe execution plan before making write calls.',
      arguments: [
        {
          name: 'taskId',
          description: 'The task id to inspect and execute.',
          required: true,
        },
      ],
    },
    {
      name: 'agent.complete_and_handoff',
      description: 'Summarize a completed task briefly, then hand it off for human review using the safe write tool.',
      arguments: [
        {
          name: 'taskId',
          description: 'The task id to hand off for review.',
          required: true,
        },
        {
          name: 'completion',
          description: 'A brief completion summary that will be written into the task.',
          required: true,
        },
      ],
    },
  ];
}

function buildPromptMessages(description, steps) {
  return [
    {
      role: 'user',
      content: {
        type: 'text',
        text: [description, '', ...steps.map((step, index) => `${index + 1}. ${step}`)].join('\n'),
      },
    },
  ];
}

function getMcpPrompt(promptName, args = {}) {
  const normalizedName = normalizeString(promptName);
  const normalizedArgs = args && typeof args === 'object' && !Array.isArray(args) ? args : {};

  if (normalizedName === 'agent.find_assigned_work') {
    const personId = normalizeString(normalizedArgs.personId);
    return {
      description: 'Find and summarize the assigned work for one agentic person.',
      messages: buildPromptMessages(
        `Find the current assigned work for agent "${personId || '{personId}'}".`,
        [
          'Call resources/read for the agent-assigned resource template using the provided person id.',
          'Summarize the current tasks, grouped by status or project when helpful.',
          'If no work is assigned, say that clearly instead of guessing.',
        ]
      ),
    };
  }

  if (normalizedName === 'agent.execute_task') {
    const taskId = normalizeString(normalizedArgs.taskId);
    return {
      description: 'Inspect one task and gather enough context to execute it safely.',
      messages: buildPromptMessages(
        `Prepare to execute task "${taskId || '{taskId}'}".`,
        [
          'Read plumy://schema/task-execution before making changes.',
          'Read the task by id and inspect any assigned project, person, and description context.',
          'Use read tools/resources first; only use write tools after you understand the task and have the current revision.',
        ]
      ),
    };
  }

  if (normalizedName === 'agent.complete_and_handoff') {
    const taskId = normalizeString(normalizedArgs.taskId);
    return {
      description: 'Complete a task handoff for human review using the high-level workflow tool.',
      messages: buildPromptMessages(
        `Complete and hand off task "${taskId || '{taskId}'}" for human review.`,
        [
          'Read the latest task state and capture its expected revision.',
          'Write a brief completion summary only.',
          'Call tasks.complete_and_request_review with the current revision and completion summary.',
        ]
      ),
    };
  }

  return null;
}

function normalizeTaskForMcp(task) {
  if (!task || typeof task !== 'object') return task;
  const revision = Number.isFinite(Number(task[MCP_TASK_REV_FIELD]))
    ? Math.max(0, Math.floor(Number(task[MCP_TASK_REV_FIELD])))
    : 0;
  const descriptionProjectContext = extractProjectContextFromDescription(task.notes);
  return {
    ...task,
    [MCP_TASK_REV_FIELD]: revision,
    descriptionProjectContext,
  };
}

function extractProjectContextFromDescription(notes) {
  if (typeof notes !== 'string' || !notes.trim()) {
    return {
      projectMentions: [],
      repoHints: [],
      urls: [],
    };
  }

  const lines = notes.split(/\r?\n/);
  const projectMentions = [];
  const repoHints = [];
  const urls = [];

  const urlMatches = notes.match(/https?:\/\/[^\s)\]]+/g) || [];
  for (const url of urlMatches) {
    if (!urls.includes(url)) urls.push(url);
    if (/github\.com|gitlab\.com|bitbucket\.org|\.git($|[/?#])/i.test(url) && !repoHints.includes(url)) {
      repoHints.push(url);
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const projectMatch = line.match(/^projects?\s*:\s*(.+)$/i);
    if (projectMatch) {
      const values = projectMatch[1]
        .split(/[;,]/)
        .map(value => value.trim())
        .filter(Boolean);
      for (const value of values) {
        if (!projectMentions.includes(value)) projectMentions.push(value);
      }
    }

    const repoMatch = line.match(/^repos?(itory)?\s*:\s*(.+)$/i);
    if (repoMatch) {
      const value = repoMatch[2].trim();
      if (value && !repoHints.includes(value)) repoHints.push(value);
    }

    const pathLikeMatch = line.match(/(?:^|\s)([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+(?:\.git)?)(?:$|\s)/g) || [];
    for (const match of pathLikeMatch) {
      const cleaned = match.trim();
      if (cleaned && !repoHints.includes(cleaned)) repoHints.push(cleaned);
    }
  }

  return {
    projectMentions,
    repoHints,
    urls,
  };
}

function findPersonById(store, personId) {
  if (!personId) return null;
  const people = readArray(store, PEOPLE_KEY);
  return people.find(person => person && person.id === personId) || null;
}

function normalizeName(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function findPersonByName(store, personName) {
  const normalized = normalizeName(personName);
  if (!normalized) return null;
  const people = readArray(store, PEOPLE_KEY);
  return people.find(person => person && normalizeName(person.name) === normalized) || null;
}

function findPersonByReference(store, { assigneeId, assigneeName }) {
  if (typeof assigneeId === 'string' && assigneeId.trim()) {
    const person = findPersonById(store, assigneeId.trim());
    if (person) return person;
  }

  if (typeof assigneeName === 'string' && assigneeName.trim()) {
    return findPersonByName(store, assigneeName);
  }

  return null;
}

function findStatusColumnByReference(store, { statusId, statusTitle }) {
  const columns = readArray(store, STATUS_COLUMNS_KEY);
  const normalizedTitle = normalizeName(statusTitle);
  const normalizedId = normalizeName(statusId);

  return columns.find(column => {
    if (!column || typeof column !== 'object') return false;
    const idMatches = typeof statusId === 'string' && column.id === statusId.trim();
    const titleMatches = normalizedTitle && normalizeName(column.title) === normalizedTitle;
    const fallbackMatches = normalizedId && normalizeName(column.title) === normalizedId;
    return idMatches || titleMatches || fallbackMatches;
  }) || null;
}

function ensureReadyForHumanReviewStatusColumn(store) {
  const existing = findStatusColumnByReference(store, {
    statusId: REQUIRES_HUMAN_REVIEW_STATUS_ID,
    statusTitle: 'Ready for human review',
  });
  if (existing) {
    return { created: false, statusColumn: existing };
  }

  const columns = readArray(store, STATUS_COLUMNS_KEY);
  const statusColumn = {
    id: 'ready-human',
    title: 'Ready for human review',
    color: '#ffb61a',
  };
  store.set(STATUS_COLUMNS_KEY, columns.concat(statusColumn));
  return { created: true, statusColumn };
}

function updateTaskWithRevision(store, taskId, expectedRevision, updater) {
  const tasks = readArray(store, TASKS_KEY);
  const taskIndex = tasks.findIndex(task => task && task.id === taskId);
  if (taskIndex < 0) {
    return { ok: false, error: 'TASK_NOT_FOUND', message: `Task "${taskId}" not found.` };
  }

  const currentTask = normalizeTaskForMcp(tasks[taskIndex]);
  const currentRevision = currentTask[MCP_TASK_REV_FIELD] || 0;

  if (!Number.isFinite(Number(expectedRevision))) {
    return {
      ok: false,
      error: 'EXPECTED_REVISION_REQUIRED',
      message: 'expectedRevision is required and must be a finite number.',
      currentRevision,
    };
  }

  const expected = Math.max(0, Math.floor(Number(expectedRevision)));
  if (expected !== currentRevision) {
    return {
      ok: false,
      error: 'REVISION_MISMATCH',
      message: 'Task revision mismatch.',
      currentRevision,
      expectedRevision: expected,
    };
  }

  const nextTask = updater(currentTask);
  if (!nextTask) {
    return { ok: false, error: 'INVALID_UPDATE', message: 'Task update was rejected.' };
  }

  const updated = {
    ...nextTask,
    [MCP_TASK_REV_FIELD]: currentRevision + 1,
    mcpUpdatedAt: new Date().toISOString(),
  };

  const nextTasks = tasks.slice();
  nextTasks[taskIndex] = updated;
  store.set(TASKS_KEY, nextTasks);

  return { ok: true, task: normalizeTaskForMcp(updated) };
}

function transitionTaskToUnderReview(store, { taskId, expectedRevision, actor = 'agent' }) {
  return updateTaskWithRevision(store, taskId, expectedRevision, (task) => {
    if (task.status !== 'in-progress') return null;
    const assignee = findPersonById(store, task.assigneeId);
    if (!assignee || assignee.kind !== 'agentic') return null;
    return {
      ...task,
      status: 'under-review',
      mcpLastActor: actor,
    };
  });
}

function moveTaskToStatus(store, {
  taskId,
  statusId,
  statusTitle,
  expectedRevision,
  actor = 'agent',
}) {
  const target = findStatusColumnByReference(store, { statusId, statusTitle });
  if (!target) {
    return {
      ok: false,
      error: 'STATUS_NOT_FOUND',
      message: 'Target status/board not found.',
    };
  }

  const tasks = readArray(store, TASKS_KEY);
  const task = tasks.find(item => item && item.id === taskId) || null;
  const currentTask = normalizeTaskForMcp(task);
  if (!currentTask) {
    return {
      ok: false,
      error: 'TASK_NOT_FOUND',
      message: `Task "${taskId}" not found.`,
    };
  }

  const currentRevision = currentTask[MCP_TASK_REV_FIELD] || 0;
  if (!Number.isFinite(Number(expectedRevision))) {
    return {
      ok: false,
      error: 'EXPECTED_REVISION_REQUIRED',
      message: 'expectedRevision is required and must be a finite number.',
      currentRevision,
    };
  }

  const expected = Math.max(0, Math.floor(Number(expectedRevision)));
  if (expected !== currentRevision) {
    return {
      ok: false,
      error: 'REVISION_MISMATCH',
      message: 'Task revision mismatch.',
      currentRevision,
      expectedRevision: expected,
    };
  }

  if (currentTask.status === target.id) {
    return { ok: true, changed: false, task: currentTask, currentRevision };
  }

  return updateTaskWithRevision(store, taskId, expectedRevision, (nextTask) => ({
    ...nextTask,
    status: target.id,
    mcpLastActor: actor,
  }));
}

function moveTaskToReadyForHumanReview(store, { taskId, expectedRevision, actor = 'agent' }) {
  const ensured = ensureReadyForHumanReviewStatusColumn(store);
  const result = moveTaskToStatus(store, {
    taskId,
    statusId: ensured.statusColumn.id,
    statusTitle: ensured.statusColumn.title,
    expectedRevision,
    actor,
  });

  return {
    ...result,
    statusCreated: ensured.created,
    statusId: ensured.statusColumn.id,
  };
}

function completeTaskAndRequestReview(store, {
  taskId,
  completion,
  expectedRevision,
  actor = 'agent',
}) {
  const completionText = sanitizeCompletionText(completion);
  if (!completionText) {
    return {
      ok: false,
      error: 'INVALID_COMPLETION',
      message: 'completion is required.',
    };
  }

  const ensured = ensureReadyForHumanReviewStatusColumn(store);
  const result = updateTaskWithRevision(store, taskId, expectedRevision, (task) => ({
    ...task,
    notes: upsertCompletionSection(task.notes, completionText),
    status: ensured.statusColumn.id,
    mcpLastActor: actor,
  }));

  return {
    ...result,
    statusCreated: ensured.created,
    statusId: ensured.statusColumn.id,
  };
}

function assignTaskToPerson(store, {
  taskId,
  assigneeId,
  assigneeName,
  assigneeKind,
  expectedRevision,
  actor = 'agent',
}) {
  const assignee = findPersonByReference(store, { assigneeId, assigneeName });
  if (!assignee) {
    return {
      ok: false,
      error: 'ASSIGNEE_NOT_FOUND',
      message: 'Assignee not found.',
    };
  }

  if (typeof assigneeKind === 'string' && assigneeKind.trim() && assignee.kind !== assigneeKind.trim()) {
    return {
      ok: false,
      error: 'ASSIGNEE_KIND_MISMATCH',
      message: 'Assignee kind does not match the selected person.',
    };
  }

  const tasks = readArray(store, TASKS_KEY);
  const task = tasks.find(item => item && item.id === taskId) || null;
  const currentTask = normalizeTaskForMcp(task);
  if (!currentTask) {
    return {
      ok: false,
      error: 'TASK_NOT_FOUND',
      message: `Task "${taskId}" not found.`,
    };
  }

  const currentRevision = currentTask[MCP_TASK_REV_FIELD] || 0;
  if (!Number.isFinite(Number(expectedRevision))) {
    return {
      ok: false,
      error: 'EXPECTED_REVISION_REQUIRED',
      message: 'expectedRevision is required and must be a finite number.',
      currentRevision,
    };
  }

  const expected = Math.max(0, Math.floor(Number(expectedRevision)));
  if (expected !== currentRevision) {
    return {
      ok: false,
      error: 'REVISION_MISMATCH',
      message: 'Task revision mismatch.',
      currentRevision,
      expectedRevision: expected,
    };
  }

  if (currentTask.assigneeId === assignee.id) {
    return { ok: true, changed: false, task: currentTask, currentRevision };
  }

  return updateTaskWithRevision(store, taskId, expectedRevision, (nextTask) => ({
    ...nextTask,
    assigneeId: assignee.id,
    mcpLastActor: actor,
  }));
}

function updateTaskAgentSummary(store, { taskId, summary, expectedRevision, actor = 'agent' }) {
  const normalizedSummary = typeof summary === 'string' ? summary.trim() : '';
  if (!normalizedSummary) {
    return {
      ok: false,
      error: 'INVALID_SUMMARY',
      message: 'summary is required.',
    };
  }
  return updateTaskWithRevision(store, taskId, expectedRevision, (task) => ({
    ...task,
    agentSummary: normalizedSummary,
    agentSummaryUpdatedAt: new Date().toISOString(),
    mcpLastActor: actor,
  }));
}

function sanitizeTaskActivityMessage(message) {
  if (typeof message !== 'string') return '';
  const normalized = message.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > 400 ? `${normalized.slice(0, 400).trim()}...` : normalized;
}

function normalizeTaskActivityType(type) {
  const normalized = normalizeString(type).toLowerCase();
  if (normalized === 'comment') return 'comment';
  return 'activity';
}

function addTaskActivityEntry(store, {
  taskId,
  message,
  type = 'activity',
  expectedRevision,
  actor = 'agent',
}) {
  const sanitizedMessage = sanitizeTaskActivityMessage(message);
  if (!sanitizedMessage) {
    return {
      ok: false,
      error: 'INVALID_ACTIVITY_MESSAGE',
      message: 'message is required.',
    };
  }

  return updateTaskWithRevision(store, taskId, expectedRevision, (task) => {
    const existingEntries = Array.isArray(task.activityLog) ? task.activityLog : [];
    const nextEntry = {
      id: `activity-${randomUUID()}`,
      type: normalizeTaskActivityType(type),
      message: sanitizedMessage,
      actor,
      createdAt: new Date().toISOString(),
    };

    return {
      ...task,
      activityLog: existingEntries.concat(nextEntry).slice(-TASK_ACTIVITY_LOG_MAX_ENTRIES),
      mcpLastActor: actor,
    };
  });
}

function addTaskComment(store, {
  taskId,
  comment,
  author = 'agent',
  expectedRevision,
  actor = 'agent',
}) {
  const sanitizedComment = sanitizeTaskActivityMessage(comment);
  const sanitizedAuthor = normalizeString(author) || 'agent';
  if (!sanitizedComment) {
    return {
      ok: false,
      error: 'INVALID_COMMENT',
      message: 'comment is required.',
    };
  }

  return updateTaskWithRevision(store, taskId, expectedRevision, (task) => {
    const existingComments = Array.isArray(task.comments) ? task.comments : [];
    const nextComment = {
      id: `comment-${randomUUID()}`,
      author: sanitizedAuthor,
      content: sanitizedComment,
      createdAt: new Date().toISOString(),
    };

    return {
      ...task,
      comments: existingComments.concat(nextComment).slice(-TASK_ACTIVITY_LOG_MAX_ENTRIES),
      mcpLastActor: actor,
    };
  });
}

function sanitizeCompletionText(completion) {
  if (typeof completion !== 'string') return '';
  const normalized = completion.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > 240 ? `${normalized.slice(0, 240).trim()}...` : normalized;
}

function upsertCompletionSection(notes, completionText) {
  const startMarker = '<!-- MCP_COMPLETION_START -->';
  const endMarker = '<!-- MCP_COMPLETION_END -->';
  const currentNotes = typeof notes === 'string' ? notes : '';
  const escaped = currentNotes.replace(
    new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, 'g'),
    ''
  ).trim();
  const completionBlock = [
    startMarker,
    '### Agent Completion',
    `- ${completionText}`,
    endMarker,
  ].join('\n');

  if (!escaped) return completionBlock;
  return `${escaped}\n\n${completionBlock}`;
}

function updateTaskCompletionDescription(store, {
  taskId,
  completion,
  expectedRevision,
  actor = 'agent',
}) {
  const completionText = sanitizeCompletionText(completion);
  if (!completionText) {
    return {
      ok: false,
      error: 'INVALID_COMPLETION',
      message: 'completion is required.',
    };
  }

  return updateTaskWithRevision(store, taskId, expectedRevision, (task) => ({
    ...task,
    notes: upsertCompletionSection(task.notes, completionText),
    mcpLastActor: actor,
  }));
}

function ensureRequiresHumanReviewStatusColumn(store) {
  const columns = readArray(store, STATUS_COLUMNS_KEY);
  const existing = columns.find(col => col && col.id === REQUIRES_HUMAN_REVIEW_STATUS_ID);
  if (existing) {
    return { created: false, statusId: REQUIRES_HUMAN_REVIEW_STATUS_ID };
  }

  const nextColumns = columns.concat({
    id: REQUIRES_HUMAN_REVIEW_STATUS_ID,
    title: REQUIRES_HUMAN_REVIEW_STATUS_TITLE,
    color: REQUIRES_HUMAN_REVIEW_STATUS_COLOR,
  });
  store.set(STATUS_COLUMNS_KEY, nextColumns);
  return { created: true, statusId: REQUIRES_HUMAN_REVIEW_STATUS_ID };
}

function isTaskCandidateForHumanReview(task, peopleById, includeDone) {
  if (!task || typeof task !== 'object') return false;

  const assignee = task.assigneeId ? peopleById.get(task.assigneeId) : null;
  const isAgentTask = Boolean(assignee && assignee.kind === 'agentic');
  const hasAgentSummary = typeof task.agentSummary === 'string' && task.agentSummary.trim().length > 0;

  if (!isAgentTask && !hasAgentSummary) return false;
  if (task.status === 'under-review') return true;
  if (includeDone && task.status === 'done') return true;
  return false;
}

function moveTasksToRequiresHumanReviewBoard(store, {
  actor = 'mcp-agent',
  taskIds,
  includeDone = false,
  expectedRevisions,
} = {}) {
  const ensuredColumn = ensureRequiresHumanReviewStatusColumn(store);
  const tasks = readArray(store, TASKS_KEY);
  const people = readArray(store, PEOPLE_KEY);
  const peopleById = new Map(people.map(person => [person.id, person]));
  const expectedMap = expectedRevisions && typeof expectedRevisions === 'object' ? expectedRevisions : {};
  const taskIdFilter = Array.isArray(taskIds) && taskIds.length > 0 ? new Set(taskIds) : null;

  const movedTaskIds = [];
  const skipped = [];

  const nextTasks = tasks.map(rawTask => {
    const task = normalizeTaskForMcp(rawTask);
    if (!task || typeof task !== 'object') return rawTask;
    if (taskIdFilter && !taskIdFilter.has(task.id)) return rawTask;

    if (!isTaskCandidateForHumanReview(task, peopleById, includeDone)) {
      skipped.push({ taskId: task.id, reason: 'not_candidate' });
      return rawTask;
    }

    const expected = expectedMap && Object.prototype.hasOwnProperty.call(expectedMap, task.id)
      ? Number(expectedMap[task.id])
      : null;
    if (expected !== null) {
      const currentRevision = Number(task[MCP_TASK_REV_FIELD] || 0);
      if (!Number.isFinite(expected) || Math.floor(expected) !== currentRevision) {
        skipped.push({
          taskId: task.id,
          reason: 'revision_mismatch',
          currentRevision,
          expectedRevision: expected,
        });
        return rawTask;
      }
    }

    if (task.status === REQUIRES_HUMAN_REVIEW_STATUS_ID) {
      skipped.push({ taskId: task.id, reason: 'already_in_board' });
      return rawTask;
    }

    movedTaskIds.push(task.id);
    return {
      ...task,
      status: REQUIRES_HUMAN_REVIEW_STATUS_ID,
      [MCP_TASK_REV_FIELD]: Number(task[MCP_TASK_REV_FIELD] || 0) + 1,
      mcpUpdatedAt: new Date().toISOString(),
      mcpLastActor: actor,
    };
  });

  if (movedTaskIds.length > 0) {
    store.set(TASKS_KEY, nextTasks);
  }

  return {
    statusId: REQUIRES_HUMAN_REVIEW_STATUS_ID,
    statusCreated: ensuredColumn.created,
    movedTaskIds,
    skipped,
    totalMoved: movedTaskIds.length,
  };
}

module.exports = {
  PREFERENCES_KEY,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_NAME,
  DEFAULT_MCP_HOST,
  DEFAULT_MCP_PORT,
  DEFAULT_MCP_PATH,
  DEFAULT_MCP_CAPABILITY_PROFILE,
  MCP_CAPABILITY_PROFILES,
  MCP_AUDIT_LOG_KEY,
  MCP_BOARD_WATCHERS_KEY,
  isMcpAgentAccessEnabled,
  getMcpServerConfig,
  isMcpAccessTokenExpired,
  getMcpAccessTokenStatus,
  buildMcpListenerStatus,
  getMcpCapabilityProfile,
  buildMcpCapabilitySnapshot,
  buildMcpInitializeResult,
  appendMcpAuditLog,
  listMcpAuditLog,
  MCP_TASK_REV_FIELD,
  getWorkspaceSnapshot,
  listTasks,
  listAssignedWorkForAgent,
  getTaskById,
  listKanbanCards,
  listTimelineCards,
  buildMcpAgentGuide,
  buildMcpTaskExecutionSchema,
  buildMcpPromptCatalog,
  getMcpPrompt,
  listBoardWatcherStates,
  getBoardWatcherState,
  pollBoardWatcher,
  transitionTaskToUnderReview,
  updateTaskAgentSummary,
  addTaskComment,
  addTaskActivityEntry,
  updateTaskCompletionDescription,
  completeTaskAndRequestReview,
  moveTasksToRequiresHumanReviewBoard,
  moveTaskToStatus,
  moveTaskToReadyForHumanReview,
  assignTaskToPerson,
  REQUIRES_HUMAN_REVIEW_STATUS_ID,
  REQUIRES_HUMAN_REVIEW_STATUS_TITLE,
};
