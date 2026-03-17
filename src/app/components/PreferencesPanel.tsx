import { useRef, useState } from 'react';
import { TaskStatus } from '../types';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Copy } from 'lucide-react';
import { McpHealthCheckResult } from '../services/mcp/types';

interface StorageMeter {
  usedBytes: number;
  totalBytes: number;
  usagePercent: number;
  sourceLabel: string;
}

interface PreferencesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  statusColumns: Array<{ id: TaskStatus; title: string; color?: string }>;
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
  mcpAccessTokenTtlMinutes: number;
  mcpCapabilityProfile: 'read_only' | 'task_write' | 'admin';
  onMcpAgentAccessToggle: (enabled: boolean) => void;
  onMcpAddressChange: (address: string) => void;
  onMcpBindHostChange: (host: string) => void;
  onMcpPortChange: (port: number) => void;
  onMcpAccessTokenChange: (token: string) => void;
  onMcpAccessTokenTtlMinutesChange: (ttlMinutes: number) => void;
  onMcpCapabilityProfileChange: (profile: 'read_only' | 'task_write' | 'admin') => void;
  onRestartMcpServer: () => void;
  showMcpHealthDiagnostics: boolean;
  mcpHealthResult: McpHealthCheckResult | null;
  mcpHealthCheckRunning: boolean;
  onRunMcpHealthCheck: () => void;
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
  mcpAccessTokenTtlMinutes,
  mcpCapabilityProfile,
  onMcpAgentAccessToggle,
  onMcpAddressChange,
  onMcpBindHostChange,
  onMcpPortChange,
  onMcpAccessTokenChange,
  onMcpAccessTokenTtlMinutesChange,
  onMcpCapabilityProfileChange,
  onRestartMcpServer,
  showMcpHealthDiagnostics,
  mcpHealthResult,
  mcpHealthCheckRunning,
  onRunMcpHealthCheck,
  storageMeter,
}: PreferencesPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedTunnelCommand, setCopiedTunnelCommand] = useState(false);

  const curlCommand = [
    `curl -sS -X POST http://${mcpBindHost}:${mcpPort}/mcp \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H 'Authorization: Bearer ${mcpAccessToken}' \\`,
    `  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list","params":{}}'`,
  ].join('\n');

  const tunnelCommand = `npx localtunnel --port ${mcpPort}`;

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

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="px-6">
          <SheetTitle>Preferences</SheetTitle>
          <SheetDescription>
            Configure how team load is calculated in the People panel.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 px-6 space-y-6">
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
              <Input
                id="mcp-token"
                type="password"
                value={mcpAccessToken}
                onChange={(e) => onMcpAccessTokenChange(e.target.value)}
                placeholder="Bearer token required when set"
              />
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
                      <p className="text-amber-700">
                        {mcpHealthResult.errors[0]}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="execution-load-status">Execution load column</Label>
            <Select
              value={executionLoadStatusId}
              onValueChange={(value) => onExecutionLoadStatusChange(value as TaskStatus)}
            >
              <SelectTrigger id="execution-load-status">
                <SelectValue placeholder="Select execution status" />
              </SelectTrigger>
              <SelectContent>
                {statusColumns.map(col => (
                  <SelectItem key={col.id} value={col.id}>
                    {col.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Only tasks in this column count toward execution load.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pipeline-load-status">Pipeline load column</Label>
            <Select
              value={pipelineLoadStatusId}
              onValueChange={(value) => onPipelineLoadStatusChange(value as TaskStatus)}
            >
              <SelectTrigger id="pipeline-load-status">
                <SelectValue placeholder="Select pipeline status" />
              </SelectTrigger>
              <SelectContent>
                {statusColumns.map(col => (
                  <SelectItem key={col.id} value={col.id}>
                    {col.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Tasks in this column count toward pipeline pressure.
            </p>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div className="text-sm font-semibold text-gray-900">Storage usage</div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-blue-500 transition-[width] duration-300"
                style={{ width: `${storageMeter.usagePercent}%` }}
              />
            </div>
            <div className="text-xs text-gray-500">
              {formatBytes(storageMeter.usedBytes)} used of {formatBytes(storageMeter.totalBytes)} available ({storageMeter.usagePercent}%)
            </div>
            <div className="text-[11px] text-gray-400">
              Source: {storageMeter.sourceLabel}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div className="text-sm font-semibold text-gray-900">Backup and reset</div>
            <p className="text-xs text-gray-500">
              Export tasks and projects for backup, or import them from a previous export.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={onExportTasksAndProjects}>
                Export tasks + projects
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Import tasks + projects
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onImportTasksAndProjects(file);
                }
                e.currentTarget.value = '';
              }}
            />
            <Button type="button" variant="destructive" onClick={onNukeLocalData}>
              Nuke local storage
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
