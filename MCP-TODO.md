# MCP TODO

Status: Active  
Last Updated: 2026-03-26

This file tracks the remaining work needed to make Plumy's MCP support reliable, easier to connect to, and less error-prone for tools like Codex and Claude.

## Priority Summary

- [ ] Implement MCP-standard initialization flow so clients can identify the server reliably
- [ ] Add a local `stdio` MCP server mode for same-machine agent connections
- [ ] Keep HTTP MCP as remote mode, but make its configuration and behavior stricter
- [ ] Unify renderer/backend storage so MCP and UI always see the same data
- [ ] Add stronger end-to-end verification and diagnostics

## Phase 1: Protocol Compatibility

- [ ] Add `initialize` request handling
- [ ] Return MCP-standard server identity fields:
  server name, version, protocol version, capabilities
- [ ] Handle `notifications/initialized`
- [ ] Verify `tools/list`, `tools/call`, `resources/list`, and `resources/read` all work after initialization
- [ ] Align IPC and HTTP capability exposure so diagnostics are consistent
- [ ] Confirm request/response shapes match what Codex/Claude MCP clients expect

## Phase 2: Transport Reliability

- [ ] Add a dedicated `stdio` MCP server entrypoint for local use
- [ ] Share the same workspace service layer between HTTP and `stdio`
- [ ] Add a settings section that clearly separates:
  Local MCP and Remote MCP
- [ ] Keep HTTP MCP local by default (`127.0.0.1`)
- [ ] Add support for more reliable remote access guidance:
  `cloudflared`, `ngrok`, or equivalent
- [ ] Add a copyable command for local `stdio` usage if the target client supports command-based MCP setup

## Phase 3: Authentication and Security

- [x] Add enable/disable toggle for MCP access
- [x] Add token-based auth
- [x] Add token TTL
- [x] Add capability profiles (`read_only`, `task_write`, `admin`)
- [ ] Add token rotation action in UI
- [ ] Add token expiry visibility in UI
- [ ] Reject malformed or missing auth with clear MCP-standard errors
- [ ] Add optional IP/origin restrictions for remote HTTP mode
- [ ] Add explicit audit viewer/export for MCP activity

## Phase 4: Safe Write Operations

- [x] Add optimistic revision checks for task writes
- [x] Add safe write tools for:
  transition to review, agent summary, completion description
- [x] Add board creation/move flow for `Requires human review`
- [ ] Add safe write tool for moving a task to a named board/status programmatically
- [ ] Add safe write tool for moving a task to `Ready for human review`
- [ ] Add safe write tool for creating comments/activity entries
- [ ] Add safe write tool for assigning task to agent/human
- [ ] Add safe write tool for updating task status with allowed-transition validation
- [ ] Add consistent write result envelope:
  updated task, new revision, audit id
- [ ] Add conflict retry guidance for clients

## Phase 5: Source of Truth and Data Consistency

- [ ] Replace localStorage-first read path with repository/service-backed reads
- [ ] Define canonical repository interfaces for:
  tasks, people, projects/swimlanes, status columns, preferences
- [ ] Move all persistence writes behind adapters
- [ ] Ensure MCP reads the same canonical data source as the UI
- [ ] Add migration/versioning rules for MCP task metadata fields:
  revision, agent summary, completion block, project context
- [ ] Remove remaining assumptions that renderer state is authoritative

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
- [ ] Add real end-to-end MCP handshake tests for `initialize`
- [ ] Add tests for auth failures, expired tokens, and denied write attempts
- [ ] Add tests for remote-mode resource reads and write tools
- [ ] Add a one-command local smoke test script
- [ ] Add a UI “Run MCP self-check” report with:
  listener status, auth mode, capabilities, latest errors
- [ ] Record median logical calls and latency in diagnostics for real runs

## Phase 8: Agent Monitoring and Automation

- [ ] Add board-watching support so an agent can actively monitor a specific kanban board/status for new tasks
- [ ] Start with polling-based board watchers for local mode
- [ ] Persist watcher state:
  last seen task ids, revisions, and last processed time
- [ ] Add filtered MCP surface for efficient board monitoring
- [ ] Add internal event hooks for:
  task created, task moved, assignment changed, description changed
- [ ] Evolve to event-driven watchers for web/self-hosted deployment
- [ ] Add UI to configure which board an agent should watch
- [ ] Add UI to configure what action an agent should take when new cards appear
- [ ] Add tests for board monitoring and duplicate-processing prevention

## Phase 9: UX Improvements

- [x] Add generated curl command in settings
- [x] Add generated localtunnel command in settings
- [ ] Add generated write-tool examples in settings
- [ ] Add generated `stdio` setup instructions in settings
- [ ] Add clearer warnings when:
  MCP is enabled but token is empty in remote mode
- [ ] Add clear “restart required” feedback after host/port/profile/token changes
- [ ] Add connection status indicator:
  disabled, local ready, remote ready, auth error, handshake error

## Phase 10: Documentation

- [ ] Document local setup:
  HTTP mode, token, curl, diagnostics
- [ ] Document recommended local setup:
  `stdio` for Codex/Claude when supported
- [ ] Document remote setup:
  tunnel, auth, risks, shutdown steps
- [ ] Document supported MCP tools/resources and expected workflow
- [ ] Document how agent-assigned tasks should be processed

## Exit Criteria

- [ ] A local MCP client can connect without a tunnel in a stable way
- [ ] A remote MCP client can connect through a supported remote mode with auth enabled
- [ ] UI and MCP always return the same task/person/project state
- [ ] Safe write tools are revision-protected and audited
- [ ] Agents can reliably detect new tasks in a watched board without duplicate execution
- [ ] Agents can move completed tasks into human-review boards programmatically
- [ ] Handshake, auth, read, and write flows are covered by tests
