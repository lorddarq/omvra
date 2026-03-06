# Bugs

_Last updated: 2026-03-06_

## Agent A (Timeline/Drag-Drop)

1. `FIXED` Range-select task creation used People mode even in Projects mode.
- Impact: creating tasks by dragging across days in Projects timeline pre-filled assignee instead of project.
- Fix: pass `mode` into row and forward it to `onAddTask`.
- File: `src/app/components/DraggableSwimlaneRow.tsx` (lines 15, 51, 168)

2. `FIXED` Timeline virtualization is re-enabled with scroll-driven month windowing.
- Impact: full date range is always rendered; this can degrade performance on large datasets.
- Fix: render only buffered visible months with leading/trailing spacers while preserving full-date indexing for interactions.
- Note: benchmark tuning and stress tests remain pending.
- File: `src/app/components/TimelineView.tsx`

3. `FIXED` Removed stale `getTaskPosition()` helper with incorrect width math.
- Impact: incorrect width if reused later; dead logic increases maintenance risk.
- Fix: removed unused helper and related prop plumbing.
- File: `src/app/components/TimelineView.tsx`

4. `FIXED` Removed stale month-window offset expression.
- Impact: virtualization/window math is misleading and likely stale (`windowOffset` resolves to 0).
- Fix: removed inactive offset code path as part of timeline cleanup.
- File: `src/app/components/TimelineView.tsx`

## Agent B (Dialog/Data/Persistence)

1. `FIXED` Timeline task text contrast was effectively forced to white.
- Impact: unreadable text on light status colors.
- Fix: respect readable text class returned by `getTaskColor`.
- File: `src/app/components/DraggableTimelineTask.tsx` (line 39)

2. `FIXED` Deleting a project/swimlane left stale task `projectIds` entries.
- Impact: ghost project associations persisted in task data.
- Fix: remove deleted id from `projectIds`, recompute `project`, clear `swimlaneId` when needed.
- File: `src/app/App.tsx` (lines 252-273)

3. `FIXED` Task dialog now enforces `endDate >= startDate`.
- Impact: users can save inverted ranges; timeline duration logic can become inconsistent.
- Fix: add save guard, `min` end date, and auto-correct when start date moves past end.
- File: `src/app/components/TaskDialog.tsx` (lines 113-137)

4. `FIXED` Legacy component file archived to avoid accidental edits.
- Impact: confusion during debugging and regressions from edits in wrong file.
- Fix: moved to `docs/archive/TimelineView-old.tsx`.
