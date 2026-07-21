---
name: omvra-goals-loops
description: Shape, groom, implement, and verify Omvra Goals / Loops work across the semantic canvas, durable goal state, MCP contracts, execution artifacts, lifecycle transitions, and QA. Use when a Goals / Loops task, milestone, operating-model decision, architecture question, or implementation request must be tracked separately across documentation, open decisions, development, and acceptance.
---

# Omvra Goals / Loops

Use this skill for Omvra Goals / Loops work in the Plumy repository and its live Omvra task records. Treat the skill as a delivery workflow, not as a product decision: surface unresolved choices for grooming and record decisions only when they are actually agreed.

## Core operating model

- Treat the Goals / Loops canvas as a semantic graph. Position supports the user's mental model; typed connectors and explicit scopes define execution meaning.
- Treat Omvra as the durable system of record for goal definitions, contracts, task projections, execution state, evidence, acknowledgements, handoffs, and audit history.
- Treat the orchestrator/overseer as the coordinator that proposes and advances work within policy. Workers propose evidence, handoffs, and rescope; they do not change governing scope or self-declare completion.
- Treat Loops as a governed orchestration surface, not an n8n-like scheduler. Omvra owns quality, process, direction, contracts, evidence, acceptance, and durable lifecycle state; agents own technical approach and self-regulation.
- Keep the UI responsible for shaping/editing definitions and presenting state. It must not directly invent durable execution truth.
- Keep lifecycle ownership in a dedicated `GoalLifecycleService` boundary. It validates revision-protected transitions, commits durable lifecycle events, and invokes cleanup only after a successful completion commit.
- Keep cleanup as a post-completion, fail-closed side effect. It may remove only verified goal-scoped `project.md` and `roster.md` files under Electron `<userData>/goal-artifacts/<goalId>`; retention is the default.
- Treat Electron-store as the sole source of truth for packaged-app workspace, Goal, execution, event, and evidence data. localStorage may hold disposable UI-only state but is not a workspace fallback, mirror, or conflict participant.

## Layered task tracking rule

For every relevant Omvra task, maintain separate sections in the task notes:

1. `Architecture and documentation status` — decisions and contracts that are actually documented or agreed.
2. `Open architecture decisions` — unresolved choices that could change product behavior, ownership, data shape, authority, or test boundaries. Keep these unchecked and groom them with the human.
3. `Development tasks (tracked separately)` — implementation, integration, migration, runtime wiring, and tests. Keep these unchecked until verified in the repository or live system.

Add a fourth QA/acceptance section when the task has meaningful behavioral risk. Never mark a development task complete because its design is documented. Never silently resolve an open architecture decision to make a checklist look finished.

Use this structure at both task and milestone level. A milestone may summarize cross-task decisions, but each linked task must retain its own layer-specific work and ownership.

## Workflow

### 1. Inspect before shaping

- Read the current task and milestone from Omvra before editing. Capture status, revision, linked tasks, existing notes, comments, attachments, and open questions.
- Inspect the current repository implementation and tests. Distinguish existing behavior from the target contract.
- Check whether a service, schema, MCP operation, helper, or test already exists before proposing a new one.
- Identify the exact source of truth: local spec, renderer state, Electron service, MCP endpoint, or live Omvra record.

### 2. Classify the work

Place every requested item into one or more of these buckets:

- **Architecture decision:** unresolved authority, lifecycle, schema, permission, linking, migration, or acceptance choice.
- **Documentation:** agreed behavior captured in a spec, task notes, contract, or acceptance artifact.
- **Development:** code, persistence, MCP wiring, migration, integration, or runtime behavior.
- **Verification:** tests, live reads/writes, backup/restore checks, UI interaction checks, and human acceptance.

If a decision materially changes any other bucket, stop at that decision and prompt the human. Safe implementation details may be delegated to the overseer only when the outcome, acceptance boundary, and architecture remain unchanged.

### 3. Shape the contract

Document the smallest useful contract before implementation. For lifecycle work, cover:

- goal/subgoal identity and revision;
- contract revision/hash and acknowledgement semantics;
- agent/persona/overseer authority;
- objective, scope, inputs, outputs, constraints, permissions, and interdictions;
- conditions, approval gates, handoff requirements, acceptance actor, and evidence requirements;
- sequence/dependency activation and budget policy;
- execution attempt, durable evidence, audit event, and conflict semantics;
- persistence, backup/restore, and cleanup behavior.

Use typed fields for executable authority. Treat free-form prose as context unless its scope and authority are explicitly recorded.

### 4. Update the live records

When task or milestone tracking is in scope:

- Update the real Omvra record, not only a local draft.
- Preserve existing decisions and history.
- Use optimistic revision protection and re-read after every write.
- Add a concise comment for important shaping decisions or handoffs.
- Keep architecture/documentation checkboxes separate from development checkboxes.
- Leave the task `In Progress` while implementation or decisions remain open.

Report the persisted revision and status after verification.

### 5. Implement the smallest correct boundary

- Reuse existing stores, schemas, services, MCP tools, and UI patterns.
- Prefer one authoritative guard or transition boundary over caller-specific patches.
- Keep editable `GoalRecord` graph state separate from execution state such as lifecycle status, attempt, evidence, and cleanup outcome.
- Do not wire cleanup to a UI status toggle or infer completion from Markdown artifact presence.
- Preserve unknown metadata and historical evidence across revisions.

### 6. Verify proportionally

At minimum, verify the relevant local build/tests and `git diff --check`. For MCP or task work, re-read the live record. For lifecycle work, test stale revisions, idempotent commands, blocked transitions, durable evidence checks, retry behavior, and post-commit cleanup. For UI work, distinguish screenshot/visual evidence from exercised interaction behavior.

## Lifecycle guardrails

The proposed lifecycle owner is `GoalLifecycleService`. Its completion flow is:

1. Validate expected goal revision, attempt, contract, predecessors, evidence, acceptance, gates, and budget.
2. Atomically persist final execution state and `goal.lifecycle.completed`.
3. Invoke the cleanup runner only after the durable commit succeeds.
4. Persist the cleanup outcome or a retry/reconciliation marker. Cleanup failure does not undo completion.

Use revision-checked, idempotent commands for `start`, `dispatch`, `submit-evidence`, `request-handoff`, `accept`, `pause`, `resume`, `retry`, `fail`, and `complete`. A worker acknowledgement means receipt and parsing of the exact contract revision; it does not grant authority or establish completion.

## Open-decision prompts

Prompt the human when the answer is not discoverable and could materially affect the product. Common Goals / Loops decisions include:

- **Resolved — runtime boundary:** Loops is a governed planning/orchestration surface, not a first-class workflow runtime. Do not add cron-like scheduling, worker-loop ownership, subagent spawning, or model-invocation control to Omvra as part of the core product. When an agent node has `workAsSubagent` enabled, Omvra must instruct the working agent to create and manage it through the working agent's own runtime.
- **Resolved — action authority:** observation, bounded execution control, evidence/handoff, and project mutations require no confirmation by default; planning, workflow mutation, subgoal redefinition, budget overruns, release approval, gate bypass, artifact removal, and project-critical deletion require human confirmation. External writes, MCP calls, and repository changes follow the responsible agent's configured approvals. Lifecycle actions require human decision unless expressly prompted or assigned within the accepted contract.
- **Resolved — goal/project relationship:** Goals are workspace-level and project membership is optional. A Goal may coordinate multiple project-owned artifacts or remain projectless for outcomes such as recurring, multi-source user briefings.
- **Resolved — configurable budget and acceptance policy:** Workflows settings provide independently configurable defaults for time, tokens, financial cost, concurrency, total attempts, and retries/rework, including each dimension's cap/reallocation mode. Goals inherit or override those defaults; acceptance defaults are also configurable at workspace level, with goal overrides and gate-level narrowing allowed. A lower-level policy may not weaken a higher-level human-confirmation requirement.
- **Resolved — MCP and backup baseline:** `goals.get` includes the complete graph plus current execution state; graph writes support focused element/connector updates and full replacement, both revision-checked and idempotent. Agent graph mutation requires human confirmation by default but is user-configurable. Backup is a compact, compressed, versioned JSON envelope with unknown-field preservation, replace-only restore, fail-fast collision handling, and read-only imported execution history. MCP history and evidence may use optional user-configured local archive directories.
- how goals link across projects, tasks, milestones, MCP capabilities, and approval gates when a cross-project or projectless Goal requires additional relationship semantics;
- who owns lifecycle truth and whether execution state is separate from graph definitions;
- stable IDs, revision scope, migration strategy, and Electron-store/localStorage precedence;
- link cardinality and authority when goal, task, or milestone revisions disagree;
- evidence ownership and test-environment authority;
- cleanup retention policy.

Park the operational policy editor as a separate future product idea. Do not add a policy-file editor to the current canvas or lifecycle implementation without a dedicated discovery and architecture task.

Do not convert these into implementation tasks until the decision is recorded.

## Task-note template

```md
Architecture and documentation status:
- [x] Documented or agreed contract item.
- [x] Documented persistence or UX rule.
- Documentation status is complete/partial for the stated scope; this is not a runtime claim.

Open architecture decisions:
- [ ] Decision that needs human grooming.

Development tasks (tracked separately):
- [ ] Runtime or repository implementation task.
- [ ] Integration/migration task.
- [ ] Verification or acceptance task.
```

## Handoff format

End work with: what changed, what was verified, what remains open, the authoritative file or Omvra record, persisted revision/status, and the next owner/action. Keep the summary concise and do not claim completion from documentation alone.
