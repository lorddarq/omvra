import { useRef } from 'react';
import { TaskStatus } from '../types';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';

interface StorageMeter {
  usedBytes: number;
  totalBytes: number;
  usagePercent: number;
  sourceLabel: string;
}

interface PreferencesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  statusColumns: Array<{ id: TaskStatus; title: string; color?: string }>;
  executionLoadStatusId: TaskStatus;
  pipelineLoadStatusId: TaskStatus;
  onExecutionLoadStatusChange: (statusId: TaskStatus) => void;
  onPipelineLoadStatusChange: (statusId: TaskStatus) => void;
  onNukeLocalData: () => void;
  onExportTasksAndProjects: () => void;
  onImportTasksAndProjects: (file: File) => void;
  storageMeter: StorageMeter;
}

export function PreferencesPanel({
  isOpen,
  onClose,
  statusColumns,
  executionLoadStatusId,
  pipelineLoadStatusId,
  onExecutionLoadStatusChange,
  onPipelineLoadStatusChange,
  onNukeLocalData,
  onExportTasksAndProjects,
  onImportTasksAndProjects,
  storageMeter,
}: PreferencesPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="px-6">
          <SheetTitle>Preferences</SheetTitle>
          <SheetDescription>
            Configure how team load is calculated in the People panel.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 px-6 space-y-6">
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
              Export tasks and projects for backup, or import them from a previous export.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={onExportTasksAndProjects}>
                Export tasks + projects
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Import tasks + projects
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
