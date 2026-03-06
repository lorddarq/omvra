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

function TaskCardComponent({ title, notes, color, project, priority = 'normal', onClick, onEdit }: TaskCardProps) {
  const projectLabels = project
    ? project.split(',').map(label => label.trim()).filter(Boolean)
    : [];
  const priorityStyle = PRIORITY_STYLES[priority];

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200 max-w-[320px] min-h-[170px] overflow-hidden"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="truncate-anywhere">
            <p className="text-base font-medium text-gray-900 w-full max-w-[304px] truncate-anywhere truncate-fade truncate-fade-horizontal">
              {title}
            </p>
            <div className="mt-2">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${priorityStyle.className}`}>
                {priorityStyle.label}
              </span>
            </div>

            {projectLabels.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {projectLabels.slice(0, 2).map(label => (
                  <Badge key={label} variant="outline">{label}</Badge>
                ))}
                {projectLabels.length > 2 && (
                  <Badge variant="outline">+{projectLabels.length - 2}</Badge>
                )}
              </div>
            )}
            {notes && <p className="text-sm text-gray-600 mt-2 line-clamp-4 leading-relaxed">{notes}</p>}
          </div>
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
    </div>
  );
}

export const TaskCard = memo(TaskCardComponent);
