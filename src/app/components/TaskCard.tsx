import React, { memo } from 'react';
import { Badge } from './ui/badge';
import { TaskPriority } from '../types';

const PRIORITY_STYLES: Record<TaskPriority, { label: string; className: string }> = {
  urgent: { label: 'Urgent', className: 'bg-red-500 text-white border-white/10' },
  moderate: { label: 'Moderate', className: 'bg-orange-500 text-white border-white/10' },
  normal: { label: 'Normal', className: 'bg-blue-500 text-white border-white/10' },
  low: { label: 'Low', className: 'bg-green-500 text-white border-white/10' },
};

interface TaskCardProps {
  title: string;
  notes?: string;
  color?: string;
  project?: string;
  priority?: TaskPriority;
  onClick?: () => void;
  onEdit?: () => void;
}

interface ChecklistPreviewItem {
  text: string;
  checked: boolean;
}

function extractCardContent(notes?: string): { bodyPreview: string; checklistItems: ChecklistPreviewItem[] } {
  if (!notes?.trim()) {
    return { bodyPreview: '', checklistItems: [] };
  }

  const checklistItems: ChecklistPreviewItem[] = [];
  const bodyChunks: string[] = [];
  const checklistRegex = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/;

  notes.split(/\r?\n/).forEach(line => {
    const match = line.match(checklistRegex);
    if (match) {
      const text = match[2].trim();
      if (text) {
        checklistItems.push({ text, checked: match[1].toLowerCase() === 'x' });
      }
      return;
    }

    const normalized = line.replace(/^#{1,6}\s*/, '').trim();
    if (normalized) {
      bodyChunks.push(normalized);
    }
  });

  return {
    bodyPreview: bodyChunks.join(' ').replace(/\s+/g, ' ').trim(),
    checklistItems,
  };
}

function TaskCardComponent({ title, notes, color, project, priority = 'normal', onClick, onEdit }: TaskCardProps) {
  const projectLabels = project
    ? project.split(',').map(label => label.trim()).filter(Boolean)
    : [];
  const priorityStyle = PRIORITY_STYLES[priority];
  const { bodyPreview, checklistItems } = extractCardContent(notes);
  const checklistPreview = checklistItems.slice(0, 3);
  const remainingChecklistCount = Math.max(0, checklistItems.length - checklistPreview.length);

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200 max-w-[320px] min-h-[170px] overflow-hidden"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium text-gray-900 truncate-anywhere">
              {title}
            </p>
          </div>

          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="shrink-0 rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
              aria-label="Edit task"
            >
              Edit
            </button>
          )}
        </div>

        <p className="min-h-[4.5rem] text-sm leading-6 text-gray-600 line-clamp-3">
          {bodyPreview || 'No description provided.'}
        </p>

        {checklistPreview.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-gray-900">Checklist</div>
            <div className="space-y-2">
              {checklistPreview.map((item, idx) => (
                <label key={`${item.text}-${idx}`} className="flex items-center gap-2 text-sm text-gray-900">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    readOnly
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="truncate-anywhere">{item.text}</span>
                </label>
              ))}
              {remainingChecklistCount > 0 && (
                <div className="text-sm text-gray-500">{remainingChecklistCount} more</div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="w-[96px] shrink-0">
            <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium leading-none ${priorityStyle.className}`}>
              {priorityStyle.label}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            {projectLabels.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {projectLabels.map(label => (
                  <Badge
                    key={label}
                    variant="outline"
                    className="max-w-[150px] justify-start overflow-hidden"
                    title={label}
                  >
                    <span className="block truncate">{label}</span>
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No projects</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const TaskCard = memo(TaskCardComponent);
