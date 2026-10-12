# 03 — Keep settings content and actions within the viewport

**What to build:** Writers can inspect all default settings, edit custom YAML, and reach Cancel/OK without an oversized dialog extending beyond the screen.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

**Implementation status:** Complete

- [x] Custom and Default settings dialogs remain bounded by the available desktop/mobile viewport in both themes, including reduced height.
- [x] Long YAML and validation messages scroll within the dialog; tabs and Cancel/OK remain reachable throughout, without page-level horizontal overflow.
- [x] Every default setting remains inspectable and read-only; switching tabs preserves unsaved custom edits.
- [x] Valid custom YAML saves and is present when settings reopen; Cancel leaves persisted settings unchanged.
- [x] Invalid YAML displays a readable, reachable error and cannot be saved; correcting it restores successful saving.
- [x] Pointer and keyboard users can operate tabs, scroll content, and activate dialog actions with visible focus.
- [x] Focused production browser verification reproduces the full-default-settings overflow and proves bounded content, accessible actions, and retained save/cancel behavior.
