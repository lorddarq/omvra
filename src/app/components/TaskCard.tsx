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
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.862 4.487Zm0 0L19.5 7.125"
                />
              </svg>
            </button>
          )}
        </div>

        <p className="kanban-task-description-ui">
          {bodyPreview || 'No description provided.'}
        </p>

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
            <div className="kanban-task-no-project">No projects</div>
          )}
        </div>
      </div>
    </div>
  );
}

export const TaskCard = memo(TaskCardComponent);
