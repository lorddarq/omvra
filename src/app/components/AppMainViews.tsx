import React, { type RefObject } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Task, TimelineSwimlane, Person, TaskStatus, StatusColumn, ProjectMilestone } from '../types';
import { ViewType } from '../hooks/useViewState';
import type { AgentWatchRuntimeState } from '../hooks/useAgentWatchRuntime';
import type { AgentWatchConfig } from '../utils/workspaceSanitizers';
import type { WorkspaceReadModel } from '../domain/workspaceReadModel';
import { TimelineView } from './TimelineView';
import { KanbanView } from './KanbanView';
import { RoadmapView } from './RoadmapView';

export interface AppMainViewsProps {
  currentView: ViewType;
  viewRefreshKey: number;
  timelineContainerRef: RefObject<HTMLDivElement>;
  kanbanContainerRef: RefObject<HTMLDivElement>;
  timelineScrollStateRef: RefObject<{ scrollLeft: number; scrollTop: number }>;
  tasks: Task[];
  timelineSwimlanes: TimelineSwimlane[];
  people: Person[];
  agentWatchConfigs: AgentWatchConfig[];
  agentWatchRuntime: Record<string, AgentWatchRuntimeState>;
  mcpAuditLog: McpAuditEntry[];
  mcpAgentAccessEnabled: boolean;
  mcpListenerStatus: McpListenerStatus | null;
  mcpRestartPending: boolean;
  statusColumns: StatusColumn[];
  milestones: ProjectMilestone[];
  readModel: WorkspaceReadModel;
  timelineInitialScrollLeft: number;
  kanbanInitialScrollLeft: number;
  kanbanInitialScrollTop: number;
  onTimelineTaskClick: (task: Task) => void;
  onTimelineAddTask: (date: Date, swimlaneId: string, endDate?: Date, mode?: 'projects' | 'people') => void;
  onTimelineUpdateTaskDates: (taskId: string, startDate: string, endDate: string) => void;
  onTimelineEditSwimlane: (swimlane: TimelineSwimlane) => void;
  onTimelineAddSwimlane: () => void;
  onTimelineReorderSwimlanes: (swimlanes: TimelineSwimlane[]) => void;
  onTimelineReorderPeople: (people: Person[]) => void;
  onTimelineReorderTasks: (tasks: Task[]) => void;
  onTimelineScroll: (state: { scrollLeft: number; scrollTop: number }) => void;
  onKanbanTaskClick: (task: Task) => void;
  onKanbanEditTask: (task: Task) => void;
  onKanbanAddTask: (status: TaskStatus) => void;
  onKanbanMoveTask: (taskId: string, newStatus: TaskStatus) => void;
  onKanbanReorderTasks: (tasks: Task[]) => void;
  onKanbanReorderColumns: (fromIndex: number, toIndex: number) => void;
  onKanbanRenameColumn: (colId: string, newTitle: string) => void;
  onKanbanChangeColumnColor: (colId: string, newColor: string) => void;
  onKanbanAddColumn: (col: any) => void;
  onKanbanDeleteColumn: (colId: string) => void;
  onRoadmapAddMilestone: () => void;
  onRoadmapMilestoneClick: (milestone: ProjectMilestone) => void;
  onRoadmapTaskClick: (task: Task) => void;
}

export function AppMainViews({
  currentView,
  viewRefreshKey,
  timelineContainerRef,
  kanbanContainerRef,
  timelineScrollStateRef,
  tasks,
  timelineSwimlanes,
  people,
  agentWatchConfigs,
  agentWatchRuntime,
  mcpAuditLog,
  mcpAgentAccessEnabled,
  mcpListenerStatus,
  mcpRestartPending,
  statusColumns,
  milestones,
  readModel,
  timelineInitialScrollLeft,
  kanbanInitialScrollLeft,
  kanbanInitialScrollTop,
  onTimelineTaskClick,
  onTimelineAddTask,
  onTimelineUpdateTaskDates,
  onTimelineEditSwimlane,
  onTimelineAddSwimlane,
  onTimelineReorderSwimlanes,
  onTimelineReorderPeople,
  onTimelineReorderTasks,
  onTimelineScroll,
  onKanbanTaskClick,
  onKanbanEditTask,
  onKanbanAddTask,
  onKanbanMoveTask,
  onKanbanReorderTasks,
  onKanbanReorderColumns,
  onKanbanRenameColumn,
  onKanbanChangeColumnColor,
  onKanbanAddColumn,
  onKanbanDeleteColumn,
  onRoadmapAddMilestone,
  onRoadmapMilestoneClick,
  onRoadmapTaskClick,
}: AppMainViewsProps) {
  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      {currentView === 'timeline' && (
        <div key={`timeline-${viewRefreshKey}`} ref={timelineContainerRef} className="h-full w-full">
          <TimelineView
            tasks={tasks}
            swimlanes={timelineSwimlanes}
            people={people}
            agentWatchConfigs={agentWatchConfigs}
            agentWatchRuntime={agentWatchRuntime}
            mcpAuditLog={mcpAuditLog}
            mcpAgentAccessEnabled={mcpAgentAccessEnabled}
            mcpListenerStatus={mcpListenerStatus}
            mcpRestartPending={mcpRestartPending}
            statusColumns={statusColumns}
            initialScrollLeft={timelineInitialScrollLeft}
            onTaskClick={onTimelineTaskClick}
            onAddTask={onTimelineAddTask}
            onUpdateTaskDates={onTimelineUpdateTaskDates}
            onEditSwimlane={onTimelineEditSwimlane}
            onAddSwimlane={onTimelineAddSwimlane}
            onReorderSwimlanes={onTimelineReorderSwimlanes}
            onReorderPeople={onTimelineReorderPeople}
            onReorderTasks={onTimelineReorderTasks}
            onTimelineScroll={onTimelineScroll}
          />
        </div>
      )}

      {currentView === 'kanban' && (
        <div key={`kanban-${viewRefreshKey}`} className="flex h-full min-h-0 w-full">
          <DndProvider backend={HTML5Backend}>
            <KanbanView
              tasks={tasks}
              swimlanes={statusColumns}
              projects={timelineSwimlanes}
              people={people}
              scrollContainerRef={kanbanContainerRef}
              initialScrollLeft={kanbanInitialScrollLeft}
              initialScrollTop={kanbanInitialScrollTop}
              onTaskClick={onKanbanTaskClick}
              onEditTask={onKanbanEditTask}
              onAddTask={onKanbanAddTask}
              onMoveTask={onKanbanMoveTask}
              onReorderTasks={onKanbanReorderTasks}
              onReorderColumns={onKanbanReorderColumns}
              onRenameColumn={onKanbanRenameColumn}
              onChangeColumnColor={onKanbanChangeColumnColor}
              onAddColumn={onKanbanAddColumn}
              onDeleteColumn={onKanbanDeleteColumn}
            />
          </DndProvider>
        </div>
      )}

      {currentView === 'roadmap' && (
        <div key={`roadmap-${viewRefreshKey}`} className="flex h-full min-h-0 w-full">
          <RoadmapView
            milestones={milestones}
            tasks={tasks}
            projects={timelineSwimlanes}
            statusColumns={statusColumns as Array<{ id: TaskStatus; title: string; color?: string }>}
            readModel={readModel}
            onAddMilestone={onRoadmapAddMilestone}
            onMilestoneClick={onRoadmapMilestoneClick}
            onTaskClick={onRoadmapTaskClick}
          />
        </div>
      )}
    </div>
  );
}
