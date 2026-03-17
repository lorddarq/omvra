const PREFERENCES_KEY = 'plumy.preferences.v1';
const TASKS_KEY = 'plumy.tasks.v1';
const PEOPLE_KEY = 'plumy.people.v1';
const SWIMLANES_KEY = 'plumy.swimlanes.v1';
const STATUS_COLUMNS_KEY = 'plumy.statusColumns.v1';
const DEFAULT_MCP_HOST = '127.0.0.1';
const DEFAULT_MCP_PORT = 3456;
const DEFAULT_MCP_PATH = '/mcp';
const DEFAULT_MCP_CAPABILITY_PROFILE = 'read_only';
const MCP_CAPABILITY_PROFILES = ['read_only', 'task_write', 'admin'];
const MCP_AUDIT_LOG_KEY = 'plumy.mcp.audit.v1';
const MCP_AUDIT_LOG_MAX_ENTRIES = 200;
const MCP_TASK_REV_FIELD = '__mcpRevision';

function readObject(store, key) {
  const value = store.get(key);
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function readArray(store, key) {
  const value = store.get(key);
  return Array.isArray(value) ? value : [];
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

function getMcpCapabilityProfile(store) {
  const preferences = readObject(store, PREFERENCES_KEY);
  const value = typeof preferences.mcpCapabilityProfile === 'string'
    ? preferences.mcpCapabilityProfile.trim()
    : '';
  return MCP_CAPABILITY_PROFILES.includes(value) ? value : DEFAULT_MCP_CAPABILITY_PROFILE;
}

function appendMcpAuditLog(store, entry) {
  const safeEntry = entry && typeof entry === 'object' ? entry : {};
  const existing = readArray(store, MCP_AUDIT_LOG_KEY);
  const nextEntry = {
    timestamp: new Date().toISOString(),
    ...safeEntry,
  };
  const nextLog = existing.concat(nextEntry).slice(-MCP_AUDIT_LOG_MAX_ENTRIES);
  store.set(MCP_AUDIT_LOG_KEY, nextLog);
  return nextEntry;
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

module.exports = {
  PREFERENCES_KEY,
  DEFAULT_MCP_HOST,
  DEFAULT_MCP_PORT,
  DEFAULT_MCP_PATH,
  DEFAULT_MCP_CAPABILITY_PROFILE,
  MCP_CAPABILITY_PROFILES,
  MCP_AUDIT_LOG_KEY,
  isMcpAgentAccessEnabled,
  getMcpServerConfig,
  getMcpCapabilityProfile,
  appendMcpAuditLog,
  MCP_TASK_REV_FIELD,
  getWorkspaceSnapshot,
  listTasks,
  getTaskById,
  listKanbanCards,
  listTimelineCards,
  transitionTaskToUnderReview,
  updateTaskAgentSummary,
};
