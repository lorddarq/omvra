import { McpCommandBlock } from './McpCommandBlock';

interface McpCommandSettingsSectionProps {
  testCommand: string;
  writeCommand: string;
  stdioCommand: string;
  tunnelCommand: string;
  retryGuidance: string;
  copiedTestCommand: boolean;
  copiedWriteCommand: boolean;
  copiedStdioCommand: boolean;
  copiedTunnelCommand: boolean;
  onCopyTestCommand: () => void;
  onCopyWriteCommand: () => void;
  onCopyStdioCommand: () => void;
  onCopyTunnelCommand: () => void;
}

export function McpCommandSettingsSection({
  testCommand,
  writeCommand,
  stdioCommand,
  tunnelCommand,
  retryGuidance,
  copiedTestCommand,
  copiedWriteCommand,
  copiedStdioCommand,
  copiedTunnelCommand,
  onCopyTestCommand,
  onCopyWriteCommand,
  onCopyStdioCommand,
  onCopyTunnelCommand,
}: McpCommandSettingsSectionProps) {
  return (
    <>
      <McpCommandBlock
        title="MCP Test Command"
        command={testCommand}
        onCopy={onCopyTestCommand}
        copied={copiedTestCommand}
        description="Generated from current MCP host, port, and token settings."
      />

      <McpCommandBlock
        title="MCP Write Examples"
        command={writeCommand}
        onCopy={onCopyWriteCommand}
        copied={copiedWriteCommand}
        copyLabel="Copy examples"
        footer={(
          <>
            <p>
              Replace `&lt;task-id&gt;` and `&lt;revision&gt;` with values from `workspace.get_snapshot`.
            </p>
            <p>{retryGuidance}</p>
          </>
        )}
      />

      <McpCommandBlock
        title="Local MCP (stdio)"
        command={stdioCommand}
        onCopy={onCopyStdioCommand}
        copied={copiedStdioCommand}
        description="Use this when your client supports command-based MCP servers. It avoids ports and tunnels."
        footer={<p className="text-[11px]">Run this from the repository root.</p>}
        variant="subtle"
      />

      <McpCommandBlock
        title="LocalTunnel Command"
        command={tunnelCommand}
        onCopy={onCopyTunnelCommand}
        copied={copiedTunnelCommand}
        copyLabel="Copy tunnel command"
        footer={(
          <>
            <p>Run this in Terminal to expose your local MCP endpoint publicly.</p>
            <p>To close localtunnel: press `Ctrl + C` in that terminal window.</p>
            <p>If it was started in background: `pkill -f localtunnel`.</p>
          </>
        )}
      />
    </>
  );
}
