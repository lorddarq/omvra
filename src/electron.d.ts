// Asset module declarations for Vite
declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

export {};

declare global {
  interface McpBridgeError {
    code: string;
    message: string;
  }

  interface McpCapabilities {
    enabled: boolean;
    readOnly: boolean;
    protocolVersion?: string;
    serverInfo?: {
      name: string;
      version: string;
    };
    capabilityProfile?: 'read_only' | 'task_write' | 'admin';
    capabilityProfiles?: Array<'read_only' | 'task_write' | 'admin'>;
    transportModes?: Array<'http' | 'stdio'>;
    capabilities: {
      workspaceSnapshot: boolean;
      resourcesRead?: boolean;
      writeTools?: boolean;
      initialize?: boolean;
    };
    writeBoundary?: {
      enforced: boolean;
      writeToolsEnabled: boolean;
      exposedWriteTools: string[];
    };
  }

  interface McpWorkspaceSnapshot {
    schemaVersion: string;
    generatedAt: string;
    readOnly: boolean;
    workspace: {
      tasks: any[];
      people: any[];
      projects: any[];
      swimlanes: any[];
      statusColumns: any[];
    };
    meta: {
      source: string;
      mcpAgentAccessEnabled: boolean;
      counts: {
        tasks: number;
        people: number;
        projects: number;
        statusColumns: number;
      };
    };
  }

  interface McpBridgeResult<T> {
    ok: boolean;
    data?: T;
    error?: McpBridgeError;
  }

  interface McpTokenStatus {
    configured: boolean;
    status: 'none' | 'active' | 'expired' | 'invalid-issued-at';
    expired: boolean;
    issuedAt: string | null;
    expiresAt: string | null;
    remainingMinutes: number | null;
    ttlMinutes: number;
  }

  interface McpListenerStatus {
    enabled: boolean;
    status: 'disabled' | 'starting' | 'running' | 'stopped' | 'error';
    listening: boolean;
    host: string;
    port: number;
    path: string;
    expectedAddress: string;
    boundAddress: string | null;
    boundUrl: string | null;
    capabilityProfile: 'read_only' | 'task_write' | 'admin';
    authMode: 'none' | 'token';
    token: McpTokenStatus;
    error: string | null;
    lastStartedAt: string | null;
    lastStoppedAt: string | null;
    lastUpdatedAt: string | null;
    restartRequired: boolean;
  }

  interface McpAuditEntry {
    auditId: string;
    timestamp: string;
    type?: string;
    outcome?: string;
    reason?: string;
    toolName?: string;
    taskId?: string;
    nextRevision?: number;
    targetStatusId?: string;
    targetStatusTitle?: string;
    assigneeId?: string;
    assigneeName?: string;
    method?: string;
    origin?: string;
    transport?: string;
    remoteAddress?: string;
    capabilityProfile?: string;
    [key: string]: unknown;
  }

  interface Window {
    electron: {
      storeGet: (key: string) => Promise<any>;
      storeSet: (key: string, value: any) => Promise<void>;
      storeDelete: (key: string) => Promise<void>;
      storeExport: () => Promise<Record<string, any>>;
      onStoreChanged: (listener: (payload: { updatedAt: string }) => void) => () => void;
      attachments: {
        pick: () => Promise<string[]>;
        verify: (path: string) => Promise<any>;
        embed: (path: string) => Promise<any>;
      };
      openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
      mcp: {
        getCapabilities: () => Promise<McpBridgeResult<McpCapabilities>>;
        getListenerStatus: () => Promise<McpBridgeResult<McpListenerStatus>>;
        getAuditLog: (options?: { limit?: number }) => Promise<McpBridgeResult<McpAuditEntry[]>>;
        getWorkspaceSnapshot: () => Promise<McpBridgeResult<McpWorkspaceSnapshot>>;
        restartServer: () => Promise<{ success: boolean; error?: string; listenerStatus?: McpListenerStatus }>;
      };
    };
  }
}
