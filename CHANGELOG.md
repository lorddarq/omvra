# Changelog

All notable changes for Plumy release candidates should be documented in this file.

This entry reflects the current supported feature set in the repository and is intended as the baseline for the next stable release candidate.

## 0.1.30-rc.1 - 2026-04-01

### Highlights

- Electron desktop planning app with synchronized Timeline and Kanban work surfaces.
- Canonical desktop persistence backed by Electron store, with portable local backup and restore support.
- Built-in MCP server with read tools, guarded write tools, prompts, resources, token auth, audit logging, and listener diagnostics.
- Cross-platform packaging for macOS, Windows, and Linux through `electron-builder`.

### Added

- Timeline view for calendar-style scheduling across project swimlanes.
- Kanban view for board-based task planning, drag-and-drop task movement, task ordering, and status-column management.
- Support for configurable status columns including reorder, rename, recolor, add, and delete flows.
- Support for project/timeline swimlanes with task allocation and timeline placement.
- People management for both human and agentic contributors.
- Task metadata support for:
  - notes
  - assignee
  - multiple projects
  - timeline placement
  - date range
  - size
  - complexity
  - priority
  - blocked state
  - swimlane-only visibility
- Structured task comments and structured activity entries.
- Markdown authoring support for task details.
- Markdown rendering support for task preview and detail surfaces.
- Workspace backup and import support from Preferences.
- Portable workspace snapshot support including mirrored Electron store data and local storage state.
- MCP HTTP endpoint and stdio entrypoint for agent workflows.
- MCP prompts for guided agent work discovery, task execution, and handoff flows.
- MCP resource templates for task, agent, board, and project lookups.
- MCP board watcher polling for delta-based task monitoring without duplicate processing.
- MCP audit logging for write attempts and diagnostics visibility in Preferences.
- MCP token authentication with TTL and capability-profile gating.
- Git-tag-aware Electron packaging version resolution.
- Automated icon generation for desktop packaging targets.
- GitHub Pages build support for the companion site under `pages/`.

### Improved

- Desktop persistence flow now treats Electron store as the canonical desktop source while preserving portability-friendly mirrored storage.
- Packaged builds resolve release artifact versions from Git tags when present.
- Local desktop builds avoid accidental macOS signing identity auto-discovery unless signing is explicitly configured.
- Electron packaging logs now suppress the giant duplicate transitive dependency dump into a concise single-line summary.
- Windows packaging compatibility in the Electron build wrapper was restored by launching `electron-builder.cmd` through a shell when required.
- MCP task creation now resolves projects by either internal project ID or human-readable project name, reducing intermittent task creation failures for clients that send names instead of IDs.
- Kanban board creation was moved into the top toolbar beside search for both desktop and web implementations.
- Kanban task creation now inserts new tasks at the top of the target board instead of appending them to the bottom.
- Kanban column reorder logic was stabilized to reduce drag jitter by resolving the live drag index and applying midpoint checks.
- Markdown editing behavior was improved so empty content stays truly empty instead of being forced into a newline-backed placeholder state.
- Markdown list rendering was improved to restore visible ordered and unordered list markers.

### MCP Support

Current supported read capabilities include:

- `workspace.get_snapshot`
- `tasks.list`
- `tasks.get`
- `cards.kanban.list`
- `cards.timeline.list`
- `boards.watch.poll`

Current supported write capabilities include:

- `task_write`
- `tasks.create`
- `tasks.transition_under_review`
- `tasks.update_agent_summary`
- `tasks.update_completion_description`
- `tasks.complete_and_request_review`
- `tasks.move_to_status`
- `tasks.move_to_ready_for_human_review`
- `tasks.move_to_requires_human_review`
- `tasks.assign`
- `tasks.add_comment`
- `tasks.add_activity_entry`

Current supported MCP resource and prompt surfaces include:

- `plumy://workspace`
- `plumy://agent/guide`
- `plumy://schema/task-execution`
- `plumy://tasks/{taskId}`
- `plumy://agents/{personId}/assigned`
- `plumy://projects/{projectId}/tasks`
- `plumy://boards/{statusId}/tasks`
- `agent.find_assigned_work`
- `agent.execute_task`
- `agent.complete_and_handoff`

### Build and Release

- Renderer build supported through Vite via `npm run build:renderer`.
- Electron packaging supported through `npm run build:electron`, which now builds renderer assets first and emits packaged artifacts to `release/`.
- Full artifact build supported through `npm run dist`.
- Pages site build supported through `npm run build:pages`.
- MCP smoke and contract verification supported through:
  - `npm run test:mcp`
  - `npm run mcp:smoke`
  - `npm run mcp:stdio`

### Notes For RC Review

- This changelog entry is a current-capabilities release candidate summary, not a complete historical release log.
- If the release is tagged with a version other than `0.1.30`, the heading should be updated to match the final release tag.
