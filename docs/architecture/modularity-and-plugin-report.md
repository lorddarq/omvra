# Modularity and Plugin Extensibility Report

Date: 2026-03-06

## Summary

Plumy is not yet structured for true plugin-style extensibility.

It is still a desktop-first React application where domain state, persistence, migrations, and UI orchestration are tightly coupled in the renderer, mainly inside `src/app/App.tsx` and parts of `src/app/components/TimelineView.tsx`.

That works for a local Electron app, but it means a private Convex backend, Docker deployment, or Umbrel packaging would currently require a refactor rather than a thin integration.

## Current Architectural Constraints

### 1. UI owns application state

The largest architectural issue is that application state is owned directly by the UI shell.

`tasks`, `people`, `swimlanes`, migrations, and persistence all live in `src/app/App.tsx`.

There is no repository layer, no domain service layer, and no command boundary between UI events and data changes.

If multiple backends are needed later, this logic has to move behind interfaces.

Reference:
- `src/app/App.tsx`

### 2. Persistence is fragmented

There is already a generic storage helper in `src/app/utils/storage.ts`, but most of the app bypasses it and writes directly to `localStorage`.

This happens in:
- `src/app/App.tsx`
- `src/app/hooks/useViewState.ts`
- `src/app/components/TimelineView.tsx`

Because of this, there is no single persistence seam that can be swapped for another backend.

### 3. Domain model is not normalized enough for backend portability

`Task` currently mixes domain and view concerns and duplicates project assignment in multiple forms:
- `swimlaneId`
- `projectIds`
- `project` string

Current type definition:
- `src/app/types.ts`

This is manageable in a local-only app, but it becomes fragile once:
- a database is introduced
- synchronization is introduced
- migrations become more formal
- multiple adapters need to agree on a canonical schema

### 4. Electron integration is hard-coded

The Electron bridge exposes a fixed set of IPC functions:
- store get/set/export
- file attachments
- open external links

References:
- `electron/preload.cjs`
- `electron/main.cjs`

This is acceptable for the current desktop build, but it is not yet a generic host capability layer.

A web build, Docker deployment, or Umbrel app would need a different capability surface for:
- storage
- file handling
- external navigation
- notifications
- app metadata

### 5. Shell and product are still combined

Today the project is effectively:
- one React renderer
- one Electron shell
- no server package
- no backend adapter package

That makes alternative runtimes harder to add cleanly.

## What Should Change

### 1. Introduce a `WorkspaceRepository`

Create an explicit data access contract that owns CRUD for:
- tasks
- people
- projects/swimlanes
- status columns
- view state
- attachment metadata

Example implementations:
- `LocalBrowserRepository`
- `ElectronStoreRepository`
- `ConvexRepository`
- `FileRepository`
- later `PostgresRepository`

The UI should stop mutating arrays directly and instead call repository-backed actions.

Instead of:
- `setTasks(...)`
- `setPeople(...)`

Prefer:
- `workspace.createTask(...)`
- `workspace.updateTask(...)`
- `workspace.deleteTask(...)`
- `workspace.listTasks()`

### 2. Introduce `HostCapabilities`

Platform-specific behavior should sit behind an explicit host adapter.

This should cover:
- file picking
- file embedding/storage
- open external links
- notifications
- app/version metadata

Possible implementations:
- `ElectronHostCapabilities`
- `BrowserHostCapabilities`
- `UmbrelHostCapabilities` if needed later

### 3. Centralize persistence and migrations

Migrations are currently embedded inside state initialization in `src/app/App.tsx`.

That should move into a dedicated persistence module or repository implementation so:
- schema versioning is centralized
- migrations are testable
- backend adapters all apply the same normalization rules

### 4. Normalize the domain model

Recommended changes:
- create an explicit `Project` entity
- treat `projectIds` as the canonical project relationship
- treat `swimlaneId` as either a timeline placement field or remove it if `Project` can absorb that concept
- remove redundant `project` display string from stored task data

This reduces schema drift and makes adapters safer.

### 5. Split the codebase by responsibility

Recommended target structure:

- `packages/core`
  - domain types
  - use cases
  - repositories
  - migrations
  - pure utilities
- `packages/web`
  - React UI
  - routing
  - composition root for browser/server-hosted app
- `packages/electron-shell`
  - Electron main/preload
  - desktop packaging concerns
- `packages/server`
  - optional API/backend
  - auth if ever needed
  - storage orchestration
- `packages/adapters/*`
  - local storage adapter
  - electron-store adapter
  - Convex adapter
  - export/import adapters

This is the cleanest route to support:
- local desktop
- browser-hosted app
- Docker deployment
- Umbrel deployment

## Recommended Plugin Model

Do not start with arbitrary runtime JavaScript plugins inside Electron.

That approach adds unnecessary:
- security risk
- crash surface
- upgrade complexity
- support burden

A better first step is an adapter-based plugin model.

Suggested plugin categories:
- storage/backend adapter
- host/platform adapter
- import/export adapter
- automation/integration adapter

This gives extensibility without requiring a dynamic runtime marketplace.

### Practical configuration model

The app can compose adapters from a configuration such as:

```ts
{
  backend: "local" | "electron" | "convex",
  host: "electron" | "web" | "umbrel",
  features: ["attachments", "markdown", "export"]
}
```

That is enough to support real deployment variation without overengineering.

## Convex Feasibility

A private Convex deployment is technically viable.

Convex documents self-hosting of the backend on your own infrastructure:
- https://docs.convex.dev/self-hosting

However, with the current codebase, adding Convex would still be a substantial integration because the app does not yet have a backend abstraction.

Recommended approach:
- first create a generic repository/API boundary
- then implement Convex as one backend adapter
- do not build the app directly around Convex-specific assumptions

## Docker Feasibility

Docker deployment is feasible, but not with the current Electron packaging model alone.

Right now there is:
- a frontend renderer
- an Electron shell
- no dedicated server process

To run Plumy in Docker properly, one of these needs to exist:

1. A web-only frontend served by a small HTTP server, plus a backend storage service
2. A frontend talking to a private backend such as Convex or Postgres over the network

Electron itself is not the right abstraction for Docker-hosted private deployment.

## Umbrel Feasibility

Umbrel is feasible only after Plumy has a browser-hosted mode.

Umbrel apps run in Docker containers and are exposed as web apps.

Relevant references:
- Umbrel app framework repo: https://github.com/getumbrel/umbrel-apps/blob/master/README.md
- Umbrel Portainer app notes: https://apps.umbrel.com/app/portainer

That means the current Electron app cannot be deployed to Umbrel as-is.

You would need:
- a web frontend
- a backend service
- persistent Docker volumes
- Umbrel-compatible app manifest/container wiring

For this codebase, Umbrel becomes straightforward only after:
- the shell is separated from the app
- the app can run in the browser
- storage is backend-driven rather than renderer-local

## Highest-ROI Refactor Order

1. Extract a `WorkspaceRepository` and route all data access through it.
2. Move migrations and key/version management out of `App.tsx`.
3. Normalize the domain model, especially project assignment.
4. Introduce `HostCapabilities` for Electron-specific features.
5. Split `core`, `web`, and `electron` responsibilities.
6. Add a web runtime target.
7. Implement one remote backend adapter, ideally behind a generic contract.
8. Package the web target for Docker and Umbrel.

## Practical Recommendation

If the goal is private, self-hosted, and portable, the right target architecture is not "Electron plus plugins".

The right target is:
- core app logic
- host adapters
- backend adapters

In that model:
- Electron is one host
- browser/Umbrel is another host
- Convex is one backend option
- local storage is another backend option

That design is modular in a way that will hold up as the product evolves.

## Relevant Code References

- `src/app/App.tsx`
- `src/app/components/TimelineView.tsx`
- `src/app/utils/storage.ts`
- `src/app/hooks/useViewState.ts`
- `src/app/types.ts`
- `electron/main.cjs`
- `electron/preload.cjs`
