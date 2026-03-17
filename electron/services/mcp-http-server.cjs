const http = require('http');
const {
  isMcpAgentAccessEnabled,
  getMcpServerConfig,
  getMcpCapabilityProfile,
  appendMcpAuditLog,
  getWorkspaceSnapshot,
  listTasks,
  getTaskById,
  listKanbanCards,
  listTimelineCards,
  transitionTaskToUnderReview,
  updateTaskAgentSummary,
} = require('./workspace-service.cjs');

const MAX_BODY_BYTES = 1024 * 1024;

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
    description: 'Returns a read-only workspace snapshot (tasks, people, projects, status columns).',
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
    description: 'Lists cards for the kanban view.',
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
    description: 'Lists cards for the timeline view.',
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
];

// Write tools are intentionally not exposed in tools/list while the backend remains read-only.
const WRITE_TOOL_DEFINITIONS = [
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
];

const RESOURCE_DEFINITIONS = [
  {
    uri: 'plumy://workspace',
    name: 'Workspace snapshot',
    description: 'Read-only workspace snapshot',
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

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
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
  return /^tasks\.(create|update|delete|write|set|transition)/.test(name);
}

function getCapabilities(store) {
  const enabled = isMcpAgentAccessEnabled(store);
  const profile = getMcpCapabilityProfile(store);
  const writeToolsEnabled = profile === 'task_write' || profile === 'admin';
  return {
    enabled,
    readOnly: true,
    capabilityProfile: profile,
    capabilityProfiles: ['read_only', 'task_write', 'admin'],
    capabilities: {
      workspaceSnapshot: enabled,
      resourcesRead: enabled,
      toolCalls: enabled,
      writeTools: writeToolsEnabled,
    },
    writeBoundary: {
      writeToolsEnabled,
      enforced: true,
      exposedWriteTools: writeToolsEnabled ? WRITE_TOOL_DEFINITIONS.map(tool => tool.name) : [],
    },
  };
}

function getResourceForUri(store, uri, requestParams) {
  if (uri === 'plumy://workspace') {
    return { uri, data: getWorkspaceSnapshot(store) };
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
  appendMcpAuditLog(store, {
    type: 'mcp_write_attempt',
    remoteAddress: req.socket?.remoteAddress || null,
    userAgent: typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    tokenProvided: Boolean(extractBearerToken(req)),
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
      recordWriteAttempt(store, req, {
        outcome: 'allowed',
        toolName: name,
        taskId,
        nextRevision: result.task?.__mcpRevision,
      });
      return { result: makeToolResult({ task: result.task }) };
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
      recordWriteAttempt(store, req, {
        outcome: 'allowed',
        toolName: name,
        taskId,
        nextRevision: result.task?.__mcpRevision,
      });
      return { result: makeToolResult({ task: result.task }) };
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

function isTokenExpired(serverConfig) {
  if (!serverConfig.accessToken) return false;
  if (!serverConfig.accessTokenIssuedAt) return true;
  const issuedAtMs = Date.parse(serverConfig.accessTokenIssuedAt);
  if (!Number.isFinite(issuedAtMs)) return true;
  const ttlMs = Math.max(1, Number(serverConfig.accessTokenTtlMinutes || 60)) * 60 * 1000;
  return Date.now() > issuedAtMs + ttlMs;
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

    const normalizedMethod = method.trim();
    const toolPayload = normalizedMethod === 'tools/call' ? getToolCallPayload(params) : null;
    const isWriteAttempt = normalizedMethod === 'tools/call' && !toolPayload?.error && isKnownWriteToolName(toolPayload.name);

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
      return makeJsonRpcResponse(
        id,
        {
          error: createJsonRpcError(
            JSON_RPC_ERROR.MCP_ACCESS_DISABLED,
            'MCP agent access is disabled. Enable mcpAgentAccessEnabled in Preferences.'
          ),
        }
      );
    }

    const currentServerConfig = getMcpServerConfig(store);
    const token = currentServerConfig.accessToken;
    if (token) {
      if (isTokenExpired(currentServerConfig)) {
        return makeJsonRpcResponse(
          id,
          {
            error: createJsonRpcError(
              JSON_RPC_ERROR.MCP_UNAUTHORIZED,
              'MCP token expired. Rotate token in Preferences.'
            ),
          }
        );
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
        return makeJsonRpcResponse(
          id,
          {
            error: createJsonRpcError(
              JSON_RPC_ERROR.MCP_UNAUTHORIZED,
              'Unauthorized MCP request. Provide a valid Bearer token.'
            ),
          }
        );
      }
    }

    if (normalizedMethod === 'mcp/capabilities') {
      return makeJsonRpcResponse(id, { result: getCapabilities(store) });
    }

    if (normalizedMethod === 'tools/list') {
      if (params !== undefined && (typeof params !== 'object' || params === null || Array.isArray(params))) {
        return makeJsonRpcResponse(id, {
          error: invalidParams('Invalid params: tools/list expects an object when params are provided.'),
        });
      }
      const profile = getMcpCapabilityProfile(store);
      const writeToolsEnabled = profile === 'task_write' || profile === 'admin';
      return makeJsonRpcResponse(id, {
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
        return makeJsonRpcResponse(id, { error: toolResponse.error });
      }
      return makeJsonRpcResponse(id, { result: toolResponse.result });
    }

    if (normalizedMethod === 'resources/list') {
      if (params !== undefined && (typeof params !== 'object' || params === null || Array.isArray(params))) {
        return makeJsonRpcResponse(id, {
          error: invalidParams('Invalid params: resources/list expects an object when params are provided.'),
        });
      }
      return makeJsonRpcResponse(id, { result: { resources: RESOURCE_DEFINITIONS } });
    }

    if (normalizedMethod === 'resources/read') {
      const normalized = normalizeObject(params);
      const uri = typeof normalized.uri === 'string' ? normalized.uri.trim() : '';
      if (!uri) {
        return makeJsonRpcResponse(id, {
          error: invalidParams('Invalid params: "uri" is required for resources/read.'),
        });
      }

      const resourceResponse = getResourceForUri(store, uri, normalized);
      if (resourceResponse.error) {
        return makeJsonRpcResponse(id, { error: resourceResponse.error });
      }

      return makeJsonRpcResponse(id, {
        result: makeResourceReadResult(resourceResponse.uri, resourceResponse.data),
      });
    }

    return makeJsonRpcResponse(
      id,
      { error: createJsonRpcError(JSON_RPC_ERROR.METHOD_NOT_FOUND, `Method not found: ${normalizedMethod}`) }
    );
  };
}

function startMcpHttpServer(store, { logger = console } = {}) {
  const dispatch = createRequestDispatcher(store);
  const serverConfig = getMcpServerConfig(store);

  const server = http.createServer((req, res) => {
    if (!req || req.method !== 'POST' || req.url !== serverConfig.path) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Not Found' }));
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

      res.statusCode = 200;
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
  });

  server.listen(serverConfig.port, serverConfig.host, () => {
    logger.info(`[mcp] Listening on http://${serverConfig.host}:${serverConfig.port}${serverConfig.path}`);
    // TODO(next-phase): add client authentication and session binding before exposing beyond local development.
    // TODO(next-phase): enable write tools only after safe-write implementation is complete.
  });

  return server;
}

module.exports = {
  startMcpHttpServer,
};
