# 02 — Make workspace search readable and responsive

**What to build:** Users can read search controls and results, navigate recognizable documents, and keep the selected content match visible through a deliberate desktop/mobile search layout.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

**Implementation status:** Complete

- [x] Query, options, actions, close icon, result names, paths, snippets, status messages, and errors are readable in light and dark themes.
- [x] Enabled default/hover/focus text, including muted text and highlighted matches after opacity composition, meets 4.5:1 contrast; essential icons and visible focus indicators meet 3:1 against adjacent colors.
- [x] Result names, paths, and snippets retain their source case and clear visual hierarchy instead of inheriting uppercase button typography.
- [x] Desktop search does not obscure usable right sidebar controls, including when the sidebar is already open.
- [x] At 390 × 844 and reduced viewport height, search fits the viewport without horizontal overflow; query, actions, close control, and every result remain reachable.
- [x] Many results scroll within a bounded area; long names, nested paths, and snippets wrap without breaking the panel or hiding controls.
- [x] Pointer and keyboard activation of content results opens the correct document, focuses the editor, selects/reveals the first match, and keeps search open without covering the match on desktop or mobile, including short-line and long-line fixtures.
- [x] Reset restores existing defaults; both Close controls and Escape dismiss search, including Escape after focus moves to the editor.
- [x] Initial, searching, populated, no-result, invalid-option, and failure states receive visible-state checks; keyboard focus remains visible without trapping focus away from the editor.
- [x] Existing local search behavior remains covered: unloaded documents and current edits, nested folders, current-workspace isolation, Trash/Temp exclusions, case-sensitive and Unicode matching, safe snippet text, stale results, and offline search.
- [x] Focused production browser checks and ego-browser screenshots verify layout, contrast, result presentation, and navigation in both viewport sizes and themes.
