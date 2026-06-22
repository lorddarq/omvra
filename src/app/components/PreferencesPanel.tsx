import { useState } from 'react';
import { Person, StorageMeter, Task, TaskStatus, StatusColumn } from '../types';
import type { AgentWatchRuntimeState } from '../hooks/useAgentWatchRuntime';
import type { AgentWatchConfig } from '../utils/workspaceSanitizers';
import { McpHealthCheckResult } from '../services/mcp/types';
import {
  DataSettingsSection,
  McpActivitySettingsSection,
  McpSettingsSection,
  McpTestingSettingsSection,
  SettingsPanel,
  TasksSettingsSection,
} from './SettingsPanel';
import { McpAccessSettingsSection } from './McpAccessSettingsSection';
import { McpCommandSettingsSection } from './McpCommandSettingsSection';
import { McpActivityLogSection } from './McpDiagnosticsSections';
import { PeopleManagementSections } from './PeopleSettingsSections';

interface PreferencesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialAnchor?: string;
  statusColumns: StatusColumn[];
  executionLoadStatusIds: TaskStatus[];
  pipelineLoadStatusIds: TaskStatus[];
  people: Person[];
  tasks: Task[];
  agentWatchConfigs: AgentWatchConfig[];
  agentWatchRuntime: Record<string, AgentWatchRuntimeState>;
  onExecutionLoadStatusChange: (statusId: TaskStatus) => void;
  onPipelineLoadStatusChange: (statusId: TaskStatus) => void;
  onAddPerson: (person: Omit<Person, 'id'>) => void;
  onUpdatePerson: (personId: string, updates: Pick<Person, 'name' | 'role' | 'kind' | 'agentInstructions'>) => void;
  onDeletePerson: (personId: string) => void;
  onSaveAgentWatchConfig: (config: AgentWatchConfig) => void;
  onRemoveAgentWatchConfig: (personId: string) => void;
  onPollAgentWatch: (personId: string) => void;
  onNukeLocalData: () => void;
  onExportTasksAndProjects: () => void;
  onImportTasksAndProjects: (file: File) => void;
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
  onMcpAgentAccessToggle: (enabled: boolean) => void;
  onMcpAddressChange: (address: string) => void;
  onMcpBindHostChange: (host: string) => void;
  onMcpPortChange: (port: number) => void;
  onMcpAccessTokenChange: (token: string) => void;
  onMcpAccessTokenRotate: () => void;
  onMcpAccessTokenTtlMinutesChange: (ttlMinutes: number) => void;
  onMcpCapabilityProfileChange: (profile: 'read_only' | 'task_write' | 'admin') => void;
  onRestartMcpServer: () => void;
  mcpHealthResult: McpHealthCheckResult | null;
  mcpHealthCheckRunning: boolean;
  onRunMcpHealthCheck: () => void;
  mcpRestartPending: boolean;
  onRefreshMcpAuditLog: () => void;
  storageMeter: StorageMeter;
}

export function PreferencesPanel({
  isOpen,
  onClose,
  initialAnchor,
  statusColumns,
  executionLoadStatusIds,
  pipelineLoadStatusIds,
  people,
  tasks,
  agentWatchConfigs,
  agentWatchRuntime,
  onExecutionLoadStatusChange,
  onPipelineLoadStatusChange,
  onAddPerson,
  onUpdatePerson,
  onDeletePerson,
  onSaveAgentWatchConfig,
  onRemoveAgentWatchConfig,
  onPollAgentWatch,
  onNukeLocalData,
  onExportTasksAndProjects,
  onImportTasksAndProjects,
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
  onMcpAgentAccessToggle,
  onMcpAddressChange,
  onMcpBindHostChange,
  onMcpPortChange,
  onMcpAccessTokenChange,
  onMcpAccessTokenRotate,
  onMcpAccessTokenTtlMinutesChange,
  onMcpCapabilityProfileChange,
  onRestartMcpServer,
  mcpHealthResult,
  mcpHealthCheckRunning,
  onRunMcpHealthCheck,
  mcpRestartPending,
  onRefreshMcpAuditLog,
  storageMeter,
}: PreferencesPanelProps) {
  const [copied, setCopied] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedWriteCommand, setCopiedWriteCommand] = useState(false);
  const [copiedStdioCommand, setCopiedStdioCommand] = useState(false);
  const [copiedTunnelCommand, setCopiedTunnelCommand] = useState(false);
  const [copiedAuditLog, setCopiedAuditLog] = useState(false);
  const hasMcpToken = Boolean(mcpAccessToken.trim());

  const tokenExpiryLabel = (() => {
    if (!hasMcpToken) return 'Auth mode: none';
    if (!mcpAccessTokenIssuedAt) return 'Auth mode: token set, expiry unavailable';

    const issuedAtMs = Date.parse(mcpAccessTokenIssuedAt);
    if (Number.isNaN(issuedAtMs)) return 'Auth mode: token set, expiry unavailable';

    const expiresAtMs = issuedAtMs + (mcpAccessTokenTtlMinutes * 60 * 1000);
    const remainingMs = expiresAtMs - Date.now();
    if (remainingMs <= 0) {
      return 'Auth mode: token expired';
    }

    const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
    return `Auth mode: token active, expires in ~${remainingMinutes} min`;
  })();

  const listenerStatusLabel = (() => {
    if (!mcpAgentAccessEnabled) return 'Listener status: disabled';
    if (!mcpListenerStatus) return 'Listener status: not checked';

    if (mcpListenerStatus.status === 'running') {
      return `Listener status: running${mcpListenerStatus.boundUrl ? ` at ${mcpListenerStatus.boundUrl}` : ''}`;
    }
    if (mcpListenerStatus.status === 'starting') {
      return 'Listener status: starting';
    }
    if (mcpListenerStatus.status === 'error') {
      return `Listener status: error${mcpListenerStatus.error ? ` - ${mcpListenerStatus.error}` : ''}`;
    }
    if (mcpListenerStatus.status === 'stopped') {
      return 'Listener status: stopped';
    }
    return 'Listener status: disabled';
  })();

  const curlCommand = [
    `curl -sS -X POST http://${mcpBindHost}:${mcpPort}/mcp \\`,
    `  -H 'Content-Type: application/json' \\`,
    hasMcpToken ? `  -H 'Authorization: Bearer ${mcpAccessToken}' \\` : `  -H 'Authorization: Bearer <token>' \\`,
    `  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list","params":{}}'`,
  ].join('\n');

  const stdioCommand = 'node electron/scripts/mcp-stdio.cjs';
  const tunnelCommand = `npx localtunnel --port ${mcpPort}`;
  const writeCommand = [
    `curl -sS -X POST http://${mcpBindHost}:${mcpPort}/mcp \\`,
    `  -H 'Content-Type: application/json' \\`,
    hasMcpToken ? `  -H 'Authorization: Bearer ${mcpAccessToken}' \\` : `  -H 'Authorization: Bearer <token>' \\`,
    `  -d '{"jsonrpc":"2.0","id":"2","method":"tools/call","params":{"name":"tasks.transition_under_review","arguments":{"taskId":"<task-id>","expectedRevision":<revision>}}}'`,
    '',
    `curl -sS -X POST http://${mcpBindHost}:${mcpPort}/mcp \\`,
    `  -H 'Content-Type: application/json' \\`,
    hasMcpToken ? `  -H 'Authorization: Bearer ${mcpAccessToken}' \\` : `  -H 'Authorization: Bearer <token>' \\`,
    `  -d '{"jsonrpc":"2.0","id":"3","method":"tools/call","params":{"name":"tasks.update_completion_description","arguments":{"taskId":"<task-id>","completion":"<brief summary>","expectedRevision":<revision>}}}'`,
  ].join('\n');

  const retryGuidance = 'If a write returns REVISION_MISMATCH, re-read the task, use the latest __mcpRevision, then retry once.';
  const auditLogJson = JSON.stringify(mcpAuditLog, null, 2);

  const isRemoteMcpAddress = (() => {
    try {
      const host = new URL(mcpAddress).hostname.toLowerCase();
      return !['localhost', '127.0.0.1', '::1'].includes(host);
    } catch {
      return false;
    }
  })();

  const remoteTokenWarning =
    mcpAgentAccessEnabled && isRemoteMcpAddress && !hasMcpToken
      ? 'Remote MCP is enabled without a token. Add one before sharing this URL.'
      : null;

  const connectionStatusLabel = (() => {
    if (!mcpAgentAccessEnabled) return 'Connection status: disabled';
    if (mcpHealthResult?.connectionStatus === 'auth-error') return 'Connection status: auth error';
    if (mcpHealthResult?.connectionStatus === 'handshake-error') return 'Connection status: handshake error';
    if (mcpHealthResult?.connectionStatus === 'local-ready') return 'Connection status: local ready';
    if (mcpHealthResult?.connectionStatus === 'remote-ready') return 'Connection status: remote ready';
    if (mcpListenerStatus?.status === 'running') return 'Connection status: listener running';
    if (mcpListenerStatus?.status === 'error') return 'Connection status: listener error';
    if (mcpListenerStatus?.status === 'starting') return 'Connection status: listener starting';
    return mcpHealthResult ? 'Connection status: unknown' : 'Connection status: not checked';
  })();

  const copyText = async (text: string, setCopiedState: (copied: boolean) => void) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (typeof window !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedState(true);
      window.setTimeout(() => setCopiedState(false), 1400);
    } catch {
      setCopiedState(false);
    }
  };

  const copyMcpAddress = async () => {
    await copyText(mcpAddress, setCopied);
  };

  const copyMcpCommand = async () => {
    await copyText(curlCommand, setCopiedCommand);
  };

  const copyWriteCommand = async () => {
    await copyText(writeCommand, setCopiedWriteCommand);
  };

  const copyStdioCommand = async () => {
    await copyText(stdioCommand, setCopiedStdioCommand);
  };

  const copyTunnelCommand = async () => {
    await copyText(tunnelCommand, setCopiedTunnelCommand);
  };

  const copyAuditLog = async () => {
    await copyText(auditLogJson, setCopiedAuditLog);
  };

  const exportAuditLog = () => {
    if (typeof window === 'undefined') return;
    const blob = new Blob([auditLogJson], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `plumy-mcp-audit-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <SettingsPanel isOpen={isOpen} onClose={onClose} initialAnchor={initialAnchor}>
      <TasksSettingsSection
        statusColumns={statusColumns}
        executionLoadStatusIds={executionLoadStatusIds}
        pipelineLoadStatusIds={pipelineLoadStatusIds}
        people={people}
        agentWatchConfigs={agentWatchConfigs}
        agentWatchRuntime={agentWatchRuntime}
        onExecutionLoadStatusChange={onExecutionLoadStatusChange}
        onPipelineLoadStatusChange={onPipelineLoadStatusChange}
        onSaveAgentWatchConfig={onSaveAgentWatchConfig}
        onRemoveAgentWatchConfig={onRemoveAgentWatchConfig}
        onPollAgentWatch={onPollAgentWatch}
      />

      <PeopleManagementSections
        people={people}
        tasks={tasks}
        statusColumns={statusColumns}
        executionLoadStatusIds={executionLoadStatusIds}
        pipelineLoadStatusIds={pipelineLoadStatusIds}
        onAddPerson={onAddPerson}
        onUpdatePerson={onUpdatePerson}
        onDeletePerson={onDeletePerson}
      />

      <McpSettingsSection>
        <McpAccessSettingsSection
          agentAccessEnabled={mcpAgentAccessEnabled}
          address={mcpAddress}
          bindHost={mcpBindHost}
          port={mcpPort}
          accessToken={mcpAccessToken}
          accessTokenTtlMinutes={mcpAccessTokenTtlMinutes}
          capabilityProfile={mcpCapabilityProfile}
          copiedAddress={copied}
          copiedStdioCommand={copiedStdioCommand}
          listenerStatus={mcpListenerStatus}
          listenerStatusLabel={listenerStatusLabel}
          connectionStatusLabel={connectionStatusLabel}
          tokenExpiryLabel={tokenExpiryLabel}
          restartPending={mcpRestartPending}
          remoteTokenWarning={remoteTokenWarning}
          stdioCommand={stdioCommand}
          healthResult={mcpHealthResult}
          healthRunning={mcpHealthCheckRunning}
          onAgentAccessToggle={onMcpAgentAccessToggle}
          onAddressChange={onMcpAddressChange}
          onBindHostChange={onMcpBindHostChange}
          onPortChange={onMcpPortChange}
          onAccessTokenChange={onMcpAccessTokenChange}
          onAccessTokenRotate={onMcpAccessTokenRotate}
          onAccessTokenTtlMinutesChange={onMcpAccessTokenTtlMinutesChange}
          onCapabilityProfileChange={onMcpCapabilityProfileChange}
          onRestartServer={onRestartMcpServer}
          onCopyAddress={copyMcpAddress}
          onCopyStdioCommand={copyStdioCommand}
          onRunHealthCheck={onRunMcpHealthCheck}
        />
      </McpSettingsSection>

      <McpTestingSettingsSection>
        <McpCommandSettingsSection
          testCommand={curlCommand}
          writeCommand={writeCommand}
          stdioCommand={stdioCommand}
          tunnelCommand={tunnelCommand}
          retryGuidance={retryGuidance}
          copiedTestCommand={copiedCommand}
          copiedWriteCommand={copiedWriteCommand}
          copiedStdioCommand={copiedStdioCommand}
          copiedTunnelCommand={copiedTunnelCommand}
          onCopyTestCommand={copyMcpCommand}
          onCopyWriteCommand={copyWriteCommand}
          onCopyStdioCommand={copyStdioCommand}
          onCopyTunnelCommand={copyTunnelCommand}
        />
      </McpTestingSettingsSection>

      <McpActivitySettingsSection>
        <McpActivityLogSection
          auditLog={mcpAuditLog}
          copied={copiedAuditLog}
          onRefresh={onRefreshMcpAuditLog}
          onCopy={copyAuditLog}
          onExport={exportAuditLog}
        />
      </McpActivitySettingsSection>

      <DataSettingsSection
        storageMeter={storageMeter}
        onNukeLocalData={onNukeLocalData}
        onExportTasksAndProjects={onExportTasksAndProjects}
        onImportTasksAndProjects={onImportTasksAndProjects}
      />
    </SettingsPanel>
  );
}
