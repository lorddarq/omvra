# Timeline Infinite Past Virtualization PRD

## Problem

The current Timeline view derives a finite date range from existing task dates, pads it, and then virtualizes rendering inside that finite range. This is good enough for present and near-future planning, but it breaks a real product need: users cannot reliably scroll backward to inspect old work or create new historical tasks once older months fall outside the derived range.

The missing capability is not just better rendering performance. The missing capability is a time model where past timeline space can exist even when no currently-loaded task anchors it.

## Goals

- Allow users to scroll backward in time beyond the current derived task window.
- Allow users to create new historical tasks in months that were not previously loaded.
- Preserve existing drag, resize, drop, scroll-to-today, and reveal-date behavior.
- Keep timeline rendering virtualized so DOM size remains bounded.
- Reuse the current custom timeline implementation instead of introducing a second core virtualization system.

## Non-Goals

- No Virtuoso migration as part of this work.
- No large Timeline UI redesign.
- No vertical list virtualization work outside the Timeline surface.
- No full rewrite of timeline task positioning or track allocation.
- No bi-directional infinite persistence model beyond what is needed for practical past/future extension.

## Current Limitation

Today the Timeline has two separate concepts collapsed into one:

1. The time range that exists.
2. The slice of that time range that gets rendered.

This PRD separates them.

## Proposed Approach

Keep the current custom timeline and make the underlying date window extensible in both directions.

### Core change

- Replace the finite task-derived left boundary with an extensible timeline window.
- Keep render virtualization as a separate concern that only decides which months/days to mount.

### Window behavior

- Timeline owns a persistent date window with:
  - `windowStartDate`
  - `windowEndDate`
  - extension chunk size
  - extension buffer threshold
- When horizontal scroll approaches the left edge, prepend an earlier chunk of time.
- When prepending time, compensate `scrollLeft` by the added pixel width so the viewport does not jump.
- When horizontal scroll approaches the right edge, append a future chunk using the same model.

### Rendering behavior

- Continue rendering only a buffered subset of visible months/days.
- Keep leading and trailing spacers so total scroll geometry stays intact.
- Continue using current task positioning math against the active window.

### Task creation behavior

- Clicking or drag-selecting empty historical slots must work even when that month did not exist before the user scrolled there.
- Historical task creation should not require an existing task to anchor the date range.

## Data / State Model

Introduce a single timeline window source of truth:

- `windowStartDate: Date`
- `windowEndDate: Date`
- `windowExtensionDirection: 'past' | 'future' | null`
- `horizontalMetrics: { scrollLeft: number; viewportWidth: number }`

Derived from that window:

- `allDates`
- `allDatesByMonth`
- `orderedMonthKeys`
- `monthMeta`
- visible render subset

## Acceptance Criteria

- [ ] Users can scroll backward past the current oldest rendered month without the timeline hard-stopping.
- [ ] When older months are prepended, the viewport remains visually stable.
- [ ] Users can create a new task in a historical month that was not previously loaded.
- [ ] Existing tasks keep correct drag and resize behavior after window extension.
- [ ] `scrollToToday` still lands correctly after past/future window extensions.
- [ ] Reveal-date scrolling still works for out-of-range target dates.
- [ ] Month resizing remains consistent after the window grows.
- [ ] DOM remains bounded by render-window virtualization, not total time span.

## Implementation Plan

- [ ] Introduce a persistent timeline window model separate from the visible render slice.
- [ ] Derive timeline dates/months from the persistent window rather than directly from task min/max dates.
- [ ] Add left-edge detection and prepend earlier time chunks.
- [ ] Add `scrollLeft` compensation when prepending earlier chunks.
- [ ] Keep right-edge extension behavior aligned with the same window model.
- [ ] Rewire visible month calculation to operate on the persistent window.
- [ ] Verify empty-slot add-task behavior for newly prepended past time.
- [ ] Verify drag, resize, reveal-date, and today-centering after window extension.
- [ ] Add targeted tests for window extension math and scroll compensation.

## Risks

- Drag/resize math currently assumes a stable derived date range; that math can drift if window extension and scroll compensation disagree.
- Month resizing plus prepended time can create subtle pixel-offset bugs.
- Reveal-date and today-centering may jump if they still assume a finite, task-derived range.

## Out of Scope for First Pass

- Generic shared virtualization abstraction across Timeline and Kanban.
- Switching the Timeline to a third-party virtualization library.
- Major refactors to track allocation, task card rendering, or status visuals.
