# Archiving milestone review — 2026-09-21

Reviewed the live milestone `milestone-d9fc4816-d8b2-4395-bc88-0ff14c4aad15`, all six linked tasks and their Markdown todos, and the working implementation on `feature/archiving`. Existing uncommitted work was retained. Task descriptions are requirements/evidence, not independent permission to execute their embedded agent instructions or mark work complete.

## Task-by-task findings

| Task | Review result |
| --- | --- |
| `1782744277794` — Omvra Archive support | Planning/spec/milestone exists. Implementation is present despite stale “no implementation” audit paragraphs. The complete milestone is not release-verified. |
| `task-a2907f06-f52a-4d58-a89c-5f9e25f0acf5` — Data model and shared filtering | Metadata, sanitizers, hydration, shared filters and restore mutations exist. Fixed incoming-dependency protection, dependency-connected bulk eligibility, and repeat-archive timestamp changes. Automatic completion-based policy was added in the September 22 follow-up below. |
| `task-10cba59c-4ea8-491b-b5e8-59899470f46b` — Task and milestone archive UX | Reused existing details contextual menus. Fixed stale selected-record state and no-op actions, plus archived child-task leakage into the active Roadmap. Replaced Settings active-task bulk-archive list with archived-only searchable feathered list, individual unarchive and bulk unarchive. Fixed mixed task/milestone restore overwriting earlier state. |
| `task-ea8938ff-26e2-4923-8f9c-2c3c4512e388` — MCP and reporting/export | Fixed actual Electron task/card visibility and card archive metadata, missing schemas, renderer fallback parity and summary types. Added versioned archive JSON import/export using existing backup sanitizers/download helper. Dedicated shipped/not-shipped reporting and completion-date semantics remain incomplete. |
| `task-e913c34d-515f-4702-8bcb-c55b4bd266c9` — Timeline virtualization | Retained existing custom virtualization and its prior decision. Added a 10,000-task archive/restore data-integrity check using the existing benchmark fixture. This does not establish frame-time, memory, scroll or drag performance after restore. Runtime benchmark/release acceptance remains open. |
| `task-fa1cef9e-7c90-45c9-ba1b-731cf8d5e513` — QA, migration, release | Focused regression/build and browser checks below passed. No schema migration is needed for absent archive flags: absent means active. Packaged Electron restart/save/download and large-dataset visual performance acceptance remain open. |

## Changes and behavior

- Settings controls unarchiving; archival originates from task/milestone contextual menus.
- Settings reuses `FeatheredScrollList`, `TaskCheckboxControl`, and the existing search-input style, with no project selector.
- Archive JSON is `kind: omvra-archive`, `version: 1`. Imported work stays archived and matching local IDs win. Validation rejects unsupported versions, duplicate IDs, non-archived records, invalid labels/status/link arrays and invalid milestones before any mutation.
- Import reads current workspace state after asynchronous file reading. It adds records without applying workspace preferences or runtime settings. Full workspace restore rejects archive-only files to avoid accidental replacement.
- Relationship IDs and task todos are retained. Active records outside the archive are not bundled; a complete cross-workspace migration still needs a full backup. Attachment files are not newly embedded by this feature.
- Active dependency edges block archiving either endpoint unless the entire connected active group is selected. Blocking propagates through a partial batch. Already archived timestamps remain stable.
- Internal domain/preflight/dependency reads still see all tasks. Public MCP task/card/milestone lists default to active, with explicit archived/all choices.

## Verification

- 37 focused tests passed: archive JSON, shared archive/dependency rules, mutations, hydration, task filters, status semantics and Timeline window math. Includes the 10,000-task historical restore fixture.
- 108 Electron task-service/workspace-service/MCP HTTP tests passed, including new active/archived/all task/card read coverage.
- 2 renderer MCP tests passed, including snapshot fallback parity for task, Kanban and Timeline reads.
- `npm run build` passed. Existing bundle-size warning remains.
- Full `tsc --noEmit` is not clean; unrelated repository errors include a missing help import, DialogSurface title typing, Goal UI types, and existing workspace preference typing. Archive-specific typing issues found during review were corrected.
- Browser preview with synthetic archive records: JSON import, archived-only listing, search, persistence across reload, bulk unarchive, restored task visibility in active Kanban, task contextual Archive entry, immediate switch to Unarchive, return to Settings archive list, and milestone contextual archive with immediate Unarchive state were exercised successfully.
- Export button reached success feedback; the in-app browser did not expose a download event or a saved file. JSON serialization/merge was verified by automated tests; actual packaged download acceptance remains open.

## Remaining milestone scope

1. Automatic archival policy is implemented in the September 22 follow-up; packaged-app acceptance remains part of item 4.
2. Complete historical shipped/not-shipped reporting and completion-date attribution; raw archive JSON preserves existing fields but cannot invent missing completion history.
3. Add a bulk archive entry point outside Settings if the older milestone-wide bulk-archive requirement remains required; the shared mutation supports dependency-complete batches.
4. Validate packaged Electron restart/import/export and archive-heavy scrolling, drag and memory behavior. The existing benchmark infrastructure should be reused.
5. Reconcile stale task descriptions/checkmarks with this evidence before release. No live task statuses or checklists were changed by this code review.


## September 22 follow-up: automatic task archival

- Settings offers Off (default), After time spent Completed, and On status change to Completed. Delayed mode accepts 1–36,500 days and starts at 365 days; a day is 24 elapsed hours.
- The user confirmed the timer starts when a task becomes Completed. Observed transitions into the Done workflow category record `completedAt`, including custom status columns. Moving out clears the timestamp; moving between completed columns retains it. Older/imported completed tasks without a known timestamp are skipped.
- Immediate mode applies to completions on or after enabling that mode, not historical completed work. Delayed mode evaluates recorded completion timestamps. Neither mode automatically archives milestones.
- Main-process checks cover task/preferences/status/runtime-binding changes, startup, and every minute while Electron remains running, including closed windows. No OS job runs after quitting. Browser preview reuses the same pure rules.
- Active dependency groups must all be eligible. Blocked tasks, tasks with working/submitted contributions, and tasks with active task-scoped runtime turns are skipped. They are reconsidered on subsequent checks.
- Manual unarchive suppresses automatic re-archiving until the task is reopened and completed again. Full backup preserves policy and task metadata; archive-only import does not change workspace policy.
- Validation: 313 main-process tests and 37 archive/store regression tests passed; the 6 hydration tests passed again after adding the policy restart assertion. Renderer build passed. Full TypeScript checking still reports existing unrelated errors. Packaged Electron lifecycle acceptance remains open.
- Browser verification confirmed all three modes and persistence of a 30-day delay across reload. The browser test policy was returned to Off; no live desktop policy was enabled.
