# Project TODOs

- [x] Create `MonthsScroller` and `MonthColumn` components (skeleton) ✅
- [x] Integrate scroll sync between months header and timeline rows ✅ (single shared scroll container)
- [x] Dynamically measure header+day-row height and align left spacer ✅
- [x] Visual polish: align borders, spacing, and fonts for months and swimlane labels ✅
- [x] Make left `Project Lane` sticky and resizable as a single column ✅
- [x] Add empty spacer above swimlane labels to align with month header+day row ✅
- [x] Move "Add Swimlane" button to bottom of left column ✅
- [x] Refactor `DraggableSwimlaneRow` to render per-month containers (column-based layout) ✅
- [x] Clip tasks per-month so segments render inside the correct month containers ✅
- [x] Add visible month resizer handle + double-click reset ✅
- [x] Persist `monthWidths` and `leftColWidth` to local persisted state ✅
- [ ] Add tests and visual QA page for alignment
- [x] Extract `TaskCard` component for swimlane task cards and add inline rename + per-card color support ✅
- [x] Enable inline re-ordering of swimlane cards (already supported) ✅
- [x] Extract and enable customization for status/category columns (title, color, reorder) ✅

---

Notes:
- The first task scaffolded basic components and wired the header to use `MonthsScroller` so we can iterate visually.
- Mark items as done here as I finish them.

---

## New Backlog Items

- [x] Add markdown support in task description/notes (render + edit UX). ✅
- [x] Increase task card footprint and preview density so cards show more useful summary content. ✅
- [x] Support tasks belonging to multiple projects (data model + UI + filtering/assignment flows). ✅
- [x] Move position information under the person name as compact subtext to reduce header space usage. ✅
- [x] Add ability to edit person details after creation (name, role/position, and related fields). ✅
- [x] Fix 5-day mode so timeline drag/drop, task positioning, and start/end date updates remain fully functional when weekends are hidden. ✅
- [x] Fix timeline task update race/stale-state overwrite during drag/drop and date update operations. ✅
- [x] Fix local date persistence to avoid timezone day-shift issues (`toISOString` date-only bugs). ✅
- [x] Fix Electron packaging failure (`npm run build:electron`) caused by missing `dist/mac-arm64/LICENSE`. ✅ (next blocker: `hdiutil` failure during DMG creation)
- [x] Fix timeline scroll-state persistence so switching views restores the actual timeline scroll position. ✅
