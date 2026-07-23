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
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

interface ViewToggleProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  showLabels?: boolean;
  disabled?: boolean;
}

export function ViewToggle({
  currentView,
  onViewChange,
  showLabels = true,
  disabled = false,
}: ViewToggleProps) {
  const views: { value: ViewType; label: string; icon: React.ReactNode }[] = [
    { value: 'timeline', 
      label: 'Timeline', 
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" className="size-[18px]">
              <title>align-3-left</title>
              <g fill="currentColor">
                <path d="M15.25 5.75V4.25C15.25 3.42157 14.5784 2.75 13.75 2.75L4.25 2.75C3.42157 2.75 2.75 3.42157 2.75 4.25V5.75C2.75 6.57843 3.42157 7.25 4.25 7.25L13.75 7.25C14.5784 7.25 15.25 6.57843 15.25 5.75Z" fill="currentColor" fillOpacity="0.3" data-stroke="none" stroke="none" />
                <path d="M9.25 13.75V12.25C9.25 11.4216 8.57843 10.75 7.75 10.75H4.25C3.42157 10.75 2.75 11.4216 2.75 12.25V13.75C2.75 14.5784 3.42157 15.25 4.25 15.25H7.75C8.57843 15.25 9.25 14.5784 9.25 13.75Z" fill="currentColor" fillOpacity="0.3" data-stroke="none" stroke="none" />
                <path d="M15.25 5.75V4.25C15.25 3.42157 14.5784 2.75 13.75 2.75L4.25 2.75C3.42157 2.75 2.75 3.42157 2.75 4.25V5.75C2.75 6.57843 3.42157 7.25 4.25 7.25L13.75 7.25C14.5784 7.25 15.25 6.57843 15.25 5.75Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M9.25 13.75V12.25C9.25 11.4216 8.57843 10.75 7.75 10.75H4.25C3.42157 10.75 2.75 11.4216 2.75 12.25V13.75C2.75 14.5784 3.42157 15.25 4.25 15.25H7.75C8.57843 15.25 9.25 14.5784 9.25 13.75Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </g>
            </svg>
    },
    { value: 'roadmap', 
      label: 'Milestones', 
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" className="size-[18px]">
              <title>location-2</title>
              <g fill="currentColor">
                <path d="M9 8.25C10.7949 8.25 12.25 6.79493 12.25 5C12.25 3.20507 10.7949 1.75 9 1.75C7.20507 1.75 5.75 3.20507 5.75 5C5.75 6.79493 7.20507 8.25 9 8.25Z" fill="currentColor" fillOpacity="0.3" data-stroke="none" stroke="none" />
                <path d="M9 8.25C10.7949 8.25 12.25 6.79493 12.25 5C12.25 3.20507 10.7949 1.75 9 1.75C7.20507 1.75 5.75 3.20507 5.75 5C5.75 6.79493 7.20507 8.25 9 8.25Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M9 13.25V8.25" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M12 12.429C14.507 12.744 16.25 13.441 16.25 14.25C16.25 15.355 13.004 16.25 9 16.25C4.996 16.25 1.75 15.355 1.75 14.25C1.75 13.441 3.493 12.743 6 12.429" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </g>
            </svg>
    },
    { value: 'kanban', 
      label: 'Kanban', 
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" className="size-[18px]">
              <title>stack-perspective</title>
              <g fill="currentColor">
                <path d="M10.46 1.82699L15.67 4.23099C16.024 4.39399 16.251 4.74899 16.251 5.13899V12.859C16.251 13.249 16.024 13.604 15.67 13.767L10.46 16.171C10.129 16.324 9.75 16.082 9.75 15.717V2.28099C9.75 1.91599 10.128 1.67399 10.46 1.82699Z" fill="currentColor" fillOpacity="0.3" data-stroke="none" stroke="none" />
                <path d="M3.25 12.25L2.408 12.531C2.084 12.639 1.75 12.398 1.75 12.057V5.94398C1.75 5.60298 2.084 5.36198 2.408 5.46998L3.25 5.75098" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M7.25 14.125L6.442 14.462C6.113 14.599 5.75 14.357 5.75 14V4.00001C5.75 3.64301 6.113 3.40101 6.442 3.53801L7.25 3.87501" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M10.46 1.82699L15.67 4.23099C16.024 4.39399 16.251 4.74899 16.251 5.13899V12.859C16.251 13.249 16.024 13.604 15.67 13.767L10.46 16.171C10.129 16.324 9.75 16.082 9.75 15.717V2.28099C9.75 1.91599 10.128 1.67399 10.46 1.82699Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </g>
            </svg>
    },
    { value: 'loops',
      label: 'Workflows',
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" className="size-[18px]">
              <title>sitemap-4</title>
              <g fill="currentColor">
                <path d="M6 11.75H3.5C2.94772 11.75 2.5 12.1977 2.5 12.75V15.25C2.5 15.8023 2.94772 16.25 3.5 16.25H6C6.55228 16.25 7 15.8023 7 15.25V12.75C7 12.1977 6.55228 11.75 6 11.75Z" fill="currentColor" fillOpacity="0.3" data-stroke="none" stroke="none" />
                <path d="M14.5 11.75H12C11.4477 11.75 11 12.1977 11 12.75V15.25C11 15.8023 11.4477 16.25 12 16.25H14.5C15.0523 16.25 15.5 15.8023 15.5 15.25V12.75C15.5 12.1977 15.0523 11.75 14.5 11.75Z" fill="currentColor" fillOpacity="0.3" data-stroke="none" stroke="none" />
                <path d="M13.25 11.75V10.75C13.25 9.645 12.355 8.75 11.25 8.75H9H6.75C5.645 8.75 4.75 9.645 4.75 10.75V11.75" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M9 6.25V8.75" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M10.25 1.75H7.75C7.19772 1.75 6.75 2.19772 6.75 2.75V5.25C6.75 5.80228 7.19772 6.25 7.75 6.25H10.25C10.8023 6.25 11.25 5.80228 11.25 5.25V2.75C11.25 2.19772 10.8023 1.75 10.25 1.75Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M6 11.75H3.5C2.94772 11.75 2.5 12.1977 2.5 12.75V15.25C2.5 15.8023 2.94772 16.25 3.5 16.25H6C6.55228 16.25 7 15.8023 7 15.25V12.75C7 12.1977 6.55228 11.75 6 11.75Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M14.5 11.75H12C11.4477 11.75 11 12.1977 11 12.75V15.25C11 15.8023 11.4477 16.25 12 16.25H14.5C15.0523 16.25 15.5 15.8023 15.5 15.25V12.75C15.5 12.1977 15.0523 11.75 14.5 11.75Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </g>
            </svg>
    },
  ];
  const viewOrder: ViewType[] = ['timeline', 'kanban', 'roadmap', 'loops'];
  const orderedViews = [...views].sort((a, b) => viewOrder.indexOf(a.value) - viewOrder.indexOf(b.value));
  const activeIndex = Math.max(0, orderedViews.findIndex(view => view.value === currentView));

  return (
    <div
      className="view-toggle"
      data-active-index={activeIndex}
    >
      <span className="view-toggle-indicator" aria-hidden="true" />
      {orderedViews.map(view => (
        <Tooltip key={view.value}>
          <TooltipTrigger asChild>
            <button
              onClick={() => onViewChange(view.value)}
              disabled={disabled}
              className={`view-toggle-button ${currentView === view.value ? 'active' : ''}`}
              aria-pressed={currentView === view.value}
              aria-label={`Switch to ${view.label} view`}
            >
              {view.icon}
              {showLabels ? view.label : null}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Switch to {view.label} view</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
