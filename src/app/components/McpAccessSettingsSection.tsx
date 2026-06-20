import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { CopyableField } from './CopyableField';

type McpCapabilityProfile = 'read_only' | 'task_write' | 'admin';

interface McpAccessSettingsSectionProps {
  agentAccessEnabled: boolean;
  address: string;
  bindHost: string;
  port: number;
  accessToken: string;
  accessTokenTtlMinutes: number;
  capabilityProfile: McpCapabilityProfile;
  copiedAddress: boolean;
  listenerStatus: McpListenerStatus | null;
  listenerStatusLabel: string;
  connectionStatusLabel: string;
  tokenExpiryLabel: string;
  restartPending: boolean;
  remoteTokenWarning: string | null;
  onAgentAccessToggle: (enabled: boolean) => void;
  onAddressChange: (address: string) => void;
  onBindHostChange: (host: string) => void;
  onPortChange: (port: number) => void;
  onAccessTokenChange: (token: string) => void;
  onAccessTokenRotate: () => void;
  onAccessTokenTtlMinutesChange: (ttlMinutes: number) => void;
  onCapabilityProfileChange: (profile: McpCapabilityProfile) => void;
  onRestartServer: () => void;
  onCopyAddress: () => void;
}

export function McpAccessSettingsSection({
  agentAccessEnabled,
  address,
  bindHost,
  port,
  accessToken,
  accessTokenTtlMinutes,
  capabilityProfile,
  copiedAddress,
  listenerStatus,
  listenerStatusLabel,
  connectionStatusLabel,
  tokenExpiryLabel,
  restartPending,
  remoteTokenWarning,
  onAgentAccessToggle,
  onAddressChange,
  onBindHostChange,
  onPortChange,
  onAccessTokenChange,
  onAccessTokenRotate,
  onAccessTokenTtlMinutesChange,
  onCapabilityProfileChange,
  onRestartServer,
  onCopyAddress,
}: McpAccessSettingsSectionProps) {
  return (
    <>
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
          aria-checked={agentAccessEnabled}
          aria-label="Toggle agent MCP access"
          onClick={() => onAgentAccessToggle(!agentAccessEnabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
            agentAccessEnabled ? 'bg-[#020329] border-[#020329]' : 'bg-gray-300 border-gray-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              agentAccessEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mcp-bind-host">MCP listener</Label>
        <div className="grid grid-cols-3 gap-2">
          <Input
            id="mcp-bind-host"
            value={bindHost}
            onChange={(event) => onBindHostChange(event.target.value)}
            placeholder="127.0.0.1"
            className="col-span-2"
          />
          <Input
            id="mcp-port"
            type="number"
            min={1}
            max={65535}
            value={port}
            onChange={(event) => onPortChange(Number(event.target.value))}
            placeholder="3456"
          />
        </div>
        <p className="text-xs text-gray-500">
          Change host/port then press restart to rebind the MCP listener.
        </p>
        <Button type="button" variant="outline" onClick={onRestartServer}>
          Restart MCP listener
        </Button>
      </div>

      <CopyableField
        id="mcp-address"
        label="Public MCP URL (for agents)"
        value={address}
        onChange={onAddressChange}
        onCopy={onCopyAddress}
        copied={copiedAddress}
        description="Use this URL when configuring external agents/tunnels."
      />

      <div className="space-y-2">
        <Label htmlFor="mcp-token">MCP Access Token (optional)</Label>
        <div className="flex gap-2">
          <Input
            id="mcp-token"
            type="password"
            value={accessToken}
            onChange={(event) => onAccessTokenChange(event.target.value)}
            placeholder="Bearer token required when set"
            className="flex-1"
          />
          <Button type="button" variant="outline" onClick={onAccessTokenRotate}>
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
          value={accessTokenTtlMinutes}
          onChange={(event) => onAccessTokenTtlMinutesChange(Number(event.target.value))}
        />
        <p className="text-xs text-gray-500">
          Token expires after this many minutes from when it was last set.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mcp-capability-profile">MCP capability profile</Label>
        <Select
          value={capabilityProfile}
          onValueChange={(value) => onCapabilityProfileChange(value as McpCapabilityProfile)}
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

      <div className="space-y-1 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <p>{listenerStatusLabel}</p>
        <p>{connectionStatusLabel}</p>
        <p>{tokenExpiryLabel}</p>
        {listenerStatus?.error && (
          <p className="text-amber-700">Last listener error: {listenerStatus.error}</p>
        )}
        {listenerStatus?.boundUrl && (
          <p>Bound URL: {listenerStatus.boundUrl}</p>
        )}
        <p>
          {restartPending
            ? 'Restart required after host, port, token, or capability profile changes.'
            : 'Listener config applied.'}
        </p>
      </div>
      {remoteTokenWarning && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {remoteTokenWarning}
        </p>
      )}
    </>
  );
}
