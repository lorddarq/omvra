const {
  getWorkspaceSnapshot,
  isMcpAgentAccessEnabled,
  buildMcpCapabilitySnapshot,
  buildMcpListenerStatus,
  listMcpAuditLog,
  buildMcpAuditSummary,
} = require('../services/workspace-service.cjs');

function deniedResponse() {
  return {
    ok: false,
    error: {
      code: 'MCP_AGENT_ACCESS_DISABLED',
      message: 'MCP agent access is disabled. Enable mcpAgentAccessEnabled in Preferences.',
    },
  };
}

function registerMcpIpcHandlers({ ipcMain, store, getListenerStatus }) {
  ipcMain.handle('mcp/get-capabilities', async () => {
    return {
      ok: true,
      data: buildMcpCapabilitySnapshot(store),
    };
  });

  ipcMain.handle('mcp/get-listener-status', async () => {
    return {
      ok: true,
      data: buildMcpListenerStatus(store, typeof getListenerStatus === 'function' ? getListenerStatus() : {}),
    };
  });

  ipcMain.handle('mcp/workspace/snapshot', async () => {
    if (!isMcpAgentAccessEnabled(store)) {
      return deniedResponse();
    }

    return {
      ok: true,
      data: getWorkspaceSnapshot(store),
    };
  });

  ipcMain.handle('mcp/get-audit-log', async (_event, { limit } = {}) => {
    return {
      ok: true,
      data: listMcpAuditLog(store, { limit }),
    };
  });

  ipcMain.handle('mcp/get-audit-summary', async (_event, options = {}) => {
    return {
      ok: true,
      data: buildMcpAuditSummary(store, options),
    };
  });
}

module.exports = {
  registerMcpIpcHandlers,
};
