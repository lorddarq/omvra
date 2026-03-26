# MCP TODO

Status: Active  
Last Updated: 2026-03-26

This file tracks the remaining work needed to make Plumy's MCP support reliable, easier to connect to, and less error-prone for tools like Codex and Claude.

## Priority Summary

- [x] Implement MCP-standard initialization flow so clients can identify the server reliably
- [x] Add a local `stdio` MCP server mode for same-machine agent connections
- [ ] Keep HTTP MCP as remote mode, but make its configuration and behavior stricter
- [ ] Unify renderer/backend storage so MCP and UI always see the same data
- [x] Add stronger end-to-end verification and diagnostics

## Phase 1: Protocol Compatibility

- [x] Add `initialize` request handling
- [x] Return MCP-standard server identity fields:
  server name, version, protocol version, capabilities
- [x] Handle `notifications/initialized`
- [x] Verify `tools/list`, `tools/call`, `resources/list`, and `resources/read` all work after initialization
- [x] Align IPC and HTTP capability exposure so diagnostics are consistent
- [x] Confirm request/response shapes match what Codex/Claude MCP clients expect

## Phase 2: Transport Reliability

- [x] Add a dedicated `stdio` MCP server entrypoint for local use
- [x] Share the same workspace service layer between HTTP and `stdio`
- [x] Add a settings section that clearly separates:
  Local MCP and Remote MCP
- [ ] Keep HTTP MCP local by default (`127.0.0.1`)
- [x] Add support for more reliable remote access guidance:
  `cloudflared`, `ngrok`, or equivalent
- [x] Add a copyable command for local `stdio` usage if the target client supports command-based MCP setup

## Phase 3: Authentication and Security

- [x] Add enable/disable toggle for MCP access
- [x] Add token-based auth
- [x] Add token TTL
- [x] Add capability profiles (`read_only`, `task_write`, `admin`)
- [x] Add token rotation action in UI
- [x] Add token expiry visibility in UI
- [x] Reject malformed or missing auth with clear MCP-standard errors
- [ ] Add optional IP/origin restrictions for remote HTTP mode
- [x] Add explicit audit viewer/export for MCP activity

## Phase 4: Safe Write Operations

- [x] Add optimistic revision checks for task writes
- [x] Add safe write tools for:
  transition to review, agent summary, completion description
- [x] Add board creation/move flow for `Requires human review`
- [x] Add safe write tool for moving a task to a named board/status programmatically
- [x] Add safe write tool for moving a task to `Ready for human review`
- [x] Add safe write tool for creating comments/activity entries
- [x] Add safe write tool for assigning task to agent/human
- [x] Add safe write tool for updating task status with allowed-transition validation
- [x] Add consistent write result envelope:
  updated task, new revision, action, audit id
- [x] Add conflict retry guidance for clients

## Phase 5: Source of Truth and Data Consistency

- [x] Replace localStorage-first read path with repository/service-backed reads
- [ ] Define canonical repository interfaces for:
  tasks, people, projects/swimlanes, status columns, preferences
- [x] Move all persistence writes behind adapters
- [x] Ensure MCP reads the same canonical data source as the UI
- [ ] Add migration/versioning rules for MCP task metadata fields:
  revision, agent summary, completion block, project context
- [x] Remove remaining assumptions that renderer state is authoritative

Note: renderer writes are now mirrored through adapters for tasks, people, projects, status columns, preferences, view state, and timeline layout. Electron startup now avoids localStorage bootstrapping when the canonical electron-store bridge is present and waits for canonical hydration before mirroring back out. The remaining work is to introduce explicit repository interfaces and versioned MCP metadata rules.

## Phase 6: Task Context Quality

- [x] Parse project/repo hints from task description
- [ ] Expand description parsing for:
  local repo paths, branch names, file paths, ticket references
- [ ] Add explicit structured fields for:
  repo path, external issue URL, branch hint
- [ ] Prefer structured task metadata over description scraping when both exist
- [ ] Surface parsed MCP task context in a debug view so users can inspect what agents will see

## Phase 7: Diagnostics and Testing

- [x] Add automated MCP contract/parity tests
- [x] Add dev MCP health diagnostics
- [x] Add real end-to-end MCP handshake tests for `initialize`
- [x] Add tests for auth failures, expired tokens, and denied write attempts
- [x] Add tests for remote-mode resource reads and write tools
- [x] Add a one-command local smoke test script
- [x] Add a UI “Run MCP self-check” report with:
  listener status, auth mode, capabilities, latest errors
- [ ] Record median logical calls and latency in diagnostics for real runs

## Phase 8: Agent Monitoring and Automation

Progress: 7/8 complete. Local polling/watch UI is in place; event-driven follow-ups remain.

- [x] Add board-watching support so an agent can actively monitor a specific kanban board/status for new tasks
- [x] Start with polling-based board watchers for local mode
- [x] Persist watcher state:
  last seen task ids, revisions, and last processed time
- [x] Add filtered MCP surface for efficient board monitoring
- [ ] Add internal event hooks for:
  task created, task moved, assignment changed, description changed
- [ ] Evolve to event-driven watchers for web/self-hosted deployment
- [x] Add UI to configure which board an agent should watch
- [x] Add UI to configure what action an agent should take when new cards appear
- [x] Add tests for board monitoring and duplicate-processing prevention

## Phase 9: UX Improvements

- [x] Add generated curl command in settings
- [x] Add generated localtunnel command in settings
- [x] Add generated write-tool examples in settings
- [x] Add generated `stdio` setup instructions in settings
- [x] Add clearer warnings when:
  MCP is enabled but token is empty in remote mode
- [x] Add clear “restart required” feedback after host/port/profile/token changes
- [x] Add connection status indicator:
  disabled, local ready, remote ready, auth error, handshake error
- [x] Add listener status reporting and bind error visibility in Preferences

## Phase 10: Documentation

- [x] Document local setup:
  HTTP mode, token, curl, diagnostics
- [x] Document recommended local setup:
  `stdio` for Codex/Claude when supported
- [x] Document remote setup:
  tunnel, auth, risks, shutdown steps
- [x] Document supported MCP tools/resources and expected workflow
- [x] Document how agent-assigned tasks should be processed

## Exit Criteria

- [ ] A local MCP client can connect without a tunnel in a stable way
- [ ] A remote MCP client can connect through a supported remote mode with auth enabled
- [ ] UI and MCP always return the same task/person/project state
- [x] Safe write tools are revision-protected and audited
- [x] Agents can reliably detect new tasks in a watched board without duplicate execution
- [ ] Agents can move completed tasks into human-review boards programmatically
- [ ] Handshake, auth, read, and write flows are covered by tests
