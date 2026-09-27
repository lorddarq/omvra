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
- Applies snapshots only when their lane version is newer than the local version (control and output cursors are separate; see v1 below).
- Displays the current task title, status, latest model message, pending request, and bounded activity projection.
- Reconciles after opening or reconnecting by requesting one current snapshot, not by replaying an unbounded stream.
- Keeps visibility independent from execution: hide/close changes presentation only; cancel is an explicit lifecycle command.

### Surface projections

- **Modal open:** receives coalesced output bursts and state transitions. Progress text is replaced by the newest snapshot when a newer burst is pending.
- **Modal hidden/minimized:** receives no ordinary message streaming. It receives only bounded state/attention changes needed by the bottom Agent tasks area and toasts.
- **Modal reopened:** receives one current snapshot, pending request, and bounded activity summary, then resumes burst delivery.
- **Bottom Agent tasks area:** is the persistent discoverability surface. Its icon/state reflects working, blocked, permission required, failed, or completed attention according to the UI contract. It is not a second event log.
- **Toast queue:** announces meaningful transitions and aggregates ordinary activity. A toast is not emitted for every normalized event.

### Unscheduled tasks

An agent task may intentionally have no start or end date while it is parked without a delivery commitment. This is independent of execution state: an unscheduled task may be open, in progress, blocked, under review, or done. Starting or supervising such a task remains available, and its Agent tasks status and attention state work exactly as they do for scheduled tasks. Missing dates only exclude the task from Timeline placement; they do not suppress supervision, notifications, task lists, search, roadmap details, reporting, dependencies, assignment, or agent-work history.

## Delivery and burst rules

These are policy parameters, not provider behavior. Initial values must be measured and then tuned behind named constants:

- flush a visible output burst on a short timer or when its byte/character cap is reached;
- replace a pending ordinary burst with a newer snapshot when the renderer is behind;
- allow at most one pending IPC output projection per session and coalesce compatible events;
- bound snapshot size, pending characters, activity entries, and notification queue length;
- drop stale snapshots by version at the renderer;
- flush final output before sending completion;
- clear all transient delivery timers and pending data when a session closes; retain safe durable history under its separate retention policy.

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

## Original decision questions

The v1 implementation contract below resolves burst bounds, notification preemption, and privacy/restart behavior. Future concurrency and optional date labels remain deferred.

- Exact initial burst interval and byte/character limits.
- Whether permission notifications bypass the normal quiet interval entirely or only preempt lower-priority notifications.
- Retention duration and redaction rules for durable summaries; the current privacy contract forbids raw prompts, raw responses, transcripts, and hidden reasoning.
- Whether a future multi-session release needs per-session fairness beyond the current one-active-session rule.
- Whether the Agent tasks surface should include an explicit unscheduled label or rely on the existing task detail/date presentation.

## Implementation contract v1 (2026-09-25)

Task: `task-5e5a0cf8-8967-4205-ba6c-393355ac999f` (Arc). This section specifies the next implementation; it does not claim the delivery policy is shipped. It refines the earlier sketch, including the decisions listed above. No runtime, storage schema, or provider capability changes are made by this specification.

### Verified current path and gaps

Paths below are relative to the repository root; symbol names are the navigation anchors.

| Boundary | Current source and behavior | Required change |
| --- | --- | --- |
| Provider ingestion | `electron/services/agent-runtime-protocol-client.cjs`: native clients consume ACP/Codex/Claude messages; Claude maps assistant output to `item/agentMessage/delta` and result to `turn/completed`. | Normalize semantic output, attention and terminal facts here or in the runner; unsupported events remain unsupported, never guessed successes. |
| Runner | `electron/services/agent-runtime-session-runner.cjs`: `recordNotification` classifies native methods, `appendRuntimeEvent` persists then emits each event; `syncTurnState` and `syncTaskExecution` emit binding changes. A terminal event currently emits before the subsequent turn-state update. | Feed one main-process delivery projection after lifecycle reconciliation; do not let the renderer infer a terminal outcome from an early native event. |
| Durable history | `electron/domain/agent-runtime-session-service.cjs`: `appendEvent` stores bounded events (2,000 total), reads cap at 100, and message previews cap at 20,000 characters. | Preserve safe facts independently of display traffic. Existing `messagePreview` persistence is a privacy gap against the no-raw-response contract; truncation is not redaction. |
| IPC | `electron/main.cjs`: `broadcastAgentRuntimeEvent` sends each payload to every window. `electron/ipc/agent-runtime.cjs` registers commands; `electron/preload.cjs` exposes `sessions.onEvent`; `src/electron.d.ts` currently types a loose `event | binding` envelope. | Introduce typed, bounded delivery envelopes and renderer-scoped subscriptions; ordinary output must not be broadcast to hidden windows. |
| Supervisor | `src/app/components/AgentSessionSupervisor.tsx`: subscribes globally, polls every 10 seconds, fetches pending requests, keeps an eight-item dock and detects completion through `findNewCompletedTaskRuns`. | Own one renderer subscription/cache and distribute projections to children; keep bounded recovery polling, not native-event interpretation or a second notification scheduler. |
| Modal | `src/app/components/TaskExecutionAction.tsx`: subscribes while open, retains 100 events, derives output/activity from native event names and refreshes on input. `TaskSessionComposer` and `RuntimePermissionCard` provide controls. | Consume shared projections and request details; preserve explicit runtime controls and negotiated capabilities. |
| Agent tasks area | `src/app/components/statuses/AppStatusBar.tsx` consumes `sessionDock`; `src/app/utils/agentRuntimeActivity.ts` provides `projectAgentRuntimeSession`. | Reuse the shared status vocabulary and attention styling; cards consume state/attention only, not model output. |
| Toasts | `src/app/utils/agentRuntimeNotifications.ts`: completion recognition uses `turn/completed`; supervisor emits Sonner success, while modal emits start/resume/continue feedback. | Route unsolicited runtime notifications through the main scheduler. Keep direct command feedback local, correlated so it cannot duplicate a scheduled transition. |

Current source and `agent-runtime-session-runner.test.cjs` distinguish provider connection from a turn. The one-active-session product rule means **one in-flight task or Goal-node turn workspace-wide**, including queued, starting, active, waiting-input and cancelling reservations. Idle reusable `ready` sessions may coexist. Delivery subscriptions, hidden panels and history never acquire or release that reservation. Use the runner's existing guard; do not introduce a competing count based on visible panels or connected sessions. Earlier supervisor prose describing every ready session as active does not override this distinction.

### Authorities, options and assumptions

Provider execution belongs to the existing runner; durable safe history belongs to the existing session service (and its separately specified storage migration); transient output belongs to the main delivery projection; notification eligibility belongs to the main scheduler; visibility and rendering belong to the app supervisor. Task/contribution/Goal acceptance remains exclusively governed by the existing domain commands and revisions. A delivery version is not a workspace revision.

| Option | Benefit | Cost / rejection condition |
| --- | --- | --- |
| Keep per-event IPC and throttle React | Small renderer change | IPC and event persistence still scale with provider traffic; hidden windows still receive it. Does not meet this task's boundary requirements. |
| Bounded main-process projections (selected) | Reuses runner, IPC and supervisor; controls work before crossing IPC; deterministic reopen | Requires typed envelopes, projection tests and a storage completion seam. One Electron deployment; no extra service or dependency. |
| Durable replay broker / separate service | Independent consumers and replay | Adds deployment and transcript/retention complexity without a demonstrated consumer; outside scope. |

Verified facts are the source paths above. Lower IPC volume should reduce renderer work, but no responsiveness improvement is measured by this documentation task. The numerical budgets below are initial implementation/test bounds, not benchmark results. The SQLite design remains a separate proposed migration: reuse its completion commit and privacy rules without making this delivery contract depend on a particular database API.

### Stable projection envelopes

These are proposed TypeScript shapes, to be implemented at the existing typed preload boundary. Reuse the existing safe binding/scope/turn/capability types; never forward an entire provider payload. All envelopes carry `schemaVersion: 1`, `epoch` (new random ID per main-process lifetime), `bindingId`, `turnId: string | null`, `version` (strictly increasing per binding within the epoch), and `observedAt` (ISO timestamp, informational only). Versions order projections, not provider timestamps. One version represents one coherent reduction; control and output produced by that reduction may share it.

| `kind` | Required payload | Meaning |
| --- | --- | --- |
| `state` | `connectionState`, `turnState`, safe scope, `attention`, `capabilities`, `activity`, `outputVersion`, `barrier` | Full replacement control projection; includes all current attention, not a lossy change log. |
| `output` | `outputVersion`, `text`, `truncated`, `availability: live | summary-only | unavailable` | Full bounded latest-response replacement, never an append delta. `outputVersion` is the binding version that last changed output. Empty text explicitly clears the previous turn. |
| `snapshot` | State fields plus output, `subscriptionId` | Atomic control/output view at one version. Used for initial open, reconnect and recovery. |
| `notification` | `notificationId`, `category`, `priority`, `safeSummary`, `requiredVersion`, `expiresAt`, `action` | Scheduled display candidate, not a lifecycle command. `action` is `open-supervision` with safe scope, or absent. |

`connectionState` and `turnState` reuse existing runtime enums (including no turn). A completed turn can leave a ready provider connection. `activity` holds cumulative per-turn tool/file/check counts only where adapters have reliable structured evidence (otherwise unknown), a last-activity time and at most 20 safe summary entries. Duplicate provider identity must not increment counts twice; identity-unknown detail must not be presented as an exact count. Old-turn output cannot replace current-turn output.

`attention` contains at most one current record per category: `permission`, `input`, `blocked`, `failure`, `cancelled`, `completed`, `recovery`. Each record has stable `id`, `category`, safe summary, `createdVersion`, and an optional request reference or stable error code. Request references include binding, turn and the original typed string/number request ID; `1` and `"1"` are distinct. Persist only safe correlation metadata. Fetch provider-owned request details through the existing requests API, preserve `responseKind` and `buildPermissionResponse`, and revalidate binding/turn/request before responding. A projection or toast can never approve a request. Multiple pending requests are fetched in bounded pages; attention carries pending count and the first request reference, not every payload.

`barrier` is `{ state: none | pending | committed | failed, turnId, finalOutputVersion: number | null, errorCode?: string }`. A `committed` barrier proves safe final history was written, not task acceptance or provider-session closure. No native protocol name is needed to interpret any of these fields. Unknown schema versions fail visibly and trigger compatible-state recovery; they must not be treated as successful completion.

### Subscription, ordering and resynchronization

Add `sessions.subscribeDelivery({ bindingId, visible, requestId })`, `sessions.setDeliveryVisibility({ subscriptionId, visible, requestId })`, `sessions.getDeliverySnapshot({ subscriptionId, requestId })`, `sessions.ackDelivery({ subscriptionId, version })`, and `sessions.unsubscribeDelivery({ subscriptionId })` beside existing commands. Names are the proposed v1 bridge contract, not currently available methods. Bind each subscription to the invoking Electron sender; validate IDs, scope, booleans and monotonic request IDs at IPC. A caller cannot change another window's subscription. There is one supervisor-owned subscription per selected binding/window; modal and dock do not create independent native listeners.

- Subscribe atomically registers interest and captures a snapshot. Events racing the returned snapshot may arrive first: renderer buffers only the newest control/output projection, installs the returned snapshot, then applies newer versions. The request ID prevents an old open response from selecting a different binding.
- Track control and output cursors separately. Receiving `state(v=12)` before `output(v=12)` must not discard that output. Ignore duplicates/older values per lane; a full snapshot replaces both lanes only when it does not regress either. On an epoch change, discard old cursors and pending callbacks and request a fresh snapshot. Ignore messages from previous subscription IDs.
- Hiding clears pending ordinary output for that subscriber; it does not clear the latest main snapshot. App-window minimization/destruction is observed in main, independent of renderer visibility reports. Showing a previously minimized window requires a fresh snapshot before streaming resumes.
- Sequence gaps are expected after coalescing: every projection is a replacement. Inconsistent turn identity, schema or barrier/output dependency requires a bounded snapshot request, not replay of historical events. Only one recovery read per binding may be in flight.
- A renderer acknowledges installed projection versions, not provider events. Maintain one sent-but-unacknowledged ordinary output projection plus one replaceable pending projection per subscriber. A missing acknowledgement never pauses ingestion, permissions, cancellation or history. After 2 seconds without acknowledgement, suspend ordinary sends and require a snapshot on recovery. Control/attention uses a coalesced latest replacement with at most one outstanding send; the protected current state remains fetchable even if its transient delivery is skipped.
- Reopen within the process returns the bounded latest text and current requests. After restart, return a privacy-safe durable summary with `availability: summary-only`; never promise transcript recovery. Revalidate outstanding runtime requests; unavailable request details disable Respond and show recovery guidance.

### State and surface behavior

| Situation | Projection / modal | Agent tasks area and notification |
| --- | --- | --- |
| Visible active work | Coalesced output plus state; controls reflect negotiated capabilities | Working; no ordinary progress toast |
| Hidden or minimized | No ordinary output IPC; ingestion, history and attention continue | Working remains discoverable; eligible attention can notify |
| Reopened | One snapshot, pending request details, then new output | Opening alone never starts/resumes a turn or repeats an old toast |
| Permission / input | Waiting-input plus stable request reference; fetch response form; do not steal focus automatically | Needs input immediately; deduped high-priority toast with Open action, even if ordinary delivery is stalled |
| Blocked launch / work | Show stable reason and recovery action; no fabricated session if preflight failed | Blocked; competing-turn error opens exact blocking binding; no second process |
| Failure / disconnect | Failure or recovery attention, safe error code; preserve last output with availability marker | Failed/interrupted, explicit retry/resume only where supported; no implicit relaunch |
| Cancel requested | Cancelling until acknowledged or timed out; retain final available output | Stopping, then cancelled/interrupted; never a successful-completion toast |
| Turn completed | Apply committed final snapshot before completion presentation | “Agent run finished”; task review/done state is independently read from governed task state |
| Final history write failed | Barrier failed; show “Runtime ended; history could not be saved” and bounded recovery | Failure attention, no durable-success notification; cancel/input transport remains usable |
| Explicit end session | Close transport through existing command, resolve transient requests, release delivery resources | Safe history remains reopenable; hiding is never this command |
| Unscheduled task | Identical execution/preflight/supervision semantics; do not synthesize dates | Identical attention/search/list/history; missing either required date excludes Timeline placement only |

Unscheduled behavior is a normative requirement, not a claim that every current date filter has been audited or fixed. Existing non-date blockers (completed/archived work, dependencies, permissions, repository/runtime readiness) still apply. No delivery handler writes dates, task statuses, contribution acceptance, Goal completion or dependency advancement.

### Completion and persistence barrier

For each `(bindingId, turnId)`, normalize terminal outcome once. Cancel acknowledgement, failure and interruption cannot become success merely because the native terminal message lacks a status. An unresolved input request retains waiting-input and prevents a successful completion barrier until the runner reconciles it.

1. Consume terminal and all preceding output in adapter order; freeze a bounded final output snapshot and safe summary/counters. Late same-turn output after the sealed terminal boundary is ignored with a diagnostic, not attached to the next turn.
2. Commit safe terminal history and the stable completion-notification identity through the storage owner. With the proposed SQLite migration this is its atomic final transaction. Existing storage must provide an equivalent verified write/reconciliation result; do not claim cross-store atomicity.
3. Publish one final `snapshot` with the committed barrier and final output version. For hidden subscribers publish control state with the same barrier and `outputVersion` but no model text. Hidden notification delivery needs the committed control version; opening later fetches the matching snapshot. Visible completion presentation requires installed output at least `finalOutputVersion`.
4. Only then release the completion notification to eligible subscribers. If notification overtakes the snapshot, hold one deduped candidate and fetch the required snapshot; do not show premature success. Notifications never delay release of the execution slot, which remains the runner's decision.

Failure to commit keeps one bounded pending final record, sets barrier failed and uses the storage owner's bounded retry policy; it never silently falls back to memory-only success. A process crash before commit yields interrupted/reconciliation-required with an explicit history gap. A crash after commit may resend the same notification ID; deduplication limits repeats but exactly-once toast display is not promised. Subsequent turns use distinct turn IDs; old completion cannot overwrite a newer turn's working state.

### Bounds, notification scheduling and cleanup

Initial hard in-memory budgets below must be named constants and exercised in tests; tune only with recorded measurements. They do not alter durable retention policies in [agent-work SQLite storage](agent-work-sqlite-storage.md).

| Resource | Initial bound / overflow behavior |
| --- | --- |
| Latest live response | 20,000 Unicode code points, at most 80 KiB UTF-8; keep newest text and set `truncated`; clear on new turn. No hidden reasoning or raw tool payloads. |
| Pending visible burst | Flush after 100 ms or 8 KiB newly received text; replace pending snapshot, never accumulate deltas behind a slow renderer. |
| Complete IPC envelope | 128 KiB serialized UTF-8; truncate optional text/activity first; reject malformed/oversized required control data visibly. |
| Activity | 20 bounded safe summaries per binding; coalesce repeated compatible facts into counters. |
| Runtime projection cache | At most 100 binding summaries, matching bounded current reads; evict oldest inactive optional entries, fetch history on demand. Never evict active, unresolved-input or failed-barrier state to admit optional history. If protected capacity is exhausted, reject new starts with a visible capacity error. |
| Notifications | 8 pending per task, 32 per workspace, one visible runtime toast per renderer; coalesce compatible categories, evict oldest low-priority candidate first. Overflow never removes canonical unresolved attention. |
| Notification text | 500 code points of application-authored safe text; no raw model/provider error text. |
| Transient terminal text | Retain for at most 15 minutes after turn terminal or until explicit end session, whichever comes first; then safe summary only. Active current text remains bounded. |

Permission/input preempts pending lower-priority notifications and bypasses their quiet interval; it does not repeatedly interrupt an identical visible request. Failure/blocked/cancel/completion follow the next available slot with priority over activity. Aggregate ordinary activity after 2 seconds quiet, with a maximum 5-second wait under continuous activity and at most one ordinary toast every 5 seconds. Expire ordinary candidates after 30 seconds, terminal candidates after 5 minutes; unresolved attention persists independently of toast expiry. Count only structured verified tool/file/check facts; otherwise say “Agent activity updated.” Opening the modal drops pending ordinary toasts. Deduplication keys include binding, turn, category and request ID or committed transition identity, not display text alone.

On startup seed notification cursors from current state; do not toast all retained completed runs. Reconnection may deliver still-unexpired, not-yet-acknowledged committed candidates with the same IDs. Toast acknowledgement only records presentation; it does not resolve attention. Route unsolicited toasts to one focused window (otherwise the designated primary window); OS notifications are outside this contract. Permission/input remains visible in every applicable state projection even when toast delivery fails.

Hide clears subscriber output timers/queues only. Unsubscribe or renderer destruction removes all sender-owned delivery state and timers. Explicit end session clears transient output, pending requests and session timers after projecting its safe closed state; durable history remains under storage retention. Main shutdown disposes all subscriptions/timers and rejects further delivery operations. Notification dedupe/cursors are bounded by the notification retention window; do not retain an unbounded `seenEventIds` set. Storage failure or queue pressure must never prevent an already-running agent from receiving an explicit cancel or valid input response.

Diagnostics expose counts and bytes for ingested/coalesced/dropped events, output/state IPC sends, pending and in-flight projections, acknowledgement timeouts, snapshot requests, queue high-water marks, flush latency, final-commit/barrier latency, stale/late messages, protected cache entries and cleanup timer counts. Correlate by safe binding/turn IDs. Do not log text, answers, request bodies, credentials, opaque provider references or hidden reasoning. Report dropped optional detail distinctly from lost critical persistence.

### Implementation sequence and verification handoff

1. Add normalization/projection fixtures and typed IPC shapes at existing seams. Preserve legacy commands while consumers migrate; do not deliver both raw and projected events to the same migrated consumer.
2. Add the bounded delivery reducer and completion commit seam beside the runner; reuse storage privacy, retry and notification identity rules. Remove raw preview persistence through the storage migration/privacy work before enabling the new durable path.
3. Add sender-scoped subscription/visibility/acknowledgement handling and the single supervisor cache; migrate modal, dock and notifications together. Retain existing permission response validation and runtime controls.
4. Verify supported adapters against the same projection fixtures, then measure event rate, IPC bytes/messages, React commits, frame responsiveness and memory with visible/hidden/reopened sessions. No performance acceptance is inferred from unit tests alone.

| Runnable implementation check | Required assertion |
| --- | --- |
| Normalized ACP/Codex/Claude fixtures | Equivalent semantic inputs produce equivalent envelopes; unknown event is not successful completion; no native-method tests in UI. |
| Burst of 10,000 outputs with fake clock and stalled acknowledgement | Text, queue and payload bounds hold; hidden sends zero ordinary output; control/input/cancel remain usable; one newest snapshot restores state. |
| Out-of-order state/output, duplicate versions, reopen race and new epoch | Same-version output survives state-first delivery; no stale regression, turn mixing or duplicate transcript append. |
| Final text → terminal → commit success/failure | Visible completion follows final output; hidden completion follows safe commit; failed commit cannot produce success; reconnect dedupes stable notification identity. |
| Input, cancel and process-exit races | Unresolved input is not completion; acknowledged cancel is not success; no provider capability is fabricated. |
| Fake-clock notification flood | Quiet/max-wait/rate/expiry/caps hold; permission preempts ordinary queue; duplicate requests do not spam; attention survives dropped toast. |
| Hide, close, unsubscribe, restart | Hiding does not cancel; close/dispose releases timers and buffers; restart shows safe summary and no raw saved text. |
| Scheduled vs unscheduled launch | Same non-date preflight, notifications and supervision; missing dates affect Timeline placement only. |
| Task and Goal acceptance / concurrency | Completion never accepts work; competing in-flight turn is rejected; idle ready session does not consume a second execution slot. |
| Privacy-negative persistence/export/log fixtures | No raw output, prompt, tool payload, request answer or provider reference escapes allowed boundaries. |

Existing baseline checks: `node --test electron/services/agent-runtime-session-runner.test.cjs` and `node --experimental-strip-types --test src/app/components/agentSessionSupervisor.test.ts src/app/utils/agentRuntimeActivity.test.ts src/app/utils/agentRuntimeNotifications.test.ts`. These validate existing behavior, not the proposed envelopes. Implementation must add behavioral tests above rather than weakening current assertions to pass.

Remaining risks: initial timing/size values need packaged-Electron measurement; generic ACP event coverage needs adapter fixtures; legacy raw previews require privacy-safe migration; cross-store finalization can fail and must surface reconciliation. No blocking architecture choice remains for this specification: priority bypass, restart output behavior, budgets and privacy are defined here. Multi-session fairness and an optional unscheduled label remain deferred product work.

### Implementation status (2026-09-25)

Main-process delivery is implemented in `electron/services/agent-runtime-delivery.cjs` (`createAgentRuntimeDelivery`, bounds in `DELIVERY_LIMITS`) and wired in `electron/main.cjs` `broadcastAgentRuntimeEvent`:

- The runner, its serialized notification queue and durable event history are unchanged; every provider event is still consumed and persisted. Delivery reads the runner's existing emissions (`binding`, `event` with the transient `messagePreview`, `storage-failure`, `storage-recovered`) and never blocks on a renderer.
- Model output no longer crosses the legacy `agent-runtime/event` channel. It is coalesced per binding (100 ms / 8 KiB), bounded to 20,000 code points / 80 KiB, and sent as full-replacement `output` envelopes on `agent-runtime/delivery`, gated by one in-flight projection per subscriber plus one replaceable pending projection; 2 s without acknowledgement suspends ordinary output until a snapshot is requested. Other legacy `event` payloads are not sent to hidden or minimized windows.
- The completion barrier uses the storage owner's terminal-turn commit (`updateBinding` → `completeTurn`): the terminal binding is only emitted after that commit, delivery materializes and seals the final output, publishes one final `snapshot` (control-only `state` for hidden subscribers), and only then hands the payload to the notification scheduler with `requiredVersion` set to the committed delivery version. A storage failure during an in-flight turn sets `barrier.state = failed` and failure/blocked attention.
- Sender-scoped IPC: `sessions.subscribeDelivery`, `setDeliveryVisibility`, `getDeliverySnapshot`, `ackDelivery`, `unsubscribeDelivery`, `getDeliveryDiagnostics`, `onDelivery`. Window minimize/hide/restore/show, sender destruction and reload (`did-navigate`) are observed in main.
- Renderer: `src/app/utils/agentRuntimeDelivery.ts` applies envelopes with separate control/output cursors. `AgentSessionSupervisor` owns the single `useAgentRuntimeDelivery` subscription for the supervised binding (reported by `TaskExecutionAction` via `onBindingChange`) and passes the projection to the modal. The subscription lives as long as the binding is supervised; hiding sets `outputSuppressed`, which drops retained text and ignores output/snapshot text until a reopen installs one fresh snapshot, while state/attention keep flowing.
- The modal no longer accumulates runtime events: latest response, activity (`projectDeliveryActivity`) and turn completion come from the projection; the legacy channel is used for binding lifecycle only. `refreshSession` keeps one bounded read to extract the latest safe failure class for sign-in/conflict detection and does not retain the events.
- Agent tasks area and task details share `resolveAgentTaskAttention` (in `agentRuntimeActivity.ts`), computed once by the supervisor as `sessionDock.attention` / `items[].attention`. It adds `permission-required` and `cancelled` attention kinds, applies projection attention for the supervised binding immediately, shows storage failure as blocked, and never lets run completion override governed task status. None of these surfaces read task dates.

Deferred: packaged-Electron measurements (step 4); per-delta SQLite event writes remain the runner's storage cost and are bounded by its 256-message / 1 MiB queue. Only the supervised binding has projection attention; other Agent tasks items use binding lifecycle state (still broadcast to hidden windows) until the projection offers a multi-binding control-only subscription.
