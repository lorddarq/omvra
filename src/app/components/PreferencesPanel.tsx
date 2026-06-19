import { useState } from 'react';
import { StorageMeter, TaskStatus, StatusColumn } from '../types';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Copy, Download, RefreshCcw } from 'lucide-react';
import { McpHealthCheckResult } from '../services/mcp/types';
import {
  DataSettingsSection,
  McpSettingsSection,
  SettingsPanel,
  TasksSettingsSection,
} from './SettingsPanel';

interface PreferencesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  statusColumns: StatusColumn[];
  executionLoadStatusId: TaskStatus;
  pipelineLoadStatusId: TaskStatus;
  onExecutionLoadStatusChange: (statusId: TaskStatus) => void;
  onPipelineLoadStatusChange: (statusId: TaskStatus) => void;
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
  showMcpHealthDiagnostics: boolean;
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
  statusColumns,
  executionLoadStatusId,
  pipelineLoadStatusId,
  onExecutionLoadStatusChange,
  onPipelineLoadStatusChange,
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
  showMcpHealthDiagnostics,
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

  const copyMcpAddress = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(mcpAddress);
      } else if (typeof window !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = mcpAddress;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  const copyMcpCommand = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(curlCommand);
      } else if (typeof window !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = curlCommand;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedCommand(true);
      window.setTimeout(() => setCopiedCommand(false), 1400);
    } catch {
      setCopiedCommand(false);
    }
  };

  const copyWriteCommand = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(writeCommand);
      } else if (typeof window !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = writeCommand;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedWriteCommand(true);
      window.setTimeout(() => setCopiedWriteCommand(false), 1400);
    } catch {
      setCopiedWriteCommand(false);
    }
  };

  const copyStdioCommand = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(stdioCommand);
      } else if (typeof window !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = stdioCommand;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedStdioCommand(true);
      window.setTimeout(() => setCopiedStdioCommand(false), 1400);
    } catch {
      setCopiedStdioCommand(false);
    }
  };

  const copyTunnelCommand = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(tunnelCommand);
      } else if (typeof window !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = tunnelCommand;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedTunnelCommand(true);
      window.setTimeout(() => setCopiedTunnelCommand(false), 1400);
    } catch {
      setCopiedTunnelCommand(false);
    }
  };

  const copyAuditLog = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(auditLogJson);
      } else if (typeof window !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = auditLogJson;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedAuditLog(true);
      window.setTimeout(() => setCopiedAuditLog(false), 1400);
    } catch {
      setCopiedAuditLog(false);
    }
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

  const formatAuditTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'Unknown time';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    return date.toLocaleString();
  };

  const describeAuditEntry = (entry: McpAuditEntry) => {
    const action = typeof entry.toolName === 'string' && entry.toolName
      ? entry.toolName
      : typeof entry.method === 'string' && entry.method
        ? entry.method
        : entry.type || 'mcp_event';
    const outcome = typeof entry.outcome === 'string' && entry.outcome ? entry.outcome : 'recorded';
    const target = typeof entry.taskId === 'string' && entry.taskId ? `task ${entry.taskId}` : null;
    const reason = typeof entry.reason === 'string' && entry.reason ? entry.reason : null;
    return [action, outcome, target, reason].filter(Boolean).join(' · ');
  };

  return (
    <SettingsPanel isOpen={isOpen} onClose={onClose}>
      <McpSettingsSection>
          <div className="space-y-3 rounded-lg border p-4">
            <div className="text-sm font-semibold text-gray-900">Agent MCP access</div>
            <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
              <div>
                <div className="text-sm font-medium text-gray-900">Allow agent MCP access</div>
                <div className="text-xs text-gray-500">
                  When off, agent MCP clients cannot access this workspace.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={mcpAgentAccessEnabled}
                aria-label="Toggle agent MCP access"
                onClick={() => onMcpAgentAccessToggle(!mcpAgentAccessEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                  mcpAgentAccessEnabled ? 'bg-[#020329] border-[#020329]' : 'bg-gray-300 border-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    mcpAgentAccessEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mcp-bind-host">MCP listener</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  id="mcp-bind-host"
                  value={mcpBindHost}
                  onChange={(e) => onMcpBindHostChange(e.target.value)}
                  placeholder="127.0.0.1"
                  className="col-span-2"
                />
                <Input
                  id="mcp-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={mcpPort}
                  onChange={(e) => onMcpPortChange(Number(e.target.value))}
                  placeholder="3456"
                />
              </div>
              <p className="text-xs text-gray-500">
                Change host/port then press restart to rebind the MCP listener.
              </p>
              <Button type="button" variant="outline" onClick={onRestartMcpServer}>
                Restart MCP listener
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mcp-address">Public MCP URL (for agents)</Label>
              <div className="flex gap-2">
                <Input
                  id="mcp-address"
                  value={mcpAddress}
                  onChange={(e) => onMcpAddressChange(e.target.value)}
                  className="h-10 flex-1"
                />
                <Button type="button" variant="outline" onClick={copyMcpAddress}>
                  <Copy className="mr-2 h-4 w-4" />
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Use this URL when configuring external agents/tunnels.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mcp-token">MCP Access Token (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="mcp-token"
                  type="password"
                  value={mcpAccessToken}
                  onChange={(e) => onMcpAccessTokenChange(e.target.value)}
                  placeholder="Bearer token required when set"
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={onMcpAccessTokenRotate}>
                  Rotate token
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                If set, clients must send `Authorization: Bearer &lt;token&gt;`.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mcp-token-ttl">Token TTL (minutes)</Label>
              <Input
                id="mcp-token-ttl"
                type="number"
                min={1}
                max={1440}
                value={mcpAccessTokenTtlMinutes}
                onChange={(e) => onMcpAccessTokenTtlMinutesChange(Number(e.target.value))}
              />
              <p className="text-xs text-gray-500">
                Token expires after this many minutes from when it was last set.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mcp-capability-profile">MCP capability profile</Label>
              <Select
                value={mcpCapabilityProfile}
                onValueChange={(value) => onMcpCapabilityProfileChange(value as 'read_only' | 'task_write' | 'admin')}
              >
                <SelectTrigger id="mcp-capability-profile">
                  <SelectValue placeholder="Select capability profile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read_only">read_only</SelectItem>
                  <SelectItem value="task_write">task_write</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                `task_write` and `admin` expose safe write MCP tools. Restart listener after changing.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>MCP Test Command</Label>
                <Button type="button" variant="outline" onClick={copyMcpCommand}>
                  <Copy className="mr-2 h-4 w-4" />
                  {copiedCommand ? 'Copied' : 'Copy command'}
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-md border bg-gray-50 p-3 text-xs text-gray-700">
{curlCommand}
              </pre>
              <p className="text-xs text-gray-500">
                Generated from current MCP host, port, and token settings.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>MCP Write Examples</Label>
                <Button type="button" variant="outline" onClick={copyWriteCommand}>
                  <Copy className="mr-2 h-4 w-4" />
                  {copiedWriteCommand ? 'Copied' : 'Copy examples'}
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-md border bg-gray-50 p-3 text-xs text-gray-700">
{writeCommand}
              </pre>
              <p className="text-xs text-gray-500">
                Replace `&lt;task-id&gt;` and `&lt;revision&gt;` with values from `workspace.get_snapshot`.
              </p>
              <p className="text-xs text-gray-500">{retryGuidance}</p>
            </div>

            <div className="space-y-2 rounded-lg border bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">MCP activity log</div>
                  <p className="text-xs text-gray-500">
                    Recent MCP reads and writes recorded by the local listener. Useful for debugging agent behavior.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={onRefreshMcpAuditLog}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                  <Button type="button" variant="outline" onClick={copyAuditLog}>
                    <Copy className="mr-2 h-4 w-4" />
                    {copiedAuditLog ? 'Copied' : 'Copy'}
                  </Button>
                  <Button type="button" variant="outline" onClick={exportAuditLog}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
              {mcpAuditLog.length === 0 ? (
                <p className="rounded-md border border-dashed bg-white px-3 py-4 text-xs text-gray-500">
                  No MCP activity recorded yet.
                </p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border bg-white p-3">
                  {mcpAuditLog.map((entry) => (
                    <div key={entry.auditId} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <p className="font-medium text-gray-900">{describeAuditEntry(entry)}</p>
                        <p className="shrink-0 text-gray-500">{formatAuditTimestamp(entry.timestamp)}</p>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                        <span>Audit ID: {entry.auditId}</span>
                        {entry.capabilityProfile && <span>Profile: {entry.capabilityProfile}</span>}
                        {entry.transport && <span>Transport: {entry.transport}</span>}
                        {entry.origin && <span>Origin: {entry.origin}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <p>{listenerStatusLabel}</p>
              <p>{connectionStatusLabel}</p>
              <p>{tokenExpiryLabel}</p>
              {mcpListenerStatus?.error && (
                <p className="text-amber-700">Last listener error: {mcpListenerStatus.error}</p>
              )}
              {mcpListenerStatus?.boundUrl && (
                <p>Bound URL: {mcpListenerStatus.boundUrl}</p>
              )}
              <p>
                {mcpRestartPending
                  ? 'Restart required after host, port, token, or capability profile changes.'
                  : 'Listener config applied.'}
              </p>
            </div>
            {remoteTokenWarning && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {remoteTokenWarning}
              </p>
            )}

            <div className="space-y-2 rounded-lg border bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Local MCP (stdio)</div>
                  <p className="text-xs text-gray-500">
                    Use this when your client supports command-based MCP servers. It avoids ports and tunnels.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={copyStdioCommand}>
                  <Copy className="mr-2 h-4 w-4" />
                  {copiedStdioCommand ? 'Copied' : 'Copy command'}
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-md border bg-white p-3 text-xs text-gray-700">
{stdioCommand}
              </pre>
              <p className="text-[11px] text-gray-500">
                Run this from the repository root.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>LocalTunnel Command</Label>
                <Button type="button" variant="outline" onClick={copyTunnelCommand}>
                  <Copy className="mr-2 h-4 w-4" />
                  {copiedTunnelCommand ? 'Copied' : 'Copy tunnel command'}
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-md border bg-gray-50 p-3 text-xs text-gray-700">
{tunnelCommand}
              </pre>
              <div className="space-y-1 text-xs text-gray-500">
                <p>Run this in Terminal to expose your local MCP endpoint publicly.</p>
                <p>To close localtunnel: press `Ctrl + C` in that terminal window.</p>
                <p>If it was started in background: `pkill -f localtunnel`.</p>
              </div>
            </div>

            {showMcpHealthDiagnostics && (
              <div className="space-y-2 rounded-md border border-dashed p-3">
                <div className="flex items-center justify-between">
                  <Label>MCP health diagnostics (dev)</Label>
                  <Button type="button" variant="outline" onClick={onRunMcpHealthCheck} disabled={mcpHealthCheckRunning}>
                    {mcpHealthCheckRunning ? 'Running...' : 'Run health check'}
                  </Button>
                </div>
                {!mcpHealthResult && (
                  <p className="text-xs text-gray-500">
                    Checks MCP tools, resources/read availability, snapshot parity, and median logical call count.
                  </p>
                )}
                {mcpHealthResult && (
                  <div className="space-y-1 text-xs text-gray-600">
                    <p>
                      Status: {mcpHealthResult.ok ? 'ok' : 'issues found'} | latency: {mcpHealthResult.latencyMs ?? 0}ms
                    </p>
                    <p>Connection: {mcpHealthResult.connectionStatus ?? 'unknown'} | auth: {mcpHealthResult.authMode ?? 'none'}</p>
                    <p>
                      Tools: {mcpHealthResult.toolsAvailable.length} available
                      {mcpHealthResult.missingTools.length ? `, missing: ${mcpHealthResult.missingTools.join(', ')}` : ''}
                    </p>
                    <p>
                      Resources/read: {mcpHealthResult.resourceReadSupported ? 'supported' : 'not exposed'}
                      {mcpHealthResult.resourcesAvailable.length
                        ? ` (${mcpHealthResult.resourcesAvailable.join(', ')})`
                        : ''}
                    </p>
                    <p>
                      Snapshot parity: counts {mcpHealthResult.countParity ? 'ok' : 'mismatch'}, keys{' '}
                      {mcpHealthResult.requiredKeyParity ? 'ok' : 'mismatch'}
                    </p>
                    <p>Median logical calls (MV.2 helper): {mcpHealthResult.medianLogicalCalls ?? 'n/a'}</p>
                    {mcpHealthResult.errors.length > 0 && (
                      <div className="space-y-1 pt-1">
                        {mcpHealthResult.errors.slice(0, 3).map((error) => (
                          <p key={error} className="text-amber-700">
                            {error}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
      </McpSettingsSection>

      <TasksSettingsSection
        statusColumns={statusColumns}
        executionLoadStatusId={executionLoadStatusId}
        pipelineLoadStatusId={pipelineLoadStatusId}
        onExecutionLoadStatusChange={onExecutionLoadStatusChange}
        onPipelineLoadStatusChange={onPipelineLoadStatusChange}
      />

      <DataSettingsSection
        storageMeter={storageMeter}
        onNukeLocalData={onNukeLocalData}
        onExportTasksAndProjects={onExportTasksAndProjects}
        onImportTasksAndProjects={onImportTasksAndProjects}
      />
    </SettingsPanel>
  );
}
