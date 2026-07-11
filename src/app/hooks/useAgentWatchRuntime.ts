import { useCallback, useEffect, useState } from 'react';
import type { McpReadService } from '../services/mcp/service.ts';
import type { McpBoardWatchResult } from '../services/mcp/types.ts';
import { sanitizeAgentWatchConfigs } from '../utils/workspaceSanitizers.ts';
import type { AgentWatchConfig } from '../utils/workspaceSanitizers.ts';
import type { StatusColumn } from '../types.ts';

export interface AgentWatchRuntimeState {
  personId: string;
  watcherId?: string;
  lastCheckedAt?: string;
  newTaskCount: number;
  updatedTaskCount: number;
  removedTaskCount: number;
  latestTaskTitles: string[];
  error?: string;
}

interface UseAgentWatchRuntimeOptions {
  mcpReadService: McpReadService;
  enabled: boolean;
  agentWatchConfigs: AgentWatchConfig[];
  setAgentWatchConfigs: React.Dispatch<React.SetStateAction<AgentWatchConfig[]>>;
  statusColumns?: StatusColumn[];
}

const EMPTY_STATUS_COLUMNS: StatusColumn[] = [];

export function getAgentWatchPollingInterval(agentWatchConfigs: AgentWatchConfig[]): number {
  const enabledConfigs = agentWatchConfigs.filter(config => config.enabled);
  if (enabledConfigs.length === 0) {
    return 0;
  }

  return Math.max(
    15000,
    ...enabledConfigs.map(config => Math.max(15, config.intervalSeconds) * 1000)
  );
}

export function useAgentWatchRuntime({
  mcpReadService,
  enabled,
  agentWatchConfigs,
  setAgentWatchConfigs,
  statusColumns = EMPTY_STATUS_COLUMNS,
}: UseAgentWatchRuntimeOptions) {
  const [agentWatchRuntime, setAgentWatchRuntime] = useState<Record<string, AgentWatchRuntimeState>>({});

  const pollAgentWatcher = useCallback(async (config: AgentWatchConfig) => {
    try {
      const watchedColumns = statusColumns.length > 0
        ? statusColumns.filter(column => column.aiWatchEnabled)
        : config.statusId ? [{ id: config.statusId }] : [];
      const results = await Promise.all(watchedColumns.map(column => mcpReadService.pollBoardWatcher({
        watcherId: statusColumns.length > 0 ? `agent:${config.personId}:column:${column.id}` : `agent:${config.personId}`,
        statusId: column.id,
        assigneeId: config.personId,
        projectId: config.projectId,
        search: config.search,
        persist: true,
      }) as Promise<McpBoardWatchResult>));
      const changes = results.reduce((all, result) => ({
        newTasks: [...all.newTasks, ...(result.changes?.newTasks || [])],
        updatedTasks: [...all.updatedTasks, ...(result.changes?.updatedTasks || [])],
        removedTaskIds: [...all.removedTaskIds, ...(result.changes?.removedTaskIds || [])],
      }), { newTasks: [], updatedTasks: [], removedTaskIds: [] } as NonNullable<McpBoardWatchResult['changes']>);
      const latestResult = results.at(-1);
      setAgentWatchRuntime(prev => ({
        ...prev,
        [config.personId]: {
          personId: config.personId,
          watcherId: latestResult?.watcherState?.watcherId,
          lastCheckedAt: latestResult?.watcherState?.lastProcessedAt || new Date().toISOString(),
          newTaskCount: Array.isArray(changes.newTasks) ? changes.newTasks.length : 0,
          updatedTaskCount: Array.isArray(changes.updatedTasks) ? changes.updatedTasks.length : 0,
          removedTaskCount: Array.isArray(changes.removedTaskIds) ? changes.removedTaskIds.length : 0,
          latestTaskTitles: [
            ...(Array.isArray(changes.newTasks) ? changes.newTasks : []),
            ...(Array.isArray(changes.updatedTasks) ? changes.updatedTasks : []),
          ]
            .map(task => String(task?.title || '').trim())
            .filter(Boolean)
            .slice(0, 4),
        },
      }));
      return latestResult ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAgentWatchRuntime(prev => ({
        ...prev,
        [config.personId]: {
          personId: config.personId,
          newTaskCount: 0,
          updatedTaskCount: 0,
          removedTaskCount: 0,
          latestTaskTitles: [],
          lastCheckedAt: new Date().toISOString(),
          error: message,
        },
      }));
      return null;
    }
  }, [mcpReadService, statusColumns]);

  const upsertAgentWatchConfig = useCallback((nextConfig: AgentWatchConfig) => {
    setAgentWatchConfigs(prev => {
      const sanitized = sanitizeAgentWatchConfigs([nextConfig], [])[0];
      if (!sanitized) return prev;
      const existingIndex = prev.findIndex(config => config.personId === sanitized.personId);
      if (existingIndex < 0) return [...prev, sanitized];
      const next = [...prev];
      next[existingIndex] = sanitized;
      return next;
    });
  }, [setAgentWatchConfigs]);

  const removeAgentWatchConfig = useCallback((personId: string) => {
    setAgentWatchConfigs(prev => prev.filter(config => config.personId !== personId));
    setAgentWatchRuntime(prev => {
      if (!prev[personId]) return prev;
      const next = { ...prev };
      delete next[personId];
      return next;
    });
  }, [setAgentWatchConfigs]);

  useEffect(() => {
    const enabledConfigs = agentWatchConfigs.filter(config => config.enabled);
    if (!enabled || enabledConfigs.length === 0) {
      return undefined;
    }

    let cancelled = false;
    const intervalMs = getAgentWatchPollingInterval(enabledConfigs);

    const run = async () => {
      for (const config of enabledConfigs) {
        if (cancelled) return;
        await pollAgentWatcher(config);
      }
    };

    void run();
    const timer = window.setInterval(() => {
      void run();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [agentWatchConfigs, enabled, pollAgentWatcher]);

  return {
    agentWatchRuntime,
    pollAgentWatcher,
    upsertAgentWatchConfig,
    removeAgentWatchConfig,
  };
}
