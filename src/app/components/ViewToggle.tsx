/**
 * ViewToggle Component
 *
 * Segmented control for switching between TimelineView and KanbanView.
 * Renders as a toggle button group in the top bar.
 *
 * Usage:
 *   <ViewToggle
 *     currentView={viewState.currentView}
 *     onViewChange={(view) => viewState.switchView(view)}
 *   />
 */

import React from 'react';
import { ViewType } from '@/app/hooks/useViewState';

interface ViewToggleProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  disabled?: boolean;
}

export function ViewToggle({
  currentView,
  onViewChange,
  disabled = false,
}: ViewToggleProps) {
  const views: { value: ViewType; label: string; icon: React.ReactNode }[] = [
    { value: 'timeline', 
      label: 'Timeline', 
      icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="size-4">
              <path d="M11 11.5C11.5523 11.5 12 11.9477 12 12.5V13.5C12 14.0523 11.5523 14.5 11 14.5H3C2.44772 14.5 2 14.0523 2 13.5V12.5C2 11.9477 2.44772 11.5 3 11.5H11Z" fill="currentColor"/>
              <path d="M14 6.5C14.5523 6.5 15 6.94772 15 7.5V8.5C15 9.05228 14.5523 9.5 14 9.5H5C4.44772 9.5 4 9.05228 4 8.5V7.5C4 6.94772 4.44772 6.5 5 6.5H14Z" fill="currentColor"/>
              <path d="M14 1.5C14.5523 1.5 15 1.94772 15 2.5V3.5C15 4.05228 14.5523 4.5 14 4.5H9C8.44772 4.5 8 4.05228 8 3.5V2.5C8 1.94772 8.44772 1.5 9 1.5H14Z" fill="currentColor"/>
            </svg>
    },
    { value: 'roadmap', 
      label: 'Roadmap', 
      icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4">
              <path fillRule="evenodd" d="M3 2.25a.75.75 0 0 1 .75.75v.54l1.838-.46a9.75 9.75 0 0 1 6.725.738l.108.054A8.25 8.25 0 0 0 18 4.524l3.11-.732a.75.75 0 0 1 .917.81 47.784 47.784 0 0 0 .005 10.337.75.75 0 0 1-.574.812l-3.114.733a9.75 9.75 0 0 1-6.594-.77l-.108-.054a8.25 8.25 0 0 0-5.69-.625l-2.202.55V21a.75.75 0 0 1-1.5 0V3A.75.75 0 0 1 3 2.25Z" clipRule="evenodd" />
              </svg>
    },
    { value: 'kanban', 
      label: 'Kanban', 
      icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4">
              <path d="M15 3.75H9v16.5h6V3.75ZM16.5 20.25h3.375c1.035 0 1.875-.84 1.875-1.875V5.625c0-1.036-.84-1.875-1.875-1.875H16.5v16.5ZM4.125 3.75H7.5v16.5H4.125a1.875 1.875 0 0 1-1.875-1.875V5.625c0-1.036.84-1.875 1.875-1.875Z" />
            </svg>
    },
    { value: 'loops',
      label: 'Loops',
      icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4"><path d="M8 7a4 4 0 1 1 4 4H8a4 4 0 1 0-4-4"/><path d="M16 17a4 4 0 1 1-4-4h4a4 4 0 1 0 4 4"/></svg>
    },
  ];
  const activeIndex = Math.max(0, views.findIndex(view => view.value === currentView));

  return (
    <div
      className="view-toggle"
      data-active-index={activeIndex}
    >
      <span className="view-toggle-indicator" aria-hidden="true" />
      {views.map(view => (
        <button
          key={view.value}
          onClick={() => onViewChange(view.value)}
          disabled={disabled}
          className={`view-toggle-button ${currentView === view.value ? 'active' : ''}`}
          aria-pressed={currentView === view.value}
          aria-label={`Switch to ${view.label} view`}
        >
          {view.icon}
          {view.label}
        </button>
      ))}
    </div>
  );
}
