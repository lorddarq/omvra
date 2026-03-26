export const DEFAULT_MCP_BIND_HOST = '127.0.0.1';
export const DEFAULT_MCP_PORT = 3456;
export const DEFAULT_MCP_SERVER_ADDRESS = 'http://127.0.0.1:3456/mcp';
export const MCP_PROTOCOL_VERSION = '2024-11-05';

export function normalizeMcpServerAddress(address?: string): string {
  const trimmed = address?.trim();
  return trimmed || DEFAULT_MCP_SERVER_ADDRESS;
}

export function normalizeMcpBindHost(host?: string): string {
  const trimmed = host?.trim();
  return trimmed || DEFAULT_MCP_BIND_HOST;
}

export function normalizeMcpPort(port?: number): number {
  if (!Number.isFinite(port)) return DEFAULT_MCP_PORT;
  const normalized = Math.floor(Number(port));
  if (normalized < 1 || normalized > 65535) return DEFAULT_MCP_PORT;
  return normalized;
}

export function buildLocalMcpAddress(host?: string, port?: number): string {
  return `http://${normalizeMcpBindHost(host)}:${normalizeMcpPort(port)}/mcp`;
}
