import { useRef, type ReactNode } from 'react';
import { Person, StorageMeter, StatusColumn, TaskStatus } from '../types';
import type { AgentWatchRuntimeState } from '../hooks/useAgentWatchRuntime';
import type { AgentWatchConfig } from '../utils/workspaceSanitizers';
import { AnchoredPanel, AnchoredPanelSection } from './AnchoredPanel';
import { AgentBoardWatchSettings } from './AgentBoardWatchSettings';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from './ui/sheet';

const SETTINGS_PANEL_NAV_GROUPS = [
  {
    label: 'Settings',
    items: [
      {
        id: 'task-load',
        label: 'Tasks',
        icon: CheckCircleIcon,
      },
      {
        id: 'mcp-access',
        label: 'MCP',
        icon: CodeBracketSquareIcon,
      },
    ],
  },
  {
    label: 'Storage',
    items: [
      {
        id: 'storage',
        label: 'Data',
        icon: CircleStackIcon,
      },
    ],
  },
];

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function SettingsPanel({ isOpen, onClose, children }: SettingsPanelProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        className="plumy-settings-sheet !bottom-2 !left-auto !right-2 !top-2 !h-auto !w-[min(800px,calc(100vw-16px))] !translate-x-0 !translate-y-0 gap-0 overflow-hidden rounded-[24px] border-0 bg-white p-2 shadow-[0_2px_8px_rgba(0,0,0,0.10),0_-6px_12px_rgba(0,0,0,0.10),0_14px_28px_rgba(0,0,0,0.10)] sm:max-w-none"
        overlayClassName="plumy-settings-overlay"
        showClose={false}
      >
        <SheetTitle className="sr-only">Preferences</SheetTitle>
        <SheetDescription className="sr-only">
          Configure agent access, task load, and local workspace data.
        </SheetDescription>
        <AnchoredPanel
          title="Preferences"
          navGroups={SETTINGS_PANEL_NAV_GROUPS}
          initialAnchor="task-load"
          onClose={onClose}
        >
          {children}
        </AnchoredPanel>
      </SheetContent>
    </Sheet>
  );
}

interface McpSettingsSectionProps {
  children: ReactNode;
}

export function McpSettingsSection({ children }: McpSettingsSectionProps) {
  return (
    <AnchoredPanelSection id="mcp-access" title="MCP">
      {children}
    </AnchoredPanelSection>
  );
}

interface TasksSettingsSectionProps {
  statusColumns: StatusColumn[];
  executionLoadStatusId: TaskStatus;
  pipelineLoadStatusId: TaskStatus;
  people: Person[];
  agentWatchConfigs: AgentWatchConfig[];
  agentWatchRuntime: Record<string, AgentWatchRuntimeState>;
  onExecutionLoadStatusChange: (statusId: TaskStatus) => void;
  onPipelineLoadStatusChange: (statusId: TaskStatus) => void;
  onSaveAgentWatchConfig: (config: AgentWatchConfig) => void;
  onRemoveAgentWatchConfig: (personId: string) => void;
  onPollAgentWatch: (personId: string) => void;
}

export function TasksSettingsSection({
  statusColumns,
  executionLoadStatusId,
  pipelineLoadStatusId,
  people,
  agentWatchConfigs,
  agentWatchRuntime,
  onExecutionLoadStatusChange,
  onPipelineLoadStatusChange,
  onSaveAgentWatchConfig,
  onRemoveAgentWatchConfig,
  onPollAgentWatch,
}: TasksSettingsSectionProps) {
  const agenticPeople = people.filter(person => person.kind === 'agentic');

  function getAgentWatchConfig(personId: string): AgentWatchConfig {
    return agentWatchConfigs.find(config => config.personId === personId) || {
      personId,
      enabled: false,
      statusId: statusColumns[0]?.id || 'open',
      action: 'inspect_and_work',
      intervalSeconds: 60,
    };
  }

  return (
    <AnchoredPanelSection id="task-load" title="Tasks">
      <div className="space-y-2">
        <Label htmlFor="execution-load-status">Execution load column</Label>
        <Select
          value={executionLoadStatusId}
          onValueChange={(value) => onExecutionLoadStatusChange(value as TaskStatus)}
        >
          <SelectTrigger id="execution-load-status">
            <SelectValue placeholder="Select execution status" />
          </SelectTrigger>
          <SelectContent>
            {statusColumns.map(col => (
              <SelectItem key={col.id} value={col.id}>
                {col.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          Only tasks in this column count toward execution load.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pipeline-load-status">Pipeline load column</Label>
        <Select
          value={pipelineLoadStatusId}
          onValueChange={(value) => onPipelineLoadStatusChange(value as TaskStatus)}
        >
          <SelectTrigger id="pipeline-load-status">
            <SelectValue placeholder="Select pipeline status" />
          </SelectTrigger>
          <SelectContent>
            {statusColumns.map(col => (
              <SelectItem key={col.id} value={col.id}>
                {col.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          Tasks in this column count toward pipeline pressure.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">Agent board watch</div>
          <p className="text-xs text-gray-500">
            Configure which task boards agentic people monitor through MCP.
          </p>
        </div>

        {agenticPeople.length > 0 ? (
          <div className="space-y-3">
            {agenticPeople.map(agent => (
              <AgentBoardWatchSettings
                key={agent.id}
                agent={agent}
                statusColumns={statusColumns}
                watchConfig={getAgentWatchConfig(agent.id)}
                watchRuntime={agentWatchRuntime[agent.id]}
                onSave={onSaveAgentWatchConfig}
                onRemove={onRemoveAgentWatchConfig}
                onPoll={onPollAgentWatch}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-gray-500">
            Add an agentic person to configure board watching.
          </p>
        )}
      </div>
    </AnchoredPanelSection>
  );
}

interface DataSettingsSectionProps {
  storageMeter: StorageMeter;
  onNukeLocalData: () => void;
  onExportTasksAndProjects: () => void;
  onImportTasksAndProjects: (file: File) => void;
}

export function DataSettingsSection({
  storageMeter,
  onNukeLocalData,
  onExportTasksAndProjects,
  onImportTasksAndProjects,
}: DataSettingsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <AnchoredPanelSection id="storage" title="Data">
      <div className="space-y-3 rounded-lg border p-4">
        <div className="text-sm font-semibold text-gray-900">Storage usage</div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full bg-blue-500 transition-[width] duration-300"
            style={{ width: `${storageMeter.usagePercent}%` }}
          />
        </div>
        <div className="text-xs text-gray-500">
          {formatBytes(storageMeter.usedBytes)} used of {formatBytes(storageMeter.totalBytes)} available ({storageMeter.usagePercent}%)
        </div>
        <div className="text-[11px] text-gray-400">
          Source: {storageMeter.sourceLabel}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="text-sm font-semibold text-gray-900">Backup and reset</div>
        <p className="text-xs text-gray-500">
          Export the full workspace backup, including UI preferences, people, projects, task allocation, and board metadata.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onExportTasksAndProjects}>
            Export workspace backup
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            Import workspace backup
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onImportTasksAndProjects(file);
            }
            e.currentTarget.value = '';
          }}
        />
        <Button type="button" variant="destructive" onClick={onNukeLocalData}>
          Nuke local storage
        </Button>
      </div>
    </AnchoredPanelSection>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path
        fillRule="evenodd"
        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53-1.684-1.684a.75.75 0 1 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.81-5.19Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CodeBracketSquareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path
        fillRule="evenodd"
        d="M3 6.75A3.75 3.75 0 0 1 6.75 3h10.5A3.75 3.75 0 0 1 21 6.75v10.5A3.75 3.75 0 0 1 17.25 21H6.75A3.75 3.75 0 0 1 3 17.25V6.75Zm6.22 3.22a.75.75 0 0 1 0 1.06L8.25 12l.97.97a.75.75 0 1 1-1.06 1.06l-1.5-1.5a.75.75 0 0 1 0-1.06l1.5-1.5a.75.75 0 0 1 1.06 0Zm5.56 0a.75.75 0 0 1 1.06 0l1.5 1.5a.75.75 0 0 1 0 1.06l-1.5 1.5a.75.75 0 1 1-1.06-1.06l.97-.97-.97-.97a.75.75 0 0 1 0-1.06Zm-1.56-.22a.75.75 0 0 1 .53.92l-1.5 5.5a.75.75 0 1 1-1.45-.4l1.5-5.5a.75.75 0 0 1 .92-.52Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CircleStackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 2.25c-4.97 0-9 1.68-9 3.75s4.03 3.75 9 3.75 9-1.68 9-3.75-4.03-3.75-9-3.75Z" />
      <path d="M3 9.75c0 2.07 4.03 3.75 9 3.75s9-1.68 9-3.75v2.5c0 2.07-4.03 3.75-9 3.75s-9-1.68-9-3.75v-2.5Z" />
      <path d="M3 15.75c0 2.07 4.03 3.75 9 3.75s9-1.68 9-3.75v2.25c0 2.07-4.03 3.75-9 3.75s-9-1.68-9-3.75v-2.25Z" />
    </svg>
  );
}
