import { Person, StorageMeter, Task, TaskStatus, TimelineSwimlane, StatusColumn } from '../types';
import { AgentWatchRuntimeState } from '../hooks/useAgentWatchRuntime';
import { AgentWatchConfig } from '../utils/workspaceSanitizers';
import { TaskDialog } from './TaskDialog';
import { TaskDetailsDialog } from './TaskDetailsDialog';
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
  onCloseSwimlaneDialog: () => void;
  onSaveSwimlane: (swimlaneData: Partial<TimelineSwimlane>) => void;
  onDeleteSwimlane: (swimlaneId: string) => void;
  onClosePeoplePanel: () => void;
  onAddPerson: (personData: Omit<Person, 'id'>) => void;
  onUpdatePerson: (personId: string, updates: Pick<Person, 'name' | 'role' | 'kind'>) => void;
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
        agentWatchConfigs={agentWatchConfigs}
        agentWatchRuntime={agentWatchRuntime}
        onAddPerson={onAddPerson}
        onUpdatePerson={onUpdatePerson}
        onDeletePerson={onDeletePerson}
        onSaveAgentWatchConfig={onSaveAgentWatchConfig}
        onRemoveAgentWatchConfig={onRemoveAgentWatchConfig}
        onPollAgentWatch={onPollAgentWatch}
      />

      <PreferencesPanel
        isOpen={isPreferencesOpen}
        onClose={onClosePreferences}
        statusColumns={statusColumns}
        executionLoadStatusId={executionLoadStatusId}
        pipelineLoadStatusId={pipelineLoadStatusId}
        storageMeter={storageMeter}
        onNukeLocalData={onNukeLocalData}
        onExportTasksAndProjects={onExportTasksAndProjects}
        onImportTasksAndProjects={onImportTasksAndProjects}
        onExecutionLoadStatusChange={onExecutionLoadStatusChange}
        onPipelineLoadStatusChange={onPipelineLoadStatusChange}
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
