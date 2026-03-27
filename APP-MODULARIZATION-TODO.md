# App Modularization Todo

This document breaks down the current `src/app/App.tsx` refactor into small, reviewable chunks.

Current state:
- `App.tsx` is `1816` lines long
- it owns:
  - workspace bootstrapping and hydration
  - localStorage + electron-store sync
  - import/export/backup repair logic
  - MCP settings, listener diagnostics, audit log refresh
  - agent watcher polling/runtime state
  - task/project/person/status mutations
  - dialog/panel orchestration
  - top-level page composition

Goal:
- reduce `App.tsx` to orchestration and composition
- move business logic, persistence, MCP coordination, and import/export concerns into focused modules
- keep behavior unchanged while making future work safer

Non-goals:
- no visual redesign
- no state-management library migration in the first pass
- no MCP protocol redesign in this refactor

## Priority Order

Ordered by lowest effort and highest win first:

1. [x] Extract portable storage helpers into `src/app/utils/storage.ts`
2. [x] Extract MCP preference helpers into `src/app/utils/mcpPreferences.ts`
3. [x] Extract task/project/person/status sanitizers into `src/app/utils/workspaceSanitizers.ts`
4. [x] Extract import/export logic into `src/app/services/workspaceBackup.ts`
5. [x] Extract task mutations into `src/app/hooks/useTaskActions.ts`
6. [x] Extract person/project/status-column mutations into dedicated hooks
7. [x] Extract MCP panel state and watcher runtime hooks
8. [x] Extract render composition components
9. [x] Clean up shared types around custom status columns

## Phase 1: Extract Pure Helpers

- [x] Move portable storage helpers out of `App.tsx` into `src/app/utils/storage.ts`
  - functions to move:
    - `safeReadJSON`
    - `readInitialWorkspaceJSON`
    - `safeReadRaw`
    - `safeWriteRaw`
    - `safeReadLocalStorageJSON`
    - `isPortableStorageKey`
    - `getPortableStorageSnapshot`
    - `flattenPortableStoreEntries`
    - `getPortableStoreValue`
    - `getPortableElectronStoreSnapshot`
    - `clearPortableStorageKeys`
    - `hasAnyPortableLocalStorageData`
    - `clearPortableElectronStoreKeys`
    - `restorePortableStorageSnapshot`
  - completed:
    - helper set consolidated into the existing storage utility module
    - `App.tsx` now imports the helpers instead of defining them inline
  - acceptance:
    - `App.tsx` imports these helpers instead of defining them inline
    - build and MCP tests stay green

- [x] Move task/project/person/status sanitizers into `src/app/utils/workspaceSanitizers.ts`
  - functions to move:
    - `normalizeTask`
    - `sanitizeStatusColumns`
    - `deriveStatusColumnsFromTasks`
    - `sanitizeTimelineSwimlanes`
    - `sanitizePeople`
    - `sanitizeTasks`
    - `sanitizePreferences`
    - `sanitizeAgentWatchConfigs`
  - completed:
    - sanitizer and normalization helpers now live in a dedicated utility module
    - `App.tsx` now imports those helpers instead of carrying them inline
    - completed with agent support from `mcp_remaining_source_of_truth`
  - acceptance:
    - module exports are pure and testable
    - add unit tests for legacy import cases and fallback behavior

- [x] Move MCP preference helpers into `src/app/utils/mcpPreferences.ts`
  - functions to move:
    - `generateMcpAccessToken`
    - `getMcpSettingsSignature`
    - `syncLocalMcpServerAddress`
    - `getDefaultStatusId`
  - completed:
    - MCP token/signature/default-status/address-sync helpers now live in a dedicated utility module
  - acceptance:
    - no MCP-specific helpers remain inline in `App.tsx`

## Phase 2: Extract Workspace State Hooks

- [ ] Create `src/app/hooks/useWorkspaceState.ts`
  - responsibility:
    - initialize and expose:
      - `tasks`
      - `timelineSwimlanes`
      - `people`
      - `statusColumns`
      - `preferences`
      - `agentWatchConfigs`
      - `hasHydratedCanonicalWorkspace`
    - own canonical hydration logic
    - own persistence effects
  - acceptance:
    - `App.tsx` no longer contains the large hydration `useEffect`
    - state boot logic is isolated and testable

- [x] Create `src/app/hooks/useWorkspaceDialogs.ts`
  - responsibility:
    - own dialog/panel open state
    - own selected task/swimlane/default values
    - expose open/close helpers for:
      - task dialog
      - task details
      - swimlane dialog
      - people panel
      - preferences panel
  - completed:
    - dialog/panel state now lives in a dedicated hook
    - App now consumes dialog state and open/close helpers from the hook
  - acceptance:
    - `App.tsx` no longer has the large block of modal-related `useState` declarations

- [x] Create `src/app/hooks/useStorageMeter.ts`
  - responsibility:
    - compute storage usage
    - expose refresh method and current meter state
  - completed:
    - storage usage logic now lives in a dedicated hook
    - the preferences-related storage meter effect has been removed from `App.tsx`
  - acceptance:
    - preferences-related storage meter `useEffect` leaves `App.tsx`

## Phase 3: Extract Mutation Logic

- [x] Create `src/app/hooks/useTaskActions.ts`
  - responsibility:
    - encapsulate task mutations:
      - save/create
      - delete
      - move status
      - update dates
      - add comment
      - move agent task to review
  - completed:
    - task mutation handlers now live in a dedicated hook
    - `App.tsx` now consumes the returned callbacks instead of carrying those implementations inline
  - acceptance:
    - `App.tsx` no longer contains `handleSaveTask`, `handleDeleteTask`, `handleMoveTask`, `handleUpdateTaskDates`, `handleAddTaskComment`, `handleMoveAgentTaskToReview`

- [x] Create `src/app/hooks/useProjectActions.ts`
  - responsibility:
    - swimlane/project add/edit/delete/reorder
    - project cleanup on task references
  - completed:
    - project/swimlane mutations now live in a dedicated hook
    - `App.tsx` now delegates save/delete/reorder behavior to that hook
  - acceptance:
    - `App.tsx` no longer owns swimlane mutation details

- [x] Create `src/app/hooks/usePeopleActions.ts`
  - responsibility:
    - add/update/delete/reorder people
    - clear invalid assignee references on delete
    - integrate watcher cleanup for deleted agentic people
  - completed:
    - people mutations now live in a dedicated hook
    - watcher cleanup on delete is preserved through the hook interface
  - acceptance:
    - person mutation logic leaves `App.tsx`

- [x] Create `src/app/hooks/useStatusColumnActions.ts`
  - responsibility:
    - rename
    - recolor
    - reorder
    - add
    - delete with fallback status migration
  - completed:
    - status-column mutations now live in a dedicated hook
    - fallback status reassignment on column deletion is preserved
  - acceptance:
    - custom kanban column rules are isolated in one place

## Phase 4: Extract MCP UI Coordination

- [x] Create `src/app/hooks/useMcpPanelState.ts`
  - responsibility:
    - listener status refresh
    - audit log refresh
    - restart handler
    - rotate token
    - dirty/applied config signature
  - completed:
    - MCP panel state now lives in a dedicated hook
    - `App.tsx` now consumes listener status, audit log, restart, token rotation, and pending-state from the hook
    - completed with agent support from `mcp_remaining_security_ops`
  - acceptance:
    - MCP panel state no longer sits inline in `App.tsx`

- [x] Create `src/app/hooks/useAgentWatchRuntime.ts`
  - responsibility:
    - `pollAgentWatcher`
    - runtime state map
    - watcher interval effect
    - manual poll helper
  - completed:
    - watcher runtime logic now lives in a dedicated hook
    - `App.tsx` now consumes watcher runtime state and watcher config helpers from the hook
    - completed with agent support from `mcp_remaining_watchers`
  - acceptance:
    - watcher polling logic and runtime bookkeeping leave `App.tsx`

- [x] Create `src/app/hooks/useWorkspaceDialogs.ts`
  - responsibility:
    - own dialog/panel open state
    - own selected task/swimlane/default values
    - expose open/close helpers for:
      - task dialog
      - task details
      - swimlane dialog
      - people panel
      - preferences panel
  - completed:
    - dialog/panel state now lives in a dedicated hook
    - `App.tsx` now consumes dialog state and open/close helpers from the hook
    - completed with agent support from `mcp_remaining_write_tools`
  - acceptance:
    - `App.tsx` no longer has the large block of modal-related `useState` declarations

- [x] Add tests for watcher polling and MCP listener UI state
  - implemented in:
    - `src/app/hooks/app-hooks.test.ts`
  - acceptance:
    - watcher state transitions are covered
    - restart/dirty-state logic is covered

## Phase 5: Extract Import / Export Workflow

- [x] Create `src/app/services/workspaceBackup.ts`
  - responsibility:
    - export payload assembly
    - import parsing
    - import repair rules
    - portable storage snapshot restore
  - completed:
    - backup payload builder/parser/repair service extracted
    - `App.tsx` now delegates export/import repair to the service module
    - completed with agent support from `mcp_task_verifier`
  - acceptance:
    - `App.tsx` does not build or parse backup payloads inline

- [ ] Add round-trip backup tests
  - scenarios:
    - tasks, people, projects, comments, status columns
    - preferences and MCP settings
    - UI state
    - storage/electronStore snapshots
    - malformed task references repaired on import
  - recommended file:
    - `src/app/services/__tests__/workspaceBackup.test.ts`

## Phase 6: Reduce Top-Level Rendering Complexity

- [x] Create `src/app/components/AppHeader.tsx`
  - responsibility:
    - logo
    - view toggle
    - people/preferences buttons
  - completed:
    - header rendering now lives in a dedicated component
    - completed with agent support from `mcp_remaining_security_ops`

- [x] Create `src/app/components/AppPanels.tsx`
  - responsibility:
    - render `TaskDialog`, `TaskDetailsDialog`, `SwimlaneDialog`, `PeoplePanel`, `PreferencesPanel`
    - accept a single grouped props object instead of many loose props
  - completed:
    - panel/dialog rendering now lives in a dedicated component
    - completed locally after no worker handoff arrived in time

- [x] Create `src/app/components/AppMainViews.tsx`
  - responsibility:
    - render timeline vs kanban view
    - keep scroll container refs and callbacks together
  - acceptance:
    - `App.tsx` render tree reads like composition, not implementation
  - completed:
    - main view rendering now lives in a dedicated component
    - completed with agent support from `mcp_remaining_watchers`

## Phase 7: Type Cleanup

- [x] Introduce a shared `StatusColumn` type in `src/app/types.ts`
  - current issue:
    - many components assume `id: TaskStatus`
    - actual product supports custom status IDs as arbitrary strings
  - target:
    - `Task.status` remains compatible
    - status-column UI uses a broader `StatusColumn` shape
  - completed:
    - shared `StatusColumn` and `Swimlane` typing now live in `src/app/types.ts`
    - status-driven components and helpers now consume the shared type instead of inline shapes
  - acceptance:
    - no ad hoc casts for custom board IDs in `App.tsx`

- [ ] Replace `Partial<Task>` write payloads with explicit input types
  - target:
    - `TaskDialogSubmit`
    - `SwimlaneSubmit`
    - `BackupImportResult`
  - acceptance:
    - fewer nullable/optional edge cases in handlers

## Phase 8: Final Cleanup / Guardrails

- [ ] Split `App.tsx` only after each module is tested
  - do not do a big-bang rewrite
  - merge in small chunks

- [ ] After each extraction:
  - run `npx tsc --noEmit`
  - run `npm run build`
  - run `npm run test:mcp`

- [ ] Final acceptance target for `App.tsx`
  - target size: under `500-700` lines
  - responsibilities left:
    - compose hooks
    - wire top-level props
    - render layout
  - responsibilities removed:
    - raw storage logic
    - import/export repair logic
    - mutation implementation details
    - watcher polling implementation
    - MCP panel orchestration details

## Suggested Execution Order

1. Extract pure helpers
2. Extract backup service
3. Extract workspace state hook
4. Extract task/project/person/status action hooks
5. Extract MCP and watcher hooks
6. Extract render components
7. Clean up shared types

## Good First Chunks

- [x] Chunk 1: storage helper extraction into `src/app/utils/storage.ts`
- [x] Chunk 2: `workspaceSanitizers.ts`
- [x] Chunk 3: `workspaceBackup.ts`
- [x] Chunk 4: `useTaskActions.ts`
- [x] Chunk 5: people/project/status hooks
- [x] Chunk 6: MCP panel/watcher/dialog hooks
- [x] Chunk 7: render composition components

These are the lowest-risk, highest-payoff extractions because they move dense logic out of `App.tsx` without changing the UI architecture yet.
