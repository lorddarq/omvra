import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Activity, Bot, Download, Terminal, Upload, Users } from 'lucide-react';
import { Person, StorageMeter, StatusColumn, TaskStatus } from '../types';
import type { AgentWatchRuntimeState } from '../hooks/useAgentWatchRuntime';
import type { AgentWatchConfig } from '../utils/workspaceSanitizers';
import { AnchoredPanel, AnchoredPanelSection } from './AnchoredPanel';
import { AgentBoardWatchSettings } from './AgentBoardWatchSettings';
import { TaskCheckboxIndicator } from './TaskCheckboxControl';
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
        id: 'people',
        label: 'People',
        icon: Users,
      },
      {
        id: 'agents',
        label: 'Agents',
        icon: Bot,
      },
      {
        id: 'mcp-access',
        label: 'MCP',
        icon: CodeBracketSquareIcon,
      },
      {
        id: 'mcp-testing',
        label: 'MCP Testing',
        icon: Terminal,
      },
      {
        id: 'mcp-activity',
        label: 'MCP Activity',
        icon: Activity,
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
  initialAnchor?: string;
  children: ReactNode;
}

export function SettingsPanel({ isOpen, onClose, initialAnchor = 'task-load', children }: SettingsPanelProps) {
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
          initialAnchor={initialAnchor}
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

export function McpTestingSettingsSection({ children }: McpSettingsSectionProps) {
  return (
    <AnchoredPanelSection id="mcp-testing" title="MCP Testing">
      {children}
    </AnchoredPanelSection>
  );
}

export function McpActivitySettingsSection({ children }: McpSettingsSectionProps) {
  return (
    <AnchoredPanelSection id="mcp-activity" title="MCP Activity">
      {children}
    </AnchoredPanelSection>
  );
}

interface TasksSettingsSectionProps {
  statusColumns: StatusColumn[];
  executionLoadStatusIds: TaskStatus[];
  pipelineLoadStatusIds: TaskStatus[];
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
  executionLoadStatusIds,
  pipelineLoadStatusIds,
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
  const [selectedAgentId, setSelectedAgentId] = useState(agenticPeople[0]?.id ?? '');
  const selectedAgent = agenticPeople.find(agent => agent.id === selectedAgentId) ?? agenticPeople[0];

  useEffect(() => {
    if (!agenticPeople.length) {
      setSelectedAgentId('');
      return;
    }

    if (!agenticPeople.some(agent => agent.id === selectedAgentId)) {
      setSelectedAgentId(agenticPeople[0].id);
    }
  }, [agenticPeople, selectedAgentId]);

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
    <AnchoredPanelSection
      id="task-load"
      title="Tasks"
      description="Settings that control task-related settings like load calculation and kanban board observability by agents"
    >
      <TaskStatusChoiceGroup
        title="Execution Load"
        description="Tasks in these columns count toward execution load."
        statusColumns={statusColumns}
        value={executionLoadStatusIds}
        onChange={onExecutionLoadStatusChange}
      />

      <TaskStatusChoiceGroup
        title="Pipeline Load"
        description="Tasks in these columns count toward pipeline pressure."
        statusColumns={statusColumns}
        value={pipelineLoadStatusIds}
        onChange={onPipelineLoadStatusChange}
      />

      <div className="space-y-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold leading-5 text-[#71717a]">Agent Board watch</div>
          <p className="break-words text-xs leading-4 text-[#6a7282] [overflow-wrap:anywhere]">
            Configure which task boards agentic people monitor through MCP.
          </p>
        </div>

        {selectedAgent ? (
          <AgentBoardWatchSettings
            agent={selectedAgent}
            agents={agenticPeople}
            selectedAgentId={selectedAgent.id}
            onAgentChange={setSelectedAgentId}
            statusColumns={statusColumns}
            watchConfig={getAgentWatchConfig(selectedAgent.id)}
            watchRuntime={agentWatchRuntime[selectedAgent.id]}
            onSave={onSaveAgentWatchConfig}
            onRemove={onRemoveAgentWatchConfig}
            onPoll={onPollAgentWatch}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-black/10 px-3 py-4 text-sm text-[#71717a]">
            Add an agentic person to configure board watching.
          </p>
        )}
      </div>
    </AnchoredPanelSection>
  );
}

interface TaskStatusChoiceGroupProps {
  title: string;
  description: string;
  statusColumns: StatusColumn[];
  value: TaskStatus[];
  onChange: (statusId: TaskStatus) => void;
}

function TaskStatusChoiceGroup({
  title,
  description,
  statusColumns,
  value,
  onChange,
}: TaskStatusChoiceGroupProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="text-sm font-semibold leading-5 text-[#71717a]">{title}</div>
        <p className="break-words text-xs leading-4 text-[#6a7282] [overflow-wrap:anywhere]">{description}</p>
      </div>
      <div className="space-y-1" role="group" aria-label={title}>
        {statusColumns.map(col => {
          const isSelected = value.includes(col.id as TaskStatus);
          return (
            <button
              key={col.id}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              onClick={() => onChange(col.id as TaskStatus)}
              className="flex min-h-6 w-full items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
            >
              <TaskCheckboxIndicator checked={isSelected} />
              <span className="min-w-0 truncate text-xs font-medium leading-5 text-[#4a4a4f]">{col.title}</span>
            </button>
          );
        })}
      </div>
    </div>
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
  const usagePercent = Math.min(100, Math.max(0, storageMeter.usagePercent));

  return (
    <AnchoredPanelSection id="storage" title="Data" description="Data and backup settings">
      <div className="min-w-0 space-y-8">
        <div className="space-y-3">
          <div className="text-sm font-semibold leading-5 text-[#71717a]">Storage Usage</div>
          <div className="space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#71717a]/15">
              <div
                className="h-full rounded-full bg-[#71717a] transition-[width] duration-300"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <div className="break-words text-xs leading-4 text-[#6a7282] [overflow-wrap:anywhere]">
              <span className="font-bold">{formatBytes(storageMeter.usedBytes)}</span>
              {' used of '}
              <span className="font-bold">{formatBytes(storageMeter.totalBytes)}</span>
              {` available (${storageMeter.usagePercent}%)`}
            </div>
            <div className="break-words text-[11px] leading-4 text-[#71717a] [overflow-wrap:anywhere]">
              Source: {storageMeter.sourceLabel}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-semibold leading-5 text-[#71717a]">Backup and restore</div>
          <p className="break-words text-xs leading-4 text-[#6a7282] [overflow-wrap:anywhere]">
            Export the full workspace backup, including UI preferences, people, projects, task allocation, and board metadata.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onExportTasksAndProjects}
              className="inline-flex h-8 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-[#67676f] outline-none hover:bg-[#71717a]/5 focus-visible:ring-2 focus-visible:ring-gray-300"
            >
              <Download className="size-4 shrink-0" />
              Backup
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-8 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-[#67676f] outline-none hover:bg-[#71717a]/5 focus-visible:ring-2 focus-visible:ring-gray-300"
            >
              <Upload className="size-4 shrink-0" />
              Restore
            </button>
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
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="text-sm font-semibold leading-5 text-[#c40000]">Danger Zone</div>
            <div className="text-xs leading-4 text-[#6a7282]">
              <p>Purge the local storage used by the app.</p>
              <p>This is irreversible</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNukeLocalData}
            className="inline-flex h-8 items-center rounded-xl border border-[#b50000]/10 bg-[#c40000]/10 px-3 text-sm font-medium text-[#cd0000] outline-none hover:bg-[#c40000]/15 focus-visible:ring-2 focus-visible:ring-red-200"
          >
            Erase Local Storage
          </button>
        </div>
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
