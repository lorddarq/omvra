import { Bot, Server } from 'lucide-react';
import type React from 'react';
import type { Person } from '../types';
import type { AgentWatchConfig } from '../utils/workspaceSanitizers';
import type { AgentWatchRuntimeState } from '../hooks/useAgentWatchRuntime';
import { cn } from './ui/utils';

interface AppStatusBarProps {
  people: Person[];
  agentWatchConfigs: AgentWatchConfig[];
  agentWatchRuntime: Record<string, AgentWatchRuntimeState>;
  mcpAgentAccessEnabled: boolean;
  mcpListenerStatus: McpListenerStatus | null;
  mcpRestartPending: boolean;
}

function getAgentAvailabilitySummary({
  people,
  agentWatchConfigs,
  agentWatchRuntime,
}: Pick<AppStatusBarProps, 'people' | 'agentWatchConfigs' | 'agentWatchRuntime'>) {
  const agentIds = new Set(people.filter(person => person.kind === 'agentic').map(person => person.id));
  const activeAgentIds = new Set(
    agentWatchConfigs
      .filter(config => config.enabled && agentIds.has(config.personId) && !agentWatchRuntime[config.personId]?.error)
      .map(config => config.personId)
  );

  return {
    active: activeAgentIds.size,
    inactive: Math.max(0, agentIds.size - activeAgentIds.size),
    total: agentIds.size,
  };
}

function getMcpStatusSummary({
  mcpAgentAccessEnabled,
  mcpListenerStatus,
  mcpRestartPending,
}: Pick<AppStatusBarProps, 'mcpAgentAccessEnabled' | 'mcpListenerStatus' | 'mcpRestartPending'>) {
  if (!mcpAgentAccessEnabled) {
    return {
      label: 'MCP offline',
      tone: 'muted' as const,
    };
  }

  if (mcpRestartPending || mcpListenerStatus?.restartRequired) {
    return {
      label: 'MCP restart needed',
      tone: 'warning' as const,
    };
  }

  if (!mcpListenerStatus) {
    return {
      label: 'MCP unknown',
      tone: 'unknown' as const,
    };
  }

  if (mcpListenerStatus.status === 'running' && mcpListenerStatus.listening) {
    return {
      label: 'MCP running',
      tone: 'success' as const,
    };
  }

  if (mcpListenerStatus.status === 'starting') {
    return {
      label: 'MCP starting',
      tone: 'unknown' as const,
    };
  }

  if (mcpListenerStatus.status === 'error') {
    return {
      label: 'MCP error',
      tone: 'danger' as const,
    };
  }

  return {
    label: 'MCP offline',
    tone: 'muted' as const,
  };
}

export function AppStatusBar({
  people,
  agentWatchConfigs,
  agentWatchRuntime,
  mcpAgentAccessEnabled,
  mcpListenerStatus,
  mcpRestartPending,
}: AppStatusBarProps) {
  const agents = getAgentAvailabilitySummary({ people, agentWatchConfigs, agentWatchRuntime });
  const mcp = getMcpStatusSummary({ mcpAgentAccessEnabled, mcpListenerStatus, mcpRestartPending });
  const mcpValue = getMcpBadgeValue(mcp.label);

  return (
    <div
      className="flex h-8 items-center gap-6 border-t border-black/5 bg-gray-50 px-4 py-2 text-xs text-gray-600"
      aria-label={`Agent status: ${agents.active} active, ${agents.inactive} inactive. ${mcp.label}.`}
    >
      <StatusPill
        icon={<Bot className="size-3.5" aria-hidden="true" />}
        label="Running Agents:"
        value={String(agents.active)}
        tone={agents.active > 0 ? 'success' : 'muted'}
        title={`${agents.active} active, ${agents.inactive} inactive`}
      />
      <StatusPill
        icon={<Server className="size-3.5" aria-hidden="true" />}
        label="MCP:"
        value={mcpValue}
        tone={mcp.tone}
        title={mcp.label}
      />
    </div>
  );
}

function getMcpBadgeValue(label: string): string {
  const state = label.replace(/^MCP\s+/i, '').toUpperCase();
  return state === 'OFFLINE' ? 'OFF' : state;
}

interface StatusPillProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'success' | 'warning' | 'danger' | 'unknown' | 'muted';
  title?: string;
}

function StatusPill({ icon, label, value, tone = 'muted', title }: StatusPillProps) {
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1" title={title}>
      <span className="shrink-0 text-gray-500">{icon}</span>
      <span className="whitespace-nowrap text-center text-xs font-medium text-[#828282]">{label}</span>
      <span className="flex min-h-[17px] shrink-0 items-center justify-center gap-1 rounded-full border border-black/10 px-1.5 py-0.5">
        <span
          className={cn(
            'size-2 shrink-0 rounded-full',
            tone === 'success' && 'bg-[#2ea147]',
            tone === 'warning' && 'bg-amber-500',
            tone === 'danger' && 'bg-[#da0004]',
            tone === 'unknown' && 'bg-slate-400',
            tone === 'muted' && 'bg-gray-300'
          )}
          aria-hidden="true"
        />
        <span className="whitespace-nowrap text-[11px] font-semibold leading-none text-[#a8a8a8]">{value}</span>
      </span>
    </div>
  );
}
