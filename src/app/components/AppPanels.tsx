import { Person, ProjectMilestone, StorageMeter, Task, TaskStatus, TimelineSwimlane, StatusColumn } from '../types';
import { AgentWatchRuntimeState } from '../hooks/useAgentWatchRuntime';
import { AgentWatchConfig } from '../utils/workspaceSanitizers';
import type { WorkspaceReadModel } from '../domain/workspaceReadModel';
import { TaskDialog } from './TaskDialog';
import { TaskDetailsDialog } from './TaskDetailsDialog';
import { MilestoneDialog } from './MilestoneDialog';
import { MilestoneDetailsDialog } from './MilestoneDetailsDialog';
import { SwimlaneDialog } from './SwimlaneDialog';
import { PeoplePanel } from './PeoplePanel';
import { PreferencesPanel } from './PreferencesPanel';
import { McpHealthCheckResult } from '../services/mcp/types';

interface AppPanelsProps {
  isTaskDialogOpen: boolean;
  isTaskDetailsOpen: boolean;
  isSwimlaneDialogOpen: boolean;
  isPeoplePanelOpen: boolean;
  isPreferencesOpen: boolean;
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
  tasks: Task[];
  timelineSwimlanes: TimelineSwimlane[];
  people: Person[];
  statusColumns: StatusColumn[];
  milestones: ProjectMilestone[];
  readModel: WorkspaceReadModel;
  isMilestoneDialogOpen: boolean;
  executionLoadStatusId: TaskStatus;
  pipelineLoadStatusId: TaskStatus;
  agentWatchConfigs: AgentWatchConfig[];
  agentWatchRuntime: Record<string, AgentWatchRuntimeState>;
  storageMeter: StorageMeter;
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
  mcpHealthResult: McpHealthCheckResult | null;
  mcpHealthCheckRunning: boolean;
  showMcpHealthDiagnostics: boolean;
  mcpRestartPending: boolean;
  onCloseTaskDialog: () => void;
  onSaveTask: (taskData: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onCloseTaskDetails: () => void;
  onEditTaskFromDetails: (task: Task) => void;
  onMoveAgentTaskToReview: (taskId: string) => void;
  onAddTaskComment: (taskId: string, content: string) => void;
  onCloseMilestoneDialog: () => void;
  onSaveMilestone: (milestone: ProjectMilestone) => void;
  onDeleteMilestone: (milestoneId: string) => void;
  onUpdateRoadmapTaskDependencies: (updates: Array<{ taskId: string; dependencyIds: string[] }>) => void;
  onCloseMilestoneDetails: () => void;
  onEditMilestoneFromDetails: (milestone: ProjectMilestone) => void;
  onMilestoneTaskClick: (task: Task) => void;
  onCloseSwimlaneDialog: () => void;
  onSaveSwimlane: (swimlaneData: Partial<TimelineSwimlane>) => void;
  onDeleteSwimlane: (swimlaneId: string) => void;
  onClosePeoplePanel: () => void;
  onAddPerson: (personData: Omit<Person, 'id'>) => void;
  onUpdatePerson: (personId: string, updates: Pick<Person, 'name' | 'role' | 'kind' | 'agentInstructions'>) => void;
  onDeletePerson: (personId: string) => void;
  onSaveAgentWatchConfig: (config: AgentWatchConfig) => void;
  onRemoveAgentWatchConfig: (personId: string) => void;
  onPollAgentWatch: (personId: string) => void;
  onClosePreferences: () => void;
  onNukeLocalData: () => void;
  onExportTasksAndProjects: () => void;
  onImportTasksAndProjects: (file: File) => void;
  onExecutionLoadStatusChange: (statusId: TaskStatus) => void;
  onPipelineLoadStatusChange: (statusId: TaskStatus) => void;
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

export function AppPanels({
  isTaskDialogOpen,
  isTaskDetailsOpen,
  isSwimlaneDialogOpen,
  isPeoplePanelOpen,
  isPreferencesOpen,
  selectedTask,
  detailsTask,
  selectedMilestone,
  detailsMilestone,
  selectedSwimlane,
  defaultStatus,
  defaultDate,
  defaultEndDate,
  defaultSwimlaneId,
  defaultAssigneeId,
  tasks,
  timelineSwimlanes,
  people,
  statusColumns,
  milestones,
  readModel,
  isMilestoneDialogOpen,
  executionLoadStatusId,
  pipelineLoadStatusId,
  agentWatchConfigs,
  agentWatchRuntime,
  storageMeter,
  mcpAgentAccessEnabled,
  mcpAddress,
  mcpBindHost,
  mcpPort,
  mcpAccessToken,
  mcpAccessTokenIssuedAt,
  mcpAccessTokenTtlMinutes,
  mcpCapabilityProfile,
  mcpListenerStatus,
  mcpAuditLog,
  mcpHealthResult,
  mcpHealthCheckRunning,
  showMcpHealthDiagnostics,
  mcpRestartPending,
  onCloseTaskDialog,
  onSaveTask,
  onDeleteTask,
  onCloseTaskDetails,
  onEditTaskFromDetails,
  onMoveAgentTaskToReview,
  onAddTaskComment,
  onCloseMilestoneDialog,
  onSaveMilestone,
  onDeleteMilestone,
  onUpdateRoadmapTaskDependencies,
  onCloseMilestoneDetails,
  onEditMilestoneFromDetails,
  onMilestoneTaskClick,
  onCloseSwimlaneDialog,
  onSaveSwimlane,
  onDeleteSwimlane,
  onClosePeoplePanel,
  onAddPerson,
  onUpdatePerson,
  onDeletePerson,
  onSaveAgentWatchConfig,
  onRemoveAgentWatchConfig,
  onPollAgentWatch,
  onClosePreferences,
  onNukeLocalData,
  onExportTasksAndProjects,
  onImportTasksAndProjects,
  onExecutionLoadStatusChange,
  onPipelineLoadStatusChange,
  onMcpAgentAccessToggle,
  onMcpAddressChange,
  onMcpBindHostChange,
  onMcpPortChange,
  onMcpAccessTokenChange,
  onMcpAccessTokenRotate,
  onMcpAccessTokenTtlMinutesChange,
  onMcpCapabilityProfileChange,
  onRestartMcpServer,
  onRunMcpHealthCheck,
  onRefreshMcpAuditLog,
}: AppPanelsProps) {
  return (
    <>
      <TaskDialog
        isOpen={isTaskDialogOpen}
        onClose={onCloseTaskDialog}
        onSave={onSaveTask}
        onDelete={onDeleteTask}
        task={selectedTask}
        defaultStatus={defaultStatus}
        defaultDate={defaultDate}
        defaultEndDate={defaultEndDate}
        defaultSwimlaneId={defaultSwimlaneId}
        defaultAssigneeId={defaultAssigneeId}
        swimlanes={timelineSwimlanes}
        statusColumns={statusColumns}
        people={people}
        tasks={tasks}
        milestones={milestones}
        readModel={readModel}
      />

      <TaskDetailsDialog
        isOpen={isTaskDetailsOpen}
        onClose={onCloseTaskDetails}
        onEdit={onEditTaskFromDetails}
        onMoveAgentTaskToReview={onMoveAgentTaskToReview}
        onAddComment={onAddTaskComment}
        task={detailsTask}
        swimlanes={timelineSwimlanes}
        people={people}
        statusColumns={statusColumns}
        tasks={tasks}
        milestones={milestones}
        readModel={readModel}
      />

      <MilestoneDetailsDialog
        isOpen={Boolean(detailsMilestone)}
        onClose={onCloseMilestoneDetails}
        onEdit={onEditMilestoneFromDetails}
        onTaskClick={onMilestoneTaskClick}
        milestone={detailsMilestone}
        projects={timelineSwimlanes}
        tasks={tasks}
        statusColumns={statusColumns as Array<{ id: TaskStatus; title: string; color?: string }>}
        readModel={readModel}
      />

      <MilestoneDialog
        isOpen={isMilestoneDialogOpen}
        onClose={onCloseMilestoneDialog}
        onSave={onSaveMilestone}
        onDelete={onDeleteMilestone}
        onUpdateTaskDependencies={onUpdateRoadmapTaskDependencies}
        milestone={selectedMilestone}
        projects={timelineSwimlanes}
        tasks={tasks}
        readModel={readModel}
      />

      <SwimlaneDialog
        isOpen={isSwimlaneDialogOpen}
        onClose={onCloseSwimlaneDialog}
        onSave={onSaveSwimlane}
        onDelete={onDeleteSwimlane}
        swimlane={selectedSwimlane}
      />

      <PeoplePanel
        isOpen={isPeoplePanelOpen}
        onClose={onClosePeoplePanel}
        people={people}
        tasks={tasks}
        statusColumns={statusColumns}
        executionLoadStatusId={executionLoadStatusId}
        pipelineLoadStatusId={pipelineLoadStatusId}
        onAddPerson={onAddPerson}
        onUpdatePerson={onUpdatePerson}
        onDeletePerson={onDeletePerson}
      />

      <PreferencesPanel
        isOpen={isPreferencesOpen}
        onClose={onClosePreferences}
        statusColumns={statusColumns}
        executionLoadStatusId={executionLoadStatusId}
        pipelineLoadStatusId={pipelineLoadStatusId}
        people={people}
        agentWatchConfigs={agentWatchConfigs}
        agentWatchRuntime={agentWatchRuntime}
        storageMeter={storageMeter}
        onNukeLocalData={onNukeLocalData}
        onExportTasksAndProjects={onExportTasksAndProjects}
        onImportTasksAndProjects={onImportTasksAndProjects}
        onExecutionLoadStatusChange={onExecutionLoadStatusChange}
        onPipelineLoadStatusChange={onPipelineLoadStatusChange}
        onSaveAgentWatchConfig={onSaveAgentWatchConfig}
        onRemoveAgentWatchConfig={onRemoveAgentWatchConfig}
        onPollAgentWatch={onPollAgentWatch}
        mcpAgentAccessEnabled={mcpAgentAccessEnabled}
        mcpAddress={mcpAddress}
        mcpBindHost={mcpBindHost}
        mcpPort={mcpPort}
        mcpAccessToken={mcpAccessToken}
        mcpAccessTokenIssuedAt={mcpAccessTokenIssuedAt}
        mcpAccessTokenTtlMinutes={mcpAccessTokenTtlMinutes}
        mcpCapabilityProfile={mcpCapabilityProfile}
        mcpListenerStatus={mcpListenerStatus}
        mcpAuditLog={mcpAuditLog}
        onMcpAgentAccessToggle={onMcpAgentAccessToggle}
        onMcpAddressChange={onMcpAddressChange}
        onMcpBindHostChange={onMcpBindHostChange}
        onMcpPortChange={onMcpPortChange}
        onMcpAccessTokenChange={onMcpAccessTokenChange}
        onMcpAccessTokenRotate={onMcpAccessTokenRotate}
        onMcpAccessTokenTtlMinutesChange={onMcpAccessTokenTtlMinutesChange}
        onMcpCapabilityProfileChange={onMcpCapabilityProfileChange}
        onRestartMcpServer={onRestartMcpServer}
        showMcpHealthDiagnostics={showMcpHealthDiagnostics}
        mcpHealthResult={mcpHealthResult}
        mcpHealthCheckRunning={mcpHealthCheckRunning}
        onRunMcpHealthCheck={onRunMcpHealthCheck}
        mcpRestartPending={mcpRestartPending}
        onRefreshMcpAuditLog={onRefreshMcpAuditLog}
      />
    </>
  );
}
