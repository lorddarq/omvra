// Renderer side of the main-process delivery contract. Envelopes are full replacements:
// control and output lanes keep separate cursors, and gaps are expected after coalescing.

export type DeliveryAttentionCategory = 'permission' | 'input' | 'blocked' | 'failure' | 'cancelled' | 'completed' | 'recovery';

export interface DeliveryAttention {
  id: string;
  category: DeliveryAttentionCategory;
  summary: string;
  createdVersion: number;
  errorCode?: string;
  request?: { bindingId: string; turnId: string; requestId: string | number };
  pendingCount?: number;
}

export interface DeliveryBarrier {
  state: 'none' | 'pending' | 'committed' | 'failed';
  turnId: string | null;
  finalOutputVersion: number | null;
  errorCode?: string;
}

export interface DeliveryActivity {
  tools: { count: number; exact: boolean };
  files: null;
  checks: null;
  lastActivityAt: string | null;
  entries: Array<{ id: string; label: string; count: number; at: string }>;
}

interface DeliveryHeader {
  schemaVersion: number;
  epoch: string;
  bindingId: string;
  turnId: string | null;
  version: number;
  observedAt: string;
}

export interface DeliveryControl {
  connectionState: string | null;
  turnState: string | null;
  taskExecutionState: string | null;
  scope: Record<string, unknown> | null;
  capabilities: Array<{ id: string; support: string }>;
  attention: DeliveryAttention[];
  activity: DeliveryActivity;
  outputVersion: number;
  barrier: DeliveryBarrier;
}

export interface DeliveryOutput {
  outputVersion: number;
  text: string;
  truncated: boolean;
  availability: 'live' | 'summary-only' | 'unavailable';
}

export type DeliveryStateEnvelope = DeliveryHeader & DeliveryControl & { kind: 'state' };
export type DeliveryOutputEnvelope = DeliveryHeader & DeliveryOutput & { kind: 'output' };
export type DeliverySnapshotEnvelope = DeliveryHeader & DeliveryControl & { kind: 'snapshot'; subscriptionId: string; output: DeliveryOutput };
export type DeliveryEnvelope = DeliveryStateEnvelope | DeliveryOutputEnvelope | DeliverySnapshotEnvelope;
export type DeliveryResult<T = Record<string, never>> = ({ ok: true } & T) | { ok: false; error: string };

export interface DeliveryCursor {
  bindingId: string | null;
  subscriptionId: string | null;
  epoch: string | null;
  controlVersion: number;
  control: (DeliveryControl & { turnId: string | null }) | null;
  output: (DeliveryOutput & { turnId: string | null }) | null;
  /** Hidden/minimized supervision keeps control state only; model text is neither retained nor requested. */
  outputSuppressed: boolean;
}

export interface DeliveryApplyResult {
  cursor: DeliveryCursor;
  /** Version to acknowledge after installing output, when output changed. */
  acknowledge: number | null;
  needsSnapshot: boolean;
}

export const emptyDeliveryCursor = (bindingId: string | null = null, subscriptionId: string | null = null, outputSuppressed = false): DeliveryCursor => ({
  bindingId, subscriptionId, epoch: null, controlVersion: -1, control: null, output: null, outputSuppressed,
});

/** Hiding drops retained text immediately; showing waits for the next snapshot to install output. */
export function setDeliveryOutputSuppressed(cursor: DeliveryCursor, suppressed: boolean): DeliveryCursor {
  if (cursor.outputSuppressed === suppressed && (!suppressed || cursor.output === null)) return cursor;
  return { ...cursor, outputSuppressed: suppressed, output: suppressed ? null : cursor.output };
}

// Highest first: requests block the agent, then failures and stops, then plain completion.
const ATTENTION_PRIORITY: DeliveryAttentionCategory[] = ['permission', 'input', 'blocked', 'failure', 'recovery', 'cancelled', 'completed'];

export function primaryDeliveryAttention(control: Pick<DeliveryControl, 'attention'> | null | undefined): DeliveryAttention | undefined {
  if (!control?.attention?.length) return undefined;
  return ATTENTION_PRIORITY.map(category => control.attention.find(record => record.category === category)).find(Boolean);
}

const controlOf = (envelope: DeliveryStateEnvelope | DeliverySnapshotEnvelope) => ({
  connectionState: envelope.connectionState,
  turnState: envelope.turnState,
  taskExecutionState: envelope.taskExecutionState,
  scope: envelope.scope,
  capabilities: envelope.capabilities,
  attention: envelope.attention,
  activity: envelope.activity,
  outputVersion: envelope.outputVersion,
  barrier: envelope.barrier,
  turnId: envelope.turnId,
});

export function applyDeliveryEnvelope(cursor: DeliveryCursor, envelope: DeliveryEnvelope): DeliveryApplyResult {
  const unchanged = { cursor, acknowledge: null, needsSnapshot: false };
  if (!envelope || envelope.bindingId !== cursor.bindingId) return unchanged;
  // Unknown schemas fail closed into a compatible snapshot request, never a success.
  if (envelope.schemaVersion !== 1) return { ...unchanged, needsSnapshot: true };
  if (envelope.kind === 'snapshot') {
    if (envelope.subscriptionId !== cursor.subscriptionId) return unchanged;
    const sameEpoch = envelope.epoch === cursor.epoch;
    const controlNewer = !sameEpoch || envelope.version >= cursor.controlVersion;
    const outputNewer = !cursor.outputSuppressed && (!sameEpoch || !cursor.output || envelope.output.outputVersion >= cursor.output.outputVersion);
    if (!controlNewer && !outputNewer) return unchanged;
    return {
      cursor: {
        ...cursor,
        epoch: envelope.epoch,
        controlVersion: controlNewer ? envelope.version : cursor.controlVersion,
        control: controlNewer ? controlOf(envelope) : cursor.control,
        output: outputNewer ? { ...envelope.output, turnId: envelope.turnId } : cursor.output,
      },
      acknowledge: envelope.version,
      needsSnapshot: false,
    };
  }
  // A new main-process epoch invalidates both cursors until a fresh snapshot is installed.
  if (cursor.epoch !== null && envelope.epoch !== cursor.epoch) return { cursor: { ...emptyDeliveryCursor(cursor.bindingId, cursor.subscriptionId, cursor.outputSuppressed) }, acknowledge: null, needsSnapshot: true };
  if (cursor.epoch === null) return unchanged;
  if (envelope.kind === 'state') {
    if (envelope.version <= cursor.controlVersion) return unchanged;
    if (cursor.outputSuppressed) return { cursor: { ...cursor, controlVersion: envelope.version, control: controlOf(envelope) }, acknowledge: null, needsSnapshot: false };
    // Output from an older turn cannot survive into a newer turn's control state.
    const output = cursor.output && cursor.output.turnId !== envelope.turnId && cursor.output.outputVersion < envelope.outputVersion ? null : cursor.output;
    const next = { ...cursor, controlVersion: envelope.version, control: controlOf(envelope), output };
    return { cursor: next, acknowledge: null, needsSnapshot: output === null && envelope.outputVersion > 0 };
  }
  if (cursor.outputSuppressed) return { ...unchanged, acknowledge: envelope.version };
  if (cursor.output && envelope.outputVersion <= cursor.output.outputVersion) return { ...unchanged, acknowledge: envelope.version };
  if (cursor.control && envelope.turnId !== cursor.control.turnId && envelope.version < cursor.controlVersion) return { ...unchanged, acknowledge: envelope.version };
  const { kind: _kind, schemaVersion: _schema, epoch: _epoch, bindingId: _binding, version: _version, observedAt: _observed, ...output } = envelope;
  return { cursor: { ...cursor, output }, acknowledge: envelope.version, needsSnapshot: false };
}
