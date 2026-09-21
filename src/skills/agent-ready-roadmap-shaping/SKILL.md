---
name: agent-ready-roadmap-shaping
description: Turn a vague product idea into an approved, provider-neutral execution plan with a PRD or architecture note, milestone, dependency-ordered tasks, todos, and acceptance criteria. Use for discovery-to-roadmap shaping before implementation by any AI agent or human.
---

# Agent-ready roadmap shaping

Use this workflow when a request starts as an idea, rough task, or ambiguous product problem and needs to become governed, executable work.

The workflow is provider-neutral. Do not assume ACP, Codex, Claude, a particular model, or a particular runtime. The resulting task contract must be usable by any assigned worker that can inspect the repository and produce evidence.

## Authority boundary

- The agent may investigate, identify gaps, propose scope, draft documentation, split work, and recommend dependencies.
- The agent must not turn its own interpretation into binding product scope silently.
- Ask the user focused questions when unresolved answers could change the outcome, architecture, data model, permissions, migration, acceptance boundary, or schedule.
- Before creating or materially updating durable milestone/task records, present the shaped outcome, open decisions, PRD or architecture summary, task breakdown, and dependency order for approval unless the user has already explicitly approved that exact scope.
- Once approved, treat the resulting contract as authoritative until an explicit rescope or revision is made.

## Workflow

### 1. Capture the rough idea

Create or locate a lightweight discovery task. Preserve the original request and distinguish:

- desired user or business outcome;
- known constraints and evidence;
- assumptions that still need validation;
- non-goals and likely risks.

Do not inflate a vague request into implementation scope at this stage.

### 2. Investigate before asking

Inspect the current repository, architecture, existing tasks, milestones, dependencies, and relevant tests or documentation. Reuse existing services, domain models, MCP operations, and planning patterns. Separate facts from proposals.

Then ask only the questions that remain material. Prefer a short grouped set covering:

- outcome and target users;
- what is explicitly in and out of scope;
- authority, permissions, and human approval points;
- data, migration, compatibility, or retention expectations;
- success measures and acceptance authority;
- sequencing, deadlines, and dependencies.

If the answers are discoverable from existing authoritative records, do not ask the user to repeat them.

### 3. Shape the documentation

Draft the smallest useful artifact before implementation:

- a PRD for product behavior, user scenarios, scope, non-goals, rollout, and acceptance;
- an architecture note when ownership, data shape, lifecycle, transport, migration, security, or performance decisions matter;
- both when product behavior depends on an architecture decision.

The documents must identify unresolved decisions rather than hiding them in prose. Record alternatives and the decision criteria when a choice is still open.

### 4. Build the execution contract

Translate the approved documentation into a roadmap structure:

- one milestone or equivalent parent outcome;
- a small set of outcome-oriented tasks, split by coherent ownership or dependency boundary;
- explicit task dependencies and execution order;
- task todos for implementation, integration, migration, and verification;
- acceptance criteria that can be checked with evidence;
- owners, dates, size, priority, permissions, and review gates only when known;
- human acceptance requirements where the result is subjective, product-critical, security-sensitive, or release-affecting.

Keep discovery, architecture/documentation, development, and verification checklists separate. A documented decision is not an implemented feature, and an agent session ending is not task completion.

### 5. Review the package before writing

Show the user a compact shaping package containing:

1. outcome and non-goals;
2. PRD/architecture artifacts and open decisions;
3. milestone and task tree;
4. dependency order and critical path;
5. todos and acceptance criteria;
6. risks, assumptions, and questions requiring a decision.

Do not create duplicate tasks or silently close unresolved decisions. If the user changes scope, revise the package before writing records.

### 6. Persist and verify

After approval, create or update the documentation and live roadmap records using the workspace's canonical task and milestone APIs. Use optimistic revisions, preserve existing notes and history, link tasks to the milestone, write dependency IDs explicitly, and synchronize child dates/estimates when schedule data is part of the plan.

Re-read the milestone and every affected task after writes. Verify titles, status, ownership, notes, todos, acceptance criteria, milestone membership, dependency order, and revisions. Report what is documented, what is implemented, and what remains open separately.

## What makes a task agent-ready

An implementation task is ready when a worker can answer without guessing:

- What outcome must change?
- What files, systems, or records are in scope?
- What is deliberately out of scope?
- What inputs and constraints apply?
- What evidence proves each acceptance criterion?
- Who or what accepts the result?
- What must happen before and after this task?

If those answers are not available, keep the work in shaping or discovery instead of dispatching it as an implementation task.

## Handoff format

End with the authoritative PRD/architecture paths or records, milestone and task IDs, dependency order, persisted revisions, approved open decisions, verification evidence, and the next owner. Never claim a task is complete because the roadmap was created.
