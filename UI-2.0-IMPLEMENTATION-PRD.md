# Plumy UI 2.0 Implementation PRD

Status: Draft  
Date: 2026-06-19  
Owner: Product + Engineering

## 1. Summary

Plumy UI 2.0 is a phased visual and layout architecture overhaul that introduces a reusable anchored panel pattern for long configuration and object-detail surfaces, then progressively applies the new design language across Settings, task details/editing, Kanban, Timeline, and related workflows.

The goal is to improve clarity, consistency, and maintainability without mixing large behavior changes with broad restyling. The first implementation slices should focus on component inventory, layout primitives, and safe componentization before applying final visual styling.

## 2. Design Reference

- [Plumy UI 2.0 Figma](https://www.figma.com/design/xK22WyMtqAJLx21eZr3QqS/Plumy?node-id=26-175)

The Figma reference is directional for layout, information architecture, spacing, interaction grammar, and visual mood. Implementation must still verify behavior against the current codebase and real workspace data.

## 3. Problem

Current Plumy UI surfaces have grown organically:

- Settings are concentrated in a large preferences component.
- People management lives in a separate panel even though it is an occasional configuration task.
- Agent management and upcoming agent persona instructions need a durable home in Settings.
- Task details and task edit surfaces are dense and would benefit from section navigation.
- Multiple panels and dialogs solve similar layout problems independently.
- Kanban needs visual polish, but its core board behavior does not require a deep rewrite.

Without a shared panel architecture, future UI work will increase duplication and make each new configuration feature harder to land safely.

## 4. Goals

- Introduce a reusable anchored panel architecture for long settings and object-detail surfaces.
- Make Settings the canonical management surface for People, Agents, Tasks, MCP, Data, MCP Activity, and MCP Testing.
- Preserve direct entry points for People and Agents by opening Settings at the relevant anchor.
- Move board watch controls into the Tasks settings section as part of the Settings information architecture change.
- Componentize reusable cards, editor forms, settings sections, and panel primitives.
- Refactor layout and section composition before performing broad styling changes.
- Keep Kanban behavior intact while progressively aligning its styling with UI 2.0.
- Reduce future implementation cost for agent persona instructions and related agent configuration features.

## 5. Non-Goals

- Rewriting Kanban drag-and-drop or task status semantics.
- Replacing app routing or introducing a full page-router model.
- Changing persistence schemas unless required by features already planned separately.
- Redesigning every view in one large, unreviewable patch.
- Moving board watch to column-level metadata in this UI 2.0 phase.
- Implementing the agent persona instructions feature itself, except where componentization prepares for it.

## 6. UX Principles

- The left rail in a panel navigates anchors within one scrollable document.
- Back exits the panel and returns to the previous app surface.
- Direct links such as People, Agents, or MCP may open the same Settings panel at different anchors.
- Work surfaces remain work surfaces: Kanban and Timeline should not become anchored panels.
- Object details and editing surfaces may reuse the anchored panel pattern.
- Visual styling should feel quiet, native-like, focused, and highly legible.
- Softness should come from surfaces and spacing, not from low-contrast text.
- Styling should be rolled out progressively after layout and behavior are stable.

## 7. Current-State Audit Targets

Phase 1 should inspect and tag components into the following groups.

### Reusable as-is

- Existing button, select, input, label, badge, sheet, dialog, and utility components.
- Existing copy/export controls where behavior is self-contained.
- Existing contrast and color utilities where applicable.

### Reusable with wrapper

- Status pills.
- Project pills.
- Load badges.
- Task checklist preview.
- MCP listener/status summary blocks.
- Copyable command blocks.
- Activity log list rows.

### Needs extraction

- Person display card.
- Agent display card.
- Person add/edit form.
- Agent add/edit form.
- Tasks settings controls.
- MCP connection/security controls.
- Data backup/storage controls.
- MCP activity log controls.
- MCP testing command blocks.
- Task basic information display.
- Task description section.
- Task dependencies section.
- Task attachments section.
- Task comments section.

### Needs new primitive

- Anchored panel shell.
- Anchored panel navigation.
- Anchored scroll view.
- Anchored section wrapper.
- Panel action bar/footer.
- Direct-anchor opener state.

## 8. Proposed Architecture

### 8.1 Shared anchored panel primitive

Create a reusable panel system, likely under:

```text
src/app/components/panels/
  AnchoredPanel.tsx
  AnchoredPanelNav.tsx
  AnchoredPanelScrollView.tsx
  AnchoredPanelSection.tsx
  PanelActionBar.tsx
```

The primitive should support:

- left navigation grouped by section category
- active anchor state
- scroll-to-section behavior
- optional initial anchor
- Back/Close action
- keyboard-focusable navigation items
- accessible section labels
- stable scroll container refs
- optional sticky footer/action bar
- responsive fallback hooks if needed later

### 8.2 Settings composition

Create a Settings implementation that composes sections rather than owning all content in one file.

```text
src/app/components/settings/
  SettingsPanel.tsx
  settingsSections.ts
  PeopleSettingsSection.tsx
  AgentsSettingsSection.tsx
  TasksSettingsSection.tsx
  McpSettingsSection.tsx
  DataSettingsSection.tsx
  McpActivitySettingsSection.tsx
  McpTestingSettingsSection.tsx
  PersonCard.tsx
  PersonEditorCard.tsx
  AgentCard.tsx
  AgentEditorCard.tsx
```

Direct app entry points should call a single opener with an anchor:

```ts
type SettingsAnchor =
  | 'people'
  | 'agents'
  | 'tasks'
  | 'mcp'
  | 'data'
  | 'mcp-activity'
  | 'mcp-testing';
```

Example behavior:

```text
Click People -> open Settings -> scroll to People
Click Agents -> open Settings -> scroll to Agents
Click MCP -> open Settings -> scroll to MCP
Back -> close Settings
```

### 8.3 Task panel composition

After Settings proves the anchored panel primitive, reuse it for task details and task editing.

Task details candidate sections:

```text
Basic Information
Description
Load
Dependencies
Attachments
Comments
Activity / Agent Summary
```

Task edit candidate sections:

```text
Basic Information
Projects
Description
Dependencies
Attachments
Advanced
```

The existing task save, update, delete, dependency, attachment, and comment behavior must remain intact.

Task details should also gain a small consolidated action menu before PDF export and before broad styling polish:

```text
...
Edit
Copy Task Info
Export PDF
```

This menu is a structural action-surface task, not the PDF export implementation itself. Delete and Close should stay outside the menu unless a later design explicitly moves them.

### 8.4 App status bar

UI 2.0 includes a compact status bar area for operational awareness:

```text
Active agents
Inactive agents
MCP running/offline
```

This should be an early, mostly-presentational shell task after component inventory. It should reuse existing people/agent and MCP state where available, avoid noisy polling, and avoid becoming a management or configuration surface.

### 8.5 Kanban relationship to UI 2.0

Kanban should remain a horizontal board/work surface. It should not use the anchored panel pattern for the board itself.

UI 2.0 work for Kanban should focus on:

- column container styling
- task card styling
- toolbar/search/filter spacing
- add board/add task treatment
- project pills and checklist previews
- empty column states
- horizontal overflow refinement

Task cards opened from Kanban should use the same task details/edit panel pattern as tasks opened elsewhere.

## 9. Board Watch Information Architecture

Board watch controls should move into the Tasks settings section during the Settings refactor.

Recommended interim Tasks section:

```text
Tasks
- Execution Load
- Pipeline Load
- Agent Board Watch
```

Rationale:

- Board watch is tied to task flow and Kanban observability.
- Moving it during the Settings anchored-panel refactor avoids designing the old information architecture twice.
- It prepares the interface for future column-level semantics without requiring that deeper data-model change now.

Important boundary:

- Do not implement column-level board watch metadata as part of this UI 2.0 phase unless a separate PRD explicitly expands scope.

## 10. Implementation Plan

### Phase 1: Component Inventory and Reuse Audit

Goal: verify the current componentization state and identify candidates for reuse or extraction.

Tasks:

- [ ] Inspect `PreferencesPanel`, `PeoplePanel`, `TaskDialog`, `TaskDetailsDialog`, `KanbanView`, and supporting card/row components.
- [ ] Tag components as reusable as-is, reusable with wrapper, needs extraction, or needs new primitive.
- [ ] Identify behavior-sensitive areas that must be preserved before refactoring.
- [ ] Map existing props and handlers that Settings sections will need.
- [ ] Produce a short implementation map before moving code.

Acceptance:

- [ ] The team has a concrete component extraction list.
- [ ] The first anchored-panel adoption target is identified.
- [ ] Known risky behavior paths are documented.

### Phase 2: App Status Bar

Goal: add the low-risk UI 2.0 shell/status surface before the heavier anchored-panel refactor.

Tasks:

- [ ] Confirm status bar placement from the Figma node and current app shell.
- [ ] Add a compact status bar component.
- [ ] Show active agent count.
- [ ] Show inactive/unavailable agent count.
- [ ] Show MCP running/offline/unknown state.
- [ ] Reuse existing app state or lightweight health state.
- [ ] Verify narrow-width behavior.

Acceptance:

- [ ] Status bar displays agent availability and MCP status.
- [ ] The component stays utilitarian and does not introduce management workflows.
- [ ] No unrelated app shell refactor is required.

### Phase 3: Add Shared Anchored Panel Primitive

Goal: introduce the shared layout shell without changing major feature behavior.

Tasks:

- [ ] Build `AnchoredPanel`.
- [ ] Build `AnchoredPanelNav`.
- [ ] Build `AnchoredPanelScrollView`.
- [ ] Build `AnchoredPanelSection`.
- [ ] Support `initialAnchor`.
- [ ] Support `scrollIntoView` navigation.
- [ ] Add active-section tracking, preferably behind a simple implementation first and refined later if needed.
- [ ] Add keyboard and focus states.
- [ ] Keep styling minimal and structural.

Acceptance:

- [ ] A long panel can render multiple sections and jump between them.
- [ ] Back/Close exits the panel.
- [ ] The active nav item updates when users navigate or scroll.
- [ ] The primitive is not hard-coded to Settings.

### Phase 4: Settings IA Refactor and Board Watch Move

Goal: migrate Settings into anchored sections and move board watch controls into Tasks settings.

Tasks:

- [ ] Create `SettingsPanel` using `AnchoredPanel`.
- [ ] Add Settings navigation groups: Settings, Storage, Help.
- [ ] Create `TasksSettingsSection`.
- [ ] Move Execution Load controls into Tasks settings.
- [ ] Move Pipeline Load controls into Tasks settings.
- [ ] Move Agent Board Watch controls into Tasks settings.
- [ ] Preserve current board watch state, poll, reset, runtime diagnostics, and save behavior.
- [ ] Create MCP, Data, MCP Activity, and MCP Testing settings sections from existing `PreferencesPanel` content.
- [ ] Keep direct entry behavior for Settings and MCP.

Acceptance:

- [ ] Settings renders as one scrollable anchored panel.
- [ ] Tasks settings owns load and board watch controls.
- [ ] Existing MCP settings, data backup, audit log, and testing command behavior still works.
- [ ] Back closes Settings.
- [ ] Direct anchors can open Settings at Tasks, MCP, Data, MCP Activity, or MCP Testing.

### Phase 5: People and Agents Componentization

Goal: move occasional people/agent management into Settings and prepare for agent persona instructions.

Tasks:

- [ ] Extract `PersonCard`.
- [ ] Extract `PersonEditorCard`.
- [ ] Extract `AgentCard`.
- [ ] Extract `AgentEditorCard`.
- [ ] Create `PeopleSettingsSection`.
- [ ] Create `AgentsSettingsSection`.
- [ ] Preserve add, edit, delete, task count, load, and assignment behavior.
- [ ] Preserve direct People and Agents entry points by opening Settings at the matching anchor.
- [ ] Retire or reduce `PeoplePanel` after equivalent Settings behavior is verified.

Acceptance:

- [ ] People and Agents are managed inside Settings.
- [ ] The main UI can still open directly to People or Agents.
- [ ] Existing add/edit/delete behavior still works.
- [ ] Agent cards and editor forms are ready for `agentInstructions` in a separate feature slice.

### Phase 6: Consolidated Task Details Action Menu

Goal: create the task-details three-dot menu that downstream task actions use.

Tasks:

- [ ] Add a top-right three-dot action menu to Task Details.
- [ ] Move Edit into the menu while preserving the existing edit flow.
- [ ] Move Copy Task Info into the menu while preserving the current copied payload.
- [ ] Add Export PDF as the designated menu item for the PDF export task.
- [ ] Keep Delete and Close outside the menu.
- [ ] Verify keyboard focus, Escape, outside click, and narrow-width behavior.

Acceptance:

- [ ] Task Details exposes Edit, Copy Task Info, and Export PDF from one menu.
- [ ] Existing edit and copy behavior still works.
- [ ] PDF export has a clear action surface before its implementation task begins.

### Phase 7: Task Details/Edit Anchored Panel Refactor

Goal: reuse the anchored panel architecture for task details and task editing.

Tasks:

- [ ] Extract task detail display sections.
- [ ] Extract task edit form sections.
- [ ] Use `AnchoredPanel` for task details.
- [ ] Use `AnchoredPanel` for task edit mode or a compatible editing shell.
- [ ] Preserve current task save, update, delete, close, comments, attachments, dependencies, and assignment behavior.
- [ ] Ensure task details opened from Timeline, Kanban, and search behave consistently.

Acceptance:

- [ ] Task details use left anchor navigation.
- [ ] Task edit uses sectioned layout without breaking save paths.
- [ ] Long notes, dependencies, attachments, and comments remain usable.
- [ ] Existing task tests and manual flows continue to pass.

### Phase 8: Kanban Visual Refresh

Goal: align Kanban with UI 2.0 styling while leaving board semantics intact.

Tasks:

- [ ] Refresh top toolbar/search/filter spacing.
- [ ] Refresh column container styling.
- [ ] Refresh column header styling.
- [ ] Refresh task card styling.
- [ ] Improve project pill and checklist preview presentation.
- [ ] Improve empty column states.
- [ ] Preserve drag/drop, column reorder, task creation, task edit, filters, and horizontal scrolling.

Acceptance:

- [ ] Kanban visually matches the UI 2.0 direction.
- [ ] Existing board interactions remain intact.
- [ ] Real long task titles and multi-project cards do not break layout.
- [ ] The board remains a working surface, not an anchored panel.

### Phase 9: Progressive Styling Rollout

Goal: apply visual refinements view by view after the layout architecture is stable.

Recommended order:

1. Settings.
2. Task details/edit.
3. Kanban.
4. Timeline controls and panels.
5. Milestones.
6. Shared dialogs/forms.
7. Empty, error, loading, and diagnostic states.

Per-view checklist:

- [ ] Text contrast is readable.
- [ ] Long labels and titles do not overflow.
- [ ] Keyboard focus is visible.
- [ ] Scroll behavior is predictable.
- [ ] Existing actions still work.
- [ ] Empty and error states remain clear.
- [ ] Real workspace data has been checked.

## 11. Testing and Verification

### Automated checks

- [ ] TypeScript build passes.
- [ ] Existing app hook tests pass.
- [ ] Existing task action tests pass.
- [ ] Existing MCP/workspace tests pass where touched.
- [ ] Add focused tests for section definitions and anchor state if practical.
- [ ] Add component tests for extracted cards/forms if the repo has a matching pattern.

### Manual QA

- [ ] Open Settings at default section.
- [ ] Open Settings directly to People.
- [ ] Open Settings directly to Agents.
- [ ] Open Settings directly to Tasks.
- [ ] Open Settings directly to MCP.
- [ ] Scroll Settings and verify active nav state.
- [ ] Add/edit/delete person.
- [ ] Add/edit/delete agent.
- [ ] Change execution and pipeline load settings.
- [ ] Configure and poll board watch.
- [ ] Change MCP host, port, token, capability profile.
- [ ] Copy/export MCP commands and activity log.
- [ ] Export and restore workspace backup.
- [ ] Open task details from Timeline.
- [ ] Open task details from Kanban.
- [ ] Edit task and save.
- [ ] Add comment, attachment, dependency, and verify persistence.
- [ ] Drag tasks and columns in Kanban after visual refresh.

## 12. Rollout Strategy

- Use small PRs organized by phase.
- Avoid restyling while moving behavior-heavy code.
- Prefer extracting components first, then replacing the old container.
- Keep old behavior available until the new section is verified.
- For Settings, ship the anchored shell with minimal styling before full UI 2.0 polish.
- For task panels, preserve form state and save handlers before changing visual details.
- For Kanban, treat changes as CSS/component styling unless a separate product decision expands scope.

## 13. Risks and Mitigations

### Risk: behavior regressions during component extraction

Mitigation: move one section at a time, keep props explicit, and verify each existing flow after extraction.

### Risk: anchor navigation fights nested scroll containers

Mitigation: use one owned scroll container inside `AnchoredPanel`; avoid nested scroll areas unless the nested content genuinely needs it.

### Risk: active nav state feels wrong

Mitigation: start with click-driven active state and add `IntersectionObserver` once layout stabilizes.

### Risk: low contrast from the soft UI direction

Mitigation: keep the visual mood but enforce readable body text, labels, and headings in production.

### Risk: Settings becomes too broad

Mitigation: keep sections small and domain-owned. Settings is the shell, not the owner of every implementation detail.

### Risk: board watch moves twice

Mitigation: move it to Tasks settings now as an interim IA step; defer column-level watch semantics to a separate product decision.

## 14. Estimated Complexity

Overall: medium-high.

Suggested effort:

- Phase 1: 0.5-1 day.
- Phase 2: 0.5-1 day.
- Phase 3: 1-2 days.
- Phase 4: 1.5-3 days.
- Phase 5: 1.5-3 days.
- Phase 6: 0.5-1 day.
- Phase 7: 2-4 days.
- Phase 8: 1-2 days.
- Phase 9: ongoing, view-by-view.

Practical first slice:

1. Audit component candidates.
2. Build `AnchoredPanel`.
3. Convert Settings to anchored sections.
4. Move board watch into Tasks settings.
5. Extract People/Agents components enough to support agent persona instructions.

Estimated first slice: 3-5 days.

## 15. Open Questions

1. Should Settings replace `PeoplePanel` entirely in the first slice, or should the old panel remain temporarily for rollback?
2. Should active anchor state be implemented with `IntersectionObserver` immediately or after the first structural pass?
3. Should task edit and task details share one container with mode-specific sections, or remain two shells that reuse the same primitives?
4. Should MCP Activity remain in Settings long term, or become an operational debug surface accessible from the status bar?
5. Should board watch remain global in Tasks settings after UI 2.0, or should a later PRD move it to column-level metadata?
