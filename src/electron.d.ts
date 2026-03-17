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
    capabilityProfile?: 'read_only' | 'task_write' | 'admin';
    capabilityProfiles?: Array<'read_only' | 'task_write' | 'admin'>;
    capabilities: {
      workspaceSnapshot: boolean;
      resourcesRead?: boolean;
      writeTools?: boolean;
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

  interface Window {
    electron: {
      storeGet: (key: string) => Promise<any>;
      storeSet: (key: string, value: any) => Promise<void>;
      storeExport: () => Promise<Record<string, any>>;
      attachments: {
        pick: () => Promise<string[]>;
        verify: (path: string) => Promise<any>;
        embed: (path: string) => Promise<any>;
      };
      openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
      mcp: {
        getCapabilities: () => Promise<McpBridgeResult<McpCapabilities>>;
        getWorkspaceSnapshot: () => Promise<McpBridgeResult<McpWorkspaceSnapshot>>;
        restartServer: () => Promise<{ success: boolean; error?: string }>;
      };
    };
  }
}
