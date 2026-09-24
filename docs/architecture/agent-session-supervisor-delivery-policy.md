# Agent session supervision and delivery policy

**Status:** Proposed architecture specification  
**Scope:** Main-process agent session supervision, renderer supervision, IPC delivery, and notifications  
**Related contracts:** [ACP runtime/session lifecycle](acp-runtime-session-lifecycle-contract.md), [supervisor and concurrency](agent-session-supervisor-and-concurrency.md)

## Problem

Provider protocols produce high-volume streams, while the supervision surface is for managing, observing, and guiding work. Forwarding every token, tool event, and intermediate message through Electron IPC makes the renderer retain work it does not need and can make the application less responsive. Closing or minimizing the modal must not stop the agent, and opening a modal must not be required for a task to remain observable.

## Decision

The main process becomes the visibility-independent delivery authority. Provider output continues to be consumed in full by the session runner, but only bounded projections cross IPC:

```text
provider protocol
  -> session runner
  -> normalized runtime event
  -> session history / delivery policy
  -> state, output, and notification projections
  -> renderer AgentSessionSupervisor
  -> modal, bottom status area, and toast queue
```

The existing renderer `AgentSessionSupervisor` remains the app-level visibility and interaction coordinator. It does not own provider backpressure, durable history, or notification timing.

## Responsibilities

### Session runner

- Own the provider process and consume its complete protocol stream.
- Normalize provider-specific events into the existing runtime event contract.
- Preserve lifecycle ordering and the one-active-session rule.
- Emit a completion barrier only after the final output has been summarized and durable work state has been written.
- Never infer task acceptance, task completion, Goal completion, or contribution acceptance from session completion.

### Main-process delivery policy

The policy receives normalized events and maintains bounded per-session state:

- latest lifecycle state and attention state;
- latest response snapshot and monotonic snapshot version;
- a short pending output burst;
- coalesced activity counters and summaries;
- permission/input/failure/cancellation/completion attention records;
- notification queue state and deduplication keys.

It decides what is sent to each surface. It must not wait for the renderer to acknowledge every provider event.

### Renderer `AgentSessionSupervisor`

- Requests start, resume, steer, cancel, close, and supervision visibility.
- Applies snapshots only when their version is newer than the local version.
- Displays the current task title, status, latest model message, pending request, and bounded activity projection.
- Reconciles after opening or reconnecting by requesting one current snapshot, not by replaying an unbounded stream.
- Keeps visibility independent from execution: hide/close changes presentation only; cancel is an explicit lifecycle command.

### Surface projections

- **Modal open:** receives coalesced output bursts and state transitions. Progress text is replaced by the newest snapshot when a newer burst is pending.
- **Modal hidden/minimized:** receives no ordinary message streaming. It receives only bounded state/attention changes needed by the bottom Agent tasks area and toasts.
- **Modal reopened:** receives one current snapshot, pending request, and bounded activity summary, then resumes burst delivery.
- **Bottom Agent tasks area:** is the persistent discoverability surface. Its icon/state reflects working, blocked, permission required, failed, or completed attention according to the UI contract. It is not a second event log.
- **Toast queue:** announces meaningful transitions and aggregates ordinary activity. A toast is not emitted for every normalized event.

## Delivery and burst rules

These are policy parameters, not provider behavior. Initial values must be measured and then tuned behind named constants:

- flush a visible output burst on a short timer or when its byte/character cap is reached;
- replace a pending ordinary burst with a newer snapshot when the renderer is behind;
- allow at most one pending IPC output projection per session and coalesce compatible events;
- bound snapshot size, pending characters, activity entries, and notification queue length;
- drop stale snapshots by version at the renderer;
- flush final output before sending completion;
- clear all timers and pending data when a session closes.

The policy must expose queue depth, burst size, flush latency, dropped/coalesced counts, and IPC payload counts for diagnostics. It must never use an unbounded in-memory queue as a substitute for streaming.

## Gentle notification policy

Notification scheduling is separate from runtime state. Events have priorities:

1. permission/input required, blocked, failure, cancellation, and completion;
2. connection or recovery changes;
3. aggregated tool/file/test activity;
4. ordinary model output, which is represented in the modal or latest snapshot.

Priority 1 changes become attention state immediately, but the toast scheduler still deduplicates repeated identical requests. Lower priorities enter a per-task queue with a quiet interval, compatible-event concatenation, a maximum visible rate, and sequential presentation. For example, several tool events can become one message such as “Agent updated 5 files and ran 3 checks.” If the modal is open, ordinary progress toasts are suppressed because the modal already presents the information.

## Completion barrier

Completion is a four-step ordered operation:

1. consume the provider terminal event;
2. finalize and persist the bounded turn/session summary;
3. publish the final state and latest-response snapshot;
4. publish completion attention/notification state.

The renderer can therefore never show “completed” while still waiting for the final response projection. This barrier does not mutate task acceptance state.

## Launch contract

Launch APIs distinguish `startTask` from `openSupervision`. Starting a task may run in the background. Opening an existing supervision view is a separate request. No runtime component infers modal visibility from task start.

## Verification requirements

The implementation must add focused checks for:

- burst coalescing and stale-version rejection;
- hidden/minimized suppression of ordinary output;
- immediate attention state for permission, blocked, failure, cancellation, and completion;
- notification deduplication, quiet intervals, compatible aggregation, and sequential delivery;
- completion ordering and cleanup on session close;
- bounded queue and snapshot behavior under a synthetic high-rate event stream.

Before selecting production defaults, measure provider event rate, IPC messages/bytes, renderer commits, frame responsiveness, memory, queue depth, and flush latency under representative runs.

## Open decisions

- Exact initial burst interval and byte/character limits.
- Whether permission notifications bypass the normal quiet interval entirely or only preempt lower-priority notifications.
- Retention duration and redaction rules for durable summaries; the current privacy contract forbids raw prompts, raw responses, transcripts, and hidden reasoning.
- Whether a future multi-session release needs per-session fairness beyond the current one-active-session rule.

