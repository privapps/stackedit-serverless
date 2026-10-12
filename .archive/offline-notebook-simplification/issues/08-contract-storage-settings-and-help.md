# 08 — Finish compatibility storage and describe the local notebook

**What to build:** Users upgrade existing notebooks safely and see documentation and controls matching the simplified product; maintainers get the completed removal of obsolete shared machinery.

**Blocked by:** 05 — Remove external integrations and account workflows; 06 — Keep music notation source as ordinary code; 07 — Remove badges and achievement bookkeeping.

**Status:** ready-for-agent
**Implementation status:** implemented (independent validation pending)

- [x] Active state/settings retain only supported behavior; legacy record types needed for read/export compatibility use a minimal inert representation.
- [x] Existing workspace snapshots retain archived templates, sync/publish records, history, supported document metadata, and other existing records without reactivating removed code.
- [x] Supported old backup import continues restoring v4/v5 notes/folders/properties/annotations, including leading byte-order marks; it does not claim full cloud/global-state restoration.
- [x] Timestamped backups retain immediate in-memory edits, unopened content, complete stable payload equality, initiating-workspace isolation, and Trash/Temp inclusion.
- [x] Removed-feature preferences are tolerated without errors or execution, while new defaults omit obsolete settings; existing Trash/Temp retention behavior is preserved.
- [x] Temporary forwarding interfaces and unused code, dependencies, icons, landing media, defaults, and assets are removed after all consumers have migrated.
- [x] Welcome/help, menus, landing content, and README accurately describe local saving, search, backup, fixed HTML export, printing, and removed features.
- [x] Local editing/undo diff support, HTML sanitization, diagrams/math, search, backups, and embedded/light behavior retain necessary implementations and dependencies.
- [x] Compatibility regressions compare supported payloads and demonstrate old-workspace upgrade, backup round trips, removed-state tolerance, and fixed export.

## Comments
