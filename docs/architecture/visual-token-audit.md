# Omvra Visual Token Audit

This audit covers the task surfaces called out in `task-e31e950b-5f84-4c3b-a8fd-166ac3a84240`:

- Timeline
- Kanban
- Roadmap
- task cards
- badges
- dialogs
- Preferences entry surface

It is intentionally scoped to the current UI architecture work, not a full design-system rewrite.

## Already Unified

These categories now resolve through shared helpers instead of per-view palettes:

- Status:
  - `src/app/utils/statusVisual.ts`
  - Used by Timeline, Kanban, Roadmap, milestone/task dependency pills, and related read-model consumers.
- Project:
  - `src/app/utils/projectVisual.ts`
  - Used by project chips, project dots, timeline row accents, milestone markers, and milestone dialog project selectors.
- Milestone health:
  - `src/app/domain/roadmap.ts` via `getMilestoneHealthVisual`
- Today button:
  - `src/app/components/TodayButton.tsx`
- Date range label:
  - `src/app/utils/dateRange.ts`
  - `src/app/components/DateRangeLabel.tsx`

## Findings By Category

### Status

Shared now. No remaining view-local hardcoded status palette was found in:

- `src/app/components/TimelineView.tsx`
- `src/app/components/DroppableColumn.tsx`
- `src/app/components/RoadmapView.tsx`
- `src/app/components/RoadmapMilestoneSidebar.tsx`
- `src/app/components/MilestoneSections.tsx`
- `src/app/components/TaskDetailsDialog.tsx`

### Project

Shared now for project color fallback and chip/dot rendering.

Remaining project-specific styling is structural rather than color-resolution logic:

- `src/app/components/DraggableSwimlaneLabel.tsx`
- `src/app/components/MilestoneSections.tsx`
- `src/app/components/RoadmapMilestoneSidebar.tsx`

### Health

Shared now through `getMilestoneHealthVisual`.

Remaining health classes are semantic outputs of the resolver, not per-view ad hoc choices.

### Brand

These are recurring product-accent values and should stay grouped as brand/action tokens if they are extracted later:

- `#1a60cb`
- `#004ec5`

Primary occurrences:

- `src/app/components/TaskDetailsDialog.tsx`
- `src/app/components/RoadmapMilestoneSidebar.tsx`

### Semantic

These communicate risk, destructive action, or deadline slippage:

- `#ff0000`
- `#ff171b`
- `#f0c8c8`
- `#fbeaea`
- `#f7dddd`
- `text-red-700`
- `border-red-300`

Primary occurrences:

- `src/app/components/MilestoneDetailsDialog.tsx`
- `src/app/components/RoadmapMilestoneSidebar.tsx`
- `src/app/components/RoadmapView.tsx`
- `src/app/components/MilestoneSections.tsx`

These should remain semantic, not be folded into project or status tokens.

### Neutral

Most remaining hardcoded values in the audited surfaces are neutral UI styling:

- `#71717a`
- `#6a7282`
- `#7b8190`
- `#67676f`
- `#4a4a4f`
- `#b5b5ba`
- `#a5a5ac`
- `#b8b8b8`
- `#f9fafb`
- `#fcfcfd`
- `#f8fafc`
- `#f3f3f3`
- `#1f2937`
- `#111827`
- `#4b5563`
- `#e5e7eb`

Primary occurrences:

- `src/app/components/MilestoneSections.tsx`
- `src/app/components/MilestoneDetailsDialog.tsx`
- `src/app/components/RoadmapMilestoneSidebar.tsx`
- `src/app/components/RoadmapView.tsx`
- `src/app/components/TaskDetailsDialog.tsx`
- `src/app/components/TimelineView.tsx`

These are the biggest remaining extraction opportunity if Omvra wants a broader surface-token pass later.

### One-off

These are local visual details that look intentional and do not yet justify shared abstractions:

- Roadmap dependency arrow stroke/fill in `src/app/components/RoadmapView.tsx`
- Sidebar grip separators in `src/app/components/RoadmapMilestoneSidebar.tsx`
- Dialog danger button fill/border pairing in `src/app/components/MilestoneDetailsDialog.tsx`

Keeping these local is smaller and clearer than forcing them into a generic token map right now.

## Surface Notes

### Timeline

- Status colors resolved through shared status visuals.
- Project row accent resolved through shared project visuals.
- Remaining hardcoded values are mostly neutral scaffold colors and one fallback neutral task color.

### Kanban

- Status column accent now resolves through shared status visuals.
- No additional project-color logic was found in the view components audited here.

### Roadmap

- Status, project, and health resolution are shared.
- Remaining hardcoded values are mostly neutral scaffolding and semantic late-risk treatments.

### Task Cards And Dialogs

- Dependency/status pills use shared status visuals.
- Project chip/dot rendering now uses shared project visuals where applicable.
- Remaining hardcoded values are mostly neutral typography/surface values plus destructive-action semantics.

### Preferences

- `src/app/components/PreferencesPanel.tsx` itself does not own notable hardcoded color resolution.
- Preferences visual audit still depends on deeper section components if a broader settings-token pass is desired.

## Recommendation

The task is now past the resolver phase. The remaining extraction work is mostly:

1. A neutral surface token pass, if Omvra wants one.
2. Manual visual QA across Timeline, Kanban, Roadmap, Task Details, and Preferences.

Everything else in the audited scope is either already unified or is small enough to remain local.
