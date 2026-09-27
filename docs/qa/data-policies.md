# Data policies verification — 2026-09-25

Task: task-1b97b79c-42f5-4cab-99ca-c73f5bce498f (Edgar).

Implemented under Settings → Local data & backup → Data policies:
- Separate age/count settings for session/turn history, events, notifications and summaries; reset-to-defaults remains a draft until confirmed.
- Automatic maintenance preference, effective policy, database/WAL/free bytes, category/protected estimates, versions, maintenance timestamps, queue metrics and redacted errors.
- Main-process previews with category counts, protection and approximate bytes; policy version/expiry checks; compact explicitly deletes zero history rows.
- Immediate operation IDs with duplicate request reuse, bounded pruning, visible progress/failure/deferral and cancellation between commits.

Policy authority is the versioned main-process JSON preference `omvra.agentWorkPolicy.v1`. It is loaded on repository startup. Renderer generic store writes and JSON imports cannot apply policy changes without preview/confirmation. Workspace-only backups omit policy and history, and restoration leaves the local policy unchanged.

## Results

| Check | Result |
| --- | --- |
| Workspace contracts | 356 main-process + 58 renderer/store/hook/supervisor checks passed; 2 existing skips |
| Local Electron repository + maintenance | 18 passed, including actual idle compaction and automatic-off regression |
| Final targeted maintenance + integration | 10 passed |
| Production renderer build | Passed; existing large-chunk warning |
| Isolated Electron UI | Passed all nine assertions listed below; clean exit |
| git diff --check | Passed |
| Full TypeScript check | Existing errors outside this change remain; no errors reported in DataPoliciesSettings, SettingsPanel or agent-work declarations |

The Electron UI harness uses the real component, preload, IPC handlers, maintenance coordinator and SQLite worker with temporary data. It verifies associated labels, dialog keyboard focus/Escape, protected previews, zero-deletion compaction, cancellation, prune preservation of active and interrupted snapshots, stale confirmation refresh, and saved policy. Run `npm run test:data-policies-ui`. A GUI-capable host is required; the sandbox launch aborted before startup, and the authorized isolated desktop run passed. No user's workspace was opened, no real provider was launched, and no live history was pruned. A temporary screenshot is emitted by the harness for visual inspection.

The backend tests also verify concurrent duplicate admission, repeat confirmation receipts, invalid/stale requests, policy persistence on reopen, non-mutating previews, <=200-row pruning batches, event-loop heartbeats while pruning, active snapshot/source revision preservation, protected compaction deferral, generic-store bypass rejection and shutdown cancellation. Test code is retained in `electron/services/agent-work-maintenance.test.cjs`.

## Limits

- Estimates are approximate; protected counts can exceed retention targets. Compaction may defer while work/recovery is live, storage is busy, the idle interval is incomplete or fragmentation is below threshold.
- Cancelling stops this manual operation between batches; already committed deletions remain. Automatic maintenance, if enabled, continues to follow the saved policy.
- Fixture keyboard/DOM checks and visual inspection do not claim a full screen-reader audit, signed-package acceptance or sustained provider-stream latency measurement.
- Coordinated SQLite history backup/restore, other privacy/runtime/date QA findings, delivery/burst acceptance and packaged cross-platform verification remain separate.
- Changes remain uncommitted alongside existing workspace edits.

## QA rerun

The broader SQLite QA rerun reproduced a timing race in the isolated cancellation check: a small prune could complete while the harness was still clicking, or the button was present but disabled during admission. The retained harness now waits for an enabled Cancel control and holds one real completed database batch until cancellation is requested. The hold is test-only and makes the cancellation assertion deterministic; it does not claim real provider-stream latency. All nine isolated Electron checks pass again. No product logic was changed during this QA recheck.
