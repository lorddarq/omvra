# MCP Roadmap, Dependencies, and Time Logging PRD

## Problem

Plumy's MCP surface cannot yet represent the full planning model that exists in the product. Agents can read and update tasks, but they cannot reliably create roadmap structures, link tasks to roadmap milestones, persist task dependencies, or log approximate time spent. This blocks agent-led planning, follow-up task decomposition, and reliable roadmap maintenance.

## Goals

- Allow MCP clients to create and inspect roadmap milestones.
- Allow MCP clients to create roadmap work with milestone names, release dates, descriptions, linked tasks, and task dependencies.
- Ensure `dependencyIds` persists through MCP task create/update APIs and appears in reads.
- Add optional approximate time-spent logging to tasks without adding a stopwatch workflow.
- Expose time-spent fields through MCP reads and writes.
- Preserve local-first storage and existing UI behavior.
- Keep MCP writes behind existing capability gates and audit logging.

## Non-Goals

- No live timer, stopwatch, billing, invoicing, or calendar timesheet workflow.
- No multi-user conflict engine beyond existing revision-protected MCP writes.
- No large Roadmap UI redesign in the first pass.

## Data Model

Task additions:

- `dependencyIds?: string[]`
- `milestoneId?: string`
- `timeSpentMinutes?: number`
- `timeSpentNote?: string`
- `timeEntries?: Array<{ id: string; minutes: number; note?: string; loggedAt: string; actor?: string }>`

Roadmap/milestone MCP writes should reuse the existing `ProjectMilestone` model:

- `title`
- `projectIds`
- `startDate`
- `endDate`
- `notes`
- `color`
- `linkedTaskIds`

## MCP Surface

Read:

- `workspace.get_snapshot` includes `milestones` and task roadmap/time fields.
- Add milestone listing and lookup support.
- Keep `plumy://workspace` aligned with tool reads.

Write:

- Extend `task_write` / `tasks.create` with `dependencyIds`, `milestoneId`, `timeSpentMinutes`, and optional time note.
- Extend `tasks.update` with `dependencyIds`, `milestoneId`, `timeSpentMinutes`, and optional time note.
- Add a narrow time logging tool that appends an approximate time entry and updates total minutes.
- Add milestone creation/update tools for roadmap operations.

## Acceptance Criteria

- [ ] MCP can create a task with `dependencyIds`, then `tasks.get` returns the same dependency IDs.
- [ ] MCP can update an existing task's `dependencyIds`, then `workspace.get_snapshot` returns the same IDs.
- [ ] Invalid dependency IDs are rejected with a clear error.
- [ ] MCP can create a milestone with title, project scope, description, release/end date, and linked task IDs.
- [ ] Linked milestone tasks receive or retain the correct `milestoneId` where appropriate.
- [ ] MCP can log approximate time spent on a task with revision protection.
- [ ] Time spent survives task reads and workspace snapshot reads.
- [ ] Backup/import sanitizers preserve the new task time fields.
- [ ] All new write operations are capability-gated and audited.
- [ ] Tool names remain Claude-safe: `^[a-zA-Z0-9_-]{1,64}$`.

## Implementation Plan

- [ ] Add task data model fields for approximate time logging.
- [ ] Preserve time-spent fields in workspace sanitizers and backups.
- [ ] Add milestone storage reads to the MCP workspace snapshot.
- [ ] Add MCP read helpers for milestones/roadmap data.
- [ ] Extend `task_write` and `tasks.update` schemas with `dependencyIds`, `milestoneId`, and time-spent fields.
- [ ] Validate and persist dependency IDs through MCP create/update.
- [ ] Add a revision-protected MCP time logging write tool.
- [ ] Add MCP milestone creation/update write tools.
- [ ] Add MCP tests covering dependency persistence, time logging, milestone creation, and Claude-safe tool names.
- [ ] Run `npm run test:mcp` and targeted TypeScript/build checks.
- [ ] Update README/MCP docs after the surface stabilizes.
