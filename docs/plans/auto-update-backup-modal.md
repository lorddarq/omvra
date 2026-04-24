# Cross-Platform Auto Update With Backup-Aware Modal

## Summary

Add an `electron-updater` based update flow for macOS, Windows, and Linux. Plumy will show a custom React modal for update availability, download progress, and install readiness. Stable users receive stable releases only; users can opt into RC updates from preferences. Before installing RC updates, the modal requires a successful workspace backup export. Stable updates will still offer backup export, but installation will not be blocked.

## Key Changes

- Add `electron-updater` and configure `electron-builder` publishing for GitHub Releases.
- Update packaging targets:
  - macOS: keep `dmg`, add `zip` for updater metadata.
  - Windows: keep `nsis`.
  - Linux: keep `AppImage` and enable AppImage updater metadata.
- Update release workflow to upload updater metadata files:
  - `latest.yml`
  - `latest-mac.yml`
  - `latest-linux.yml`
  - macOS `.zip`
  - existing installers/artifacts.
- Mark releases with prerelease status when tag contains an RC suffix like `v1.2.3-rc.1`.
- Add a user preference for update channel:
  - `stable` by default.
  - `rc` when explicitly opted in.

## Implementation Changes

- Main process owns updater logic in `electron/main.cjs`:
  - check for updates only when `app.isPackaged`.
  - expose IPC methods: check, download, install, dismiss, get state, set channel.
  - emit update events to renderer: checking, available, not available, progress, downloaded, error.
- Preload exposes a small safe update bridge under `window.electron.updates`.
- Renderer adds a custom `UpdateModal`:
  - shows version, channel, release notes when available, progress, and errors.
  - stable update: buttons for `Export backup`, `Download`, `Later`, `Restart and install`.
  - RC update: `Restart and install` remains disabled until backup export succeeds.
- Reuse the existing workspace backup payload builder from `App.tsx` so update backups match the current Preferences export format.
- Add a shared backup-export function/hook so both Preferences and the update modal use the same export code path.
- Add update channel control to Preferences:
  - default `Stable releases`.
  - optional `Release candidates`.
  - changing channel persists to existing app preferences storage.

## Test Plan

- Unit/component tests:
  - backup export helper produces the same schema as the existing Preferences export.
  - update modal disables RC install until backup export success.
  - stable update allows install without backup but still offers export.
  - channel preference persists and maps to updater channel.
- Main/preload tests:
  - IPC update bridge exposes only intended methods.
  - updater events are forwarded with sanitized payloads.
  - updater is inactive in dev/unpackaged mode.
- Manual release validation:
  - install stable version, create workspace data, update to newer stable, confirm data remains.
  - opt into RC, receive `vX.Y.Z-rc.N`, export backup, install, confirm data remains.
  - verify macOS, Windows, and Linux AppImage each receive update metadata from GitHub Releases.
  - verify users on stable do not receive RC releases unless opted in.

## Assumptions

- Use `electron-updater`, not direct Sparkle or Squirrel integration.
- GitHub Releases remain the update provider.
- Linux support means AppImage in-app updates first, matching the current packaging target.
- RC updates require backup before install; stable updates only recommend backup.
- Existing `appId` and `productName` remain unchanged so local data paths stay stable.
- macOS auto-update requires signed/notarized builds before production rollout.

