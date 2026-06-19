import { useRef, type ReactNode } from 'react';
import { StorageMeter, StatusColumn, TaskStatus } from '../types';
import { AnchoredPanel, AnchoredPanelSection } from './AnchoredPanel';
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
        id: 'mcp-access',
        label: 'MCP access',
        description: 'Agent access, listener, and commands',
      },
      {
        id: 'task-load',
        label: 'Task load',
        description: 'Execution and pipeline columns',
      },
    ],
  },
  {
    label: 'Data',
    items: [
      {
        id: 'storage',
        label: 'Storage',
        description: 'Usage, backup, and reset',
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
      <SheetContent className="w-[min(980px,calc(100vw-32px))] gap-0 overflow-hidden p-0 sm:max-w-none" showClose={false}>
        <SheetTitle className="sr-only">Preferences</SheetTitle>
        <SheetDescription className="sr-only">
          Configure agent access, task load, and local workspace data.
        </SheetDescription>
        <AnchoredPanel
          title="Preferences"
          description="Configure agent access, task load, and local workspace data."
          navGroups={SETTINGS_PANEL_NAV_GROUPS}
          initialAnchor="mcp-access"
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
    <AnchoredPanelSection
      id="mcp-access"
      title="MCP access"
      description="Configure the local MCP listener, external access, and generated agent commands."
    >
      {children}
    </AnchoredPanelSection>
  );
}

interface TasksSettingsSectionProps {
  statusColumns: StatusColumn[];
  executionLoadStatusId: TaskStatus;
  pipelineLoadStatusId: TaskStatus;
  onExecutionLoadStatusChange: (statusId: TaskStatus) => void;
  onPipelineLoadStatusChange: (statusId: TaskStatus) => void;
}

export function TasksSettingsSection({
  statusColumns,
  executionLoadStatusId,
  pipelineLoadStatusId,
  onExecutionLoadStatusChange,
  onPipelineLoadStatusChange,
}: TasksSettingsSectionProps) {
  return (
    <AnchoredPanelSection
      id="task-load"
      title="Task load"
      description="Choose which status columns count toward execution and pipeline load."
    >
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
    <AnchoredPanelSection
      id="storage"
      title="Storage"
      description="Review local storage usage and manage workspace backups."
    >
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
