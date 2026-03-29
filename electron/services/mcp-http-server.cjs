const http = require('http');
const {
  isMcpAgentAccessEnabled,
  getMcpServerConfig,
  getMcpCapabilityProfile,
  buildMcpCapabilitySnapshot,
  buildMcpInitializeResult,
  appendMcpAuditLog,
  getWorkspaceSnapshot,
  buildMcpAgentGuide,
  buildMcpTaskExecutionSchema,
  buildMcpPromptCatalog,
  getMcpPrompt,
  listTasks,
  getTaskById,
  listAssignedWorkForAgent,
  listKanbanCards,
  listTimelineCards,
  pollBoardWatcher,
  createTask,
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
  isMcpAccessTokenExpired,
} = require('./workspace-service.cjs');

const MAX_BODY_BYTES = 1024 * 1024;
const ALLOWED_CORS_HEADERS = 'Content-Type, Accept, Authorization, X-MCP-Token';
const ALLOWED_CORS_METHODS = 'POST, OPTIONS';

const JSON_RPC_ERROR = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  MCP_ACCESS_DISABLED: -32001,
  MCP_UNAUTHORIZED: -32002,
  MCP_WRITE_FORBIDDEN: -32003,
};

const READ_TOOL_DEFINITIONS = [
  {
    name: 'workspace.get_snapshot',
    description: 'Returns the full read-only workspace snapshot. Use this after initialize when you need the canonical task, person, project, and board state.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'tasks.list',
    description: 'Lists tasks with optional filters (status, assigneeId, search, projectId).',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        status: { type: 'string' },
        assigneeId: { type: 'string' },
        search: { type: 'string' },
        projectId: { type: 'string' },
      },
    },
  },
  {
    name: 'tasks.get',
    description: 'Gets a single task by id.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        id: { type: 'string' },
        taskId: { type: 'string' },
      },
      oneOf: [{ required: ['id'] }, { required: ['taskId'] }],
    },
  },
  {
    name: 'cards.kanban.list',
    description: 'Lists cards for the kanban view. Use this when you want a board-shaped projection with task status, assignee, and notes.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        statusId: { type: 'string' },
        assigneeId: { type: 'string' },
        search: { type: 'string' },
      },
    },
  },
  {
    name: 'cards.timeline.list',
    description: 'Lists cards for the timeline view. Use this when you need date-bounded task cards for scheduling or planning.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        laneId: { type: 'string' },
        startDate: { type: 'string' },
        endDate: { type: 'string' },
      },
    },
  },
  {
    name: 'boards.watch.poll',
    description: 'Polls a kanban board/status for new or changed tasks and persists watcher state for duplicate suppression. Call this repeatedly to watch a board for incoming work.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        watcherId: { type: 'string' },
        statusId: { type: 'string' },
        assigneeId: { type: 'string' },
        projectId: { type: 'string' },
        search: { type: 'string' },
        persist: { type: 'boolean' },
      },
      required: ['statusId'],
    },
  },
];

const WRITE_TOOL_DEFINITIONS = [
  {
    name: 'task_write',
    description: 'Creates a new task with optional project, timeline, assignment, schedule, and task metadata. Use this for bug hunting runs or when agents need to log follow-up work.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        title: { type: 'string' },
        notes: { type: 'string' },
        statusId: { type: 'string' },
        statusTitle: { type: 'string' },
        assigneeId: { type: 'string' },
        assigneeName: { type: 'string' },
        assigneeKind: { type: 'string' },
        projectId: { type: 'string' },
        projectIds: {
          type: 'array',
          items: { type: 'string' },
        },
        swimlaneId: { type: 'string' },
        startDate: { type: 'string' },
        endDate: { type: 'string' },
        size: { type: 'string' },
        complexity: { type: 'string' },
        priority: { type: 'string' },
        blocked: { type: 'boolean' },
        swimlaneOnly: { type: 'boolean' },
      },
      required: ['title'],
    },
  },
  {
    name: 'tasks.create',
    description: 'Compatibility alias for task_write.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        title: { type: 'string' },
        notes: { type: 'string' },
        statusId: { type: 'string' },
        statusTitle: { type: 'string' },
        assigneeId: { type: 'string' },
        assigneeName: { type: 'string' },
        assigneeKind: { type: 'string' },
        projectId: { type: 'string' },
        projectIds: {
          type: 'array',
          items: { type: 'string' },
        },
        swimlaneId: { type: 'string' },
        startDate: { type: 'string' },
        endDate: { type: 'string' },
        size: { type: 'string' },
        complexity: { type: 'string' },
        priority: { type: 'string' },
        blocked: { type: 'boolean' },
        swimlaneOnly: { type: 'boolean' },
      },
      required: ['title'],
    },
  },
  {
    name: 'tasks.transition_under_review',
    description: 'Transitions a task status to under-review. (not available in read-only mode)',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        taskId: { type: 'string' },
        expectedRevision: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      },
      required: ['taskId', 'expectedRevision'],
    },
  },
  {
    name: 'tasks.update_agent_summary',
    description: 'Updates a task agent summary field. (not available in read-only mode)',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        taskId: { type: 'string' },
        summary: { type: 'string' },
        expectedRevision: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      },
      required: ['taskId', 'summary', 'expectedRevision'],
    },
  },
  {
    name: 'tasks.add_comment',
    description: 'Adds a structured comment to a task. Use this before handing work off or when you need to leave a concise status note.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        taskId: { type: 'string' },
        comment: { type: 'string' },
        author: { type: 'string' },
        expectedRevision: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      },
      required: ['taskId', 'comment', 'expectedRevision'],
    },
  },
  {
    name: 'tasks.add_activity_entry',
    description: 'Adds a structured activity entry to a task.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        taskId: { type: 'string' },
        message: { type: 'string' },
        type: { type: 'string' },
        expectedRevision: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      },
      required: ['taskId', 'message', 'expectedRevision'],
    },
  },
  {
    name: 'tasks.update_completion_description',
    description: 'Updates a task description with a brief completion note. Use this to summarize what the agent completed before handing off.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        taskId: { type: 'string' },
        completion: { type: 'string' },
        expectedRevision: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      },
      required: ['taskId', 'completion', 'expectedRevision'],
    },
  },
  {
    name: 'tasks.complete_and_request_review',
    description: 'Adds a brief completion note and moves the task to Ready for human review using the next safe revision.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        taskId: { type: 'string' },
        completion: { type: 'string' },
        expectedRevision: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      },
      required: ['taskId', 'completion', 'expectedRevision'],
    },
  },
  {
    name: 'tasks.move_to_requires_human_review',
    description: 'Creates "Requires human review" board if needed and moves completed review-required tasks there. Use this as a final agent handoff step.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        taskIds: {
          type: 'array',
          items: { type: 'string' },
        },
        includeDone: { type: 'boolean' },
        expectedRevisions: {
          type: 'object',
          additionalProperties: { anyOf: [{ type: 'string' }, { type: 'number' }] },
        },
      },
    },
  },
  {
    name: 'tasks.move_to_status',
    description: 'Moves a task to a named board/status after validating the target exists. Use this when the destination board is already known.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        taskId: { type: 'string' },
        statusId: { type: 'string' },
        statusTitle: { type: 'string' },
        expectedRevision: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      },
      required: ['taskId', 'expectedRevision'],
    },
  },
  {
    name: 'tasks.move_to_ready_for_human_review',
    description: 'Moves a task to Ready for human review, creating the board if needed. Use this after completing work and writing a brief completion note.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        taskId: { type: 'string' },
        expectedRevision: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      },
      required: ['taskId', 'expectedRevision'],
    },
  },
  {
    name: 'tasks.assign',
    description: 'Assigns a task to a human or agent person by id or name. Use this to hand work to a specific person before or after execution.',
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        taskId: { type: 'string' },
        assigneeId: { type: 'string' },
        assigneeName: { type: 'string' },
        assigneeKind: { type: 'string' },
        expectedRevision: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      },
      required: ['taskId', 'expectedRevision'],
    },
  },
];

const RESOURCE_DEFINITIONS = [
  {
    uri: 'plumy://workspace',
    name: 'Workspace snapshot',
    description: 'Read-only workspace snapshot',
    mimeType: 'application/json',
  },
  {
    uri: 'plumy://agent/guide',
    name: 'Agent guide',
    description: 'Workflow guide for agents using the Plumy MCP server',
    mimeType: 'application/json',
  },
  {
    uri: 'plumy://schema/task-execution',
    name: 'Task execution schema',
    description: 'Task execution lifecycle and handoff schema',
    mimeType: 'application/json',
  },
  {
    uri: 'plumy://cards/kanban',
    name: 'Kanban cards',
    description: 'Read-only kanban card projection',
    mimeType: 'application/json',
  },
  {
    uri: 'plumy://cards/timeline',
    name: 'Timeline cards',
    description: 'Read-only timeline card projection',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'plumy://tasks/{taskId}',
    name: 'Task by id',
    description: 'Read-only task resource',
    mimeType: 'application/json',
  },
];

const RESOURCE_TEMPLATE_DEFINITIONS = [
  {
    uriTemplate: 'plumy://tasks/{taskId}',
    name: 'Task by id',
    description: 'Resolve a task by id',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'plumy://agents/{personId}/assigned',
    name: 'Assigned tasks by person',
    description: 'Resolve tasks assigned to a person',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'plumy://projects/{projectId}/tasks',
    name: 'Tasks by project',
    description: 'Resolve tasks in a project',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'plumy://boards/{statusId}/tasks',
    name: 'Tasks by board',
    description: 'Resolve tasks in a board/status',
    mimeType: 'application/json',
  },
];

const PROMPT_DEFINITIONS = buildMcpPromptCatalog();

function createJsonRpcError(code, message, data) {
  const error = { code, message };
  if (data !== undefined) {
    error.data = data;
  }
  return error;
}

function makeJsonRpcResponse(id, payload) {
  return {
    jsonrpc: '2.0',
    id: id === undefined ? null : id,
    ...payload,
  };
}

function makeToolResult(structuredContent) {
  return {
    structuredContent,
    content: [
      {
        type: 'text',
        text: JSON.stringify(structuredContent),
      },
    ],
    isError: false,
  };
}

function makeWriteToolResult(action, payload = {}) {
  const structuredContent = {
    ok: true,
    action,
    changed: Boolean(payload.changed),
    auditId: typeof payload.auditId === 'string' && payload.auditId ? payload.auditId : null,
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'revision')) {
    structuredContent.revision = payload.revision;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'task')) {
    structuredContent.task = payload.task;
    if (!Object.prototype.hasOwnProperty.call(structuredContent, 'revision')) {
      structuredContent.revision = payload.task && typeof payload.task === 'object'
        ? payload.task.__mcpRevision ?? null
        : null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'result')) {
    structuredContent.result = payload.result;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'statusId')) {
    structuredContent.statusId = payload.statusId;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'statusCreated')) {
    structuredContent.statusCreated = payload.statusCreated;
  }

  return makeToolResult(structuredContent);
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function hasResponseId(request) {
  return Boolean(request) && Object.prototype.hasOwnProperty.call(request, 'id');
}

function getRequestMeta(req) {
  const headers = req?.headers || {};
  const remoteAddress = req?.transport === 'stdio'
    ? 'stdio'
    : req?.socket?.remoteAddress || req?.remoteAddress || null;

  return {
    remoteAddress,
    userAgent: typeof headers['user-agent'] === 'string' ? headers['user-agent'] : null,
    tokenProvided: Boolean(extractBearerToken(req)),
    transport: req?.transport || 'http',
  };
}

function sanitizeForAudit(value, depth = 0) {
  if (depth > 2) return '[truncated]';
  if (typeof value === 'string') {
    return value.length > 240 ? `${value.slice(0, 240)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(item => sanitizeForAudit(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, itemValue] of Object.entries(value).slice(0, 40)) {
      out[key] = sanitizeForAudit(itemValue, depth + 1);
    }
    return out;
  }
  return undefined;
}

function parseTaskId(args) {
  const normalized = normalizeObject(args);
  if (typeof normalized.id === 'string' && normalized.id.trim()) {
    return normalized.id.trim();
  }
  if (typeof normalized.taskId === 'string' && normalized.taskId.trim()) {
    return normalized.taskId.trim();
  }
  return null;
}

function isJsonRpcIdValid(id) {
  return id === undefined
    || id === null
    || typeof id === 'string'
    || (typeof id === 'number' && Number.isFinite(id));
}

function invalidParams(message, details) {
  return createJsonRpcError(JSON_RPC_ERROR.INVALID_PARAMS, message, details);
}

function getToolCallPayload(params) {
  const normalized = normalizeObject(params);
  const name = typeof normalized.name === 'string' ? normalized.name.trim() : '';

  if (!name) {
    return {
      error: invalidParams('Invalid params: "name" is required for tools/call.'),
    };
  }

  if (normalized.arguments !== undefined
    && (!normalized.arguments || typeof normalized.arguments !== 'object' || Array.isArray(normalized.arguments))) {
    return {
      error: invalidParams('Invalid params: "arguments" must be an object when provided.'),
    };
  }

  return {
    name,
    args: normalizeObject(normalized.arguments),
  };
}

function isKnownWriteToolName(name) {
  if (WRITE_TOOL_DEFINITIONS.some(tool => tool.name === name)) {
    return true;
  }
  return /^tasks\.(create|update|delete|write|set|transition|complete)/.test(name);
}

function getResourceForUri(store, uri, requestParams) {
  if (uri === 'plumy://workspace') {
    return { uri, data: getWorkspaceSnapshot(store) };
  }

  if (uri === 'plumy://agent/guide') {
    return { uri, data: buildMcpAgentGuide() };
  }

  if (uri === 'plumy://schema/task-execution') {
    return { uri, data: buildMcpTaskExecutionSchema() };
  }

  if (uri === 'plumy://tasks/{taskId}'
    || uri === 'plumy://agents/{personId}/assigned'
    || uri === 'plumy://projects/{projectId}/tasks'
    || uri === 'plumy://boards/{statusId}/tasks') {
    return {
      error: invalidParams(`Resource URI "${uri}" is a template. Use resources/templates/list and substitute the path parameter before calling resources/read.`, { uri }),
    };
  }

  if (uri.startsWith('plumy://tasks/')) {
    const taskId = decodeURIComponent(uri.slice('plumy://tasks/'.length));
    if (!taskId) {
      return {
        error: invalidParams('Invalid params: task resource URI must include task id.', { uri }),
      };
    }
    return { uri, data: getTaskById(store, taskId) };
  }

  if (uri.startsWith('plumy://agents/') && uri.endsWith('/assigned')) {
    const personId = decodeURIComponent(uri.slice('plumy://agents/'.length, -'/assigned'.length));
    if (!personId) {
      return {
        error: invalidParams('Invalid params: agent resource URI must include person id.', { uri }),
      };
    }
    const filters = normalizeObject(requestParams);
    const payload = listAssignedWorkForAgent(store, {
      personId,
      search: filters.search,
      status: filters.status,
      projectId: filters.projectId,
    });
    if (!payload.ok) {
      return { error: invalidParams(payload.message, payload) };
    }
    return {
      uri,
      data: payload,
    };
  }

  if (uri.startsWith('plumy://projects/') && uri.endsWith('/tasks')) {
    const projectId = decodeURIComponent(uri.slice('plumy://projects/'.length, -'/tasks'.length));
    if (!projectId) {
      return {
        error: invalidParams('Invalid params: project resource URI must include project id.', { uri }),
      };
    }
    const filters = normalizeObject(requestParams);
    return {
      uri,
      data: listTasks(store, {
        projectId,
        search: filters.search,
        assigneeId: filters.assigneeId,
        status: filters.status,
      }),
    };
  }

  if (uri.startsWith('plumy://boards/') && uri.endsWith('/tasks')) {
    const statusId = decodeURIComponent(uri.slice('plumy://boards/'.length, -'/tasks'.length));
    if (!statusId) {
      return {
        error: invalidParams('Invalid params: board resource URI must include status id.', { uri }),
      };
    }
    const filters = normalizeObject(requestParams);
    return {
      uri,
      data: listTasks(store, {
        status: statusId,
        search: filters.search,
        assigneeId: filters.assigneeId,
        projectId: filters.projectId,
      }),
    };
  }

  if (uri.startsWith('plumy://cards/kanban')) {
    const filters = normalizeObject(requestParams);
    const payload = listKanbanCards(store, {
      status: filters.statusId,
      assigneeId: filters.assigneeId,
      search: filters.search,
    });
    return { uri: 'plumy://cards/kanban', data: payload };
  }

  if (uri.startsWith('plumy://cards/timeline')) {
    const filters = normalizeObject(requestParams);
    const payload = listTimelineCards(store, filters);
    return { uri: 'plumy://cards/timeline', data: payload };
  }

  return {
    error: invalidParams(`Unsupported resource URI "${uri}".`, {
      supported: ['plumy://workspace', 'plumy://tasks/{taskId}', 'plumy://cards/kanban', 'plumy://cards/timeline'],
    }),
  };
}

function makeResourceReadResult(resourceUri, data) {
  return {
    contents: [
      {
        uri: resourceUri,
        mimeType: 'application/json',
        text: JSON.stringify(data),
      },
    ],
  };
}

function recordWriteAttempt(store, req, details) {
  return appendMcpAuditLog(store, {
    type: 'mcp_write_attempt',
    ...getRequestMeta(req),
    ...sanitizeForAudit(details),
  });
}

function handleToolCall(store, req, params) {
  const payload = getToolCallPayload(params);
  if (payload.error) {
    return { error: payload.error };
  }

  const { name, args } = payload;

  if (isKnownWriteToolName(name)) {
    const profile = getMcpCapabilityProfile(store);
    const writeToolsEnabled = profile === 'task_write' || profile === 'admin';
    if (!writeToolsEnabled) {
      recordWriteAttempt(store, req, {
        outcome: 'denied',
        reason: 'write_tools_unavailable',
        capabilityProfile: profile,
        toolName: name,
        arguments: args,
      });

      return {
        error: createJsonRpcError(
          JSON_RPC_ERROR.MCP_WRITE_FORBIDDEN,
          `Write tool "${name}" is not available. MCP is currently read-only by default.`,
          {
            capabilityProfile: profile,
            allowedProfiles: ['task_write', 'admin'],
            writeToolsEnabled,
          }
        ),
      };
    }
  }

  switch (name) {
    case 'workspace.get_snapshot':
      return { result: makeToolResult(getWorkspaceSnapshot(store)) };

    case 'tasks.list':
      return { result: makeToolResult(listTasks(store, args)) };

    case 'tasks.get': {
      const taskId = parseTaskId(args);
      if (!taskId) {
        return {
          error: invalidParams('Invalid params: "id" (or "taskId") is required for tasks.get.'),
        };
      }
      return { result: makeToolResult(getTaskById(store, taskId)) };
    }

    case 'cards.kanban.list': {
      const filters = {
        status: args.statusId,
        assigneeId: args.assigneeId,
        search: args.search,
      };
      return { result: makeToolResult(listKanbanCards(store, filters)) };
    }

    case 'cards.timeline.list':
      return { result: makeToolResult(listTimelineCards(store, args)) };

    case 'boards.watch.poll': {
      const result = pollBoardWatcher(store, {
        watcherId: args.watcherId,
        statusId: args.statusId,
        assigneeId: args.assigneeId,
        projectId: args.projectId,
        search: args.search,
        persist: args.persist !== false,
      });
      if (!result.ok) {
        return { error: invalidParams(result.message, result) };
      }
      return { result: makeToolResult(result) };
    }

    case 'task_write':
    case 'tasks.create': {
      const result = createTask(store, {
        title: args.title,
        notes: args.notes,
        statusId: args.statusId,
        statusTitle: args.statusTitle,
        assigneeId: args.assigneeId,
        assigneeName: args.assigneeName,
        assigneeKind: args.assigneeKind,
        projectId: args.projectId,
        projectIds: args.projectIds,
        swimlaneId: args.swimlaneId,
        startDate: args.startDate,
        endDate: args.endDate,
        size: args.size,
        complexity: args.complexity,
        priority: args.priority,
        blocked: args.blocked,
        swimlaneOnly: args.swimlaneOnly,
        actor: 'mcp-agent',
      });
      if (!result.ok) {
        recordWriteAttempt(store, req, {
          outcome: 'denied',
          reason: result.error,
          toolName: name,
          title: args.title,
        });
        return { error: invalidParams(result.message, result) };
      }
      const audit = recordWriteAttempt(store, req, {
        outcome: 'allowed',
        toolName: name,
        taskId: result.task?.id,
        title: result.task?.title,
        nextRevision: result.task?.__mcpRevision,
      });
      return {
        result: makeWriteToolResult(name, {
          changed: true,
          auditId: audit?.auditId,
          task: result.task,
          revision: result.task?.__mcpRevision,
        }),
      };
    }

    case 'tasks.transition_under_review': {
      const taskId = parseTaskId(args);
      if (!taskId) {
        return { error: invalidParams('Invalid params: "taskId" is required.') };
      }
      const result = transitionTaskToUnderReview(store, {
        taskId,
        expectedRevision: args.expectedRevision,
        actor: 'mcp-agent',
      });
      if (!result.ok) {
        recordWriteAttempt(store, req, {
          outcome: 'denied',
          reason: result.error,
          toolName: name,
          taskId,
        });
        return { error: invalidParams(result.message, result) };
      }
      const audit = recordWriteAttempt(store, req, {
        outcome: 'allowed',
        toolName: name,
        taskId,
        nextRevision: result.task?.__mcpRevision,
      });
      return {
        result: makeWriteToolResult(name, {
          changed: true,
          auditId: audit?.auditId,
          task: result.task,
          revision: result.task?.__mcpRevision,
        }),
      };
    }

    case 'tasks.update_agent_summary': {
      const taskId = parseTaskId(args);
      if (!taskId) {
        return { error: invalidParams('Invalid params: "taskId" is required.') };
      }
      const result = updateTaskAgentSummary(store, {
        taskId,
        summary: args.summary,
        expectedRevision: args.expectedRevision,
        actor: 'mcp-agent',
      });
      if (!result.ok) {
        recordWriteAttempt(store, req, {
          outcome: 'denied',
          reason: result.error,
          toolName: name,
          taskId,
        });
        return { error: invalidParams(result.message, result) };
      }
      const audit = recordWriteAttempt(store, req, {
        outcome: 'allowed',
        toolName: name,
        taskId,
        nextRevision: result.task?.__mcpRevision,
      });
      return {
        result: makeWriteToolResult(name, {
          changed: true,
          auditId: audit?.auditId,
          task: result.task,
          revision: result.task?.__mcpRevision,
        }),
      };
    }

    case 'tasks.add_comment': {
      const taskId = parseTaskId(args);
      if (!taskId) {
        return { error: invalidParams('Invalid params: "taskId" is required.') };
      }
      const result = addTaskComment(store, {
        taskId,
        comment: args.comment,
        author: args.author || 'mcp-agent',
        expectedRevision: args.expectedRevision,
        actor: 'mcp-agent',
      });
      if (!result.ok) {
        recordWriteAttempt(store, req, {
          outcome: 'denied',
          reason: result.error,
          toolName: name,
          taskId,
        });
        return { error: invalidParams(result.message, result) };
      }
      const audit = recordWriteAttempt(store, req, {
        outcome: 'allowed',
        toolName: name,
        taskId,
        nextRevision: result.task?.__mcpRevision,
      });
      return {
        result: makeWriteToolResult(name, {
          changed: true,
          auditId: audit?.auditId,
          task: result.task,
          revision: result.task?.__mcpRevision,
        }),
      };
    }

    case 'tasks.add_activity_entry': {
      const taskId = parseTaskId(args);
      if (!taskId) {
        return { error: invalidParams('Invalid params: "taskId" is required.') };
      }
      const result = addTaskActivityEntry(store, {
        taskId,
        message: args.message,
        type: args.type,
        expectedRevision: args.expectedRevision,
        actor: 'mcp-agent',
      });
      if (!result.ok) {
        recordWriteAttempt(store, req, {
          outcome: 'denied',
          reason: result.error,
          toolName: name,
          taskId,
        });
        return { error: invalidParams(result.message, result) };
      }
      const audit = recordWriteAttempt(store, req, {
        outcome: 'allowed',
        toolName: name,
        taskId,
        nextRevision: result.task?.__mcpRevision,
      });
      return {
        result: makeWriteToolResult(name, {
          changed: true,
          auditId: audit?.auditId,
          task: result.task,
          revision: result.task?.__mcpRevision,
        }),
      };
    }

    case 'tasks.move_to_requires_human_review': {
      const result = moveTasksToRequiresHumanReviewBoard(store, {
        actor: 'mcp-agent',
        taskIds: Array.isArray(args.taskIds) ? args.taskIds : undefined,
        includeDone: Boolean(args.includeDone),
        expectedRevisions: args.expectedRevisions,
      });
      const audit = recordWriteAttempt(store, req, {
        outcome: 'allowed',
        toolName: name,
        movedTaskIds: result.movedTaskIds,
        skipped: result.skipped,
      });
      return {
        result: makeWriteToolResult(name, {
          changed: result.totalMoved > 0,
          auditId: audit?.auditId,
          result,
          statusId: result.statusId,
          statusCreated: result.statusCreated,
        }),
      };
    }

    case 'tasks.update_completion_description': {
      const taskId = parseTaskId(args);
      if (!taskId) {
        return { error: invalidParams('Invalid params: "taskId" is required.') };
      }
      const result = updateTaskCompletionDescription(store, {
        taskId,
        completion: args.completion,
        expectedRevision: args.expectedRevision,
        actor: 'mcp-agent',
      });
      if (!result.ok) {
        recordWriteAttempt(store, req, {
          outcome: 'denied',
          reason: result.error,
          toolName: name,
          taskId,
        });
        return { error: invalidParams(result.message, result) };
      }
      const audit = recordWriteAttempt(store, req, {
        outcome: 'allowed',
        toolName: name,
        taskId,
        nextRevision: result.task?.__mcpRevision,
      });
      return {
        result: makeWriteToolResult(name, {
          changed: true,
          auditId: audit?.auditId,
          task: result.task,
          revision: result.task?.__mcpRevision,
        }),
      };
    }

    case 'tasks.complete_and_request_review': {
      const taskId = parseTaskId(args);
      if (!taskId) {
        return { error: invalidParams('Invalid params: "taskId" is required.') };
      }
      const result = completeTaskAndRequestReview(store, {
        taskId,
        completion: args.completion,
        expectedRevision: args.expectedRevision,
        actor: 'mcp-agent',
      });
      if (!result.ok) {
        recordWriteAttempt(store, req, {
          outcome: 'denied',
          reason: result.error,
          toolName: name,
          taskId,
        });
        return { error: invalidParams(result.message, result) };
      }
      const audit = recordWriteAttempt(store, req, {
        outcome: 'allowed',
        toolName: name,
        taskId,
        targetStatusId: result.statusId,
        nextRevision: result.task?.__mcpRevision ?? result.currentRevision,
      });
      return {
        result: makeWriteToolResult(name, {
          changed: result.changed !== false,
          auditId: audit?.auditId,
          task: result.task,
          revision: result.task?.__mcpRevision ?? result.currentRevision,
          statusId: result.statusId,
          statusCreated: result.statusCreated,
        }),
      };
    }

    case 'tasks.move_to_status': {
      const taskId = parseTaskId(args);
      if (!taskId) {
        return { error: invalidParams('Invalid params: "taskId" is required.') };
      }

      const result = moveTaskToStatus(store, {
        taskId,
        statusId: args.statusId,
        statusTitle: args.statusTitle,
        expectedRevision: args.expectedRevision,
        actor: 'mcp-agent',
      });
      if (!result.ok) {
        recordWriteAttempt(store, req, {
          outcome: 'denied',
          reason: result.error,
          toolName: name,
          taskId,
          targetStatusId: args.statusId,
          targetStatusTitle: args.statusTitle,
        });
        return { error: invalidParams(result.message, result) };
      }
      const audit = recordWriteAttempt(store, req, {
        outcome: 'allowed',
        toolName: name,
        taskId,
        targetStatusId: args.statusId,
        targetStatusTitle: args.statusTitle,
        nextRevision: result.task?.__mcpRevision ?? result.currentRevision,
      });
      return {
        result: makeWriteToolResult(name, {
          changed: result.changed !== false,
          auditId: audit?.auditId,
          task: result.task,
          revision: result.task?.__mcpRevision ?? result.currentRevision,
        }),
      };
    }

    case 'tasks.move_to_ready_for_human_review': {
      const taskId = parseTaskId(args);
      if (!taskId) {
        return { error: invalidParams('Invalid params: "taskId" is required.') };
      }

      const result = moveTaskToReadyForHumanReview(store, {
        taskId,
        expectedRevision: args.expectedRevision,
        actor: 'mcp-agent',
      });
      if (!result.ok) {
        recordWriteAttempt(store, req, {
          outcome: 'denied',
          reason: result.error,
          toolName: name,
          taskId,
        });
        return { error: invalidParams(result.message, result) };
      }
      const audit = recordWriteAttempt(store, req, {
        outcome: 'allowed',
        toolName: name,
        taskId,
        targetStatusId: result.statusId,
        nextRevision: result.task?.__mcpRevision ?? result.currentRevision,
      });
      return {
        result: makeWriteToolResult(name, {
          changed: result.changed !== false,
          auditId: audit?.auditId,
          task: result.task,
          revision: result.task?.__mcpRevision ?? result.currentRevision,
          statusId: result.statusId,
          statusCreated: result.statusCreated,
        }),
      };
    }

    case 'tasks.assign': {
      const taskId = parseTaskId(args);
      if (!taskId) {
        return { error: invalidParams('Invalid params: "taskId" is required.') };
      }

      const result = assignTaskToPerson(store, {
        taskId,
        assigneeId: args.assigneeId,
        assigneeName: args.assigneeName,
        assigneeKind: args.assigneeKind,
        expectedRevision: args.expectedRevision,
        actor: 'mcp-agent',
      });
      if (!result.ok) {
        recordWriteAttempt(store, req, {
          outcome: 'denied',
          reason: result.error,
          toolName: name,
          taskId,
          assigneeId: args.assigneeId,
          assigneeName: args.assigneeName,
        });
        return { error: invalidParams(result.message, result) };
      }
      const audit = recordWriteAttempt(store, req, {
        outcome: 'allowed',
        toolName: name,
        taskId,
        assigneeId: args.assigneeId,
        assigneeName: args.assigneeName,
        nextRevision: result.task?.__mcpRevision ?? result.currentRevision,
      });
      return {
        result: makeWriteToolResult(name, {
          changed: result.changed !== false,
          auditId: audit?.auditId,
          task: result.task,
          revision: result.task?.__mcpRevision ?? result.currentRevision,
        }),
      };
    }

    default:
      return {
        error: invalidParams(`Unknown tool "${name}".`),
      };
  }
}

function extractBearerToken(req) {
  const authHeader = req.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }
  const fallbackToken = req.headers?.['x-mcp-token'];
  return typeof fallbackToken === 'string' ? fallbackToken.trim() : '';
}

function buildAuthErrorData(serverConfig, reason, req, extra = {}) {
  return {
    reason,
    authMode: serverConfig.accessToken ? 'token' : 'none',
    tokenConfigured: Boolean(serverConfig.accessToken),
    tokenStatus: serverConfig.accessToken
      ? (isMcpAccessTokenExpired(serverConfig) ? 'expired' : 'active')
      : 'none',
    endpoint: serverConfig.publicUrl,
    host: serverConfig.host,
    port: serverConfig.port,
    path: serverConfig.path,
    transport: req?.transport || 'http',
    ...extra,
  };
}

function createAuthError(serverConfig, req, reason, message, extra = {}) {
  return createJsonRpcError(
    JSON_RPC_ERROR.MCP_UNAUTHORIZED,
    message,
    buildAuthErrorData(serverConfig, reason, req, extra)
  );
}

function createAccessDisabledError(serverConfig, req) {
  return createJsonRpcError(
    JSON_RPC_ERROR.MCP_ACCESS_DISABLED,
    'MCP agent access is disabled. Enable mcpAgentAccessEnabled in Preferences.',
    buildAuthErrorData(serverConfig, 'access_disabled', req)
  );
}

function createRequestDispatcher(store) {
  return (request, req) => {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return makeJsonRpcResponse(
        null,
        { error: createJsonRpcError(JSON_RPC_ERROR.INVALID_REQUEST, 'Invalid Request') }
      );
    }

    const { jsonrpc, id, method, params } = request;
    if (!isJsonRpcIdValid(id)) {
      return makeJsonRpcResponse(
        null,
        { error: createJsonRpcError(JSON_RPC_ERROR.INVALID_REQUEST, 'Invalid Request: id must be string, number, null, or omitted.') }
      );
    }

    if (jsonrpc !== '2.0' || typeof method !== 'string' || !method.trim()) {
      return makeJsonRpcResponse(
        id,
        { error: createJsonRpcError(JSON_RPC_ERROR.INVALID_REQUEST, 'Invalid Request') }
      );
    }

    const canRespond = hasResponseId(request);
    const respond = payload => (canRespond ? makeJsonRpcResponse(id, payload) : null);
    const normalizedMethod = method.trim();
    const toolPayload = normalizedMethod === 'tools/call' ? getToolCallPayload(params) : null;
    const isWriteAttempt = normalizedMethod === 'tools/call' && !toolPayload?.error && isKnownWriteToolName(toolPayload.name);
    const currentServerConfig = getMcpServerConfig(store);

    if (normalizedMethod === 'notifications/initialized') {
      return null;
    }

    if (!isMcpAgentAccessEnabled(store)) {
      if (isWriteAttempt) {
        recordWriteAttempt(store, req, {
          outcome: 'denied',
          reason: 'access_disabled',
          capabilityProfile: getMcpCapabilityProfile(store),
          toolName: toolPayload.name,
          arguments: toolPayload.args,
        });
      }
      return respond({
        error: createAccessDisabledError(currentServerConfig, req),
      });
    }

    const token = currentServerConfig.accessToken;
    const isStdioTransport = req?.transport === 'stdio';
    if (token && !isStdioTransport) {
      if (isMcpAccessTokenExpired(currentServerConfig)) {
        return respond({
          error: createAuthError(
            currentServerConfig,
            req,
            'token_expired',
            'MCP token expired. Rotate token in Preferences.'
          ),
        });
      }
      const providedToken = extractBearerToken(req);
      if (!providedToken || providedToken !== token) {
        if (isWriteAttempt) {
          recordWriteAttempt(store, req, {
            outcome: 'denied',
            reason: 'unauthorized',
            capabilityProfile: getMcpCapabilityProfile(store),
            toolName: toolPayload.name,
            arguments: toolPayload.args,
          });
        }
        return respond({
          error: createAuthError(
            currentServerConfig,
            req,
            'unauthorized',
            'Unauthorized MCP request. Provide a valid Bearer token.',
            {
              tokenProvided: Boolean(providedToken),
            }
          ),
        });
      }
    }

    if (normalizedMethod === 'initialize') {
      if (params !== undefined && (typeof params !== 'object' || params === null || Array.isArray(params))) {
        return respond({
          error: invalidParams('Invalid params: initialize expects an object when params are provided.'),
        });
      }
      return respond({ result: buildMcpInitializeResult(store) });
    }

    if (normalizedMethod === 'mcp/capabilities') {
      return respond({ result: buildMcpCapabilitySnapshot(store) });
    }

    if (normalizedMethod === 'prompts/list') {
      if (params !== undefined && (typeof params !== 'object' || params === null || Array.isArray(params))) {
        return respond({
          error: invalidParams('Invalid params: prompts/list expects an object when params are provided.'),
        });
      }
      return respond({
        result: {
          prompts: PROMPT_DEFINITIONS,
        },
      });
    }

    if (normalizedMethod === 'prompts/get') {
      const normalized = normalizeObject(params);
      const name = typeof normalized.name === 'string' ? normalized.name.trim() : '';
      if (!name) {
        return respond({
          error: invalidParams('Invalid params: "name" is required for prompts/get.'),
        });
      }
      const prompt = getMcpPrompt(name, normalizeObject(normalized.arguments));
      if (!prompt) {
        return respond({
          error: createJsonRpcError(
            JSON_RPC_ERROR.INVALID_PARAMS,
            `Prompt "${name}" not found.`,
            { name }
          ),
        });
      }
      return respond({
        result: {
          description: prompt.description,
          messages: prompt.messages,
        },
      });
    }

    if (normalizedMethod === 'tools/list') {
      if (params !== undefined && (typeof params !== 'object' || params === null || Array.isArray(params))) {
        return respond({
          error: invalidParams('Invalid params: tools/list expects an object when params are provided.'),
        });
      }
      const profile = getMcpCapabilityProfile(store);
      const writeToolsEnabled = profile === 'task_write' || profile === 'admin';
      return respond({
        result: {
          tools: writeToolsEnabled
            ? [...READ_TOOL_DEFINITIONS, ...WRITE_TOOL_DEFINITIONS]
            : READ_TOOL_DEFINITIONS,
        },
      });
    }

    if (normalizedMethod === 'tools/call') {
      const toolResponse = handleToolCall(store, req, params);
      if (toolResponse.error) {
        return respond({ error: toolResponse.error });
      }
      return respond({ result: toolResponse.result });
    }

    if (normalizedMethod === 'resources/list') {
      if (params !== undefined && (typeof params !== 'object' || params === null || Array.isArray(params))) {
        return respond({
          error: invalidParams('Invalid params: resources/list expects an object when params are provided.'),
        });
      }
      return respond({
        result: {
          resources: RESOURCE_DEFINITIONS,
          resourceTemplates: RESOURCE_TEMPLATE_DEFINITIONS,
        },
      });
    }

    if (normalizedMethod === 'resources/templates/list') {
      if (params !== undefined && (typeof params !== 'object' || params === null || Array.isArray(params))) {
        return respond({
          error: invalidParams('Invalid params: resources/templates/list expects an object when params are provided.'),
        });
      }
      return respond({
        result: {
          resourceTemplates: RESOURCE_TEMPLATE_DEFINITIONS,
          templates: RESOURCE_TEMPLATE_DEFINITIONS,
        },
      });
    }

    if (normalizedMethod === 'resources/read') {
      const normalized = normalizeObject(params);
      const uri = typeof normalized.uri === 'string' ? normalized.uri.trim() : '';
      if (!uri) {
        return respond({
          error: invalidParams('Invalid params: "uri" is required for resources/read.'),
        });
      }

      const resourceResponse = getResourceForUri(store, uri, normalized);
      if (resourceResponse.error) {
        return respond({ error: resourceResponse.error });
      }

      return respond({
        result: makeResourceReadResult(resourceResponse.uri, resourceResponse.data),
      });
    }

    return respond({
      error: createJsonRpcError(JSON_RPC_ERROR.METHOD_NOT_FOUND, `Method not found: ${normalizedMethod}`),
    });
  };
}

function applyCorsHeaders(req, res) {
  const requestOrigin = typeof req?.headers?.origin === 'string' ? req.headers.origin.trim() : '';
  const allowOrigin = requestOrigin || '*';

  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', ALLOWED_CORS_METHODS);
  res.setHeader('Access-Control-Allow-Headers', ALLOWED_CORS_HEADERS);
  res.setHeader('Access-Control-Max-Age', '600');
}

function startMcpHttpServer(store, { logger = console, onStatusChange } = {}) {
  const dispatch = createRequestDispatcher(store);
  const serverConfig = getMcpServerConfig(store);
  const emitStatus = (status) => {
    if (typeof onStatusChange !== 'function') return;
    onStatusChange({
      ...status,
      host: serverConfig.host,
      port: serverConfig.port,
      path: serverConfig.path,
      expectedAddress: serverConfig.publicUrl,
      capabilityProfile: getMcpCapabilityProfile(store),
      updatedAt: new Date().toISOString(),
    });
  };

  emitStatus({
    status: isMcpAgentAccessEnabled(store) ? 'starting' : 'disabled',
    listening: false,
    error: null,
    boundAddress: null,
    boundUrl: null,
    restartRequired: false,
  });

  const server = http.createServer((req, res) => {
    applyCorsHeaders(req, res);

    if (!req || req.url !== serverConfig.path) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Not Found' }));
      return;
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    let requestBody = '';
    let receivedBytes = 0;

    req.setEncoding('utf8');

    req.on('data', chunk => {
      receivedBytes += Buffer.byteLength(chunk, 'utf8');
      if (receivedBytes > MAX_BODY_BYTES) {
        res.statusCode = 413;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Payload Too Large' }));
        req.destroy();
        return;
      }
      requestBody += chunk;
    });

    req.on('end', () => {
      let payload;
      try {
        payload = JSON.parse(requestBody || '{}');
      } catch (_error) {
        const response = makeJsonRpcResponse(
          null,
          { error: createJsonRpcError(JSON_RPC_ERROR.PARSE_ERROR, 'Parse error') }
        );
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(response));
        return;
      }

      let responsePayload;
      try {
        responsePayload = dispatch(payload, req);
      } catch (error) {
        logger.error('[mcp] Unexpected error while handling request:', error);
        responsePayload = makeJsonRpcResponse(
          payload && typeof payload === 'object' ? payload.id : null,
          {
            error: createJsonRpcError(
              JSON_RPC_ERROR.INTERNAL_ERROR,
              'Internal error'
            ),
          }
        );
      }

      if (responsePayload === null) {
        res.statusCode = 204;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end();
        return;
      }

      const responseCode = responsePayload?.error?.code;
      if (responseCode === JSON_RPC_ERROR.MCP_UNAUTHORIZED) {
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'Bearer realm="Plumy MCP", error="invalid_token"');
      } else if (responseCode === JSON_RPC_ERROR.MCP_ACCESS_DISABLED) {
        res.statusCode = 403;
      } else {
        res.statusCode = 200;
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(responsePayload));
    });

    req.on('error', error => {
      logger.error('[mcp] Request stream error:', error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      res.end(JSON.stringify({ error: 'Request stream failure' }));
    });
  });

  server.on('error', error => {
    logger.error(`[mcp] HTTP server error on ${serverConfig.host}:${serverConfig.port}${serverConfig.path}:`, error);
    emitStatus({
      status: 'error',
      listening: false,
      error: error?.message || String(error),
      boundAddress: null,
      boundUrl: null,
      restartRequired: true,
    });
  });

  server.on('close', () => {
    emitStatus({
      status: 'stopped',
      listening: false,
      error: null,
      boundAddress: null,
      boundUrl: null,
      restartRequired: false,
    });
  });

  server.listen(serverConfig.port, serverConfig.host, () => {
    logger.info(`[mcp] Listening on http://${serverConfig.host}:${serverConfig.port}${serverConfig.path}`);
    emitStatus({
      status: 'running',
      listening: true,
      error: null,
      boundAddress: `${serverConfig.host}:${serverConfig.port}`,
      boundUrl: `http://${serverConfig.host}:${serverConfig.port}${serverConfig.path}`,
      lastStartedAt: new Date().toISOString(),
      restartRequired: false,
    });
    // TODO(next-phase): add client authentication and session binding before exposing beyond local development.
    // TODO(next-phase): enable write tools only after safe-write implementation is complete.
  });

  return server;
}

module.exports = {
  startMcpHttpServer,
  createRequestDispatcher,
};
