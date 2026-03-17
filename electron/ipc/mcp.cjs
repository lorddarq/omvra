const {
  getWorkspaceSnapshot,
  isMcpAgentAccessEnabled,
  getMcpCapabilityProfile,
  MCP_CAPABILITY_PROFILES,
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

function registerMcpIpcHandlers({ ipcMain, store }) {
  ipcMain.handle('mcp/get-capabilities', async () => {
    const enabled = isMcpAgentAccessEnabled(store);
    const capabilityProfile = getMcpCapabilityProfile(store);
    const writeToolsEnabled = capabilityProfile === 'task_write' || capabilityProfile === 'admin';
    return {
      ok: true,
      data: {
        enabled,
        readOnly: !writeToolsEnabled,
        capabilityProfile,
        capabilityProfiles: MCP_CAPABILITY_PROFILES,
        capabilities: {
          workspaceSnapshot: enabled,
          resourcesRead: enabled,
          writeTools: writeToolsEnabled,
        },
        writeBoundary: {
          enforced: true,
          writeToolsEnabled,
          exposedWriteTools: writeToolsEnabled
            ? ['tasks.transition_under_review', 'tasks.update_agent_summary']
            : [],
        },
        // TODO(next-phase): include per-client auth token claims here.
        // TODO(next-phase): enforce local-only transport identity checks.
      },
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
}

module.exports = {
  registerMcpIpcHandlers,
};
