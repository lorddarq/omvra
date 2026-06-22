# Omvra MCP Integration PRD

Status: Draft  
Date: 2026-03-17  
Owner: Product + Engineering

## 1. Summary

Omvra needs an MCP integration so external coding agents can read project-management context from both Kanban and Timeline views, then act on tasks with clear guardrails.  
This PRD defines a phased rollout that starts read-only and evolves to controlled write support.

## 2. Problem

Today, task context is only available inside the desktop UI. Agents cannot reliably:
- discover assigned work
- read full task context (status, dates, assignee, projects, markdown details)
- interpret both Kanban and Timeline projections from one stable API

This blocks agent-assisted workflows and future deployment models (self-hosted/web/private DB).

## 3. Goals

- Expose a stable MCP surface for workspace/task reads.
- Ensure agents can read data as Kanban cards and Timeline cards from the same canonical source.
- Add secure, explicit, auditable write actions in a later phase.
- Keep architecture modular so storage/backend can be swapped (local, self-hosted, private DB).

## 4. Non-Goals

- Full multi-tenant cloud backend in v1.
- Autonomous code execution/orchestration engine inside Omvra in v1.
- Broad arbitrary write access from MCP clients.

## 5. Users and Primary Use Cases

Users:
- Individual contributor using Codex/Claude for implementation help.
- Team lead assigning bugfix tasks to a specific agent persona.

Use cases:
- Agent lists assigned tasks and pulls enough context to start work.
- Agent reads “Kanban card view” grouped by status.
- Agent reads “Timeline card view” grouped by lane/date window.
- Human reviews agent updates in Omvra after task transitions to under-review.

## 6. Product Requirements

### 6.1 Functional Requirements

1. Provide canonical workspace read endpoint(s): tasks, people, projects/swimlanes, status columns.
2. Provide MCP tools/resources to query tasks by:
   - `status`
   - `assignee`
   - `project/swimlane`
   - date window
3. Support view-aware projections:
   - Kanban-oriented card listing
   - Timeline-oriented card listing
4. Return normalized task payload including:
   - identity (`id`, `title`)
   - workflow (`status`)
   - ownership (`assigneeId`, reporter if present)
   - schedule (`startDate`, `endDate`)
   - grouping (`projectIds`, `swimlaneId`)
   - content (`descriptionMarkdown`)
5. Phase 2 write actions must support:
   - update agent state
   - set short execution summary
   - transition task to under-review
6. Audit log all MCP write actions with actor, action, timestamp, and payload diff.

### 6.2 Non-Functional Requirements

1. Local-first by default; no external transmission unless explicitly configured.
2. Capability-scoped auth (read-only first).
3. P95 response under 250ms for list/read in desktop-local mode for typical datasets (<= 5k tasks).
4. Backward-compatible API evolution with versioned schemas.

## 7. Proposed Architecture

Recommended model: **MCP sidecar + Electron main process broker (single writer)**.

- Renderer remains UI-only.
- Main process owns validated data access and writes.
- Sidecar MCP server exposes tools/resources and calls main-process broker APIs.

Why this model:
- Better isolation than embedding all MCP logic into UI/main directly.
- Avoids concurrent-write inconsistencies from direct sidecar storage access.
- Clean path to future backend adapters (local storage, self-hosted DB, private Convex-like backend).

## 8. MCP Surface (v1 Read-Only)

### 8.1 Core Tools

- `workspace.get_snapshot()`
- `tasks.list(filters)`
- `tasks.get(taskId)`
- `cards.kanban.list(statusId?, assigneeId?, search?)`
- `cards.timeline.list(laneId?, startDate?, endDate?, includeOffscreen?)`

### 8.2 Core Resources

- `omvra://workspace`
- `omvra://tasks/{taskId}`
- `omvra://cards/kanban`
- `omvra://cards/timeline`

### 8.3 Canonical Data Rule

Kanban and Timeline resources must derive from the same canonical task entities and return stable IDs so clients can correlate both views.

## 9. Security and Permissions

- Default profile: `read_only`.
- Future profiles: `task_write`, `admin`.
- Local transport only by default (loopback/UDS), no public bind.
- Explicit user opt-in for enabling MCP.
- Token-based auth with short TTL.
- Rate limiting and schema validation for all tool calls.

## 10. Rollout Plan

### Phase 0: Service Boundary
- Extract task/workspace repository interface from UI-facing state handling.
- Centralize read/write through one service contract.

### Phase 1: Read-Only MCP
- Implement sidecar MCP server.
- Add workspace/task/card read tools and resources.
- Validate card parity between UI and MCP output.
- Add dev health diagnostics in renderer for tool/resource availability and snapshot parity as a pre-test gate.

### Phase 2: Safe Write Operations
- Add controlled task update tools for agent workflow fields and status transitions.
- Add audit logging + conflict detection.

### Phase 3: Deployment Abstraction
- Introduce pluggable storage adapters.
- Support desktop local adapter and private/self-hosted adapter.

## 11. Success Metrics

- 95% of sampled tasks return identical key fields across UI and MCP card projections.
- Agent can fetch assigned tasks and required context in <= 3 MCP calls median.
- Zero unauthorized write operations in production logs.
- <1% MCP request failure rate over 7-day rolling window.

## 12. Risks and Mitigations

- Risk: schema drift between UI and MCP payloads.  
  Mitigation: shared schema package + contract tests.

- Risk: conflicting writes between UI and MCP clients.  
  Mitigation: single-writer broker + optimistic revision checks.

- Risk: over-broad agent permissions.  
  Mitigation: capability profiles, explicit opt-in, audit logs.

## 13. Acceptance Criteria

1. MCP can list and fetch tasks with all required fields.
2. MCP can return Kanban and Timeline card lists that match UI semantics.
3. Read-only mode is default and requires explicit enablement.
4. Write operations (if enabled) are limited, validated, and audited.
5. Architecture supports swapping persistence adapter without changing MCP contract.

## 14. Open Questions

1. Should task comments/activity ship in Phase 1 or Phase 2?
2. Should agent assignment routing be polling-based or event-queue-based?
3. Which storage backend is first for private self-hosted mode after local adapter?
