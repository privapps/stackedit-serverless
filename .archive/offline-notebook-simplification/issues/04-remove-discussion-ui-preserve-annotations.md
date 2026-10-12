# 04 — Edit without discussion gutters while preserving annotations

**What to build:** Users write in an uncluttered editor and preview while old comment contents remain recoverable as inactive document metadata.

**Blocked by:** 01 — Preserve document serialization independently of providers.

**Status:** ready-for-agent
**Implementation status:** implemented (independent validation pending)

- [x] New discussion, reply, delete-comment, avatar, gutter, and discussion highlighting controls are absent from editor and preview.
- [x] Discussion state, marker relocation, hover/click behavior, and discussion-specific layout calculations are removed from active editing.
- [x] Existing archived comments/discussions remain present in document data and supported exports/imports without remote user lookups.
- [x] Archived offsets retain their original values and are treated as archival metadata rather than maintained anchors.
- [x] Typing, formatting, selection, preview, undo/redo, search navigation, and layout resizing retain their current behavior.
- [x] No annotation removal occurs simply from opening, editing, exporting, or upgrading a note.
- [x] Browser/public-interface regressions cover annotated legacy notes and retained editing behavior.

## Comments
