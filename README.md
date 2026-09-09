# Omvra

[![Packaging CI](https://github.com/lorddarq/omvra/actions/workflows/packaging.yml/badge.svg)](https://github.com/lorddarq/omvra/actions/workflows/packaging.yml)
[![Pages deployment](https://github.com/lorddarq/omvra/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/lorddarq/omvra/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-desktop-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=20232A)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-enabled-6f42c1)](#mcp-integration-desktop)

Omvra is a desktop workspace for planning work, running local coding agents, and reviewing their results. Tasks, projects, people, and schedules stay on your computer. Ordinary planning works without an Omvra account or an internet connection; agent providers and optional online actions may require their own authentication and network access.

## What you can do

- **Plan across shared views.** Timeline schedules work by project or person, Kanban organizes statuses, and Milestones groups related tasks and dependencies.
- **Keep work in context.** Tasks support Markdown descriptions, assignment, comments, attachments, priorities, dependencies, and approximate time entries.
- **Build governed workflows.** Workflows provides a graph editor for Goals, with templates, agent steps, instructions, conditions, human input, approval gates, retries, artifacts, and schedules. Execution follows the configured policy and available runtime capabilities.
- **Run and supervise agents.** Configure an installed ACP-compatible runtime, Codex app-server, or Claude Code CLI; start work from a task and follow activity, blockers, and permission requests. External handoff is also available.
- **Review before accepting.** Preserve results and verification in task context and handoffs. Agent contributions and workflow approvals have explicit lifecycle actions.
- **Connect external assistants.** MCP exposes workspace reads and governed writes with capability profiles, authentication controls, revision checks, and activity diagnostics.
- **Back up locally.** Export and restore workspace data, and choose stable or release-candidate updates from Settings.

## Your first task

1. Open Omvra. Choose **Get started** on the welcome screen to open task creation, or **Take a tour** for the optional introduction.
2. Name an outcome, such as “Draft homepage outline,” and describe what a useful result includes. Save the task; a project or agent connection is not required to begin.
3. Add an owner when needed. Use **Settings → People** for people and **Settings → Agent profiles** for agent personas.
4. To schedule work, set dates and check its project membership and **Timeline Project**, then locate it on Timeline.
5. When the task is ready for agent execution, configure Runtime access and use **Start work**. Review the result before accepting it.

A workspace checklist currently tracks three milestones: a task exists, a person or agent exists, and a task has moved beyond Open. These are setup indicators, not proof that an agent has run or that a result has been accepted. The checklist disappears when all three are met.

You can reopen the introduction through **Settings → Help → Restart Onboarding**. Closing the tour suppresses automatic replay; it does not reset workspace data.

## Planning views

| View | What it shows | How to use it |
| --- | --- | --- |
| Timeline | Scheduled tasks arranged by project or person | Set dates, navigate to the scheduled period, drag within a row to reschedule, or resize an edge to adjust dates. |
| Kanban | Tasks grouped by status | Move and reorder tasks as the work progresses. |
| Milestones | Related tasks, dates, and dependencies | Group work around a delivery point and inspect progress. |
| Workflows | Goal execution graphs | Connect steps, decisions, approvals, and retry paths; configure policy and scheduling. |

Timeline, Kanban, and Milestones use shared task data. A missing Timeline task may need valid dates, matching project membership or assignment, an expanded row, or completed-work visibility enabled. Projects mode and People mode use different row relationships.

Dragging a task horizontally within its row changes the schedule. Dropping onto another People row can change the assignee; project-row drops depend on project membership. You can edit dates in the task editor without dragging. Scheduled duration and logged effort are separate; time entries are approximate records, not a stopwatch or billing system.

## Agents: profiles, runtimes, and connections

These settings serve different purposes:

| Settings section | Purpose |
| --- | --- |
| Agent profiles | Define an agent persona and its behavioral and operational instructions. |
| Runtime access | Allow Omvra to launch or hand off work to configured agent applications. |
| Connected agents | Allow external MCP clients to read or update the workspace under the selected access level. |
| Troubleshoot connections | Inspect connection health and diagnostic results. |
| Activity log | Inspect bounded, redacted MCP activity. |

An agent persona does not select a runtime or authenticate a provider. Runtime access and Connected agents are independent controls; disabling one does not disable the other.

### Start and supervise work

1. Install and authenticate the runtime you intend to use.
2. Open **Settings → Runtime access**, enable **Allow runtime connections**, and configure its exact executable and integration mode.
3. Prepare the task’s outcome and instructions. Assign an agent persona if you want its guidance applied.
4. Choose **Start work** and review the resolved runtime, model, working folder, task context, and any blockers.
5. Follow activity in supervision and respond to permission or input requests. Use the explicit session controls to continue, cancel, or close work.

Supported integrations:

- Native ACP over local stdio for conforming runtimes.
- Codex app-server over local stdio.
- Claude Code CLI stream-json over local stdio.
- Explicit external handoff.

The Claude integration uses the CLI, not the Claude desktop application. Runtime profiles contain launch configuration, not provider credentials. A connection test does not necessarily prove provider authentication or model access; inspect the runtime’s reported state and any start failure.

Supervision is owned at app level, so closing a launch panel does not cancel the session. Current concurrency policy permits one in-flight turn across the workspace; idle ready sessions do not consume that capacity. Recovery follows the selected adapter’s behavior and availability rather than promising that every provider conversation can resume unchanged.

### Context and review

Managed sessions and direct MCP clients resolve the current task, assignment, persona guidance, operational instructions, and task context. Missing or incomplete persona information can use standard agent behavior when the execution contract permits it. An unresolved task is a blocker. Referenced skills may be available, missing, denied, or unverified; unverified means Omvra lacks visibility, not that the skill is absent.

Instruction delivery does not guarantee a provider follows those instructions. Review actual results and verification.

A finished, cancelled, or closed session does not submit or accept task work. Use the appropriate handoff, contribution, and workflow approval actions. A status change alone does not accept a contribution or complete a Goal.

## MCP integration (desktop)

Omvra exposes a local HTTP MCP endpoint at `/mcp` when connected-agent access is enabled. A stdio entrypoint is also available for compatible clients. Use the connection details generated by the current app build.

1. Open **Settings → Connected agents** and enable **Allow connected agents**.
2. Choose **Read Only** for inspection, **Task Write** for permitted task/workflow updates, or **Admin** when broader operations are required.
3. Configure the client using the current endpoint and authentication details.
4. Restart the connection service after changes that require it, then reconnect the client.
5. Use **Troubleshoot connections** and **Activity log** to investigate failures.

The selected runtime owns its general MCP configuration and provider credentials. Managed adapters may supply Omvra’s own endpoint with a scoped grant; this does not replace the provider’s other MCP connections.

### Tool workflow

Discover the current tools and schemas from the connected server; capability profiles can hide write tools. Client-facing tool names use underscores, mapped internally to dotted operations.

Common entry points include:

- `workspace_get_snapshot`, `tasks_list`, and `tasks_get` for workspace and task reads.
- `agent_resolve_task_context` for the exact task’s execution context.
- `cards_kanban_list` and `cards_timeline_list` for view projections.
- `milestones_list`, `milestones_get`, and `milestones_link_tasks` for milestone coordination.
- `tasks_update_description`, `tasks_transition_contribution`, and `tasks_complete_and_request_review` for governed updates and handoffs.

Read the current record before writing and supply its `expectedRevision` where required. On a revision conflict, reread and reconcile the intended change. Do not blindly retry with stale content.

For `tasks_complete_and_request_review`, first preserve the existing description and add the full handoff using `tasks_update_description`. Reread the revision, then submit a completion pointer of at most 240 characters. Human acceptance remains a separate decision.

MCP resources and prompts provide context; they do not override client instructions, permissions, or task acceptance rules. Keep credentials private, prefer local binding, and disable external access when no longer needed. Remote access requires deliberate endpoint exposure and appropriate authentication.

The authoritative tool catalog is [mcp-registry.cjs](electron/services/mcp-registry.cjs).

## Local data, backup, and updates

Desktop workspace data is stored through Electron’s main process using `electron-store`. The renderer uses a structured store with hydration, selectors, mutations, and persistence adapters; browser storage is not the canonical desktop database.

Open **Settings → Local data & backup**:

- **Backup Data** exports a JSON recovery copy.
- **Restore Data** imports a backup. Create a backup of your current workspace first.

Exports include tasks, people, projects, status columns, milestones, preferences, UI state, Goal policy, and storage snapshots. Treat backup files as private workspace data. Local attachment references and machine-specific paths may need repair after moving computers; a backup does not install runtimes or authenticate provider accounts.

Attachments can reference local files. Moving or deleting those originals can break the references, so preserve the linked files as well as the backup.

Open **Settings → About & updates** to choose stable releases or release candidates and check for updates. Release-candidate installation requires a fresh backup. Update availability and installation depend on the packaged build and platform.

## Development

The app uses Electron, React, TypeScript, Vite, Tailwind CSS, react-dnd, and electron-store. CI uses Node 24.

```bash
npm install
npm run dev
```

This starts Vite on `http://localhost:5173` and Electron against that renderer.

```bash
npm run dev:vite      # Renderer only
npm run dev:electron  # Electron; waits for the renderer
npm run dev:pages     # Marketing site
```

Updater fixtures exercise UI states without contacting a release server or installing an update:

```bash
npm run dev:update
npm run dev:update:downloading
npm run dev:update:downloaded
npm run dev:update:backup
```

### Build and package

```bash
npm run build          # Renderer → dist/
npm run build:electron # Renderer and desktop package → release/
npm run dist           # Generate icons, then build and package
npm run build:pages    # Marketing site → dist-pages/
npm run generate:icons
```

Packaging resolves the version from the current supported Git tag, falling back to `package.json`. Platform artifacts and signing/publishing behavior are defined in [packaging.yml](.github/workflows/packaging.yml). GitHub Pages deployment is defined in [deploy-pages.yml](.github/workflows/deploy-pages.yml).

### Verification and diagnostics

There is no single `npm test`; choose the checks relevant to the change.

```bash
npm run test:hooks
npm run test:mcp
npm run test:workspace-contracts
npm run mcp:smoke
npx tsc --noEmit
```

Vite builds do not replace TypeScript checking or runtime UI verification. The smoke test needs an accessible MCP endpoint.

```bash
npm run mcp:stdio
npm run workspace:diagnostics
npm run workspace:export-diagnostics
npm run workspace:export-store
```

Diagnostic exports can contain private workspace data; inspect them before sharing.

## Architecture and contribution

- `src/app/components/`: planning views, editors, Settings, onboarding, and supervision.
- `src/app/store/`: renderer workspace and layout state.
- `src/app/hooks/`: app orchestration and actions.
- `electron/domain/`: domain rules and validation.
- `electron/services/`: persistence, MCP, runtime adapters, and execution services.
- `electron/ipc/` and `electron/preload.cjs`: desktop IPC boundary.
- `pages/`: marketing site.
- `docs/architecture/`: behavioral contracts.

Read the relevant contract before changing runtime, task collaboration, Goal, or MCP behavior:

- [Runtime and session lifecycle](docs/architecture/acp-runtime-session-lifecycle-contract.md)
- [Session supervision and concurrency](docs/architecture/agent-session-supervisor-and-concurrency.md)
- [Task collaboration and acceptance](docs/architecture/task-orchestration-and-multi-agent-collaboration.md)
- [Task context ledger](docs/architecture/task-context-ledger.md)
- [Goal control-flow nodes](docs/architecture/goals-control-flow-nodes.md)

Reuse existing store mutations and domain helpers, preserve revision checks, and keep UI and MCP behavior aligned. Validate the affected contracts and verify interactive changes in the running app.
