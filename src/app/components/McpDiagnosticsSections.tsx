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
}

export function McpActivityLogSection({
  auditLog,
  copied,
  onRefresh,
  onCopy,
  onExport,
}: McpActivityLogSectionProps) {
  return (
    <div className="space-y-2 rounded-lg border bg-gray-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">MCP activity log</div>
          <p className="text-xs text-gray-500">
            Recent MCP reads and writes recorded by the local listener. Useful for debugging agent behavior.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onRefresh}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button type="button" variant="outline" onClick={onCopy}>
            <Copy className="mr-2 h-4 w-4" />
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button type="button" variant="outline" onClick={onExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>
      {auditLog.length === 0 ? (
        <p className="rounded-md border border-dashed bg-white px-3 py-4 text-xs text-gray-500">
          No MCP activity recorded yet.
        </p>
      ) : (
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border bg-white p-3">
          {auditLog.map((entry) => (
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

function describeAuditEntry(entry: McpAuditEntry) {
  const action = typeof entry.toolName === 'string' && entry.toolName
    ? entry.toolName
    : typeof entry.method === 'string' && entry.method
      ? entry.method
      : entry.type || 'mcp_event';
  const outcome = typeof entry.outcome === 'string' && entry.outcome ? entry.outcome : 'recorded';
  const target = typeof entry.taskId === 'string' && entry.taskId ? `task ${entry.taskId}` : null;
  const reason = typeof entry.reason === 'string' && entry.reason ? entry.reason : null;
  return [action, outcome, target, reason].filter(Boolean).join(' · ');
}
