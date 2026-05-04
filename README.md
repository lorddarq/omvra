# Plumy

Plumy is an Electron desktop project-management app with two synchronized planning surfaces:

- Timeline view: calendar-like scheduling across project swimlanes
- Kanban view: status-column workflow management

The app is designed so contributors and agents can reason about the same task dataset through UI and MCP projections.

## Tech Stack

- Electron (desktop shell + secure preload bridge)
- React + TypeScript
- Vite (renderer and Pages builds)
- Tailwind CSS
- react-dnd (task drag and drop)
- electron-store (desktop persistence)

## Repository Structure

- `src/`: main renderer app (Plumy desktop UI)
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

Desktop persistence is now canonical-store aware:

- renderer state is mirrored through storage helpers
- Electron process uses `electron-store` as the canonical desktop persistence surface
- renderer/localStorage remains a portability and backup-friendly layer
- dev and packaged builds use separate Electron stores to avoid workspace collisions

Key storage namespaces use versioned keys (`*.v1`) to support future migrations.

### Views

- `TimelineView`: date-positioned task blocks with swimlane tracks
- `SwimlanesView`/`KanbanView`: status columns with reorder/move behavior
- markdown rendering is used for task details preview surfaces
- `PeoplePanel`: human and agentic team-member management, load visualization, and agent board-watch configuration
- `PreferencesPanel`: MCP configuration, diagnostics, audit log export, backup/import, and storage usage

### Backup and portability

Plumy supports full workspace backup/import from the Preferences panel.

Backups now include:

- tasks
- structured task comments
- people
- projects/swimlanes
- status columns
- preferences
- MCP settings
- timeline and kanban UI state
- timeline layout metadata
- portable local storage snapshot
- mirrored Electron store snapshot

This is intended to make workspace moves and recovery seamless rather than exporting only partial task data.

## MCP Integration (Desktop)

Plumy includes an MCP endpoint served by Electron main process (`/mcp`, local bind by default).

Current capabilities include:

- read tools/resources:
  - `workspace.get_snapshot`
  - `tasks.list`, `tasks.get`
  - `cards.kanban.list`, `cards.timeline.list`
  - `boards.watch.poll`
  - prompts:
    - `agent.find_assigned_work`
    - `agent.execute_task`
    - `agent.complete_and_handoff`
  - resources under `plumy://...`, including:
    - `plumy://workspace`
    - `plumy://agent/guide`
    - `plumy://schema/task-execution`
  - resource templates via `resources/templates/list`, including:
    - `plumy://tasks/{taskId}`
    - `plumy://agents/{personId}/assigned`
    - `plumy://projects/{projectId}/tasks`
    - `plumy://boards/{statusId}/tasks`
- gated safe write tools (capability-profile dependent):
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

Security controls include:

- explicit enable/disable toggle
- capability profiles (`read_only`, `task_write`, `admin`)
- optional token auth with TTL
- local-loopback default binding
- audit logging for MCP writes
- listener status and bind-error reporting in Preferences

Recommended workflow:

- agents should start with `plumy://agent/guide` and `plumy://schema/task-execution`
- use `resources/templates/list` to discover stable lookup URIs before guessing paths
- use `prompts/list` and `prompts/get` when the MCP client supports prompt-driven workflows
- use `workspace.get_snapshot` or `plumy://workspace` for the canonical top-level read
- use `plumy://agents/{personId}/assigned` to find assigned work without guessing filter shapes
- use `tasks.list`, `tasks.get`, `cards.kanban.list`, and `cards.timeline.list` for targeted reads
- use `boards.watch.poll` when an agent needs to monitor a specific status/board without duplicate processing
- use revision-protected write tools only after reading the current task revision
- keep the task description focused on the problem statement and use:
  - `agentSummary` for brief execution summary
  - comments for human-readable conversation
  - activity entries for structured machine-side progress notes
- when work is complete, prefer `tasks.complete_and_request_review` for a single safe handoff path
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

Vite config for Pages is in `pages/vite.config.ts` and uses base path `/Plumy/`.

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

Plumy now supports an agent-oriented desktop workflow:

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
