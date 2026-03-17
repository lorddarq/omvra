import { normalizeMcpServerAddress } from '../../constants/mcp';
import { McpClientConfig, McpReadToolName, McpResourceResponse, McpToolDescriptor } from './types';

const DEFAULT_TIMEOUT_MS = 4000;

interface JsonRpcSuccess<T> {
  jsonrpc?: '2.0';
  id?: string | number | null;
  result: T;
}

interface JsonRpcFailure {
  jsonrpc?: '2.0';
  id?: string | number | null;
  error: {
    code?: number;
    message: string;
    data?: unknown;
  };
}

type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcFailure;

export class McpClientDisabledError extends Error {
  constructor() {
    super('MCP access is disabled in preferences.');
    this.name = 'McpClientDisabledError';
  }
}

export class McpClient {
  private readonly config: McpClientConfig;

  constructor(config: McpClientConfig) {
    this.config = {
      ...config,
      endpoint: normalizeMcpServerAddress(config.endpoint),
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };
  }

  get endpoint(): string {
    return this.config.endpoint;
  }

  get enabled(): boolean {
    return this.config.enabled;
  }

  async listTools(): Promise<McpToolDescriptor[]> {
    if (typeof window !== 'undefined' && window.electron?.mcp?.getCapabilities) {
      const capabilities = await window.electron.mcp.getCapabilities();
      if (!capabilities?.ok) {
        throw new Error(capabilities?.error?.message || 'MCP capabilities unavailable');
      }

      const tools: McpToolDescriptor[] = [];
      if (capabilities.data?.capabilities?.workspaceSnapshot) {
        tools.push({
          name: 'workspace.get_snapshot',
          description: 'Returns a read-only workspace snapshot (tasks, people, projects, status columns).',
        });
      }
      return tools;
    }

    const result = await this.rpcCall<{ tools?: McpToolDescriptor[] }>('tools/list', {});
    return Array.isArray(result.tools) ? result.tools : [];
  }

  async readResource(uri: string): Promise<McpResourceResponse[]> {
    const result = await this.rpcCall<{ contents?: McpResourceResponse[] }>('resources/read', { uri });
    return Array.isArray(result.contents) ? result.contents : [];
  }

  async callReadTool<T = unknown>(name: McpReadToolName, args?: Record<string, unknown>): Promise<T> {
    if (typeof window !== 'undefined' && window.electron?.mcp?.getWorkspaceSnapshot) {
      if (name !== 'workspace.get_snapshot') {
        throw new Error(`Read tool "${name}" is not exposed by the current Electron MCP bridge yet.`);
      }

      const result = await window.electron.mcp.getWorkspaceSnapshot();
      if (!result?.ok) {
        throw new Error(result?.error?.message || 'Workspace snapshot unavailable');
      }
      return result.data as T;
    }

    const result = await this.rpcCall<{ content?: Array<{ text?: string }>; structuredContent?: unknown }>(
      'tools/call',
      {
        name,
        arguments: args ?? {},
      }
    );

    if (result.structuredContent !== undefined) {
      return result.structuredContent as T;
    }

    const firstText = result.content?.find(entry => typeof entry.text === 'string')?.text;
    if (typeof firstText === 'string' && firstText.trim()) {
      try {
        return JSON.parse(firstText) as T;
      } catch {
        return firstText as T;
      }
    }

    return {} as T;
  }

  // TODO(phase-2): add authenticated write-call pathways when token-based auth lands.
  private async rpcCall<T>(method: string, params?: unknown): Promise<T> {
    if (!this.config.enabled) {
      throw new McpClientDisabledError();
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `${Date.now()}`,
          method,
          params,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`MCP request failed (${response.status})`);
      }

      const payload = (await response.json()) as JsonRpcResponse<T>;
      if ('error' in payload) {
        throw new Error(payload.error.message || 'MCP request failed');
      }

      return payload.result;
    } finally {
      window.clearTimeout(timeout);
    }
  }
}
