# Goals / Loops operating model

Status: shaping

This document defines the current operating model for Goals / Loops. It is the product contract to refine before implementation work is considered complete.

## Purpose

Goals / Loops is a durable planning-and-orchestration surface exposed through MCP. It is not only a visual workflow diagram and not only a planning document. A goal describes an intended outcome, the work required to reach it, the agents or personas responsible for that work, and the boundaries that govern execution.

Omvra is the durable system of record. The orchestrator is the overseer: it reads the goal, decomposes and delegates work, records evidence and decisions, and advances the workflow when its configured gates are satisfied.

## Confirmed execution flow

When a user asks an orchestrator to execute a goal by ID:

1. The orchestrator connects to Omvra through MCP and retrieves the goal, subgoals, typed connectors, instructions, conditions, approval gates, agent references, handoffs, permissions, interdictions, and current state.
2. It validates that the goal is executable: the graph is structurally valid, required agents and personas are available, contracts are complete, and no required approval is missing.
3. It maps each subgoal to an existing canonical agent/persona. It may recruit or create an agent only when no suitable existing agent is available and the goal policy permits it.
4. It uses the project-management capabilities to materialize tracked tasks, todos, milestones, and sequence dependencies for the subgoals.
5. It issues a versioned contract packet to the agent responsible for the first eligible subgoal.
6. The agent acknowledges the contract revision/hash through MCP before work begins.
7. The orchestrator monitors the subgoal state, evidence, conditions, and handoff. It may delegate, wake, query, dismiss, sleep, request rework, pause, or escalate according to the goal policy and the competency/instruction fit of the destination agent.
8. Once the subgoal's completion evidence and handoff satisfy the configured acceptance boundary, the orchestrator records completion and activates the next eligible subgoal.
9. The cycle continues until the goal reaches human acceptance, completion, failure, or an explicitly blocked state.

The graph's spatial arrangement should communicate the user's intended workflow. Execution meaning must remain explicit in typed connectors and scoped relationships; coordinates must never be the sole source of ordering or authority.

## Durable state and contracts

The following must survive application restarts and workspace backup/restore:

- goal and subgoal definitions;
- node positions and typed connectors;
- overseer assignment and canonical agent references;
- instructions and their scope;
- conditions, approval gates, permissions, and interdictions;
- generated contract packets and their revisions/hashes;
- agent acknowledgements;
- task, todo, milestone, and dependency projections;
- execution state, attempts, evidence, handoffs, decisions, and audit history.

Instructions are authoritative only when explicitly scoped and included in the generated contract packet. An agent must acknowledge the packet revision before work begins. A contract change invalidates affected acknowledgements, pauses affected work, preserves existing evidence, and requires overseer reconciliation before execution resumes.

### Proposed minimum contract packet

The following is the minimum proposed packet sent to a worker agent. It is intentionally a reference-rich contract: large instructions and evidence should remain in Omvra and be addressed by stable ids or URIs rather than copied into every dispatch.

| Field | Purpose |
| --- | --- |
| `goalId`, `goalRevision` | Identify the governing goal version |
| `executionAttemptId`, `subgoalId` | Identify the current run and work unit |
| `contractId`, `contractRevision`, `contractHash` | Bind work and acknowledgement to one immutable packet |
| `agentId`, `personaId`, `overseerId` | Identify the worker, competency, and coordinator |
| `objective` and `scope` | State the outcome and boundaries of the assignment |
| `inputs` and `instructionRefs` | Identify required source material and explicitly scoped instructions |
| `outputs` and `deliverables` | Define what the worker must produce |
| `constraints`, `permissions`, and `interdictions` | Define what the worker may and may not do |
| `acceptanceCriteria` and `evidenceRequirements` | Define how completion is evaluated |
| `handoff` | Define recipient, format, context, and stop condition for transfer |
| `sequencePredecessors` and `nextEligibleStates` | Define dependency and activation boundaries |
| `allocatedAutonomyBudget` | Bound retries, loops, and resource consumption for this work unit |
| `contextRefs` | Point to the current `project.md`, `roster.md`, task, and relevant evidence |

The minimum acknowledgement is sent by the worker agent and means only: “I received and parsed this exact contract revision.” It should include `agentId`, `executionAttemptId`, `contractId`, `contractRevision`, `contractHash`, `receivedAt`, and an explicit `acknowledged` or `rejected` result. A rejection must include a reason or missing-information list.

Acknowledgement does not mean that the worker accepts authority to redefine the goal, alter the workflow, waive an interdiction, or declare the contract safe to execute. Execution eligibility is a separate overseer-controlled decision. The lifecycle is:

`dispatched` → `received` → `acknowledged` → `worker assessed` → `overseer validated` → `eligible to work`

After acknowledgement, the worker may submit a separate typed assessment: `ready`, `needs-clarification`, `needs-rescope`, or `blocked`. If it detects a conflict, missing input, infeasible instruction, or risk to the stated objective, it should acknowledge receipt and report the issue rather than silently adapting the work.

The overseer evaluates any proposed rescope against the goal, subgoal, acceptance gate, permissions, interdictions, dependencies, and remaining budget. A non-breaking rescope may be authorized automatically when the applicable policy permits it and sufficient budget is available. A breaking change, unavailable budget, or policy conflict enters the impact and estimation gate. Any authorized semantic change creates a new contract revision and requires the worker to acknowledge the revised packet before continuing. The worker cannot unilaterally modify the contract or sequence.

### Negotiated rescoping

`needs-rescope` is a request to investigate, not permission to change execution. The overseer should negotiate with the worker and, when relevant, the user to understand the underlying business need before accepting a proposed change.

The negotiation record should capture typed fields for:

- triggering observation or constraint;
- suspected underlying business need;
- current objective and assumption at risk;
- proposed scope change;
- alternatives considered, including continuing with the current scope;
- impact on the goal outcome, architecture, downstream subgoals, acceptance criteria, and evidence;
- budget impact by dimension and available budget;
- recommended decision and required approver.

The overseer should distinguish a symptom from a changed business outcome. It may authorize a bounded adjustment when the underlying outcome, acceptance contract, architecture boundary, and dependency chain remain intact, the applicable policy permits the change, and budget is available. It must route the change through the impact and estimation gate when the outcome, product scope, architecture, acceptance criteria, or downstream sequence could be compromised. User approval is required when the change alters the end goal, approved product direction, human acceptance requirements, or a protected policy boundary.

The negotiation must preserve the original request, the worker's rationale, the alternatives, the decision, and the resulting contract revision in `project.md` and the durable execution history. The overseer must not use negotiation to consume unbounded budget while deferring a decision.

Workers have proposal authority, not governing-contract authority. They may report contradictions, missing inputs, infeasible requirements, implementation realities, and proposed changes through the typed assessment and negotiation record. The overseer owns the default decision and evaluates the proposal against the ultimate goal, not only the local subgoal.

If a proposal could endanger the goal or subgoal, change the approved outcome, invalidate downstream work, or consume material unapproved budget, the overseer should prefer user input over inference and continuation. A goal may explicitly delegate a defined class of decisions to the overseer through operational policy, such as “resolve implementation-level tradeoffs without interrupting the user when acceptance criteria and architecture remain unchanged.” Delegation must be typed, scoped, and visible in the contract; it must not be inferred from ordinary prose.

## Skill distribution and resolution

Goals may require skills for business framing, product analysis, design, implementation, QA, or other specialized work. Skill availability is part of goal setup and agent preflight, not an implicit assumption in free-hand instructions.

For the MVP, Omvra should ship a read-only bundled skills catalog and use those skills directly from their installed folder. A goal or subgoal references a skill by typed `skillId`, version, and required stage/persona. The orchestrator checks availability before dispatch and includes the resolved skill references in the contract packet.

The initial resolution order should be:

1. Omvra-bundled skills, which are trusted and read-only.
2. An explicitly configured workspace skills directory.
3. An explicitly configured user skills directory.

External sources must not be downloaded, installed, or executed implicitly during goal setup. A local override may be used only when it is explicitly configured, has a valid manifest and version, and passes the applicable trust/integrity checks. If a required skill is unavailable or incompatible, setup pauses with a typed missing-skill result rather than silently substituting prose or a different skill.

The settings surface should live under an Agents & Skills section, alongside agent/persona configuration. It should show the bundled read-only location, optional workspace and user directories, source precedence, discovered skill versions, integrity/trust status, and refresh/validation actions. Goal setup should show which skills will be used, which are missing, and whether a local override is taking precedence.

The skill manifest should be small and typed at minimum: `skillId`, `version`, `name`, `summary`, `supportedStages`, `supportedPersonas`, `entrypoint`, `source`, `integrityHash`, and `trustStatus`. Skill prose remains advisory content inside the generated contract; it cannot override system, safety, goal policy, or acceptance rules.

Only semantic contract changes invalidate an acknowledgement. Examples include changes to objective, scope, inputs, instructions, outputs, constraints, permissions, interdictions, acceptance criteria, evidence requirements, handoff, dependency, or budget. Cosmetic labels, layout, and non-authoritative notes should not force a restart.

### Policy authority and typed fields

Policies that govern execution should be represented as strongly typed, versioned fields wherever possible. Typed policy is executable authority; free-hand text is contextual guidance unless it is explicitly marked, scoped, and compiled into the contract as an authoritative instruction.

The effective policy is resolved in this order:

1. Platform safety and system-level interdictions.
2. Goal-level permissions, interdictions, budgets, and acceptance policy.
3. Subgoal policy, when it narrows or specifies behavior for that subgoal.
4. Acceptance-gate policy, when it governs the gate's actor, evidence, approval, or release behavior.
5. Contract-level fields generated from the resolved policy.
6. Scoped authoritative instructions linked to the relevant node, handoff, or transition.
7. Free-hand descriptions and notes as non-authoritative context.

Lower-level policy may narrow higher-level authority but may not silently weaken a higher-level interdiction or safety rule. A conflict, missing required field, or ambiguous promotion from prose to policy pauses execution and enters `approval required`.

Acceptance gates should support an explicit actor mode: `human`, `agentic`, or `both`. `agentic` requires the overseer's evidence checks; `human` requires the designated human decision; `both` requires both checks to pass. Gate-specific policy may define evidence, approvers, budget behavior, and failure handling without overriding goal-level safety rules.

Free-hand text can be promoted into an authoritative contract instruction only through an explicit user action or a shaping decision that records its scope, owner, effective revision, and acceptance impact. The overseer must not infer binding policy from ordinary prose.

## Contract-change impact gate

Contract changes use impact-aware invalidation. The system must not restart the whole workflow merely because text or instructions changed.

After new user input or an approved change request arrives, the overseer creates a change proposal and evaluates it before mutating execution:

1. Classify the change as operational, local corrective, scope-changing, or goal-defining.
2. Identify the earliest affected subgoal and all downstream sequence dependents.
3. Estimate the rework, time/token/cost budget, affected agents, approval gates, and expected evidence that remains reusable.
4. Present the impact summary and proposed restart boundary to the user when the change would invalidate active work or materially consume budget.
5. On approval, create a new goal/contract revision and execution attempt from the earliest affected stage. Preserve superseded work as historical evidence; do not silently use it as completion evidence for the new revision.

Operational changes may continue in place. Local corrective changes pause and re-acknowledge only the affected scope. Scope-changing changes invalidate the affected subgoal and downstream dependents. Goal-defining changes, such as a new product outcome, architecture, or acceptance criteria, normally restart from Shaping.

The impact gate must be recorded in the durable execution history and summarized in `project.md`, including the change classification, rationale, invalidation boundary, reusable evidence, estimated cost, approval decision, and new execution attempt identifier.

## Overseer state model

The overseer is the record keeper for state transitions. The user may configure the policy and acceptance boundary, but subgoal status is derived from execution state rather than being freely user-set.

Normal states:

`waiting for input` → `ready` → `working` → `evidence required` → `handoff pending` → `complete`

Interruption states:

`blocked`, `approval required`, and `failed`

The overseer must not advance a sequence dependency while its predecessor is incomplete, its required evidence is missing, its acknowledgement is stale, or a configured approval gate has not passed.

## Budgeted autonomy

The overseer is autonomous for starting, pausing, retrying, delegating, waking, and reassigning work when those actions are permitted by the goal's rules. Human approval is required only when an explicit approval gate, permission boundary, interdiction, or execution-budget limit requires it.

Every executable goal must have a bounded autonomy budget. At minimum, the budget must cover:

- maximum concurrently running loops;
- maximum total loop attempts for the goal;
- maximum retries or rework cycles per subgoal;
- maximum escalation-free time or token/cost budget, when the runtime exposes those measurements.

Starting a loop, retrying a failed handoff, requesting rework, or reassigning an active subgoal consumes budget. A reassignment must not reset the attempt count. When a limit is reached, the overseer must stop dispatching work, preserve the current evidence and state, and transition the goal to `approval required` or `blocked` with a human-readable reason. The human may extend the budget, change the policy, or abandon the goal; the overseer must not silently continue.

The budget is a safety boundary, not a target. The overseer should stop earlier when it detects a repeated failure signature, no meaningful evidence delta, an unsatisfied prerequisite, or a contract/policy conflict.

Budget reallocation is a configurable policy, not a universal overseer behavior. The goal settings must define the policy for each budget dimension—financial cost, tokens, elapsed time, concurrent loops, and retries/rework—and may provide tighter subgoal-level overrides.

For each dimension, the user may choose a policy such as:

- **Hard cap:** never exceed or reallocate beyond the assigned amount; pause for approval.
- **Goal pool:** allow the overseer to move unused budget from another subgoal within the explicit goal-level pool.
- **Approval to reallocate:** allow the overseer to propose a transfer, but require user approval before consuming it.
- **Unbounded by this dimension:** explicitly permit continued work for that dimension, subject to other budgets and stop conditions.

The policy must record who authorized it, when it was set, which subgoals may donate or receive budget, and whether the rule applies to the current execution attempt or future attempts. Financial authorization is independent from token authorization: a user may permit a large token budget while retaining a hard monetary cap, or explicitly permit both. A subgoal-specific hard cap overrides a flexible goal pool unless the user explicitly permits that subgoal to receive reallocated budget.

When a transfer is permitted, the overseer records the donor, recipient, dimension, amount, reason, policy setting, and resulting balances before dispatching more work. If no applicable policy permits the transfer, the subgoal pauses in `approval required` rather than assuming permission.

## Working context and stage transitions

Each active goal should maintain an ephemeral Markdown working-context file, initially named `project.md`. It is a transition artifact, not the source of truth. The overseer owns its structure and updates it after meaningful decisions, handoffs, failures, reassignments, and stage changes.

The working context must be granular enough for a newly activated agent to resume without replaying the entire conversation. At minimum it should contain:

- current goal and subgoal, stage, status, and next decision;
- the accepted objective and current contract revision/hash;
- decisions made, rejected alternatives, and unresolved questions;
- relevant inputs, constraints, permissions, and interdictions;
- completed work and evidence locations;
- failed attempts, issue summaries, retry count, and why the next attempt is different;
- active agents, their competency rationale, last known state, and pending requests;
- handoff requirements and the exact condition for advancing;
- the next recommended action and the stop/escalation reason, when applicable.

The file should be scoped per goal or execution context, versioned with the goal revision, and updated atomically with a handoff where possible. Completed goals retain `project.md` and `roster.md` by default as an inspectable final decision and recruitment log. The user can enable the `Cleanup goal artefacts` workflow setting to remove them after durable execution records and final evidence are verified; cleanup must never remove those durable records or evidence.

Markdown is for resumability and inspection. Metrics must come from durable structured events and execution records, including task and subgoal attempts, failures, elapsed time, agent transitions, issue counts, evidence submissions, retries, and approval/blocked periods. The system must not depend on parsing `project.md` to calculate metrics.

The goal should also maintain an ephemeral `roster.md` for temporary agent recruitment. It should record the recruited agent type/persona, why the existing pool was insufficient, the competencies and skills requested, relevant instruction sources, the subgoals served, and whether the agent was dismissed or retained at completion. This helps inspect overseer recruitment rationale and discover recurring competency gaps. The durable agent assignment, recruitment, and dismissal events remain the authoritative audit and metrics source. Retention is the default; cleanup is controlled by the `Cleanup goal artefacts` workflow setting.

### Completion cleanup hook

Cleanup is a post-completion side effect, never part of the state transition that establishes completion. The completion transition must first persist the final goal state, durable execution events, final evidence references, and any required human acceptance. Only then may it invoke the cleanup hook.

Electron owns the canonical artifact root at `<userData>/goal-artifacts`, where `<userData>` is `app.getPath('userData')`. Each goal uses a child directory named by its validated goal id. This keeps the files recoverable from the app's Library/Application Support data location while keeping them outside the project workspace. The hook receives `{ goalId, artifactRoot, cleanupEnabled, durableRecordsVerified, finalEvidenceVerified }`, with the Electron owner deriving `artifactRoot` from that user-data root, and is fail-closed:

- `cleanupEnabled: false` returns `skipped` and leaves both working-context files untouched;
- either verification flag being false returns `blocked` and leaves both files untouched;
- a missing goal id, unsafe artifact path, or unknown artifact location returns `invalid` and performs no deletion;
- when all preconditions pass, the runner may delete only the goal-scoped `project.md` and `roster.md` files, never the artifact directory, durable records, evidence, or unrelated files;
- deletion is idempotent: missing target files count as already-cleaned, while individual failures are returned as `partial-failure` with the error and any successful deletions;
- cleanup emits a structured `goal.artifacts.cleanup` event containing the goal id, setting state, verification outcome, requested files, removed files, and result. The event is written before or alongside the cleanup attempt by the durable execution owner, and is never stored in either Markdown artifact.

The first implementation exposes this hook as a side-effect service. The goal-completion orchestrator must call it only after its durable commit succeeds and must treat `blocked`, `invalid`, and `partial-failure` as observable cleanup outcomes rather than as completion failures. Until that orchestrator boundary exists, the default remains retention and no cleanup is attempted automatically.

## Proposed goal lifecycle owner and transition protocol

The lifecycle owner should be a dedicated `GoalLifecycleService` in the Omvra durable-state boundary. It owns validation, state transitions, revision checks, durable lifecycle events, and the post-commit cleanup invocation. It must not be the cleanup runner itself: cleanup is a narrow side effect of a successful completion transition.

The ownership boundary is:

| Actor | Authority |
| --- | --- |
| Goals UI | Edit the goal graph and shaping fields; it may request lifecycle commands but may not directly set execution state or emit completion evidence. |
| Orchestrator/overseer | Propose dispatch, pause, retry, handoff, acceptance, and completion commands with evidence and policy context. |
| Worker agent | Submit acknowledgement, assessment, evidence, and handoff proposals; it cannot promote its own work to complete. |
| `GoalLifecycleService` | Validate and atomically commit allowed transitions, increment revisions, append durable events, and invoke post-commit effects. |
| Cleanup runner | Delete only verified goal-scoped working-context files and return an observable cleanup result. |

The current `GoalRecord` shape is sufficient for graph editing but is not sufficient as the execution record. Execution state should be stored beside the goal definition rather than overloaded into `GoalElement.status`:

```ts
type GoalExecutionStatus =
  | 'draft'
  | 'ready'
  | 'working'
  | 'evidence-required'
  | 'handoff-pending'
  | 'awaiting-acceptance'
  | 'complete'
  | 'blocked'
  | 'approval-required'
  | 'failed';

interface GoalExecutionRecord {
  goalId: string;
  goalRevision: number;
  executionAttemptId: string;
  status: GoalExecutionStatus;
  overseerAgentId?: string;
  contractRevision?: number;
  contractHash?: string;
  requiredAcceptanceActor: GoalAcceptanceActor;
  durableEvidenceRefs: string[];
  finalEvidenceVerified: boolean;
  durableRecordsVerified: boolean;
  cleanupStatus?: 'not-requested' | 'skipped' | 'blocked' | 'cleaned' | 'invalid' | 'partial-failure';
  updatedAt: string;
}
```

### Allowed transitions

Every command includes `goalId`, `expectedGoalRevision`, `executionAttemptId`, `actorId`, `requestedAt`, and an idempotency key. The service rejects stale revisions before evaluating the command. It returns the current revision and conflict reason; callers must re-read and reconcile rather than overwrite.

| From | Command | Preconditions | To |
| --- | --- | --- | --- |
| `draft` | `start` | Graph valid, required agents/skills resolved, policy and budget present | `ready` |
| `ready` | `dispatch` | Predecessors complete, contract acknowledged, no gate or budget block | `working` |
| `working` | `submit-evidence` | Evidence references are durable and scoped to the attempt | `evidence-required` |
| `evidence-required` | `request-handoff` | Acceptance criteria and evidence checks pass | `handoff-pending` |
| `handoff-pending` | `accept` | Required actor has accepted; for `both`, both checks pass | `complete` or next eligible state |
| `working` / `evidence-required` / `handoff-pending` | `pause` | Actor is authorized or a policy stop condition exists | `blocked` or `approval-required` |
| `blocked` / `approval-required` | `resume` | Blocking reason resolved, revision revalidated, contract still current | `ready` or prior active state |
| `working` / `evidence-required` / `handoff-pending` | `fail` | Failure reason and preserved evidence recorded | `failed` |
| `working` / `evidence-required` / `handoff-pending` / `failed` | `retry` | Retry budget and policy permit another attempt | `ready` |

`complete` is terminal for an execution attempt. A changed objective, acceptance boundary, or semantic contract creates a new goal revision and execution attempt; it never reopens the completed attempt in place. A newly discovered cleanup failure does not downgrade completion. It updates the cleanup outcome and emits an operational event for retry or inspection.

### Completion transaction

`complete` is a two-phase application operation with one durable commit boundary:

1. Validate the expected goal revision, execution attempt, current contract, predecessor states, evidence references, acceptance actor, budget, and all required gates.
2. Write the final execution record, completion decision, evidence references, handoff result, and `goal.lifecycle.completed` event atomically. Set `durableRecordsVerified` and `finalEvidenceVerified` from the commit result, not caller claims.
3. After the durable commit succeeds, invoke `cleanupGoalArtifacts` with the resolved user-data artifact root and the persisted verification results.
4. Persist `goal.artifacts.cleanup` as a follow-up event and update `cleanupStatus`. A `skipped`, `blocked`, `invalid`, or `partial-failure` result is observable but does not undo the completed state.

If step 2 fails, no cleanup is attempted. If the process exits between steps 2 and 3, a durable `cleanup pending` marker allows a later lifecycle reconciliation pass to retry the side effect idempotently. The reconciliation pass must never infer completion from the presence or absence of `project.md` or `roster.md`.

### Commands and durable events

The minimum command surface is `start`, `dispatch`, `submit-evidence`, `request-handoff`, `accept`, `pause`, `resume`, `retry`, `fail`, and `complete`. Each accepted command appends an event containing `eventId`, `eventType`, `goalId`, `goalRevision`, `executionAttemptId`, `actorId`, `occurredAt`, `previousStatus`, `nextStatus`, `commandId`, and typed reason/evidence fields. Replaying a command with the same idempotency key returns the original result without appending a second transition.

The minimum completion evidence record must identify the acceptance criteria checked, the evidence references used, the verifier, verification time, and whether the evidence belongs to the current contract revision. Evidence may be preserved from earlier attempts only when the impact gate explicitly marks it reusable; otherwise it cannot satisfy completion.

This proposal makes Omvra the owner of lifecycle truth while keeping the current prototype honest: until `GoalLifecycleService` exists, the Goals canvas can continue to edit and persist graph definitions, but it must not claim that those edits constitute an executable completion transition or trigger cleanup automatically.

## Responsibility boundaries

| Responsibility | Owner |
| --- | --- |
| Define outcome, constraints, and acceptance policy | User |
| Interpret the goal graph and coordinate execution | Overseer/orchestrator |
| Produce the assigned deliverables and evidence | Worker agent |
| Persist canonical state and expose it through MCP | Omvra |
| Approve configured human gates | User or designated human reviewer |
| Maintain task, todo, milestone, and dependency projections | Orchestrator through project-management MCP tools |

## Acceptance policy

Acceptance is configured per goal. The default is human acceptance for every completed subgoal, which gives the user a review point at each handoff. The user may change the goal setting to require acceptance only at configured human-acceptance gates or at final goal completion. The selected policy must be included in the goal contract and visible in the execution state; changing it during active work passes through the contract-change impact gate.

The overseer may perform its own evidence and completion checks regardless of the configured human-acceptance policy. It must not mark a subgoal fully complete when the selected policy still requires human acceptance.

## Agent-pool and temporary recruitment policy

The overseer should first use canonical agents from the existing pool, matching the required competency, persona, instructions, and destination scope. If no sufficiently close match exists, and the goal permissions allow it, the overseer may create a temporary specialized agent for the subgoal. Recruitment must be justified, bounded by the goal autonomy budget, and recorded in `roster.md` plus durable structured events. Temporary agents should be dismissed or put to sleep when no longer needed; retention requires an explicit reason.

## Open policy decisions

These decisions remain intentionally unresolved and must be agreed before the operating model is implementation-ready:

- **Approval scope:** whether every subgoal handoff requires user approval, or only explicit gates such as release, destructive actions, and major scope changes.
- **Autonomy budget defaults:** the default concurrent-loop, total-attempt, retry, and cost/time limits for a new goal.
- **Contract changes:** whether affected work resumes from preserved evidence after re-acknowledgement, or starts a new execution attempt.
- **Contract changes:** use the impact gate above; resume locally when valid, otherwise create a new execution attempt from the earliest affected stage. Full restart is reserved for goal-defining changes.
- **Acceptance boundary:** whether the user must accept every subgoal, or only the final goal and configured human-acceptance gates.
- **Agent recruitment:** whether the orchestrator creates an agent only when no matching canonical persona exists, or may proactively create specialized agents.
- **Resolved — working-context retention:** completed goals retain `project.md` and `roster.md` by default. The `Cleanup goal artefacts` workflow setting opts into deletion after durable records and final evidence are verified.

## Resolved architecture boundary: governor, not runtime

Loops is a planning/orchestration surface with an executable governance boundary, not a first-class workflow runtime or cronjob scheduler. Omvra owns quality, process, direction, contracts, permissions, evidence, acceptance, and durable lifecycle state. Agents own the technical approach and self-regulation while executing accepted work.

Omvra must therefore:

- validate dispatch, pause, retry, handoff, evidence, acceptance, and completion requests;
- enforce contracts, dependencies, conditions, approval gates, budgets, permissions, and interdictions;
- preserve durable state, evidence, decisions, and audit history;
- reject or pause work that violates the governing contract; and
- expose the next eligible action without owning the worker's internal loop, scheduling strategy, model invocation, or technical implementation approach.

Agents may choose their technical methods, regulate their own working loop, and report evidence, rescope proposals, failures, or handoffs. They may not redefine the governing outcome, bypass Omvra's transition boundary, or self-authorize completion.

This boundary intentionally avoids building an n8n-like scheduler inside Omvra. Any future background execution service would be an optional adapter for dispatch and reconciliation, not the owner of workflow meaning or agent technique.

## Resolved action authority policy

The action pool is the set of control-plane actions Omvra can recognize, authorize, audit, or reject. It does not include an agent's internal reasoning or technical implementation choices.

| Action category | Default authority | Boundary |
| --- | --- | --- |
| Observation | Overseer/agent | No confirmation. Read-only inspection of goals, tasks, milestones, evidence, dependencies, skills, and status. |
| Planning | Human | Human confirmation is required. Subgoal redefinition always requires confirmation because it may change the goal's final outcome. |
| Execution control | Overseer | No confirmation within scope. Raise an exception when the action conflicts with the subgoal or end goal, or requires changing operational instructions to finish the goal. |
| Evidence and handoff | Overseer/agent | No confirmation. Record outcomes ephemerally per goal for debugging and resumability, while durable structured events remain authoritative for audit and metrics. |
| Workflow mutation | Human | Human confirmation is required for changes to scope, dependencies, acceptance criteria, contracts, gates, permissions, or interdictions. |
| Project mutations | Overseer/agent | No confirmation by default, but notify the human. Use canonical project-management writes and preserve auditability. |
| Send messages on the user's behalf | Human | Human confirmation is required. |
| Write files, call external MCP tools, modify repositories | Agent configuration | Follow the configured approvals for the responsible agent/runtime. For example, use Codex's configured approval behavior rather than inventing a second Omvra policy. |
| Budget overruns, release approval, gate bypass, artifact removal | Human | Human confirmation is required. |
| Delete data | Human when project-critical | Require confirmation for project-critical data; otherwise follow the applicable agent configuration and project policy. |
| Lifecycle actions | Human or delegated overseer | Require a human decision by default. No confirmation is needed when the human expressly prompted the action or it is an explicitly assigned task within the accepted contract. |

The overseer may execute an action autonomously only when the action category and current contract authorize it. A conflict, missing authority, material scope change, or operational-instruction change pauses the action and creates an exception for human review. This policy governs Omvra's control-plane decisions; it does not constrain an agent's internal technical approach.

### Parked product idea: operational policy editor

An operational policy editor is a future product feature, not part of the current Goals / Loops implementation. It would provide a typed UI backed by a policy file or durable policy record, with scoped rules, approval defaults, agent configuration references, and audit history. Park it for separate discovery and architecture work rather than adding an ad hoc policy editor to the current canvas or lifecycle slice.

Until the remaining decisions are resolved, the safe default is to pause at ambiguity, approval, stale-contract, missing-evidence, and failed-gate states; preserve evidence; and request a human decision.

## Implementation handoff

The next deliverable is the implementation of the lifecycle boundary described above, covering:

- the minimum goal/subgoal/contract/acknowledgement schema;
- goal-to-task decomposition and persona recruitment;
- condition, approval, handoff, retry, delegation, wake, and escalation behavior;
- permission and interdiction precedence;
- user-versus-overseer acceptance semantics;
- MCP read/write operations and revision conflict behavior;
- persistence and backup requirements;
- acceptance tests for advancing, pausing, resuming, and failing a goal.
- a durable completion commit followed by idempotent cleanup reconciliation.
