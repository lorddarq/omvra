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
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200 max-w-[300px] overflow-hidden"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="truncate-anywhere">
            <p className="text-sm font-medium text-gray-900 w-full max-w-[296px] truncate-anywhere truncate-fade truncate-fade-horizontal">
              {title}
            </p>

            {project && <div className="mt-1"><Badge variant="outline">{project}</Badge></div>}
            {notes && <p className="text-xs text-gray-500 mt-1 line-clamp-3">{notes}</p>}
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
