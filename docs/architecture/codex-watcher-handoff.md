# Unified Codex watcher handoff for CLI and desktop

Status: proposed implementation contract  
Task: `task-5bd3a967-8710-4d6d-b97a-f7d0b9855b1d`

## Decision summary

Keep board watching in Omvra and make the output a durable, transport-neutral handoff record. The desktop app and terminal Codex runtime are consumers of that record, not separate watcher implementations.

The existing `boards.watch.poll` contract remains the detection API. A detected change is converted into one handoff with a stable deduplication key. A consumer claims the handoff, wakes its Codex runtime, and acknowledges the delivery or reports failure. MCP `initialize.clientInfo` is the canonical client identity; transport-specific headers and launcher environment variables are only adapters for carrying the same identity.

This is a modular-monolith boundary inside the existing Electron/MCP runtime. It does not require a second service or a desktop-only plugin path.

## Current evidence

- `src/app/hooks/useAgentWatchRuntime.ts` runs the desktop polling loop and applies configured actions to changed tasks.
- `src/app/services/mcp/client.ts` identifies the renderer MCP client as `Omvra` and talks to the local MCP endpoint.
- `electron/services/mcp-http-server.cjs` dispatches both HTTP and stdio requests through the same request dispatcher and preserves `initialize.clientInfo` by MCP session.
- `electron/services/workspace-service.cjs` persists watcher snapshots under `omvra.mcp.agentWatchStates.v1` and compares task IDs/revisions to suppress duplicate board changes.
- `electron/scripts/mcp-stdio.cjs` currently provides the shared stdio transport but has no separate watcher or wake contract.

These facts support one shared handoff boundary. They do not yet demonstrate a need for independently deployed watcher services.

## Decision drivers

1. The same task change must not be processed twice when CLI and desktop are both connected.
2. A consumer must be identifiable without treating arbitrary headers, user-agent strings, or environment dumps as trusted data.
3. Delivery must survive a consumer restart and an MCP request timeout.
4. CLI and desktop need different wake adapters while sharing the same claim and acknowledgement semantics.
5. Existing MCP tools, revision protection, audit redaction, and local-first storage must remain compatible.

## Handoff contract

The canonical handoff is an internal persisted record. It can later be projected through MCP resources/tools without changing its identity or state machine.

```ts
type CodexRuntimeSurface = 'cli' | 'desktop';
type CodexHandoffStatus = 'queued' | 'claimed' | 'delivered' | 'acknowledged' | 'failed';

interface CodexWatcherHandoff {
  schemaVersion: 1;
  handoffId: string;
  dedupeKey: string;
  watcherId: string;
  taskId: string;
  taskRevision: number;
  action: string;
  target: {
    assigneeId?: string;
    projectId?: string;
    statusId: string;
  };
  requestedClient?: {
    clientId?: string;
    runtime: CodexRuntimeSurface;
  };
  status: CodexHandoffStatus;
  attempt: number;
  lease?: {
    ownerId: string;
    expiresAt: string;
  };
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}
```

`dedupeKey` is derived from the watcher identity, task ID, task revision, and configured action. A retry uses the same handoff ID; a later task revision creates a new handoff. Task titles, descriptions, access tokens, raw headers, and command lines are not part of this record.

## Identity across transports

The shared identity is a bounded client descriptor:

```ts
interface CodexClientIdentity {
  clientId: string;       // stable installation/runtime identity, not a secret
  clientName: 'Codex';
  clientVersion?: string;
  runtime: 'cli' | 'desktop';
}
```

Transport mapping:

| Surface | Canonical source | Adapter input | Rule |
| --- | --- | --- | --- |
| HTTP desktop | MCP `initialize.params.clientInfo` plus bounded runtime metadata | `X-Omvra-Client-Id`, `X-Omvra-Runtime` | Headers are hints; initialize metadata remains canonical and values are allow-listed. |
| CLI stdio | MCP `initialize.params.clientInfo` | `OMVRA_CLIENT_ID`, `OMVRA_RUNTIME=cli` set by the launcher | Environment variables configure the launcher; they are never persisted wholesale. |
| Legacy client | Missing identity | none | Normalize to `clientId: unknown`, `runtime: unknown`; do not block ordinary MCP reads. |

Identity is descriptive routing metadata, not an authorization signal. Authorization continues to use the existing MCP access controls and token handling.

## Runtime flow

```text
board change
    -> boards.watch.poll
    -> watcher state compares task IDs/revisions
    -> create-or-reuse handoff by dedupeKey
    -> consumer claims handoff with a lease
    -> surface adapter wakes the matching Codex runtime
    -> adapter marks delivered
    -> Codex reads task context and performs work
    -> Codex acknowledges or fails the handoff
```

The desktop adapter may wake the in-process agent workflow or surface a notification. The CLI adapter may write a bounded wake message to the Codex launcher/stdin integration. Neither adapter owns deduplication or task mutation.

The minimum future MCP surface is:

- `agent.handoffs.list` — read queued/claimed records for the current client.
- `agent.handoffs.claim` — claim one record with `handoffId`, `clientId`, and lease duration.
- `agent.handoffs.acknowledge` — terminal delivery acknowledgement with an idempotency key.
- `agent.handoffs.fail` — release or retry a handoff with a bounded failure class.

`boards.watch.poll` may continue returning the change set for compatibility, but new watcher code should create handoffs through the same main-process workspace service that persists watcher state. The renderer must not independently create a competing handoff record.

## Claim, lease, and acknowledgement rules

- Claim is conditional on `status = queued`, or on an expired lease. A second consumer receives a conflict and must not wake Codex.
- Claim increments `attempt` and assigns a short lease. The lease is renewed only by an active consumer; expiry returns the record to `queued`.
- `delivered` means the surface adapter accepted the wake request. It is not completion.
- `acknowledged` means the Codex runtime accepted responsibility or completed the requested handoff, depending on the acknowledgement kind. The kind must be explicit in the implementation.
- `failed` records a bounded failure class and retry eligibility. It must not embed stack traces or task payloads.
- Acknowledgement is idempotent by `handoffId` plus `idempotencyKey`; duplicate acknowledgements return the existing terminal state.
- Task writes remain revision-protected. Handoff acknowledgement must never bypass `expectedRevision` on task mutation.

## Architecture options

| Option | Structure | Benefits | Costs and risks | Decision |
| --- | --- | --- | --- | --- |
| A. Separate desktop and CLI watchers | Each surface polls and wakes its own runtime | Small local changes | Duplicate processing, divergent filters, no shared lease, difficult recovery | Reject |
| B. Shared durable handoff in the existing MCP/workspace boundary | Omvra detects once; CLI and desktop consume through adapters | One dedupe/claim model, portable transports, incremental migration, local-first | Requires a small persisted state machine and consumer adapters | Recommend |
| C. External watcher service/queue | Dedicated process owns polling and delivery | Stronger isolation and future horizontal scaling | New deployment, auth, lifecycle, and offline complexity without current evidence | Defer |

Option B is the smallest structure that meets the stated requirement. The current code is already a modular monolith with a shared dispatcher and store; extracting a service now would add an operational boundary without removing the shared data coordination problem.

## Quality scenarios

| Attribute | Scenario | Initial target |
| --- | --- | --- |
| Duplicate safety | CLI and desktop claim the same newly assigned task concurrently | At most one claim succeeds; the loser receives a conflict and does not wake Codex. |
| Recovery | Consumer exits after claim and before acknowledgement | Lease expiry makes the handoff claimable again without creating a second handoff. |
| Portability | The same handoff is consumed over HTTP desktop and stdio CLI | Identity, dedupe key, state transitions, and acknowledgement shape are identical. |
| Privacy | A malformed client sends arbitrary headers or environment values | Only bounded identity fields reach audit/storage; secrets and payloads are discarded. |
| Compatibility | Existing client only calls `boards.watch.poll` | It continues to receive the existing change response and is not required to implement handoffs immediately. |

Workload assumptions are intentionally unmeasured: polling frequency is currently configuration-driven and each desktop poll can fan out across watched status columns. Before considering an external queue, measure concurrent watchers, handoff creation rate, stale leases, and claim conflicts.

## Risks and mitigations

- **Renderer/main-process split:** if the renderer remains the writer for handoffs, CLI and desktop can race. Persist handoffs in the main-process workspace service and expose a narrow MCP contract.
- **Identity spoofing:** client metadata can be forged. Use it only for routing and observability; retain existing auth and capability checks.
- **Indefinite retry loops:** bound attempts and store a stable failure class; surface exhausted records for human review.
- **Task mutation confusion:** delivery acknowledgement is not task completion. Keep handoff state and task status separate.
- **Unbounded local state:** cap retained terminal handoffs and retain only bounded metadata, with a migration/cleanup policy.

## Implementation sequence

1. Add a workspace-service handoff normalizer and versioned storage key, without changing existing watcher response fields.
2. Create handoffs from the existing poll result using the stable dedupe key.
3. Add claim/ack/fail primitives in the main-process boundary and tests for concurrent claim, lease expiry, and idempotent acknowledgement.
4. Add a desktop adapter that consumes the handoff and reports delivery separately from completion.
5. Add a CLI/stdio adapter using the same identity and handoff methods; use launcher environment variables only to seed identity.
6. Add bounded audit projections and diagnostics, then migrate the UI watcher status to show queued/claimed/delivered/failed states.

## Open decisions before runtime implementation

- Whether `acknowledged` means “Codex accepted the work” or “Codex completed the work”; use two explicit acknowledgement kinds if both are needed.
- How the desktop Codex runtime is woken in the host application; this is an adapter decision and must not leak into the shared handoff contract.
- Lease duration and retention limits; select them from measurements rather than assuming the current 15-second minimum poll interval is a delivery SLA.
