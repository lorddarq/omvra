/** Main-process-only API. IPC consumers must project out provider_session_ref / opaqueSessionRef.
 * The caller validates external task/attempt/Goal references through their governed services.
 * The session service enables the live runner only after verified migration/cutover.
 */
export type WorkScope = { kind: 'task'; taskId: string; executionAttemptId: string; taskRevision: number; contributionId?: string }
  | { kind: 'goal-node'; goalId: string; goalElementId: string; goalExecutionId: string; executionAttempt: number; goalRevision: number };
export type SessionState = 'starting' | 'ready' | 'interrupted' | 'closed' | 'failed' | 'active' | 'needs-input' | 'cancelling';
export type TurnState = 'queued' | 'starting' | 'active' | 'waiting-input' | 'cancelling' | 'completed' | 'failed' | 'interrupted';
export type Capability = { id: string; support: 'supported' | 'unsupported' | 'unknown'; version?: string };
export type Turn = { id: string; state: TurnState; requestId?: string; createdAt?: string; updatedAt?: string; startedAt?: string; finishedAt?: string; terminalReason?: string };
export type Binding = { schemaVersion: 1; id: string; revision: number; idempotencyKey: string; runtimeProfileId: string; scope: WorkScope; state: SessionState; capabilities: Capability[]; createdAt: string; updatedAt: string; lastObservedAt: string; opaqueSessionRef?: string; terminalReason?: string; turn?: Turn };
export type CreateSession = { runtimeProfileId: string; scope: WorkScope; idempotencyKey: string; capabilities?: Capability[]; turn?: Turn };
export type UpdateSession = { bindingId: string; expectedRevision: number; state?: SessionState; opaqueSessionRef?: string; terminalReason?: 'closed' | 'cancelled' | 'process-exit' | 'runtime-missing' | 'protocol-error'; capabilities?: Capability[]; turn?: Turn; recoveryRequired?: boolean };
export type EventInput = {
  bindingId: string; runtimeProfileId: string; idempotencyKey: string; kind: string; id?: string; turnId?: string; seq?: number;
  state?: string; outcome?: string; sourceProtocol?: 'acp' | 'codex-app-server' | 'claude-stream-json' | 'unknown'; nativeEventType?: string; observedAt?: string;
  requestId?: string; capabilityId?: string; permissionState?: 'requested' | 'allowed' | 'denied' | 'cancelled' | 'unknown';
  inputTokens?: number; outputTokens?: number; totalTokens?: number; contextTokens?: number; cost?: number; currency?: string; usageAggregation?: 'cumulative' | 'delta' | 'unknown';
};
export type EventRow = { id: string; session_id: string; turn_id: string | null; seq: number; idempotency_key: string; kind: string; native_type: string; priority: number; summary: string; facts_json: string; observed_at: number; created_at: number };
export type TurnRow = { id: string; session_id: string; turn_index: number; state: TurnState; request_id: string | null; created_at: number; updated_at: number; started_at: number | null; finished_at: number | null; outcome: string | null; final_summary: string | null; final_summary_version: number; error_code: string | null; governance_json: string };
export type SessionRow = {
  id: string; revision: number; idempotency_key: string; runtime_profile_id: string; provider: string | null; source_protocol: string; scope_kind: WorkScope['kind'];
  task_id: string | null; contribution_id: string | null; attempt_id: string | null; goal_id: string | null; goal_element_id: string | null; goal_execution_id: string | null; goal_execution_attempt: number | null;
  source_revision: number; provider_session_ref: string | null; state: SessionState; attention_state: string; capabilities_json: string; created_at: number; updated_at: number; last_observed_at: number; finished_at: number | null; terminal_reason: string | null;
  last_event_seq: number; pruned_through_seq: number; snapshot_version: number; recovery_required: 0 | 1; governance_json: string;
};
export type ProjectionRow = { task_id: string; attempt_id: string; session_id: string; latest_state: string; latest_attention_state: string; latest_summary: string | null; started_at: number | null; finished_at: number | null; updated_at: number; projection_version: number };
export type NotificationRow = { id: string; session_id: string; turn_id: string | null; priority: number; dedupe_key: string; summary: string; created_at: number; expires_at: number; delivered_at: number | null; dismissed_at: number | null };
export type Snapshot = { binding: Binding; session: SessionRow; turn: TurnRow | null; events: EventRow[]; hasMore: boolean; projection: ProjectionRow | null; notifications: NotificationRow[] };
export type RetentionPolicy = { eventDays: 1 | 7 | 30 | 90; eventsPerSession: number; events: number; notificationDays: 1 | 7 | 30 | 90; notifications: number; sessionDays: 1 | 7 | 30 | 90; sessions: number; turns: number; summaryDays: 1 | 7 | 30 | 90; projections: number; automatic: boolean };
export type Checkpoint = { busy: number; log: number; checkpointed: number };
export type StorageError = { code: string; message: string };
export type Metrics = {
  databaseBytes: number; walBytes: number; logicalBytes: number; freeBytes: number; freePages: number; pages: number;
  counts: Record<'sessions' | 'turns' | 'events' | 'work_projections' | 'delivery_state' | 'notifications', number>;
  protectedRecords: { count: number; oldest: number | null; estimatedBytes: number; categories: Record<string,number> }; policy: RetentionPolicy; policyVersion: number; schemaVersion: 1; driver: 'node:sqlite'; nodeVersion: string; sqliteVersion: string;
  maintenance: { deletedRows: number; pruneDurationMs: number; lastPrune: number | null; lastCheckpoint: (Checkpoint & { at: number }) | null; lastCompaction: (Checkpoint & { at: number }) | null; busyRetries: number; lastError: (StorageError & { at: number }) | null };
  queue: { peakQueue: number; peakBytes: number; coalescedCommands: number; rejectedCommands: number; lastError: StorageError | null; depth: number; bytes: number };
};
export type AgentWorkRepository = {
  preview(input?: {policy?: Partial<RetentionPolicy>}): Promise<Omit<import('./agent-work-maintenance.cjs').PolicyPreview,'id'|'action'|'expiresAt'>>;
  migrationSession(input: {binding: Binding; digest: string}): Promise<{imported?: true; idempotent?: true}>;
  migrationEvent(input: {event: EventInput}): ReturnType<AgentWorkRepository['appendEvent']>;
  migrationFinalize(input: {bindingId: string}): Promise<{finalized: true}>;
  migrationVerify(): Promise<{sessions: number; events: number; sessionDigest: string; eventDigest: string}>;
  resumeMaintenance(): void;
  governance(input: {bindingId: string}): Promise<{binding: Binding; latestUsage: unknown; metrics: {turns: number | null; toolCalls: number | null; reportedTokens: number | null; reportedCost: number | null; concurrency: number; attempts: number}}>;
  createSession(input: CreateSession): Promise<{ ok: true; binding: Binding; idempotent: boolean }>;
  updateSession(input: UpdateSession): Promise<{ ok: true; binding: Binding }>;
  appendEvent(input: EventInput): Promise<{ persisted: boolean; seq?: number; idempotent?: boolean; alreadyPruned?: boolean; event?: EventRow; reason?: 'storage-pressure' }>;
  /** Resolves after one commit of final summary/projection/notification. Publish snapshot first, attention second. */
  completeTurn(input: { bindingId: string; expectedRevision: number; turnId: string; outcome: 'completed' | 'failed' | 'interrupted'; idempotencyKey: string }): Promise<{ idempotent?: boolean; snapshot: Snapshot; notification: NotificationRow | null }>;
  snapshot(input: { bindingId: string; limit?: number; afterSeq?: number }): Promise<Snapshot>;
  listSessions(input?: { limit?: number; afterId?: string; taskId?: string; activeOnly?: boolean; recent?: boolean }): Promise<{ sessions: Binding[]; hasMore: boolean }>;
  saveDelivery(input: { bindingId: string; surface: 'supervisor' | 'status' | 'toast'; lastSnapshotVersion: number; lastSentSeq: number; quietUntil?: number | null }): Promise<{ saved: true }>;
  ackNotification(input: { id: string; dismiss?: boolean }): Promise<{ changed: boolean }>;
  /** Call with preferences on open; this repository never becomes a settings authority. */
  setPolicy(input: Partial<RetentionPolicy>): Promise<{ policy: RetentionPolicy; policyVersion: number }>;
  metrics(): Promise<Metrics>;
  /** One <=200-row batch, yielding/cancellation belongs to the owner of a multi-batch UI operation. */
  prune(): Promise<{ deletedRows: number; summariesCleared: number; more: boolean; durationMs: number }>;
  checkpoint(): Promise<Checkpoint>;
  compact(): Promise<{ deletedRows: 0; more: boolean; deferred?: boolean; reason?: string; reclaimedBytes?: number; busy?: number }>;
  close(): Promise<void>;
};
export function createAgentWorkRepository(options: { storePath: string; policy?: Partial<RetentionPolicy>; maintenanceSuspended?: boolean }): Promise<AgentWorkRepository>;
