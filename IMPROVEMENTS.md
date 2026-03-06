# Improvements

_Last updated: 2026-03-06_

## Modularization Opportunities

1. Split `TimelineView` into focused hooks and container components.
- Suggested slices:
  - `useTimelineDates()` for date range + weekend filtering + month buckets
  - `useTimelineScrollSync()` for left/right sync + persistence callbacks
  - `useTimelineSizing()` for month/left-column resize state
  - `TimelineToolbar`, `TimelineLeftPanel`, `TimelineGrid`
- Benefit: easier regression testing and lower cognitive load in one large file.
- File: `src/app/components/TimelineView.tsx`

2. Extract timeline drop math into a shared utility.
- Move prefix-sum/day-index/drop-line calculations out of `DraggableSwimlaneRow` into `timelineDrop.ts`.
- Benefit: one source of truth for drop snapping + simpler unit tests.
- File: `src/app/components/DraggableSwimlaneRow.tsx`

3. Centralize task project-assignment mapping logic.
- Introduce utility functions:
  - `normalizeTaskProjects(task, swimlanes)`
  - `removeProjectFromTasks(tasks, projectId, swimlanes)`
- Benefit: avoids repeating `projectIds`/`project`/`swimlaneOnly` consistency logic across `App` and dialogs.
- Files: `src/app/App.tsx`, `src/app/components/TaskDialog.tsx`

4. Remove `any` in column handlers and enforce typed status column model.
- Replace `(cols: any[])` with a typed `StatusColumn[]` alias.
- Benefit: safer refactors and better editor diagnostics.
- File: `src/app/App.tsx`

5. Consolidate persistence/migration concerns.
- Move localStorage keys + migration transforms into a dedicated persistence module.
- Benefit: cleaner `App.tsx` and fewer accidental schema regressions.
- File: `src/app/App.tsx`

6. Keep archived legacy timeline isolated from active implementation.
- Status: completed by moving to `docs/archive/TimelineView-old.tsx`.
- Benefit: prevents accidental edits to inactive code path while preserving reference history.
