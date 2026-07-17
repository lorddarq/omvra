import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Person,
  ProjectMilestone,
  StorageMeter,
  Task,
  TaskStatus,
  TimelineSwimlane,
  StatusColumn,
} from '../types';
import { AgentWatchRuntimeState } from '../hooks/useAgentWatchRuntime';
import { AgentWatchConfig } from '../utils/workspaceSanitizers';
import type { WorkspaceReadModel } from '../domain/workspaceReadModel';
import type { MarkdownAppearance } from '../utils/markdownAppearance';
import { MilestoneDialog } from './dialogs/MilestoneDialog';
import { MilestoneDetailsDialog } from './dialogs/MilestoneDetailsDialog';
import { SwimlaneDialog } from './dialogs/SwimlaneDialog';
import { PreferencesPanel } from './PreferencesPanel';
import { McpHealthCheckResult } from '../services/mcp/types';

const TaskDialog = lazy(() => import('./dialogs/TaskDialog').then(module => ({ default: module.TaskDialog })));
const TaskDetailsDialog = lazy(() => import('./dialogs/TaskDetailsDialog').then(module => ({ default: module.TaskDetailsDialog })));

export interface AppPanelDialogState {
  isTaskDialogOpen: boolean;
  isTaskDetailsOpen: boolean;
  isSwimlaneDialogOpen: boolean;
  isPreferencesOpen: boolean;
  preferencesInitialAnchor?: string;
  selectedTask: Task | null;
  detailsTask: Task | null;
  selectedMilestone: ProjectMilestone | null;
  detailsMilestone: ProjectMilestone | null;
  selectedSwimlane: TimelineSwimlane | null;
  defaultStatus: TaskStatus;
  defaultDate?: Date;
  defaultEndDate?: Date;
  defaultSwimlaneId?: string;
  defaultAssigneeId?: string;
  isMilestoneDialogOpen: boolean;
}

export interface AppPanelWorkspaceState {
  tasks: Task[];
  timelineSwimlanes: TimelineSwimlane[];
  people: Person[];
  statusColumns: StatusColumn[];
  milestones: ProjectMilestone[];
  readModel: WorkspaceReadModel;
}

export interface PreferencesPanelState {
  executionLoadStatusIds: TaskStatus[];
  pipelineLoadStatusIds: TaskStatus[];
  updateChannel: 'stable' | 'rc';
  markdownAppearance: MarkdownAppearance;
  showCompletedTimelineTasks: boolean;
  agentWatchConfigs: AgentWatchConfig[];
  agentWatchRuntime: Record<string, AgentWatchRuntimeState>;
  storageMeter: StorageMeter;
  importFeedback?: {
    type: 'success' | 'error';
    message: string;
  } | null;
  mcpAgentAccessEnabled: boolean;
  mcpAddress: string;
  mcpBindHost: string;
  mcpPort: number;
  mcpAccessToken: string;
  mcpAccessTokenIssuedAt?: string;
  mcpAccessTokenTtlMinutes: number;
  mcpCapabilityProfile: 'read_only' | 'task_write' | 'admin';
  mcpListenerStatus: McpListenerStatus | null;
  mcpAuditLog: McpAuditEntry[];
  mcpAuditSummary: McpAuditSummary | null;
  mcpHealthResult: McpHealthCheckResult | null;
  mcpHealthCheckRunning: boolean;
  mcpRestartPending: boolean;
}

export interface TaskPanelActions {
  onCloseTaskDialog: () => void;
  onSaveTask: (taskData: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onCloseTaskDetails: () => void;
  onEditTaskFromDetails: (task: Task) => void;
  onMoveAgentTaskToReview: (taskId: string) => void;
  onAddTaskComment: (taskId: string, content: string) => void;
  onUpdateTaskAttachments: (taskId: string, attachments: Task['attachments']) => void;
}

export interface MilestonePanelActions {
  onCloseMilestoneDialog: () => void;
  onSaveMilestone: (milestone: ProjectMilestone) => void;
  onDeleteMilestone: (milestoneId: string) => void;
  onUpdateRoadmapTaskDependencies: (updates: Array<{ taskId: string; dependencyIds: string[] }>) => void;
  onCloseMilestoneDetails: () => void;
  onEditMilestoneFromDetails: (milestone: ProjectMilestone) => void;
  onMilestoneTaskClick: (task: Task) => void;
}

export interface WorkspaceAdminActions {
  onCloseSwimlaneDialog: () => void;
  onSaveSwimlane: (swimlaneData: Partial<TimelineSwimlane>) => void;
  onDeleteSwimlane: (swimlaneId: string) => void;
  onAddPerson: (personData: Omit<Person, 'id'>) => void;
  onUpdatePerson: (personId: string, updates: Pick<Person, 'name' | 'role' | 'kind' | 'agentInstructions' | 'agentOperationalInstructions'>) => void;
  onDeletePerson: (personId: string) => void;
  onSaveAgentWatchConfig: (config: AgentWatchConfig) => void;
  onRemoveAgentWatchConfig: (personId: string) => void;
  onPollAgentWatch: (personId: string) => void;
  onClosePreferences: () => void;
  onNukeLocalData: () => void;
  onExportWorkspaceBackup: () => Promise<boolean>;
  onImportTasksAndProjects: (file: File) => void;
  onUpdateChannelChange: (channel: 'stable' | 'rc') => void;
  onMarkdownAppearanceChange: (updates: Partial<MarkdownAppearance>) => void;
  onShowCompletedTimelineTasksChange: (show: boolean) => void;
  onUpdateStatusColumn: (columnId: string, updates: Partial<Omit<StatusColumn, 'id'>>) => void;
  onMcpAgentAccessToggle: (enabled: boolean) => void;
  onMcpAddressChange: (address: string) => void;
  onMcpBindHostChange: (host: string) => void;
  onMcpPortChange: (port: number) => void;
  onMcpAccessTokenChange: (token: string) => void;
  onMcpAccessTokenRotate: () => void;
  onMcpAccessTokenTtlMinutesChange: (ttl: number) => void;
  onMcpCapabilityProfileChange: (profile: 'read_only' | 'task_write' | 'admin') => void;
  onRestartMcpServer: () => void;
  onRunMcpHealthCheck: () => void;
  onRefreshMcpAuditLog: () => void;
}

export interface AppPanelsProps {
  dialogs: AppPanelDialogState;
  workspace: AppPanelWorkspaceState;
  preferences: PreferencesPanelState;
  taskActions: TaskPanelActions;
  milestoneActions: MilestonePanelActions;
  adminActions: WorkspaceAdminActions;
}

export function AppPanels({
  dialogs,
  workspace,
  preferences,
  taskActions,
  milestoneActions,
  adminActions,
}: AppPanelsProps) {
  const [shouldRenderTaskDialog, setShouldRenderTaskDialog] = useState(false);
  const [shouldRenderTaskDetailsDialog, setShouldRenderTaskDetailsDialog] = useState(false);

  useEffect(() => {
    if (dialogs.isTaskDialogOpen) {
      setShouldRenderTaskDialog(true);
    }
  }, [dialogs.isTaskDialogOpen]);

  useEffect(() => {
    if (dialogs.isTaskDetailsOpen) {
      setShouldRenderTaskDetailsDialog(true);
    }
  }, [dialogs.isTaskDetailsOpen]);

  return (
    <>
      <Suspense fallback={null}>
        {shouldRenderTaskDialog && (
          <TaskDialog
            isOpen={dialogs.isTaskDialogOpen}
            onClose={taskActions.onCloseTaskDialog}
            onSave={taskActions.onSaveTask}
            onDelete={taskActions.onDeleteTask}
            task={dialogs.selectedTask}
            defaultStatus={dialogs.defaultStatus}
            defaultDate={dialogs.defaultDate}
            defaultEndDate={dialogs.defaultEndDate}
            defaultSwimlaneId={dialogs.defaultSwimlaneId}
            defaultAssigneeId={dialogs.defaultAssigneeId}
            swimlanes={workspace.timelineSwimlanes}
            statusColumns={workspace.statusColumns}
            people={workspace.people}
            tasks={workspace.tasks}
            milestones={workspace.milestones}
            readModel={workspace.readModel}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {shouldRenderTaskDetailsDialog && (
          <TaskDetailsDialog
            isOpen={dialogs.isTaskDetailsOpen}
            onClose={taskActions.onCloseTaskDetails}
            onEdit={taskActions.onEditTaskFromDetails}
            onMoveAgentTaskToReview={taskActions.onMoveAgentTaskToReview}
            onAddComment={taskActions.onAddTaskComment}
            onUpdateAttachments={taskActions.onUpdateTaskAttachments}
            task={dialogs.detailsTask}
            swimlanes={workspace.timelineSwimlanes}
            people={workspace.people}
            statusColumns={workspace.statusColumns}
            tasks={workspace.tasks}
            milestones={workspace.milestones}
            readModel={workspace.readModel}
          />
        )}
      </Suspense>

      <MilestoneDetailsDialog
        isOpen={Boolean(dialogs.detailsMilestone)}
        onClose={milestoneActions.onCloseMilestoneDetails}
        onEdit={milestoneActions.onEditMilestoneFromDetails}
        onDelete={milestoneActions.onDeleteMilestone}
        onTaskClick={milestoneActions.onMilestoneTaskClick}
        milestone={dialogs.detailsMilestone}
        projects={workspace.timelineSwimlanes}
        tasks={workspace.tasks}
        statusColumns={workspace.statusColumns}
        readModel={workspace.readModel}
      />

      <MilestoneDialog
        isOpen={dialogs.isMilestoneDialogOpen}
        onClose={milestoneActions.onCloseMilestoneDialog}
        onSave={milestoneActions.onSaveMilestone}
        onDelete={milestoneActions.onDeleteMilestone}
        onUpdateTaskDependencies={milestoneActions.onUpdateRoadmapTaskDependencies}
        milestone={dialogs.selectedMilestone}
        projects={workspace.timelineSwimlanes}
        statusColumns={workspace.statusColumns}
        tasks={workspace.tasks}
        readModel={workspace.readModel}
      />

      <SwimlaneDialog
        isOpen={dialogs.isSwimlaneDialogOpen}
        onClose={adminActions.onCloseSwimlaneDialog}
        onSave={adminActions.onSaveSwimlane}
        onDelete={adminActions.onDeleteSwimlane}
        swimlane={dialogs.selectedSwimlane}
      />

      <PreferencesPanel
        isOpen={dialogs.isPreferencesOpen}
        onClose={adminActions.onClosePreferences}
        initialAnchor={dialogs.preferencesInitialAnchor}
        statusColumns={workspace.statusColumns}
        executionLoadStatusIds={preferences.executionLoadStatusIds}
        pipelineLoadStatusIds={preferences.pipelineLoadStatusIds}
        updateChannel={preferences.updateChannel}
        markdownAppearance={preferences.markdownAppearance}
        showCompletedTimelineTasks={preferences.showCompletedTimelineTasks}
        people={workspace.people}
        tasks={workspace.tasks}
        timelineSwimlanes={workspace.timelineSwimlanes}
        agentWatchConfigs={preferences.agentWatchConfigs}
        agentWatchRuntime={preferences.agentWatchRuntime}
        storageMeter={preferences.storageMeter}
        importFeedback={preferences.importFeedback}
        onNukeLocalData={adminActions.onNukeLocalData}
        onExportWorkspaceBackup={adminActions.onExportWorkspaceBackup}
        onImportTasksAndProjects={adminActions.onImportTasksAndProjects}
        onUpdateChannelChange={adminActions.onUpdateChannelChange}
        onMarkdownAppearanceChange={adminActions.onMarkdownAppearanceChange}
        onShowCompletedTimelineTasksChange={adminActions.onShowCompletedTimelineTasksChange}
        onUpdateStatusColumn={adminActions.onUpdateStatusColumn}
        onAddPerson={adminActions.onAddPerson}
        onUpdatePerson={adminActions.onUpdatePerson}
        onDeletePerson={adminActions.onDeletePerson}
        onSaveAgentWatchConfig={adminActions.onSaveAgentWatchConfig}
        onRemoveAgentWatchConfig={adminActions.onRemoveAgentWatchConfig}
        onPollAgentWatch={adminActions.onPollAgentWatch}
        mcpAgentAccessEnabled={preferences.mcpAgentAccessEnabled}
        mcpAddress={preferences.mcpAddress}
        mcpBindHost={preferences.mcpBindHost}
        mcpPort={preferences.mcpPort}
        mcpAccessToken={preferences.mcpAccessToken}
        mcpAccessTokenIssuedAt={preferences.mcpAccessTokenIssuedAt}
        mcpAccessTokenTtlMinutes={preferences.mcpAccessTokenTtlMinutes}
        mcpCapabilityProfile={preferences.mcpCapabilityProfile}
        mcpListenerStatus={preferences.mcpListenerStatus}
        mcpAuditLog={preferences.mcpAuditLog}
        mcpAuditSummary={preferences.mcpAuditSummary}
        onMcpAgentAccessToggle={adminActions.onMcpAgentAccessToggle}
        onMcpAddressChange={adminActions.onMcpAddressChange}
        onMcpBindHostChange={adminActions.onMcpBindHostChange}
        onMcpPortChange={adminActions.onMcpPortChange}
        onMcpAccessTokenChange={adminActions.onMcpAccessTokenChange}
        onMcpAccessTokenRotate={adminActions.onMcpAccessTokenRotate}
        onMcpAccessTokenTtlMinutesChange={adminActions.onMcpAccessTokenTtlMinutesChange}
        onMcpCapabilityProfileChange={adminActions.onMcpCapabilityProfileChange}
        onRestartMcpServer={adminActions.onRestartMcpServer}
        mcpHealthResult={preferences.mcpHealthResult}
        mcpHealthCheckRunning={preferences.mcpHealthCheckRunning}
        onRunMcpHealthCheck={adminActions.onRunMcpHealthCheck}
        mcpRestartPending={preferences.mcpRestartPending}
        onRefreshMcpAuditLog={adminActions.onRefreshMcpAuditLog}
      />
    </>
  );
}
