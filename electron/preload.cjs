const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Store
  storeGet: (key) => ipcRenderer.invoke('store/get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store/set', key, value),
  storeExport: () => ipcRenderer.invoke('store/export'),

  // Attachments
  attachments: {
    pick: () => ipcRenderer.invoke('attachments/pick'),
    verify: (filePath) => ipcRenderer.invoke('attachments/verify', filePath),
    embed: (filePath) => ipcRenderer.invoke('attachments/embed', filePath),
  },

  // Open external (validated in main)
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // MCP bridge (read-only, gated by mcpAgentAccessEnabled preference)
  mcp: {
    getCapabilities: () => ipcRenderer.invoke('mcp/get-capabilities'),
    getWorkspaceSnapshot: () => ipcRenderer.invoke('mcp/workspace/snapshot'),
    restartServer: () => ipcRenderer.invoke('mcp/restart-server'),
  },
});
