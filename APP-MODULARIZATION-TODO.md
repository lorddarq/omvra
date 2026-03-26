# App Modularization Todo

This document breaks down the current `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/App.tsx` refactor into small, reviewable chunks.

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

1. [ ] Extract portable storage helpers into `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/utils/storage.ts`
2. [x] Extract MCP preference helpers into `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/utils/mcpPreferences.ts`
3. [ ] Extract task/project/person/status sanitizers into `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/utils/workspaceSanitizers.ts`
4. [ ] Extract import/export logic into `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/services/workspaceBackup.ts`
5. [ ] Extract task mutations into `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/hooks/useTaskActions.ts`
6. [ ] Extract person/project/status-column mutations into dedicated hooks
7. [ ] Extract MCP panel state and watcher runtime hooks
8. [ ] Extract render composition components
9. [ ] Clean up shared types around custom status columns

## Phase 1: Extract Pure Helpers

- [x] Move portable storage helpers out of `App.tsx` into `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/utils/storage.ts`
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

- [ ] Move task/project/person/status sanitizers into `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/utils/workspaceSanitizers.ts`
  - functions to move:
    - `normalizeTask`
    - `sanitizeStatusColumns`
    - `deriveStatusColumnsFromTasks`
    - `sanitizeTimelineSwimlanes`
    - `sanitizePeople`
    - `sanitizeTasks`
    - `sanitizePreferences`
    - `sanitizeAgentWatchConfigs`
  - acceptance:
    - module exports are pure and testable
    - add unit tests for legacy import cases and fallback behavior

- [x] Move MCP preference helpers into `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/utils/mcpPreferences.ts`
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

- [ ] Create `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/hooks/useWorkspaceState.ts`
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

- [ ] Create `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/hooks/useWorkspaceDialogs.ts`
  - responsibility:
    - own dialog/panel open state
    - own selected task/swimlane/default values
    - expose open/close helpers for:
      - task dialog
      - task details
      - swimlane dialog
      - people panel
      - preferences panel
  - acceptance:
    - `App.tsx` no longer has the large block of modal-related `useState` declarations

- [ ] Create `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/hooks/useStorageMeter.ts`
  - responsibility:
    - compute storage usage
    - expose refresh method and current meter state
  - acceptance:
    - preferences-related storage meter `useEffect` leaves `App.tsx`

## Phase 3: Extract Mutation Logic

- [ ] Create `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/hooks/useTaskActions.ts`
  - responsibility:
    - encapsulate task mutations:
      - save/create
      - delete
      - move status
      - update dates
      - add comment
      - move agent task to review
  - acceptance:
    - `App.tsx` no longer contains `handleSaveTask`, `handleDeleteTask`, `handleMoveTask`, `handleUpdateTaskDates`, `handleAddTaskComment`, `handleMoveAgentTaskToReview`

- [ ] Create `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/hooks/useProjectActions.ts`
  - responsibility:
    - swimlane/project add/edit/delete/reorder
    - project cleanup on task references
  - acceptance:
    - `App.tsx` no longer owns swimlane mutation details

- [ ] Create `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/hooks/usePeopleActions.ts`
  - responsibility:
    - add/update/delete/reorder people
    - clear invalid assignee references on delete
    - integrate watcher cleanup for deleted agentic people
  - acceptance:
    - person mutation logic leaves `App.tsx`

- [ ] Create `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/hooks/useStatusColumnActions.ts`
  - responsibility:
    - rename
    - recolor
    - reorder
    - add
    - delete with fallback status migration
  - acceptance:
    - custom kanban column rules are isolated in one place

## Phase 4: Extract MCP UI Coordination

- [ ] Create `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/hooks/useMcpPanelState.ts`
  - responsibility:
    - listener status refresh
    - audit log refresh
    - restart handler
    - rotate token
    - dirty/applied config signature
  - acceptance:
    - MCP panel state no longer sits inline in `App.tsx`

- [ ] Create `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/hooks/useAgentWatchRuntime.ts`
  - responsibility:
    - `pollAgentWatcher`
    - runtime state map
    - watcher interval effect
    - manual poll helper
  - acceptance:
    - watcher polling logic and runtime bookkeeping leave `App.tsx`

- [ ] Add tests for watcher polling and MCP listener UI state
  - recommended files:
    - `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/hooks/__tests__/useAgentWatchRuntime.test.ts`
    - `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/hooks/__tests__/useMcpPanelState.test.ts`
  - acceptance:
    - watcher state transitions are covered
    - restart/dirty-state logic is covered

## Phase 5: Extract Import / Export Workflow

- [ ] Create `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/services/workspaceBackup.ts`
  - responsibility:
    - export payload assembly
    - import parsing
    - import repair rules
    - portable storage snapshot restore
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
    - `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/services/__tests__/workspaceBackup.test.ts`

## Phase 6: Reduce Top-Level Rendering Complexity

- [ ] Create `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/components/AppHeader.tsx`
  - responsibility:
    - logo
    - view toggle
    - people/preferences buttons

- [ ] Create `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/components/AppPanels.tsx`
  - responsibility:
    - render `TaskDialog`, `TaskDetailsDialog`, `SwimlaneDialog`, `PeoplePanel`, `PreferencesPanel`
    - accept a single grouped props object instead of many loose props

- [ ] Create `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/components/AppMainViews.tsx`
  - responsibility:
    - render timeline vs kanban view
    - keep scroll container refs and callbacks together
  - acceptance:
    - `App.tsx` render tree reads like composition, not implementation

## Phase 7: Type Cleanup

- [ ] Introduce a shared `StatusColumn` type in `/Users/sorin.jurcut/Documents/GitHub/Plumy/src/app/types.ts`
  - current issue:
    - many components assume `id: TaskStatus`
    - actual product supports custom status IDs as arbitrary strings
  - target:
    - `Task.status` remains compatible
    - status-column UI uses a broader `StatusColumn` shape
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
- [ ] Chunk 2: `workspaceSanitizers.ts`
- [ ] Chunk 3: `workspaceBackup.ts`
- [ ] Chunk 4: `useTaskActions.ts`
- [ ] Chunk 5: `useMcpPanelState.ts`

These are the lowest-risk, highest-payoff extractions because they move dense logic out of `App.tsx` without changing the UI architecture yet.
