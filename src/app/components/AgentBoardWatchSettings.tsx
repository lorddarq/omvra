import type { Person, StatusColumn } from '../types';
import type { AgentWatchConfig, AgentWatchAction } from '../utils/workspaceSanitizers';
import type { AgentWatchRuntimeState } from '../hooks/useAgentWatchRuntime';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface AgentBoardWatchSettingsProps {
  agent: Person;
  statusColumns: StatusColumn[];
  watchConfig: AgentWatchConfig;
  watchRuntime?: AgentWatchRuntimeState;
  onSave: (config: AgentWatchConfig) => void;
  onRemove: (personId: string) => void;
  onPoll: (personId: string) => void;
}

export function AgentBoardWatchSettings({
  agent,
  statusColumns,
  watchConfig,
  watchRuntime,
  onSave,
  onRemove,
  onPoll,
}: AgentBoardWatchSettingsProps) {
  return (
    <div className="rounded-lg border bg-gray-50 p-3 space-y-3">
      <div>
        <div className="text-sm font-semibold text-gray-900">{agent.name}</div>
        <p className="text-xs text-gray-500">
          Configure which board this agent monitors for newly assigned tasks.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Watched board</Label>
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
            <SelectTrigger className="h-9">
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
        </div>
        <div className="space-y-2">
          <Label>Action</Label>
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
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inspect_only">Inspect only</SelectItem>
              <SelectItem value="inspect_and_work">Inspect and work</SelectItem>
              <SelectItem value="move_to_ready_for_human_review">Ready for human review</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Project filter</Label>
          <Input
            value={watchConfig.projectId || ''}
            onChange={(e) =>
              onSave({
                ...watchConfig,
                personId: agent.id,
                projectId: e.target.value.trim() || undefined,
              })
            }
            placeholder="Optional project id"
            className="h-9"
          />
        </div>
        <div className="space-y-2">
          <Label>Poll interval (sec)</Label>
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
            className="h-9"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Search filter</Label>
        <Input
          value={watchConfig.search || ''}
          onChange={(e) =>
            onSave({
              ...watchConfig,
              personId: agent.id,
              search: e.target.value.trim() || undefined,
            })
          }
          placeholder="Optional title/description filter"
          className="h-9"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2">
        <div>
          <div className="text-sm font-medium text-gray-900">Watcher enabled</div>
          <div className="text-xs text-gray-500">{describeAgentAction(watchConfig.action)}</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={watchConfig.enabled}
          aria-label={`Toggle watcher for ${agent.name}`}
          onClick={() =>
            onSave({
              ...watchConfig,
              personId: agent.id,
              enabled: !watchConfig.enabled,
            })
          }
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
            watchConfig.enabled ? 'bg-[#020329] border-[#020329]' : 'bg-gray-300 border-gray-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              watchConfig.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onPoll(agent.id)}>
          Poll now
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onRemove(agent.id)}>
          Reset watcher
        </Button>
      </div>

      <div className="rounded-md border bg-white px-3 py-2 text-xs text-gray-600 space-y-1">
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
