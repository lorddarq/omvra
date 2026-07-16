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

The file should be scoped per goal or execution context, versioned with the goal revision, and updated atomically with a handoff where possible. It may be cleared at goal completion or retained as an opt-in final decision log. If it is cleared, the durable structured execution record and final evidence must remain available.

Markdown is for resumability and inspection. Metrics must come from durable structured events and execution records, including task and subgoal attempts, failures, elapsed time, agent transitions, issue counts, evidence submissions, retries, and approval/blocked periods. The system must not depend on parsing `project.md` to calculate metrics.

The goal should also maintain an ephemeral `roster.md` for temporary agent recruitment. It should record the recruited agent type/persona, why the existing pool was insufficient, the competencies and skills requested, relevant instruction sources, the subgoals served, and whether the agent was dismissed or retained at completion. This helps inspect overseer recruitment rationale and discover recurring competency gaps. The durable agent assignment, recruitment, and dismissal events remain the authoritative audit and metrics source.

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
- **Working-context retention:** whether completed goals retain `project.md` by default or delete it after durable records and final evidence are verified.
- **Roster retention:** whether completed goals retain `roster.md` by default or clear it after durable recruitment events and the final evidence are verified.

Until resolved, the safe default is to pause at ambiguity, approval, stale-contract, missing-evidence, and failed-gate states; preserve evidence; and request a human decision.

## Implementation handoff

The next deliverable is an implementation-ready lifecycle and state-transition specification covering:

- the minimum goal/subgoal/contract/acknowledgement schema;
- goal-to-task decomposition and persona recruitment;
- condition, approval, handoff, retry, delegation, wake, and escalation behavior;
- permission and interdiction precedence;
- user-versus-overseer acceptance semantics;
- MCP read/write operations and revision conflict behavior;
- persistence and backup requirements;
- acceptance tests for advancing, pausing, resuming, and failing a goal.
