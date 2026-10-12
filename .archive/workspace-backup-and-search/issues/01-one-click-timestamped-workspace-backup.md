# 01 — One-click workspace backup with local timestamps

**What to build:** Let users export the current workspace directly from the explorer header or the existing backup menu, producing the same compatible JSON backup with a useful local date/time filename. This is a complete backup workflow, including actual download behavior and restore compatibility.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

**Implementation status:** Complete

- [x] Add an icon button immediately left of Close explorer, with the tooltip and accessible name Export workspace backup. Preserve the order and behavior of the existing explorer controls.
- [x] The new button supports normal pointer and keyboard activation, and the existing Export workspace backup menu entry remains available.
- [x] Both entry points use one shared export operation. Extract the existing export behavior into the backup abstraction as part of this ticket rather than duplicating it.
- [x] Capture the current workspace when export starts and keep the resulting snapshot scoped to that workspace, even if the user subsequently changes workspaces.
- [x] An export triggered immediately after editing includes the latest document edits; it does not depend on waiting for the periodic persistence cycle.
- [x] Preserve the existing JSON backup structure and workspace-record coverage, including records outside the active-document search scope. No backup schema or import behavior changes are introduced.
- [x] Both entry points suggest exactly `StackEdit_Workspace_<YYYYMMDD-HHmm>.json`, using one captured browser-local timestamp, zero-padded calendar components, a 24-hour clock, and minute precision.
- [x] Do not add seconds, workspace names, timezone suffixes, or application-generated collision suffixes. Exports within the same minute retain the same suggested filename and ordinary browser conflict handling.
- [x] Export works offline and does not transmit workspace data. Database or export failures use the existing error-notification conventions and do not produce a success-shaped incomplete backup.
- [x] Browser acceptance coverage activates each entry point and inspects real download filenames and JSON bytes. A fixed local clock and identical snapshot yield the exact expected filename and equivalent payloads.
- [x] Focused filename coverage includes zero-padding, minute precision, a local-versus-UTC difference, and a local date boundary.
- [x] Restore an exported backup through the existing import workflow and verify document names, folder placement, and content, including an edit made immediately before export.
- [x] Existing explorer actions and old-format backup imports continue working, and export does not alter document text.
- [x] Update the directly related user documentation with the shortcut and filename format. Reuse existing test boundaries; do not add production-only test hooks or unrelated persistence refactoring.

## Comments

- Revalidated on 2026-10-09 after the lifecycle audit. `npm test` passes with 83 tests and lint reports 0 errors; `npm run build` and `npm run browser-smoke` pass. The browser comparison ignores IndexedDB transaction counters and content-state hashes that can advance during a pending local save, while comparing the exported workspace records.
- Full current-state validation on 2026-10-09 passed. Browser smoke now separates the immediate unsaved-edit export from a stable same-snapshot comparison of both entry points and deep-compares every JSON field; the restore flow verifies the immediate edit survives import. Focused tests also cover workspace changes during a pending export and database/download failures.
