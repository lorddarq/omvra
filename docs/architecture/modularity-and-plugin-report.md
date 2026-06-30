# Modularity and Plugin Extensibility Report

Date: 2026-07-01
Status: Directionally relevant, but updated from the original 2026-03-06 snapshot

## Summary

Omvra is still not structured for true plugin-style extensibility.

That said, the March version of this report overstates how monolithic the codebase still is. The app remains desktop-first and renderer-heavy, but it now has clearer seams in a few important places:

- renderer state orchestration in `src/app/App.tsx`
- reusable hooks for action logic in `src/app/hooks/*`
- storage and backup utilities in `src/app/utils/storage.ts` and `src/app/services/workspaceBackup.ts`
- a read-model layer in `src/app/domain/workspaceReadModel.ts`
- an Electron MCP/service layer in `electron/services/*`

So the main conclusion still holds, but the supporting details need to be understood as "partly improved, not yet finished."

## Current Assessment

### 1. UI still owns too much application state

This is still the largest architectural limitation.

`src/app/App.tsx` still initializes and coordinates:

- tasks
- people
- milestones
- status columns
- preferences
- view state
- MCP runtime wiring
- dialog orchestration

The codebase is more modular than before because action logic has been pushed into hooks such as:

- `src/app/hooks/useTaskActions.ts`
- `src/app/hooks/usePeopleActions.ts`
- `src/app/hooks/useProjectActions.ts`
- `src/app/hooks/useStatusColumnActions.ts`
- `src/app/hooks/useWorkspaceDialogs.ts`

But those hooks are still largely UI-owned state mutators rather than a repository or use-case boundary.

Verdict:
- Still relevant concern
- Less severe than the March report implied

### 2. Persistence is improved, but still not fully abstracted

The old report said persistence was fragmented and mostly bypassed storage helpers. That is only partly true now.

There is now a more explicit storage and portability layer in:

- `src/app/utils/storage.ts`
- `src/app/services/workspaceBackup.ts`
- `src/app/utils/workspaceSanitizers.ts`
- `src/app/utils/canonicalHydration.js`

Important improvement:

- Electron store is now treated as the canonical desktop source in several flows
- localStorage is still present as a renderer portability and bootstrap layer
- import/export and backup handling are more formal than before

However, persistence is still not hidden behind a backend-neutral repository contract. The renderer still knows too much about storage keys, bootstrapping, and mirroring behavior.

Verdict:
- The original concern still matters
- The document should no longer describe persistence as mostly ad hoc

### 3. The domain model is still only partially normalized

This section is still relevant.

`Task` still carries overlapping relationship fields such as:

- `swimlaneId`
- `projectIds`
- `project`

That is workable for a local app, but it remains risky if Omvra later adds:

- synchronization
- multiple storage adapters
- a server-backed write path
- migration-heavy evolution

The situation is somewhat improved by `src/app/domain/workspaceReadModel.ts`, which creates richer projections without forcing every component to re-derive relationships itself.

But the stored canonical task shape is still not as clean as it should be for backend portability.

Verdict:
- Still highly relevant

### 4. Electron integration is no longer just a tiny fixed bridge

This part of the old report is outdated in tone.

The preload bridge is still explicit and host-specific in `electron/preload.cjs`, but the Electron side now includes more than raw shell plumbing:

- attachment handling
- PDF export
- runtime metadata
- MCP capability/status access
- a fairly substantial workspace and MCP service layer in `electron/services/workspace-service.cjs`
- HTTP MCP surface in `electron/services/mcp-http-server.cjs`

This is still not a formal `HostCapabilities` abstraction, but it is no longer fair to describe Electron integration as only a hard-coded minimal bridge.

Verdict:
- Concern is partially relevant
- Evidence and wording needed refresh

### 5. Shell and product are still combined

This remains true in practice.

There is still:

- one Electron shell
- one renderer app
- no browser-hosted production runtime
- no separate server package
- no clean backend adapter package

The codebase now has better internal layering, but it is still one app rather than a true host/core split.

Verdict:
- Still relevant

## What Changed Since The Original Report

The following developments reduce the severity of the original critique:

### A. The renderer has more internal structure

The app has many more focused hooks, utilities, and view-specific components than a pure "everything in App.tsx" architecture.

Examples:

- `src/app/hooks/*`
- `src/app/domain/workspaceReadModel.ts`
- `src/app/services/workspaceBackup.ts`
- `src/app/utils/workspaceSanitizers.ts`

### B. There is now a meaningful MCP/service layer

The Electron process now exposes a real service surface for workspace reads/writes and MCP-oriented workflows:

- `electron/services/workspace-service.cjs`
- `electron/services/mcp-http-server.cjs`
- `electron/ipc/mcp.cjs`

That is not yet a portable backend abstraction, but it is a real architectural seam that did not exist in the earlier framing.

### C. Trust boundaries and data contracts are more explicit

Recent work added:

- MCP resource metadata
- trust-boundary semantics
- explicit field guidance for agent behavior vs operational instructions
- a larger MCP contract test suite

That moves Omvra slightly closer to a service-oriented architecture even though the runtime remains Electron-first.

## What Is Still Missing

If the goal is true modularity or deployable host/backend variation, the following pieces are still missing:

### 1. A real repository boundary

Omvra still lacks a first-class `WorkspaceRepository` or equivalent contract that cleanly owns:

- task CRUD
- people CRUD
- milestone CRUD
- status column CRUD
- persistence
- migrations
- read/write consistency

Today those responsibilities are distributed across:

- renderer state
- action hooks
- storage utilities
- Electron workspace service helpers

### 2. A host abstraction

There is still no explicit interface for:

- file picking
- file embedding
- external navigation
- PDF export
- runtime metadata
- notifications

These are all workable in Electron, but they are not yet packaged as a host-neutral capability layer.

### 3. A browser/server runtime target

The report’s Docker and Umbrel conclusions still hold.

Omvra cannot meaningfully target Docker or Umbrel cleanly until it can run as:

- a browser-hosted frontend
- plus either a backend service or a backend adapter

Electron is still the product runtime, not just one host option.

### 4. A normalized canonical schema

The app has richer derived projections, but the stored workspace shape still carries legacy overlap and UI-driven fields that would need cleanup before backend portability becomes easy.

## Updated Recommendation

Do not treat "plugins" as the next architecture move.

That is still the wrong level of abstraction for Omvra.

The right path is still:

- core workspace logic
- host capability adapters
- backend/storage adapters

In practical terms, the next meaningful modularity step is not a plugin marketplace. It is a clearer contract around workspace reads/writes and host-side capabilities.

## Highest-ROI Refactor Order

### 1. Introduce a `WorkspaceRepository`

Create an explicit data contract for:

- tasks
- people
- milestones
- projects/swimlanes
- status columns
- preferences or view-state persistence where appropriate

This should become the boundary between UI interaction and persistence.

### 2. Move persistence bootstrapping and migration policy out of `App.tsx`

Keep `App.tsx` as a composition root, not the place where persistence rules are defined.

### 3. Normalize the stored workspace schema

Especially:

- project vs swimlane relationships
- display strings vs canonical ids
- long-lived task metadata vs view-local metadata

### 4. Formalize host capabilities

Extract an interface around:

- attachments
- PDF export
- external links
- runtime info
- MCP runtime controls if those remain host-owned

### 5. Separate renderer, shell, and service concerns more intentionally

This does not require a monorepo immediately. It can start as clearer top-level modules and contracts inside the existing repo.

## On The Old `packages/*` Recommendation

The original report recommended a future split into:

- `packages/core`
- `packages/web`
- `packages/electron-shell`
- `packages/server`
- `packages/adapters/*`

That still makes sense as a long-term target, but it should be read as aspirational architecture, not an immediate or proven next step.

Today, the better question is not "should we split into packages now?"

It is:

"What are the first two or three contracts we need so that a future split is possible without rewriting behavior twice?"

Those contracts are most likely:

- workspace repository
- host capabilities
- canonical schema + migration boundary

## Convex, Docker, and Umbrel Relevance

These sections remain broadly relevant.

### Convex

Still viable, but still better introduced behind a generic repository or service contract rather than directly into the renderer state model.

### Docker

Still requires a browser-servable runtime or backend-oriented architecture. Electron alone is not the deployment model.

### Umbrel

Still depends on Omvra becoming a browser-hosted app with backend-driven persistence.

## Final Verdict

This document is still useful if read as:

- an architectural direction memo
- a warning against premature runtime plugin systems
- a portability planning note

It is no longer fully accurate as a current-state audit.

Most useful current take:

- The strategic conclusion still holds
- The repo is more modular internally than the original draft gave it credit for
- The next step is contract extraction, not plugin infrastructure

## Relevant Code References

- `src/app/App.tsx`
- `src/app/utils/storage.ts`
- `src/app/services/workspaceBackup.ts`
- `src/app/utils/workspaceSanitizers.ts`
- `src/app/domain/workspaceReadModel.ts`
- `src/app/hooks/useTaskActions.ts`
- `src/app/hooks/usePeopleActions.ts`
- `electron/main.cjs`
- `electron/preload.cjs`
- `electron/services/workspace-service.cjs`
- `electron/services/mcp-http-server.cjs`
