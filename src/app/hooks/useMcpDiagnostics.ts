import { useEffect } from 'react';
import { createMcpReadService } from '../services/mcp/service';

interface UseMcpDiagnosticsOptions {
  enabled: boolean;
  endpoint: string;
}

export function useMcpDiagnostics({ enabled, endpoint }: UseMcpDiagnosticsOptions) {
  useEffect(() => {
    const isLocalDevHost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (!isLocalDevHost) return;

    let cancelled = false;

    const run = async () => {
      const mcp = createMcpReadService({
        enabled,
        endpoint,
      });

      const result = await mcp.diagnostics();
      if (cancelled) return;

      if (result.ok) {
        console.info(
          `[MCP diagnostics] connected endpoint=${result.endpoint} latency=${result.latencyMs}ms tools=${result.toolCount}`
        );
        return;
      }

      if (result.error === 'disabled') {
        console.info('[MCP diagnostics] skipped (agent MCP access disabled)');
        return;
      }

      console.warn(
        `[MCP diagnostics] unavailable endpoint=${result.endpoint} reason=${result.error || 'unknown'}`
      );
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [enabled, endpoint]);
}
