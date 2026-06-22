import type { ReactNode } from 'react';
import type { Person, StatusColumn } from '../types';
import type { AgentWatchConfig, AgentWatchAction } from '../utils/workspaceSanitizers';
import type { AgentWatchRuntimeState } from '../hooks/useAgentWatchRuntime';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';

interface AgentBoardWatchSettingsProps {
  agent: Person;
  agents: Person[];
  selectedAgentId: string;
  onAgentChange: (personId: string) => void;
  statusColumns: StatusColumn[];
  watchConfig: AgentWatchConfig;
  watchRuntime?: AgentWatchRuntimeState;
  onSave: (config: AgentWatchConfig) => void;
  onRemove: (personId: string) => void;
  onPoll: (personId: string) => void;
}

export function AgentBoardWatchSettings({
  agent,
  agents,
  selectedAgentId,
  onAgentChange,
  statusColumns,
  watchConfig,
  watchRuntime,
  onSave,
  onRemove,
  onPoll,
}: AgentBoardWatchSettingsProps) {
  return (
    <div className="space-y-3">
      <FieldBlock label="Agent">
        <Select value={selectedAgentId} onValueChange={onAgentChange}>
          <SelectTrigger className={watchSelectClassName}>
            <SelectValue placeholder="Select agent" />
          </SelectTrigger>
          <SelectContent>
            {agents.map(item => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldBlock>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <FieldBlock label="Watched Board">
          <Select
            value={watchConfig.statusId}
            onValueChange={(value) =>
              onSave({
                ...watchConfig,
                personId: agent.id,
                statusId: value,
              })
            }
          >
            <SelectTrigger className={watchSelectClassName}>
              <SelectValue placeholder="Select board" />
            </SelectTrigger>
            <SelectContent>
              {statusColumns.map(col => (
                <SelectItem key={col.id} value={col.id}>
                  {col.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldBlock>
        <FieldBlock label="Action">
          <Select
            value={watchConfig.action}
            onValueChange={(value) =>
              onSave({
                ...watchConfig,
                personId: agent.id,
                action: value as AgentWatchAction,
              })
            }
          >
            <SelectTrigger className={watchSelectClassName}>
              <SelectValue placeholder="Select action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inspect_only">Inspect only</SelectItem>
              <SelectItem value="inspect_and_work">Inspect and work</SelectItem>
              <SelectItem value="move_to_ready_for_human_review">Ready for human review</SelectItem>
            </SelectContent>
          </Select>
        </FieldBlock>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <FieldBlock label="Project filter">
          <Input
            value={watchConfig.projectId || ''}
            onChange={(e) =>
              onSave({
                ...watchConfig,
                personId: agent.id,
                projectId: e.target.value.trim() || undefined,
              })
            }
            placeholder="Project Name"
            className={watchInputClassName}
          />
        </FieldBlock>
        <FieldBlock label="Poll interval">
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={15}
              max={3600}
              value={watchConfig.intervalSeconds}
              onChange={(e) =>
                onSave({
                  ...watchConfig,
                  personId: agent.id,
                  intervalSeconds: Math.max(15, Math.min(3600, Number(e.target.value) || 60)),
                })
              }
              className={`${watchInputClassName} w-20 flex-none`}
            />
            <span className="text-xs font-medium leading-5 text-[#71717a]">Sec</span>
          </div>
        </FieldBlock>
      </div>

      <FieldBlock label="Search filter">
        <Input
          value={watchConfig.search || ''}
          onChange={(e) =>
            onSave({
              ...watchConfig,
              personId: agent.id,
              search: e.target.value.trim() || undefined,
            })
          }
          placeholder="Keyword"
          className={watchInputClassName}
        />
      </FieldBlock>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold leading-5 text-[#71717a]">Watching</div>
          <Switch
            checked={watchConfig.enabled}
            aria-label={`Toggle watcher for ${agent.name}`}
            onCheckedChange={(enabled) =>
              onSave({
                ...watchConfig,
                personId: agent.id,
                enabled,
              })
            }
          />
        </div>
        <p className="text-xs leading-4 text-[#6a7282]">Enables global kanban board monitoring by agents</p>
      </div>

      <div className="rounded-xl bg-[#f4f4f5] px-3 py-2 text-xs leading-4 text-[#6a7282]">
        <p>Last checked: {formatWatchTime(watchRuntime?.lastCheckedAt)}</p>
        <p>
          Changes: {watchRuntime?.newTaskCount || 0} new, {watchRuntime?.updatedTaskCount || 0} updated,
          {` ${watchRuntime?.removedTaskCount || 0} removed`}
        </p>
        {watchRuntime?.latestTaskTitles?.length ? (
          <p>Latest tasks: {watchRuntime.latestTaskTitles.join(', ')}</p>
        ) : (
          <p>No recent watcher matches.</p>
        )}
        {watchRuntime?.error && (
          <p className="text-amber-700">Watcher error: {watchRuntime.error}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onPoll(agent.id)}
          className="inline-flex h-8 items-center rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-[#67676f] outline-none hover:bg-[#71717a]/5 focus-visible:ring-2 focus-visible:ring-gray-300"
        >
          Poll now
        </button>
        <button
          type="button"
          onClick={() => onRemove(agent.id)}
          className="inline-flex h-8 items-center rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-[#67676f] outline-none hover:bg-[#71717a]/5 focus-visible:ring-2 focus-visible:ring-gray-300"
        >
          Reset watcher
        </button>
      </div>

      <div className="sr-only">
        <div>
          <div>{describeAgentAction(watchConfig.action)}</div>
        </div>
      </div>
    </div>
  );
}

const watchSelectClassName = 'h-8 rounded-xl border-0 bg-white px-2 text-sm font-medium text-[#67676f] shadow-[0_0_1px_rgba(0,0,0,0.06),0_1px_1px_rgba(0,0,0,0.06),0_2px_2px_rgba(0,0,0,0.04)] focus-visible:ring-gray-300';
const watchInputClassName = 'h-8 rounded-xl border-black/10 bg-white/10 px-2 text-sm font-medium text-[#67676f] shadow-none placeholder:text-[#b0b0b5] focus-visible:ring-gray-300';

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="text-xs font-medium leading-5 text-[#71717a]">{label}</div>
      {children}
    </div>
  );
}

function formatWatchTime(value?: string) {
  if (!value) return 'Not checked yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function describeAgentAction(action: AgentWatchAction) {
  if (action === 'inspect_only') return 'Inspect only';
  if (action === 'move_to_ready_for_human_review') return 'Move done tasks to Ready for human review';
  return 'Inspect and work the task';
}
