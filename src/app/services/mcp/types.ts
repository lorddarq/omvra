export interface McpClientConfig {
  enabled: boolean;
  endpoint: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface McpResourceResponse {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export type McpReadToolName =
  | 'workspace.get_snapshot'
  | 'tasks.list'
  | 'tasks.get'
  | 'cards.kanban.list'
  | 'cards.timeline.list';

export interface McpDiagnosticsResult {
  ok: boolean;
  endpoint: string;
  latencyMs?: number;
  toolCount?: number;
  error?: string;
}

export interface McpSnapshotExpectation {
  counts?: {
    tasks?: number;
    people?: number;
    swimlanes?: number;
    statusColumns?: number;
  };
  requiredTaskKeys?: string[];
  requiredPersonKeys?: string[];
  requiredStatusColumnKeys?: string[];
}

export interface McpHealthCheckResult {
  ok: boolean;
  endpoint: string;
  latencyMs?: number;
  toolsAvailable: string[];
  missingTools: string[];
  resourceReadSupported: boolean;
  resourcesAvailable: string[];
  resourcesMissing: string[];
  snapshotCounts?: {
    tasks: number;
    people: number;
    swimlanes: number;
    statusColumns: number;
  };
  expectedCounts?: {
    tasks?: number;
    people?: number;
    swimlanes?: number;
    statusColumns?: number;
  };
  countParity: boolean;
  requiredKeyParity: boolean;
  medianLogicalCalls?: number;
  errors: string[];
}

export interface McpWorkspaceSnapshot {
  workspaceId?: string;
  name?: string;
  tasks?: unknown[];
  projects?: unknown[];
  people?: unknown[];
  statusColumns?: unknown[];
  readOnly?: boolean;
  schemaVersion?: string;
  generatedAt?: string;
  workspace?: {
    tasks?: unknown[];
    people?: unknown[];
    projects?: unknown[];
    swimlanes?: unknown[];
    statusColumns?: unknown[];
  };
  [key: string]: unknown;
}

export interface McpTaskSummary {
  id: string;
  title?: string;
  status?: string;
  [key: string]: unknown;
}

export interface McpCard {
  id: string;
  [key: string]: unknown;
}
