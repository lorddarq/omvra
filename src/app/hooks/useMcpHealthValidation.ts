import { useCallback, useMemo, useState } from 'react';
import { createMcpReadService } from '../services/mcp/service';
import { McpHealthCheckResult, McpSnapshotExpectation } from '../services/mcp/types';

interface UseMcpHealthValidationOptions {
  enabled: boolean;
  endpoint: string;
  headers?: Record<string, string>;
  expectation: McpSnapshotExpectation;
}

export function useMcpHealthValidation({
  enabled,
  endpoint,
  headers,
  expectation,
}: UseMcpHealthValidationOptions) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<McpHealthCheckResult | null>(null);

  const isDevEnvironment = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }, []);

  const runHealthCheck = useCallback(async () => {
    setIsRunning(true);
    try {
      const service = createMcpReadService({
        enabled,
        endpoint,
        headers,
      });
      const nextResult = await service.validateHealth(expectation);
      setResult(nextResult);
      return nextResult;
    } finally {
      setIsRunning(false);
    }
  }, [enabled, endpoint, headers, expectation]);

  return {
    isDevEnvironment,
    isRunning,
    result,
    runHealthCheck,
  };
}
