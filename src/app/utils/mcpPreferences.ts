import {
  buildLocalMcpAddress,
  normalizeMcpServerAddress,
} from '../constants/mcp';
import { TaskStatus } from '../types';

export interface McpPreferencesShape {
  mcpAgentAccessEnabled: boolean;
  mcpCapabilityProfile: 'read_only' | 'task_write' | 'admin';
  mcpBindHost: string;
  mcpPort: number;
  mcpServerAddress: string;
  mcpAccessToken: string;
  mcpAccessTokenIssuedAt?: string;
  mcpAccessTokenTtlMinutes: number;
}

export function generateMcpAccessToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `mcp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getMcpSettingsSignature(preferences: McpPreferencesShape): string {
  return JSON.stringify({
    enabled: preferences.mcpAgentAccessEnabled,
    profile: preferences.mcpCapabilityProfile,
    bindHost: preferences.mcpBindHost,
    port: preferences.mcpPort,
    address: preferences.mcpServerAddress,
    token: preferences.mcpAccessToken,
    tokenIssuedAt: preferences.mcpAccessTokenIssuedAt,
    tokenTtlMinutes: preferences.mcpAccessTokenTtlMinutes,
  });
}

export function getDefaultStatusId(
  columns: Array<{ id: TaskStatus; title: string; color?: string }>,
  preferred: TaskStatus
): TaskStatus {
  const preferredCol = columns.find(col => col.id === preferred);
  if (preferredCol) return preferredCol.id;
  return columns[0]?.id || preferred;
}

export function syncLocalMcpServerAddress(
  previousPreferences: Pick<McpPreferencesShape, 'mcpBindHost' | 'mcpPort' | 'mcpServerAddress'>,
  nextHost: string,
  nextPort: number
): string {
  const previousLocalAddress = buildLocalMcpAddress(
    previousPreferences.mcpBindHost,
    previousPreferences.mcpPort
  );
  const nextLocalAddress = buildLocalMcpAddress(nextHost, nextPort);
  const previousAddress = normalizeMcpServerAddress(previousPreferences.mcpServerAddress);

  return previousAddress === previousLocalAddress
    ? nextLocalAddress
    : previousAddress;
}
