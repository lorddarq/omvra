import { Copy, Download, RefreshCcw } from 'lucide-react';
import type { McpHealthCheckResult } from '../services/mcp/types';
import { Button } from './ui/button';
import { Label } from './ui/label';

interface McpActivityLogSectionProps {
  auditLog: McpAuditEntry[];
  copied: boolean;
  onRefresh: () => void;
  onCopy: () => void;
  onExport: () => void;
  listenerStatusLabel: string;
  connectionStatusLabel: string;
  tokenExpiryLabel: string;
  boundUrl?: string | null;
  restartPending: boolean;
}

export function McpActivityLogSection({
  auditLog,
  copied,
  onRefresh,
  onCopy,
  onExport,
  listenerStatusLabel,
  connectionStatusLabel,
  tokenExpiryLabel,
  boundUrl,
  restartPending,
}: McpActivityLogSectionProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="text-sm font-semibold leading-5 text-[#71717a]">Activity Log</div>
          <p className="text-xs leading-4 text-[#6a7282] text-pretty">
            Recent MCP reads and writes recorded by the local listener. Useful for debugging agent behavior.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ActivityActionButton onClick={onRefresh}>
            <RefreshCcw className="size-4" />
            Refresh
          </ActivityActionButton>
          <ActivityActionButton onClick={onCopy}>
            <Copy className="size-4" />
            {copied ? 'Copied' : 'Copy'}
          </ActivityActionButton>
          <ActivityActionButton onClick={onExport}>
            <Download className="size-4" />
            Export Log
          </ActivityActionButton>
        </div>
      </div>

      {auditLog.length === 0 ? (
        <p className="rounded-xl bg-[#fafafa] px-3 py-4 text-xs leading-4 text-[#6a7282]">
          No MCP activity recorded yet.
        </p>
      ) : (
        <div className="max-h-[422px] overflow-y-auto rounded-xl bg-[#f7f7f8] px-3 py-3">
          {auditLog.map((entry) => (
            <ActivityLogEntry key={entry.auditId} entry={entry} />
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div className="text-sm font-semibold leading-5 text-[#71717a]">Status</div>
        <div className="rounded-xl bg-[#fafafa] px-3 py-3 text-xs leading-4 text-[#6a7282]">
          <p>{listenerStatusLabel}</p>
          <p>{connectionStatusLabel}</p>
          <p>{tokenExpiryLabel}</p>
          {boundUrl && <p>Bound URL: {boundUrl}</p>}
          <p>
            {restartPending
              ? 'Restart required after host, port, token, or capability profile changes.'
              : 'Listener config applied.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function ActivityActionButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-3 text-sm font-medium leading-5 text-[#71717a] outline-none transition-[background-color,color] hover:bg-[#71717a]/5 focus-visible:ring-2 focus-visible:ring-gray-300"
    >
      {children}
    </button>
  );
}

function ActivityLogEntry({ entry }: { entry: McpAuditEntry }) {
  return (
    <div className="border-b border-[#e5e7eb] py-3 last:border-b-0 last:pb-0 first:pt-0">
      <div className="space-y-0.5 text-xs leading-4 text-[#6a7282]">
        <p>{entry.toolName || entry.method || entry.type || 'mcp_event'}</p>
        {entry.outcome && <p>{entry.outcome}</p>}
        {entry.taskId && <p>task: {entry.taskId}</p>}
        <p>{formatAuditTimestamp(entry.timestamp)}</p>
        <p>Audit ID: {entry.auditId}</p>
        {entry.transport && <p className="pt-3">Transport: {entry.transport}</p>}
        {entry.capabilityProfile && <p>Profile: {entry.capabilityProfile}</p>}
        {entry.origin && <p>Origin: {entry.origin}</p>}
      </div>
    </div>
  );
}

interface McpHealthDiagnosticsSectionProps {
  result: McpHealthCheckResult | null;
  running: boolean;
  onRun: () => void;
}

export function McpHealthDiagnosticsSection({
  result,
  running,
  onRun,
}: McpHealthDiagnosticsSectionProps) {
  return (
    <div className="space-y-2 rounded-md border border-dashed p-3">
      <div className="flex items-center justify-between">
        <Label>MCP health diagnostics (dev)</Label>
        <Button type="button" variant="outline" onClick={onRun} disabled={running}>
          {running ? 'Running...' : 'Run health check'}
        </Button>
      </div>
      {!result && (
        <p className="text-xs text-gray-500">
          Checks MCP tools, resources/read availability, snapshot parity, and median logical call count.
        </p>
      )}
      {result && (
        <div className="space-y-1 text-xs text-gray-600">
          <p>
            Status: {result.ok ? 'ok' : 'issues found'} | latency: {result.latencyMs ?? 0}ms
          </p>
          <p>Connection: {result.connectionStatus ?? 'unknown'} | auth: {result.authMode ?? 'none'}</p>
          <p>
            Tools: {result.toolsAvailable.length} available
            {result.missingTools.length ? `, missing: ${result.missingTools.join(', ')}` : ''}
          </p>
          <p>
            Resources/read: {result.resourceReadSupported ? 'supported' : 'not exposed'}
            {result.resourcesAvailable.length
              ? ` (${result.resourcesAvailable.join(', ')})`
              : ''}
          </p>
          <p>
            Snapshot parity: counts {result.countParity ? 'ok' : 'mismatch'}, keys{' '}
            {result.requiredKeyParity ? 'ok' : 'mismatch'}
          </p>
          <p>Median logical calls (MV.2 helper): {result.medianLogicalCalls ?? 'n/a'}</p>
          {result.errors.length > 0 && (
            <div className="space-y-1 pt-1">
              {result.errors.slice(0, 3).map((error) => (
                <p key={error} className="text-amber-700">
                  {error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatAuditTimestamp(timestamp?: string) {
  if (!timestamp) return 'Unknown time';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString();
}
