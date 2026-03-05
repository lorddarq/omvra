import React from 'react';
import { Badge } from './ui/badge';

interface TaskCardProps {
  title: string;
  notes?: string;
  color?: string;
  project?: string;
  onClick?: () => void;
  onEdit?: () => void;
}

export function TaskCard({ title, notes, color, project, onClick, onEdit }: TaskCardProps) {
  const projectLabels = project
    ? project.split(',').map(label => label.trim()).filter(Boolean)
    : [];

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
