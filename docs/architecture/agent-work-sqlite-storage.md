# SQLite storage for agent sessions and task work metadata

**Status:** Proposed architecture specification  
**Scope:** Main-process SQLite store for agent runtime history, delivery state, and bounded task-work projections  
**Related contract:** [Storage architecture review](storage-architecture-review.md)

## Problem

Agent session bindings and events currently use bounded arrays in electron-store. Each append reads and rewrites the whole array, while the renderer also keeps a task-local event array. Provider differences make external history inconsistent: Codex can expose a saved thread, while Claude does not provide the same durable history. We need provider-neutral history for supervision and reporting without making JSON or a provider thread the source of truth.

## Decision boundary

SQLite owns agent-work data. The existing workspace/task store remains authoritative for normal task metadata:

| Existing task authority | SQLite agent-work authority |
| --- | --- |
| title, description, status, dates, assignee, dependencies, ACs, task revision | runtime sessions, turns, normalized events, bounded output summaries, permission/input records, delivery state, notification dedupe, provider references, runtime metrics |

SQLite may hold a bounded, derived task-work projection keyed by `task_id` for fast supervision and reporting. It must not become a second writer for task title, description, status, acceptance, Goal state, or contribution acceptance. A task record can reference work IDs; it does not need to embed session history.

The correlation chain is explicit:

```text
task -> contribution/attempt -> session -> turn -> event
```

Missing links are allowed for general agent sessions, but task-bound sessions should record every available identifier.

## Proposed schema

All tables are main-process-owned and use integer SQLite primary keys or stable UUIDs as appropriate. Timestamps are UTC ISO strings or SQLite integers consistently within the implementation.

### `agent_sessions`

Stable session identity and lifecycle projection: `id`, `binding_id`, `task_id`, `attempt_id`, `provider`, `runtime_profile_id`, `scope_kind`, `scope_id`, `provider_session_ref` (opaque and non-secret), `state`, `attention_state`, `created_at`, `updated_at`, `finished_at`, `last_event_seq`, and bounded `latest_snapshot_version`.

### `agent_turns`

Turn-level boundaries: `id`, `session_id`, `turn_index`, `state`, `started_at`, `finished_at`, `outcome`, bounded `final_summary`, `final_summary_version`, and `error_code`. This is a summary record, not a raw transcript.

### `agent_events`

Append-only normalized events: `id`, `session_id`, `turn_id`, `seq`, `kind`, `native_type`, `priority`, `summary`, bounded `message_segment` where allowed, `observed_at`, and `created_at`. Enforce uniqueness on `(session_id, seq)`, index session/time and task/session lookups, and retain only the configured bounded history.

### `agent_work_projections`

One current derived row per task/attempt: `task_id`, `attempt_id`, `session_id`, `latest_state`, `latest_attention_state`, `latest_summary`, `latest_model_message`, `provider`, `provider_session_ref`, `started_at`, `finished_at`, `updated_at`, and `projection_version`. Updates are idempotent and replace the current projection; they do not mutate the task authority.

### `agent_delivery_state`

Ephemeral/recoverable delivery bookkeeping: `session_id`, `surface`, `visibility`, `last_snapshot_version`, `last_sent_seq`, `pending_output`, `pending_chars`, `quiet_until`, and `updated_at`. It exists to recover a supervision view and to prevent duplicate notifications; it is not a transcript.

### `agent_notifications`

Bounded notification records for dedupe and reporting: `id`, `session_id`, `task_id`, `priority`, `dedupe_key`, `summary`, `created_at`, `delivered_at`, and `dismissed_at`. Expiration/retention is mandatory.

## Privacy and retention

The current runtime contract forbids persisting raw prompts, raw responses, transcripts, hidden reasoning, credentials, and unredacted provider payloads. This spec therefore persists normalized event summaries and bounded final/last-message projections only. Storing full model conversations would require an explicit privacy-contract revision, migration, export, and deletion policy; it is not implied by adding SQLite.

Every table has a retention class. Runtime events and notifications are capped by count and age; finished sessions have a separate retention policy; delivery state is deleted on session close after the final projection is committed. The store must expose pruning metrics and run pruning without blocking the UI.

## Main-process repository boundary

Create one main-process SQLite repository/connection owner. Renderer code accesses it only through typed IPC commands. Writes use short transactions and a serialized write queue. The repository must handle `SQLITE_BUSY` with bounded retry/backoff, report failures, and never silently fall back to a second persistence authority.

Do not dual-write the same agent event to an old JSON array and SQLite indefinitely. Migration must be an explicit, resumable step with a backup/export, row counts, checksums or equivalent verification, and a cutover marker. Keep JSON/electron-store for settings, flexible configuration, compatibility import/export, and backups.

## Provider-neutral history

`provider_session_ref` is optional opaque metadata. Codex thread IDs can be retained as an external reference; Claude can still have a complete Omvra-owned bounded history even when the provider offers no durable thread. The application must not assume that an external provider thread is available, complete, or authoritative.

## Transaction and projection rules

For each normalized runtime event, the main process may update the session cursor, append the bounded event, update the turn/session projection, and update delivery state in one short transaction where practical. High-volume message segments may be coalesced before persistence according to the delivery policy. The final completion transaction must persist the final summary and projection before publishing completion to the renderer.

Task acceptance, contribution acceptance, Goal completion, dependency changes, archive state, and backup records continue through their existing governed services and optimistic revision rules. SQLite work projections can inform those services but cannot perform those transitions implicitly.

## Migration and rollout

1. Instrument the current array/IPC path and capture representative rates, sizes, memory, and latency.
2. Introduce the repository behind a feature flag and write/read only a bounded development sample.
3. Add session/turn/event/projection recovery and compare it with the existing supervisor snapshot.
4. Migrate runtime/session/context history with an export and verification report.
5. Cut over reads, then writes, and remove the old event-array writer after a verified release.
6. Evaluate whether stable task rows should ever move to SQLite separately; do not expand scope merely because the agent-work store exists.

## Verification requirements

- schema creation and migration are idempotent;
- unique sequence constraints prevent duplicate events;
- crash/restart recovery returns the latest bounded snapshot;
- pruning enforces count and age limits;
- concurrent event bursts remain serialized without unbounded memory;
- final-summary-before-completion ordering survives failure injection;
- provider references contain no credentials or raw protocol payloads;
- task authority remains unchanged when a session starts, ends, crashes, or is cancelled;
- backup/export and deletion behavior are documented and tested.

## Open decisions

- SQLite driver and Electron ABI/rebuild/packaging strategy (`better-sqlite3` is a candidate, not a decision).
- Exact retention classes, caps, and deletion UX.
- Whether bounded final model messages may be retained by default or require a workspace preference.
- Whether the first migration includes only runtime/session/context events or also a task-work projection.
- Database location, encryption-at-rest expectations, and backup inclusion.

