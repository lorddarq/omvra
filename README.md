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
