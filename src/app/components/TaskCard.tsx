import React, { memo } from 'react';
import { TaskPriority } from '../types';
import { extractTaskCardContent } from '../utils/taskNotes';
import { TASK_PRIORITY_ICONS } from './taskPriorityIcons';

const VISIBLE_PROJECT_COUNT = 2;

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
  const priorityIcon = TASK_PRIORITY_ICONS[priority];
  const { bodyPreview, checklistItems } = extractTaskCardContent(notes);
  const checklistPreview = checklistItems.slice(0, 3);
  const remainingChecklistCount = Math.max(0, checklistItems.length - checklistPreview.length);
  const visibleProjectLabels = projectLabels.slice(0, VISIBLE_PROJECT_COUNT);
  const remainingProjectCount = Math.max(0, projectLabels.length - visibleProjectLabels.length);

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className="kanban-task-card-ui"
      data-priority={priority}
    >
      <div className="space-y-4">
        <div className="kanban-task-title-container">
          <div className="kanban-task-title-content">
            <img
              src={priorityIcon.src}
              alt=""
              aria-hidden="true"
              className="kanban-task-priority-icon"
            />
            <p className="kanban-task-title-ui truncate-anywhere">
              {title}
            </p>
          </div>

          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="kanban-task-edit-button"
              aria-label="Edit task"
            >
              Edit
            </button>
          )}
        </div>

        {bodyPreview ? (
          <p className="kanban-task-description-ui">{bodyPreview}</p>
        ) : (
          <div className="kanban-task-inline-empty">No description yet</div>
        )}

        {checklistPreview.length > 0 && (
          <div className="kanban-task-checklist-preview">
            <div className="kanban-task-section-label">Checklist</div>
            <div className="space-y-2">
              {checklistPreview.map((item, idx) => (
                <label key={`${item.text}-${idx}`} className="kanban-task-checklist-item">
                  <span
                    className="kanban-task-checklist-checkbox"
                    data-checked={item.checked ? 'true' : 'false'}
                    aria-hidden="true"
                  />
                  <span className="truncate-anywhere">{item.text}</span>
                </label>
              ))}
              {remainingChecklistCount > 0 && (
                <div className="kanban-task-more-count">{remainingChecklistCount} more</div>
              )}
            </div>
          </div>
        )}

        <div className="kanban-task-projects-section">
          <div className="kanban-task-section-label">Projects:</div>
          {projectLabels.length > 0 ? (
            <div className="kanban-task-project-list">
              {visibleProjectLabels.map(label => (
                <span
                  key={label}
                  className="kanban-task-project-pill"
                  title={label}
                >
                  {label}
                </span>
              ))}
              {remainingProjectCount > 0 && (
                <span className="kanban-task-project-pill">
                  {remainingProjectCount} More
                </span>
              )}
            </div>
          ) : (
            <div className="kanban-task-inline-empty">No projects yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

export const TaskCard = memo(TaskCardComponent);
