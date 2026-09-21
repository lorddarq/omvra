import type React from 'react';
import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { FeatheredScrollList } from '../FeatheredScrollList';
import { cn } from '../ui/utils';
import { getMcpStatusSummary, getRecentMcpActivitySignal, type AgentStatusTone } from '../../utils/statusBar';
import type { Person, Task } from '../../types';
import { FiltersIcon } from '../SettingsPanel';
import { useAgentSessionSupervisor } from '../AgentSessionSupervisor';
import { getAttentionState, getSessionAttentionState } from '../../utils/attention';
import { ChevronUp, ChevronRight, CircleCheck, CircleAlert, Circle, Hourglass, LoaderCircle, TriangleAlert } from 'lucide-react';
import { agentRuntimeTurnState, type AgentRuntimeTurnProjection } from '../../utils/agentRuntimeActivity';

export interface AppStatusBarProps {
  tasks: Task[];
  people: Person[];
  mcpAuditLog: McpAuditEntry[];
  mcpAgentAccessEnabled: boolean;
  mcpListenerStatus: McpListenerStatus | null;
  mcpRestartPending: boolean;
}

export function AppStatusBar({
  tasks,
  people,
  mcpAuditLog,
  mcpAgentAccessEnabled,
  mcpListenerStatus,
  mcpRestartPending,
}: AppStatusBarProps) {
  const { sessionDock, openSession } = useAgentSessionSupervisor();
  const mcp = getMcpStatusSummary({ mcpAgentAccessEnabled, mcpListenerStatus, mcpRestartPending });
  const recentMcpActivity = getRecentMcpActivitySignal({ mcpAuditLog, tasks });
  const mcpValue = getMcpBadgeValue(mcp.label);

  return (
    <div
      className="flex min-h-8 items-center gap-3 border-t border-black/5 bg-gray-50 pl-4 pr-2 py-2 text-xs text-gray-600"
      aria-label={`Agent tasks status: ${getSessionDockLabel(sessionDock)}. ${mcp.label}.`}
    >
      <StatusPill
        icon={<FiltersIcon className="size-3.5" aria-hidden="true" />}
        label="MCP:"
        value={mcpValue}
        tone={mcp.tone}
        title={recentMcpActivity.title ? `${mcp.label} • ${recentMcpActivity.title}` : mcp.label}
      />
      <div className="ml-auto min-w-0">
        <SessionDockStatus sessionDock={sessionDock} onOpen={openSession} />
      </div>
    </div>
  );
}

function SessionDockStatus({ sessionDock, onOpen }: { sessionDock: ReturnType<typeof useAgentSessionSupervisor>['sessionDock']; onOpen: ReturnType<typeof useAgentSessionSupervisor>['openSession'] }) {
  const [expanded, setExpanded] = useState(false);
  const label = getSessionDockLabel(sessionDock);
  const detail = sessionDock.task?.title
    ? sessionDock.task.title
    : (sessionDock.historyCount > 0 ? `${sessionDock.historyCount} session${sessionDock.historyCount === 1 ? '' : 's'} in history` : 'No session selected');
  const buttonLabel = sessionDock.binding && sessionDock.task ? `Open supervision: ${label} for ${sessionDock.task.title}` : undefined;
  const hasSessions = sessionDock.items.length > 0;
  const attention = sessionDock.state === 'blocked'
    ? getAttentionState('blocked')
    : getRequestAwareAttention(sessionDock.binding, sessionDock.task, sessionDock.pendingRequest) || null;
  const accessibleLabel = `${buttonLabel || `Agent tasks status: ${label}`}. ${attention ? `${attention.description} Next action: ${attention.nextStep}` : 'No attention action is pending.'}`;
  const statusLabel = attention?.kind === 'active' ? 'Working' : attention?.label || label;
  const StatusIcon = getStatusIcon(attention);
  return (
    <Popover open={expanded && hasSessions} onOpenChange={setExpanded}>
      <PopoverTrigger asChild>
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={accessibleLabel}
        title={`${detail}. ${label}`}
        className="group flex min-h-8 min-w-0 max-w-[calc(100vw-8rem)] items-center gap-2 rounded-lg bg-[#f0f2f5] px-2 py-1 text-left text-zinc-500 transition-colors hover:bg-gray-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
      >
        <span className={`flex size-4 shrink-0 items-center justify-center rounded-full ${sessionDock.state === 'working' || sessionDock.state === 'hidden-active' || sessionDock.state === 'ready' ? 'bg-emerald-500/10 text-emerald-500' : sessionDock.state === 'needs-input' ? 'bg-amber-500/10 text-amber-500' : sessionDock.state === 'failed' ? 'bg-red-500/10 text-red-500' : 'bg-slate-400/10 text-slate-400'}`} aria-hidden="true">
          <span className="size-2 rounded-full bg-current" />
        </span>
        <span className="whitespace-nowrap text-sm font-medium tracking-[-0.14px]">Agent tasks:</span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
          <StatusIcon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span className="truncate">{statusLabel}</span>
        </span>
        {hasSessions && <ChevronUp className={`size-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} strokeWidth={1.5} aria-hidden="true" />}

      </button>

      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={8} aria-label="Agent tasks" className="relative w-[min(381px,calc(100vw-2rem))] overflow-hidden rounded-xl border-black/10 bg-white p-0 shadow-[0_0_1px_1px_rgba(0,0,0,0.1),0_4px_12px_rgba(0,0,0,0.04)]">
        <div className="pointer-events-none absolute -left-[200px] top-1/2 size-[220px] -translate-y-1/2 rounded-full bg-[#e5d9cf] blur-[100px]" aria-hidden="true" />
        <div className="relative flex items-center justify-between px-5 pb-4 pt-6">
          <span className="text-sm font-medium tracking-[-0.14px] text-zinc-500">Agent tasks</span>
          <button type="button" onClick={() => setExpanded(false)} className="rounded text-xs font-medium text-[#1a60cb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Close</button>
        </div>
        <FeatheredScrollList scrollClassName="max-h-[min(372px,calc(var(--radix-popover-content-available-height)-65px))] pb-4">
          <div>
            {sessionDock.items.map(({ binding, task, pendingRequest }) => {
              const state = getRequestAwareAttention(binding, task, pendingRequest);
              const Icon = getStatusIcon(state);
              const title = task?.title || 'Untitled task';
              return (
                <button key={binding.id} type="button" onClick={() => { setExpanded(false); onOpen(binding); }}
                  aria-label={`${title}. ${state?.label || 'Session status unavailable'}. Open supervision`}
                  title={`${title}. ${state?.description || 'Session status unavailable'}`}
                  className="relative flex min-h-[46px] w-full items-center gap-3 py-3.5 pl-5 pr-3.5 text-left hover:bg-black/5 focus-visible:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
                  <Icon className={`size-4 shrink-0 ${state?.tone === 'danger' ? 'text-red-500' : state?.tone === 'warning' && state.kind !== 'batch-finished' ? 'text-amber-500' : 'text-slate-500'}`} strokeWidth={1.25} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-600">{title}</span>
                  <ChevronRight className="size-[18px] shrink-0 text-neutral-400" strokeWidth={1.25} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </FeatheredScrollList>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[30px] bg-gradient-to-t from-white to-transparent" aria-hidden="true" />
      </PopoverContent>
    </Popover>
  );
}

function getStatusIcon(attention: ReturnType<typeof getRequestAwareAttention> | null) {
  return attention?.kind === 'active' || attention?.kind === 'starting' ? LoaderCircle
    : attention?.kind === 'needs-input' ? Hourglass
      : attention?.tone === 'danger' ? CircleAlert
        : attention?.kind === 'complete' || attention?.kind === 'batch-finished' ? CircleCheck
          : attention?.tone === 'warning' ? TriangleAlert : Circle;
}

function getRequestAwareAttention(binding?: { state: string; turn?: AgentRuntimeTurnProjection; taskExecution?: { state?: string } }, task?: Task, pendingRequest?: { message: string }) {
  const attention = getSessionAttentionState({ bindingState: binding?.state, turnState: agentRuntimeTurnState(binding), executionState: binding?.taskExecution?.state, taskStatus: task?.status });
  if (attention?.kind !== 'needs-input') return attention;
  if (pendingRequest) return { ...attention, description: pendingRequest.message };
  return { ...getAttentionState('interrupted'), label: 'Input request unavailable', description: 'The session says it needs input, but Omvra has no answerable request.', nextStep: 'Open supervision to reconnect or replace the stale session.' };
}

function getSessionDockLabel(sessionDock: ReturnType<typeof useAgentSessionSupervisor>['sessionDock']): string {
  if (sessionDock.state === 'none') return 'No active work';
  if (sessionDock.state === 'blocked') return `${getAttentionState('blocked').label} · Another session is active`;
  const attention = getRequestAwareAttention(sessionDock.binding, sessionDock.task, sessionDock.pendingRequest);
  if (!attention) return 'Session status unavailable';
  if (attention.kind === 'active') return `${attention.label} · Open to monitor`;
  if (attention.kind === 'needs-input') return `${attention.label} · Review request`;
  if (attention.kind === 'failed') return `${attention.label} · Review needed`;
  if (['review', 'outcome-review'].includes(attention.kind)) return `${attention.label} · Review task`;
  if (attention.kind === 'interrupted') return `${attention.label} · Resume available`;
  if (['batch-finished', 'ready', 'closed'].includes(attention.kind)) return `${attention.label} · Continue available`;
  return attention.label;
}

function getMcpBadgeValue(label: string): string {
  const state = label.replace(/^MCP\s+/i, '').toUpperCase();
  return state === 'OFFLINE' ? 'OFF' : state;
}

interface StatusPillProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: AgentStatusTone;
  title?: string;
}

function StatusPill({
  icon,
  label,
  value,
  tone = 'muted',
  title,
}: StatusPillProps) {
  const ledColor = tone === 'success'
    ? '#2ea147'
    : tone === 'warning'
      ? '#f59e0b'
      : tone === 'danger'
        ? '#da0004'
        : tone === 'unknown'
          ? '#94a3b8'
          : '#d1d5db';

  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1" title={title}>
      <span className="shrink-0 text-gray-500">{icon}</span>
      <span className="whitespace-nowrap text-center text-xs font-medium text-[#828282]">{label}</span>
      <span className="flex min-h-[17px] shrink-0 items-center justify-center gap-1 rounded-full border border-black/10 px-1.5 py-0.5">
        <span className="relative flex size-2 shrink-0 items-center justify-center" aria-hidden="true">
          <span
            className={cn(
              'relative size-2 rounded-full',
              tone === 'success' && 'bg-[#2ea147]',
              tone === 'warning' && 'bg-amber-500',
              tone === 'danger' && 'bg-[#da0004]',
              tone === 'unknown' && 'bg-slate-400',
              tone === 'muted' && 'bg-gray-300'
            )}
            style={{ backgroundColor: ledColor }}
          />
        </span>
        <span className="whitespace-nowrap text-[11px] font-semibold leading-none text-[#a8a8a8]">{value}</span>
      </span>
    </div>
  );
}

interface StateBadgeProps {
  label: string;
  value: string;
  tone: AgentStatusTone;
  title?: string;
}

export function StateBadge({ label, value, tone, title }: StateBadgeProps) {
  return (
    <span
      className="flex min-h-[17px] shrink-0 items-center justify-center gap-1 rounded-full border border-black/10 px-1.5 py-0.5"
      title={title}
    >
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
      <span className="whitespace-nowrap text-[11px] font-medium leading-none text-[#8b8b93]">
        {label} {value}
      </span>
    </span>
  );
}

interface ProvenanceBadgeProps {
  label: string;
  value: string;
  dotColor: string;
  backgroundColor: string;
  textColor: string;
  title?: string;
}

function ProvenanceBadge({
  label,
  value,
  dotColor,
  backgroundColor,
  textColor,
  title,
}: ProvenanceBadgeProps) {
  return (
    <span
      className="flex min-h-[17px] shrink-0 items-center justify-center gap-1 rounded-full border border-black/5 px-1.5 py-0.5"
      style={{ backgroundColor, color: textColor }}
      title={title}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} aria-hidden="true" />
      <span className="whitespace-nowrap text-[11px] font-medium leading-none">
        {label} {value}
      </span>
    </span>
  );
}
