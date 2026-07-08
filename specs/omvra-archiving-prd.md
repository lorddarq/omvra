# Omvra Archiving PRD

Date: 2026-07-07
Status: Proposed
Owner: Pericles (product), Edgar (engineering delivery)
Scope: Omvra desktop app, roadmap view, MCP workspace/task surfaces, and reporting/export behavior

## Summary

Omvra needs a way to archive completed or inactive work without deleting it. Archived tasks and archived roadmap milestones should disappear from the default execution views, remain recoverable, and still be available for reporting and export so teams can answer what was done, by whom, and by when.

This should be implemented as a first-class lifecycle state, not as deletion and not as a hidden local-only filter hack.

## Problem

Today, old tasks and past roadmap work continue to live beside active planning surfaces. That makes Timeline, Kanban, and Roadmap progressively noisier as a workspace grows.

Users need to:

- remove inactive work from day-to-day planning views
- keep a durable record of shipped work
- archive past roadmap milestones after a release or initiative closes
- still generate reports and exports from archived items
- restore archived work when needed

## Goals

- Add first-class archive support for tasks.
- Add first-class archive support for roadmap milestones.
- Keep archived items excluded from default active views.
- Provide an explicit archived view/filter so records remain discoverable.
- Preserve archived items in backup/import and MCP reads.
- Support reporting/export over archived records, including status/date/assignee attribution.

## Non-Goals

- Permanent deletion workflows beyond what already exists.
- A complex retention-policy engine.
- Remote analytics or cloud reporting.
- Multi-tier archive storage.
- Full document-style reporting UI in V1.

## Product Principles

- Archive means hidden from default operational views, not erased.
- Reports must still treat archived work as first-class historical data.
- The default product should stay focused on active delivery.
- Archive actions must be reversible.
- The smallest viable implementation should reuse existing task/milestone persistence and filtering paths.

## Users and Core Scenarios

### Scenario 1: Archive completed task work

A user marks a task complete, later archives it, and no longer sees it in default Kanban, Timeline, or task-picking flows unless archived items are explicitly included.

### Scenario 2: Archive an old milestone

After a release or initiative is done, a user archives the milestone so it no longer clutters the roadmap, while linked tasks and milestone history remain available for historical lookup.

### Scenario 3: Generate a report

A user exports or views a historical report covering archived work and can see title, project, assignee, status, completion/archive timing, and milestone context.

### Scenario 4: Restore historical work

A user restores an archived task or milestone and it re-enters active planning surfaces without losing dependency or roadmap context.

## Proposed Product Behavior

### Task archiving

- Add task-level archive metadata instead of deleting tasks.
- Default Timeline, Kanban, open-task selectors, and assignment flows exclude archived tasks.
- Archived tasks can be included through an explicit toggle/filter.
- Archived tasks remain searchable when archived visibility is enabled.
- A task cannot be archived while it still has an active dependency relationship to a task that is not archived.
- In practice, if a task depends on or is still dependency-linked to active work that remains unarchived, the archive action should be blocked until that dependency state is resolved.
- Standalone tasks without dependency conflicts can be archived safely.

### Milestone archiving

- Add milestone-level archive metadata.
- Default Roadmap view excludes archived milestones.
- Archived milestones remain available through an explicit filter.
- Archiving a milestone does not delete linked tasks.
- Restoring a milestone restores its linked tasks as part of the same operation.

### Reporting/export

- Archived tasks and milestones remain part of workspace backup/import.
- MCP snapshot and targeted read surfaces expose archive metadata.
- Existing export/report surfaces should be able to include archived records instead of silently dropping them.
- If a dedicated archive report UI is too large for V1, ship structured export/report-ready data first and a thin UI second.

### Settings-managed archive restoration

- Add a dedicated `Archiving` section under the existing `Settings -> Data` area.
- This section becomes the primary historical management surface for archived records.
- It should list archived tasks and archived milestones with enough identifying context to restore them confidently.
- It should support direct unarchive actions.
- Unarchiving from settings should restore a record to normal product visibility, including Timeline visibility for tasks that belong there.
- Bulk archive and bulk restore actions should be supported here for practical workspace cleanup and recovery.
- Restoring a standalone task should also restore any archived dependencies required for that task to re-enter active planning safely.

## Data Model Direction

### Task

Add minimal archive fields:

- `archived?: boolean`
- `archivedAt?: string`

### ProjectMilestone

Add matching milestone fields:

- `archived?: boolean`
- `archivedAt?: string`

## UX Direction

### Task surfaces

- Add archive/unarchive actions in task details/edit surfaces.
- Default Kanban/Timeline/task dialogs stay focused on active work.
- Add a simple `Include archived` toggle in relevant list/filter surfaces rather than creating a separate information architecture first.
- If a task still has an active dependency conflict, the archive action should be unavailable or clearly blocked with an explanation.

### Roadmap surfaces

- Add archive/unarchive action to milestone details/edit flow.
- Default Roadmap view hides archived milestones.
- Add `Include archived milestones` or shared archive visibility control.
- Restoring a milestone is a single action that restores the milestone together with its linked tasks; there is no scoped restore split for V1.

### Settings surface

- Keep archive management inside the existing Data settings area rather than creating a new top-level settings category.
- The `Archiving` section should present archived items in a compact management list rather than requiring users to re-enable archived visibility across operational views first.
- The first version should prioritize scanability and restore clarity over rich analytics.
- Show only the information needed to identify and restore records confidently; do not over-design archive provenance fields that do not matter in a user-plus-agent shared workspace.
- Support bulk selection/actions in this section.

### Language

- Use `Archive` / `Unarchive`.
- Avoid ambiguous copy like `Hide` or `Close forever`.
- Explain that archived items remain available for reports and restore.

## Technical Implications

### Persistence and workspace model

- Extend `Task` and `ProjectMilestone` types.
- Preserve archive metadata across local storage, canonical electron-store sync, backup/import, and workspace sanitization.

### Domain/read-model filtering

- Centralize active-vs-archived filtering in shared helpers where possible.
- Avoid view-local archive checks duplicated across Timeline, Kanban, Roadmap, dialogs, and MCP projections.
- Centralize dependency-conflict checks for archive eligibility so the rule is enforced consistently everywhere.

### MCP

- `workspace_get_snapshot`, `tasks_get`, `tasks_list`, `cards_timeline_list`, milestone reads, and any report/export path should expose archive metadata.
- Add safe write support for archive/unarchive through existing update flows unless a dedicated action is clearly needed.
- Default list/card tools should likely exclude archived records unless an explicit include flag is passed.

### Reporting/export

- Review existing PDF/clipboard/export helpers and ensure archived records can be intentionally included.
- The minimum acceptable V1 is archive-aware structured export plus clearly labeled archived metadata.

### Timeline scaling and virtualization

- Restoring archived tasks can expand the amount of Timeline-visible data substantially.
- Archive support therefore needs an explicit timeline-performance review, not just a visibility toggle.
- The long-term target is a continuous, effectively unlimited timeline scroller that virtualizes data instead of enforcing a narrow fixed time window.
- Inspect the existing custom timeline virtualization path first before adding another dependency.
- `react-virtuoso` is a valid candidate to evaluate because its documented strengths include large-list virtualization, automatic variable-size handling, dynamic size updates, and grouped rendering patterns.
- V1 does not need to commit to Virtuoso in advance, but the rollout should explicitly decide whether the current timeline virtualization can evolve toward that continuous-scroll goal under archive-heavy restore scenarios.

## Risks

### Risk 1: Archive logic gets duplicated everywhere

Mitigation: add shared filtering and archive-label helpers early.

### Risk 2: Archived items disappear from history/export accidentally

Mitigation: include archive fields in backup/import, MCP snapshot, and export tests.

### Risk 3: Milestone archiving breaks linked task context

Mitigation: preserve milestone linkage and dependency data even when hidden from default roadmap views.

### Risk 4: Reporting scope grows too large

Mitigation: phase the work so archive metadata and filters land before richer reporting UI.

## Rollout Plan

### Phase 1: Domain and persistence

- Add archive metadata to task and milestone types.
- Preserve it through store sync, import/export, sanitizers, and MCP shapes.
- Add shared archive filtering helpers and tests.
- Add shared archive-eligibility/dependency-conflict checks and tests.

### Phase 2: Core UI actions and filtering

- Add archive/unarchive actions for tasks and milestones.
- Hide archived records from default Timeline, Kanban, Roadmap, and picker flows.
- Add explicit include-archived toggles/filters.
- Add `Settings -> Data -> Archiving` as the management surface for archived records and restore actions.
- Add bulk archive/bulk restore flows.
- Enforce the dependency-conflict rule in archive and restore actions.

### Phase 3: Reporting and MCP completion

- Ensure archive metadata is visible in MCP reads and export/report helpers.
- Add archive-aware historical report/export behavior.
- Verify restore flows and regression coverage.

### Phase 4: Timeline performance hardening

- Validate Timeline behavior after restoring archive-heavy datasets.
- If the current custom virtualization path is not sufficient, harden or replace it with the smallest viable improvement.
- Use the continuous, virtualized timeline scroller goal as the evaluation target rather than preserving the current limited-window behavior by default.
- Evaluate `react-virtuoso` as a candidate rather than assuming a rewrite is automatically required.

## Work Breakdown Recommendation

1. Omvra Archiving: Data model, persistence, and shared filtering
2. Omvra Archiving: Task and milestone archive UX
3. Omvra Archiving: Archived items settings surface and restore flows
4. Omvra Archiving: MCP and reporting/export support
5. Omvra Archiving: Timeline virtualization hardening and Virtuoso evaluation
6. Omvra Archiving: Regression coverage, migration notes, and release QA

## Acceptance Criteria

- Tasks can be archived and unarchived without deletion.
- Milestones can be archived and unarchived without losing linked-task context.
- Tasks with active dependency conflicts cannot be archived until the conflict is resolved.
- Default active views exclude archived items.
- Users can explicitly include archived items when needed.
- `Settings -> Data -> Archiving` lists archived items and supports restore/unarchive actions.
- `Settings -> Data -> Archiving` supports bulk archive/restore actions.
- Restoring a milestone restores its linked tasks as part of the same action.
- Restoring a standalone task restores any archived dependencies required to make it active safely.
- Archive metadata survives restart, backup/import, and MCP reads.
- Archived work can still be used in historical reporting/export.
- Restoring archived tasks does not leave Timeline performance obviously degraded.
- The implementation ships with targeted regression coverage for the shared archive logic.

## Open Questions

- Should archived tasks be assignable/editable by default, or should some actions be visually reduced?
- Do we need a dedicated archive report screen now, or is archive-aware export enough for the first release?
