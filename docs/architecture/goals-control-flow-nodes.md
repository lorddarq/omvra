# Goals control-flow nodes

Status: architecture decision record, 2026-07-19

## Decision

Goals / Loops treats `human-input` and `retry` as executable control-flow node entities. They are visible on the canvas, persisted in Goal graphs, exposed through MCP, included in execution logs and inspectors, and interpreted by the lifecycle/orchestration layer.

This is intentionally broader than agent work. A Goal node may represent a meaningful workflow state or command even when no agent performs work inside it.

The canvas toolbar will expose a **Control flow** selector, parallel to the agent selector. The initial options are:

- `human-input`
- `retry`

The control-flow category is extensible for future nodes, but no additional node types are part of this slice.

## Human input

`human-input` is an overseer-mediated pause primitive.

- The overseer owns the interaction and prompts the user when execution reaches the node.
- The workflow becomes paused/blocked until the user responds.
- The first version collects free text.
- The response is persisted as reusable Goal execution context.
- The response does not replace earlier context; it is appended as a new input event.
- Execution resumes only after the response is durable.

Example: “Which additional competitors should we research?”

## Retry

`retry` is a control-flow command that re-enters execution at an earlier completed node.

- A regular persisted connector configures the retry target.
- The connector remains the source of truth for the target relationship.
- The lifecycle interprets the connector as a return route because its source is a `retry` node.
- The target may be an earlier node, including a completed node.
- The retry node has a dedicated `maxAttempts` or `maxRetries` value.
- Retry counting is scoped to the current Goal execution.
- Previous findings, evidence, inputs, and execution history are preserved.
- The retry path is rendered as a visually distinct return edge.

When the retry limit is reached, the node uses a user-selected exhaustion policy:

- `human-review`: pause and ask whether to continue or fail the Goal.
- `fail-goal`: mark the Goal execution as failed.

## Context model

Retry must not overwrite the context produced by earlier attempts. Each attempt should append an immutable context record containing the attempt number, retry reason, latest human input, prior evidence, and accumulated findings. Agents receive the full history plus the latest response.

This keeps earlier research auditable and avoids ambiguous merge behavior when a retry targets a completed node.

## Graph and execution semantics

Normal connectors remain DAG dependencies. A connector whose source is a `retry` node is a bounded control-flow return and is validated separately from ordinary dependency edges. The UI must not disable cycle protection globally.

The renderer edits and visualizes the graph. Lifecycle/orchestration owns pause, resume, retry counting, context accumulation, exhaustion behavior, and execution events.

MCP read models must expose the semantic node fields and retry target rather than flattening control-flow nodes into generic sequences.

## Agent-node configuration

Agent nodes are executable delegation points, not instruction-display nodes. Their visible notes are descriptive; dispatch instructions are stored in a dedicated agent configuration.

```ts
type GoalAgentMode = 'existing' | 'ephemeral';

type GoalAgentConfiguration = {
  mode: GoalAgentMode;
  assigneeId?: string;
  requestedName?: string;
  requestedType?: string;
  instructions: string;
  spawnIfUnavailable?: boolean;
};
```

The agent inspector exposes existing/ephemeral mode, canonical agent selection, requested name/type or capability, task-specific instructions, and spawn-if-unavailable behavior.

For an existing agent, the overseer resolves the canonical person, loads its persona/behavior and operational instructions, and combines them with the node's task-specific instructions. For an ephemeral agent, no persona profile or invented behavior is attached; the overseer receives a recruitment brief containing the requested capability and node instructions, then spawns a temporary agent if allowed.

If an existing agent cannot be resolved and `spawnIfUnavailable` is enabled, the node produces a typed unavailable-agent result and asks the overseer to spawn a temporary agent. The fallback must not silently assign a different canonical agent.

Templates must not persist hard-coded canonical `assigneeId` values that may not exist in another workspace. They should provide a requested capability, task-specific instructions, and an explicit existing/ephemeral default. Existing `instructions` nodes remain useful for shared or scoped guidance, but are not substitutes for agent delegation instructions.

## Initial workflow

```text
Research competitors
        ↓
Compare findings
        ↓
Enough coverage?
   ├─ yes → Synthesize recommendation
   └─ no  → Ask for more competitors
                    ↓
              Retry research ──↺ Research competitors
```

## Future control-flow candidates

Do not add these in the initial implementation, but keep the category extensible for:

- `wait` for dates, events, webhooks, or external conditions;
- `parallel` and `join` for fan-out and synchronization;
- `loop` for collection iteration;
- `switch` for multi-way routing;
- `handoff` for responsibility transfer; delivery handoff is separately tracked as a terminal delivery contract, not an ordinary dependency node;
- `timeout` and `escalation` for stalled execution;
- `cancel` and `compensate` for intentional stop and cleanup;
- `subworkflow` for reusable Goal invocation;
- `break` and `continue` for loop control;
- explicit `success` and `failure` terminal states.

## Terminal delivery handoff

The first live Goal test showed that execution completion and human delivery are different boundaries. A Goal may have valid evidence and still fail the user's requested outcome if the result is not delivered in the required format or channel.

`delivery-handoff` is therefore a terminal execution contract rather than a normal control-flow node or DAG dependency. It should carry:

- recipient and conversation/channel;
- required deliverable references;
- format, including downloadable PDF or other file preferences;
- summary and naming requirements;
- human or agent acceptance actor;
- delivery status: `pending`, `delivered`, `rejected`, or `failed`;
- a stop condition that prevents Goal completion until the required delivery outcome is recorded.

The terminal handoff must be included in the worker contract where relevant, exposed through MCP/read models, persisted across reload and backup/restore, and visible in the UI as `handoff-pending` before delivery. It must not be flattened into an ordinary connector because delivery semantics are about the final human outcome, not execution ordering.

## First-run execution gaps to close

The first live run also showed that the graph's configured ephemeral agent and `recruitment-requested` state did not result in a spawned subagent, and that the UI remained unaware of active execution. The runtime must enforce the following observable sequence:

```text
validate graph
  → recruit/spawn worker
  → dispatch contract
  → received / acknowledged
  → worker assessed / eligible
  → started / stage updates
  → evidence submitted
  → overseer validated
  → terminal delivery handoff
  → delivered / rejected / failed
```

Every transition needs an immutable typed event with the current node, execution attempt, actor, contract revision, timestamp, and reason. Missing telemetry must produce a visible degraded or blocked state; it must not leave the canvas looking like a draft workflow.

## Implementation boundaries

The first implementation must cover:

- typed node schema and migration-safe persistence;
- Control flow toolbar selector and node creation;
- node inspectors for human-input and retry configuration;
- regular connector configuration for retry targets;
- paused human-input lifecycle state;
- durable free-text responses and full retry context;
- per-execution retry limits and exhaustion policy;
- distinct loop-edge rendering;
- MCP graph and execution read/write contracts;
- renderer, lifecycle, persistence, MCP, and QA coverage.

Out of scope: structured input forms, arbitrary loops, parallel execution, event waiting, and the other future control-flow types listed above.
