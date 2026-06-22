# Omvra

Omvra is an Electron desktop project-management app with synchronized planning surfaces:

- Timeline view: calendar-like scheduling across project swimlanes
- Kanban view: status-column workflow management
- Roadmap view: milestones, linked tasks, and intertask dependencies

The app is designed so contributors and agents can reason about the same task dataset through UI and MCP projections.

## Tech Stack

- Electron (desktop shell + secure preload bridge)
- React + TypeScript
- Vite (renderer and Pages builds)
- Tailwind CSS
- react-dnd (task drag and drop)
- electron-store (desktop persistence)

## Repository Structure

- `src/`: main renderer app (Omvra desktop UI)
- `electron/`: Electron main/preload code, IPC handlers, packaging scripts
- `pages/`: marketing/docs site source for GitHub Pages
- `.github/workflows/`: CI for packaging and Pages deployment
- `specs/`: product/architecture specs for major initiatives

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

`npm run dev` starts:

1. Vite renderer dev server on `http://localhost:5173`
2. Electron pointed to that dev server

Useful split commands:

```bash
npm run dev:vite      # Vite renderer only
npm run dev:electron  # Electron only (waits for localhost:5173)
npm run dev:pages     # Run the Pages site locally
```

## Build and Packaging

```bash
npm run build          # renderer build alias
npm run build:renderer # Vite renderer build -> dist/
npm run build:electron # build renderer, then package app -> release/
npm run dist           # generate icons + build renderer + package app -> release/
```

### Version resolution in packaged builds

`npm run build:electron` first creates the Vite renderer build in `dist/`, then runs `electron/scripts/build-electron-with-tag-version.cjs`, which resolves build version as:

1. Current Git tag version (supports `vX.Y.Z`)
2. Fallback to `package.json` version if no valid tag exists

This keeps release artifacts aligned with Git tags in CI.

## Asset and Icon Generation

```bash
npm run generate:icons
```

This runs `electron/scripts/generate-icons.cjs` and:

- uses `electron/assets/icon.png` as source
- generates favicon PNG sizes + `app.icns` + `app.ico`
- writes outputs into `electron/assets/`

`npm run dist` runs icon generation automatically via `predist`.

## Architecture Overview

### Runtime boundaries

- `electron/main.cjs`
  - creates `BrowserWindow`
  - loads Vite URL in dev, `dist/index.html` in production
  - owns file attachment, store, external-link IPC handlers
  - starts MCP HTTP server (local)
- `electron/preload.cjs`
  - exposes safe `window.electron` APIs
  - keeps context isolation enabled
- `src/app/App.tsx`
  - source-of-truth UI state orchestration
  - passes handlers and state to Timeline/Kanban components

### Data model and persistence

Core task/workspace types live in `src/app/types.ts`.

Tasks can include local file attachments. Attachments are stored as references to existing files, not as copied file contents:

- `Task.attachments` contains file metadata (`id`, `name`, absolute `path`, `file://` `uri`, optional `size`, and `addedAt`)
- task create/edit UI lets users add existing local files and remove references
- task details shows attachment paths and reveals the selected file in Finder
- backup/import and workspace sanitizers preserve attachment metadata

Because attachments point at local files, moving or deleting the original file can leave a stale reference. The app deliberately reveals file locations instead of opening files directly.

MCP agents can manage the same attachment references through write tools:

- `tasks_attach_file` accepts an absolute local path or `file://` URL and stores attachment metadata on the task
- `tasks_remove_attachment` removes an attachment by `attachmentId`, absolute path, or `file://` URL
- both tools require the current task revision, like other task writes
- non-file URLs are rejected; MCP does not open, read, or copy attachment contents

Tasks can also carry roadmap and approximate effort metadata:

- `milestoneId` links a task to a roadmap milestone
- `dependencyIds` records dependencies on other tasks
- `timeSpentMinutes` stores the approximate cumulative effort
- `timeSpentNote` stores the latest effort note
- `timeEntries` stores append-only effort entries with minutes, note, timestamp, and actor

These fields are preserved by workspace sanitizers, backup/import, app restarts, task reads, and the MCP workspace snapshot. Time logging is intentionally estimate-based; Omvra does not provide a stopwatch or billing workflow.

Desktop persistence is now canonical-store aware:

- renderer state is mirrored through storage helpers
- Electron process uses `electron-store` as the canonical desktop persistence surface
- renderer/localStorage remains a portability and backup-friendly layer
- dev and packaged builds use separate Electron stores to avoid workspace collisions

Key storage namespaces use versioned keys (`*.v1`) to support future migrations.

### Views

- `TimelineView`: date-positioned task blocks with swimlane tracks
- `SwimlanesView`/`KanbanView`: status columns with reorder/move behavior
- `RoadmapView`: milestone scheduling, linked work, and task dependencies
- task descriptions are edited as plain markdown text and rendered in task details preview surfaces
- `PeoplePanel`: human and agentic team-member management, load visualization, and agent board-watch configuration
- `PreferencesPanel`: MCP configuration, diagnostics, audit log export, backup/import, and storage usage

### Backup and portability

Omvra supports full workspace backup/import from the Preferences panel.

Backups now include:

- tasks
- structured task comments
- people
- projects/swimlanes
- status columns
- roadmap milestones and task dependency metadata
- approximate task time totals and entries
- preferences
- MCP settings
- timeline and kanban UI state
- timeline layout metadata
- portable local storage snapshot
- mirrored Electron store snapshot

This is intended to make workspace moves and recovery seamless rather than exporting only partial task data.

## MCP Integration (Desktop)

Omvra includes an MCP endpoint served by Electron main process (`/mcp`, local bind by default).

Current capabilities include:

- read tools/resources:
  - `workspace_get_snapshot`
  - `tasks_list`, `tasks_get`
  - `cards_kanban_list`, `cards_timeline_list`
  - `boards_watch_poll`
  - `milestones_list`, `milestones_get`
  - prompts:
    - `agent.find_assigned_work`
    - `agent.execute_task`
    - `agent.complete_and_handoff`
  - resources under `omvra://...`, including:
    - `omvra://workspace`
    - `omvra://agent/guide`
    - `omvra://schema/task-execution`
  - resource templates via `resources/templates/list`, including:
    - `omvra://tasks/{taskId}`
    - `omvra://agents/{personId}/assigned`
    - `omvra://projects/{projectId}/tasks`
    - `omvra://boards/{statusId}/tasks`
- gated safe write tools (capability-profile dependent):
  - task lifecycle: `task_write`, `tasks_create`, `tasks_update`, `tasks_update_description`, `tasks_delete`
  - task files: `tasks_attach_file`, `tasks_remove_attachment`
  - task effort: `tasks_log_time`
  - roadmap: `milestones_create`, `milestones_update`, `milestones_link_tasks`, `milestones_delete`
  - review workflow: `tasks_transition_under_review`, `tasks_complete_and_request_review`, `tasks_move_to_status`, `tasks_move_to_ready_for_human_review`, `tasks_move_to_requires_human_review`
  - task context: `tasks_update_agent_summary`, `tasks_update_completion_description`, `tasks_assign`, `tasks_add_comment`, `tasks_add_activity_entry`

Client-facing tool names use underscores so they remain compatible with clients that require names matching `^[a-zA-Z0-9_-]{1,64}$`. Internally, the server maps them to the equivalent dotted operation names.

### Roadmap, dependencies, and time logging

`workspace_get_snapshot` and `omvra://workspace` include milestones plus each task's roadmap and time fields. `milestones_list` and `milestones_get` provide targeted roadmap reads.

For roadmap writes:

1. Create standalone tasks with `task_write` or `tasks_create`.
2. Create a milestone with `milestones_create`; `title` and `endDate` are required.
3. Use `milestones_link_tasks` as the canonical atomic operation for adding existing tasks to a milestone and setting `dependencyIds`. It requires only the current milestone revision.
4. Use `milestones_update` for milestone metadata and replace/remove link operations.
5. Use `milestones_delete` to remove a milestone. It clears affected task `milestoneId` values and roadmap dependency metadata to match the UI deletion behavior.

Milestone and task updates use optimistic revision protection through `expectedRevision`. Invalid task, project, milestone, or dependency references are rejected before the write is committed.

Use `tasks_log_time` with `taskId`, positive `minutes`, optional `note`, and `expectedRevision` to append an approximate time entry and increment `timeSpentMinutes`. Direct task create/update calls may also set the current total and latest note.

Security controls include:

- explicit enable/disable toggle
- capability profiles (`read_only`, `task_write`, `admin`)
- optional token auth with TTL
- local-loopback default binding
- audit logging for MCP writes
- listener status and bind-error reporting in Preferences

Recommended workflow:

- agents should start with `omvra://agent/guide` and `omvra://schema/task-execution`
- use `resources/templates/list` to discover stable lookup URIs before guessing paths
- use `prompts/list` and `prompts/get` when the MCP client supports prompt-driven workflows
- use `workspace_get_snapshot` or `omvra://workspace` for the canonical top-level read
- use `omvra://agents/{personId}/assigned` to find assigned work without guessing filter shapes
- use `tasks_list`, `tasks_get`, `cards_kanban_list`, and `cards_timeline_list` for targeted reads
- use `milestones_list` and `milestones_get` for targeted roadmap reads
- use `boards_watch_poll` when an agent needs to monitor a specific status/board without duplicate processing
- use revision-protected write tools only after reading the current task revision
- use `milestones_link_tasks` instead of ordinary task updates for milestone membership and dependency changes
- keep the task description focused on the problem statement and use:
  - `agentSummary` for brief execution summary
  - comments for human-readable conversation
  - activity entries for structured machine-side progress notes
- when work is complete, prefer `tasks_complete_and_request_review` for a single safe handoff path
- if a more manual flow is needed, update the description briefly and move the task into the review board explicitly

Operational checks:

- `npm run test:mcp` runs the workspace contract tests
- `npm run mcp:smoke` runs a one-command local MCP smoke test against `MCP_ENDPOINT` or the default local endpoint
- `npm run mcp:stdio` starts the local stdio MCP server entrypoint
- In the Preferences panel, the MCP section shows:
  - connection status
  - auth mode and token expiry
  - listener/bind status
  - generated curl/localtunnel/stdio commands
  - MCP activity audit log with copy/export support
  - latest health check errors

Recommended local setup:

1. Keep the MCP listener bound to `127.0.0.1` and enable agent access only when needed.
2. Use the generated `curl` command in Preferences to verify the HTTP endpoint.
3. Use the generated `node electron/scripts/mcp-stdio.cjs` command when your MCP client supports `stdio`.
4. After changing host, port, token, or capability profile, restart the MCP listener from Preferences.

Recommended remote setup:

1. Prefer a managed tunnel or remote forwarding solution when an agent cannot reach localhost directly.
2. `cloudflared`, `ngrok`, or an equivalent managed tunnel is preferred over ad hoc sharing.
3. Keep the access token enabled for any remote URL.
4. Close `localtunnel` with `Ctrl + C`, or `pkill -f localtunnel` if it was backgrounded.
5. Revoke or rotate the token after sharing a remote endpoint.

## GitHub Pages Site Deployment

The marketing/docs site is built from `pages/` and emitted to `dist-pages/`.

Local build:

```bash
npm run build:pages
```

Workflow: `.github/workflows/deploy-pages.yml`

- triggers on pushes to `main` when files under `pages/**` change
- builds with Node 20
- uploads `dist-pages` as Pages artifact
- deploys with `actions/deploy-pages`

Vite config for Pages is in `pages/vite.config.ts` and uses base path `/omvra/`.

## Packaging CI and Releases

Workflow: `.github/workflows/packaging.yml`

- triggers on tag pushes matching `v*`
- matrix build on macOS, Windows, Linux
- generates icons before packaging
- builds renderer + packaged app
- uploads platform artifacts
- creates GitHub Release and attaches `.dmg`, `.exe`, `.AppImage` outputs when available

## Useful Checks

```bash
npm run test:mcp
npm run mcp:smoke
npm run mcp:stdio
```

These commands cover:

- MCP/workspace contract tests
- a local MCP smoke test
- local stdio MCP server startup

## Current Agent Workflow Support

Omvra now supports an agent-oriented desktop workflow:

- people can be marked as `human` or `agentic`
- tasks can be assigned to agentic people
- agentic people can be configured to watch a specific kanban board/status
- watcher settings live in the People panel and include:
  - watched board
  - action mode
  - optional project filter
  - optional search filter
  - poll interval
- watcher state keeps duplicate processing suppression on the MCP side
- agents can move work into human-review boards and leave structured comments/activity entries
- agents can discover assigned work through MCP resources/templates and use a single review-handoff workflow tool

## Comments and Task Context

Tasks now support:

- markdown description/details
- structured comments
- structured MCP activity entries
- brief agent completion blocks for review handoff
- parsed project/repo hints from the task description for agent routing

Comments are part of the task payload and are included in backup/import flows.

## Contributor Notes

- Prefer changing data behavior through service/repository layers when possible to reduce UI/storage drift.
- Keep task/card projection changes aligned between UI and MCP outputs.
- If you adjust MCP surface or schemas, update `TODO-IMPLEMENTATION.md` and relevant specs in `specs/`.
