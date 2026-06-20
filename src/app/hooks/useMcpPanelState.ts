import { useCallback, useEffect, useState } from 'react';
import { generateMcpAccessToken, getMcpSettingsSignature } from '../utils/mcpPreferences.ts';
import type { McpPreferencesShape } from '../utils/mcpPreferences.ts';

export interface McpAuditSummaryEntry extends McpAuditEntry {
  auditId: string;
  timestamp: string;
}

interface UseMcpPanelStateOptions<TPreferences extends McpPreferencesShape> {
  preferences: TPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<TPreferences>>;
  runHealthCheck: () => Promise<unknown> | unknown;
}

export function useMcpPanelState<TPreferences extends McpPreferencesShape>({
  preferences,
  setPreferences,
  runHealthCheck,
}: UseMcpPanelStateOptions<TPreferences>) {
  const [appliedMcpSettingsSignature, setAppliedMcpSettingsSignature] = useState(() =>
    getMcpSettingsSignature(preferences)
  );
  const [mcpListenerStatus, setMcpListenerStatus] = useState<McpListenerStatus | null>(null);
  const [mcpAuditLog, setMcpAuditLog] = useState<McpAuditSummaryEntry[]>([]);

  const adoptAppliedSignatureFromListener = useCallback((listenerStatus: McpListenerStatus | null) => {
    if (!listenerStatus || !preferences.mcpAgentAccessEnabled) return;
    if (listenerStatus.status !== 'running' || !listenerStatus.listening) return;
    if (listenerStatus.restartRequired) return;
    if (listenerStatus.host !== preferences.mcpBindHost) return;
    if (listenerStatus.port !== preferences.mcpPort) return;
    if (listenerStatus.expectedAddress !== preferences.mcpServerAddress) return;
    if (listenerStatus.capabilityProfile !== preferences.mcpCapabilityProfile) return;

    const token = listenerStatus.token;
    const tokenMatches = preferences.mcpAccessToken
      ? Boolean(token?.configured)
        && token.issuedAt === (preferences.mcpAccessTokenIssuedAt || null)
        && token.ttlMinutes === preferences.mcpAccessTokenTtlMinutes
      : !token?.configured;
    if (!tokenMatches) return;

    setAppliedMcpSettingsSignature(getMcpSettingsSignature(preferences));
  }, [preferences]);

  const refreshMcpListenerStatus = useCallback(async () => {
    try {
      if (window.electron?.mcp?.getListenerStatus) {
        const result = await window.electron.mcp.getListenerStatus();
        if (result?.ok) {
          setMcpListenerStatus(result.data);
          adoptAppliedSignatureFromListener(result.data);
        }
      }
    } catch {
      // Keep the last known listener state if the bridge is temporarily unavailable.
    }
  }, [adoptAppliedSignatureFromListener]);

  const refreshMcpAuditLog = useCallback(async () => {
    try {
      if (window.electron?.mcp?.getAuditLog) {
        const result = await window.electron.mcp.getAuditLog({ limit: 25 });
        if (result?.ok && Array.isArray(result.data)) {
          setMcpAuditLog(
            result.data.filter(
              (entry): entry is McpAuditSummaryEntry =>
                Boolean(entry && typeof entry.auditId === 'string' && typeof entry.timestamp === 'string')
            )
          );
        }
      }
    } catch {
      // Keep the last known audit log if the bridge is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    if (!preferences.mcpAgentAccessEnabled) return;

    let cancelled = false;
    const refreshStatus = async () => {
      if (cancelled) return;
      await refreshMcpListenerStatus();
    };

    void refreshStatus();

    if (mcpListenerStatus?.status !== 'starting') {
      return () => {
        cancelled = true;
      };
    }

    const intervalId = window.setInterval(() => {
      void refreshStatus();
    }, 750);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [mcpListenerStatus?.status, preferences.mcpAgentAccessEnabled, refreshMcpListenerStatus]);

  useEffect(() => {
    adoptAppliedSignatureFromListener(mcpListenerStatus);
  }, [adoptAppliedSignatureFromListener, mcpListenerStatus]);

  const handleRestartMcpServer = useCallback(async () => {
    try {
      if (window.electron?.mcp?.restartServer) {
        const result = await window.electron.mcp.restartServer();
        if (!result?.success) {
          window.alert(`Could not restart MCP server: ${result?.error || 'Unknown error'}`);
          return;
        }
        if (result.listenerStatus) {
          setMcpListenerStatus(result.listenerStatus);
        } else {
          void refreshMcpListenerStatus();
        }
        void refreshMcpAuditLog();
        setAppliedMcpSettingsSignature(getMcpSettingsSignature(preferences));
        await Promise.resolve(runHealthCheck());
      }
    } catch {
      window.alert('Could not restart MCP server.');
    }
  }, [preferences, refreshMcpAuditLog, refreshMcpListenerStatus, runHealthCheck]);

  const handleRotateMcpAccessToken = useCallback(() => {
    setPreferences(prev => ({
      ...prev,
      mcpAccessToken: generateMcpAccessToken(),
      mcpAccessTokenIssuedAt: new Date().toISOString(),
    }));
  }, [setPreferences]);

  return {
    appliedMcpSettingsSignature,
    mcpListenerStatus,
    mcpAuditLog,
    refreshMcpListenerStatus,
    refreshMcpAuditLog,
    handleRestartMcpServer,
    handleRotateMcpAccessToken,
    isMcpRestartPending: getMcpSettingsSignature(preferences) !== appliedMcpSettingsSignature,
  };
}
