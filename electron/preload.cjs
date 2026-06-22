const { contextBridge, ipcRenderer } = require('electron');
const STORE_DID_CHANGE_CHANNEL = 'store/did-change';

contextBridge.exposeInMainWorld('electron', {
  // Store
  storeGet: (key) => ipcRenderer.invoke('store/get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store/set', key, value),
  storeDelete: (key) => ipcRenderer.invoke('store/delete', key),
  storeExport: () => ipcRenderer.invoke('store/export'),
  onStoreChanged: (listener) => {
    if (typeof listener !== 'function') {
      return () => {};
    }

    const wrappedListener = (_event, payload) => {
      listener(payload);
    };
    ipcRenderer.on(STORE_DID_CHANGE_CHANNEL, wrappedListener);

    return () => {
      ipcRenderer.removeListener(STORE_DID_CHANGE_CHANNEL, wrappedListener);
    };
  },

  // Attachments
  attachments: {
    pick: () => ipcRenderer.invoke('attachments/pick'),
    verify: (filePath) => ipcRenderer.invoke('attachments/verify', filePath),
    embed: (filePath) => ipcRenderer.invoke('attachments/embed', filePath),
    reveal: (filePath) => ipcRenderer.invoke('attachments/reveal', filePath),
  },

  // Open external (validated in main)
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Task actions
  tasks: {
    exportPdf: (payload) => ipcRenderer.invoke('tasks/export-pdf', payload),
  },

  // MCP bridge (read-only, gated by mcpAgentAccessEnabled preference)
  mcp: {
    getCapabilities: () => ipcRenderer.invoke('mcp/get-capabilities'),
    getListenerStatus: () => ipcRenderer.invoke('mcp/get-listener-status'),
    getAuditLog: (options) => ipcRenderer.invoke('mcp/get-audit-log', options),
    getWorkspaceSnapshot: () => ipcRenderer.invoke('mcp/workspace/snapshot'),
    restartServer: () => ipcRenderer.invoke('mcp/restart-server'),
  },
});
