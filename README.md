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
npm run build:electron # electron-builder packaging
npm run dist           # generate icons + build renderer + package app
```

### Version resolution in packaged builds

`npm run build:electron` runs `electron/scripts/build-electron-with-tag-version.cjs`, which resolves build version as:

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

Desktop persistence is currently local-first:

- renderer state uses local storage helpers
- Electron process uses `electron-store` for settings/MCP server config and bridge-related state

Key storage namespaces use versioned keys (`*.v1`) to support future migrations.

### Views

- `TimelineView`: date-positioned task blocks with swimlane tracks
- `SwimlanesView`/`KanbanView`: status columns with reorder/move behavior
- markdown rendering is used for task details preview surfaces

## MCP Integration (Desktop)

Plumy includes an MCP endpoint served by Electron main process (`/mcp`, local bind by default).

Current capabilities include:

- read tools/resources:
  - `workspace.get_snapshot`
  - `tasks.list`, `tasks.get`
  - `cards.kanban.list`, `cards.timeline.list`
  - resources under `plumy://...`
- gated safe write tools (capability-profile dependent):
  - `tasks.transition_under_review`
  - `tasks.update_agent_summary`
  - additional task-completion workflow tools may be present depending on current branch/runtime

Security controls include:

- explicit enable/disable toggle
- capability profiles (`read_only`, `task_write`, `admin`)
- optional token auth with TTL
- local-loopback default binding

Recommended workflow:

- agents should start with `workspace.get_snapshot` or `plumy://workspace`
- use `tasks.list`, `tasks.get`, `cards.kanban.list`, and `cards.timeline.list` for targeted reads
- use revision-protected write tools only after reading the current task revision
- when work is complete, update the description briefly and move the task into the review board if human review is required

Operational checks:

- `npm run test:mcp` runs the workspace contract tests
- `npm run mcp:smoke` runs a one-command local MCP smoke test against `MCP_ENDPOINT` or the default local endpoint
- In the Preferences panel, the MCP section shows connection status, auth mode, token expiry, and the latest health check errors

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
```

Runs MCP/workspace contract tests in `electron/services/workspace-service.test.cjs`.

## Contributor Notes

- Prefer changing data behavior through service/repository layers when possible to reduce UI/storage drift.
- Keep task/card projection changes aligned between UI and MCP outputs.
- If you adjust MCP surface or schemas, update `TODO-IMPLEMENTATION.md` and relevant specs in `specs/`.
