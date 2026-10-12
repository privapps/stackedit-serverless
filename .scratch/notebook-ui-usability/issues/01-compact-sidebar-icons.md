# 01 — Restore compact sidebar navigation icons

**What to build:** Notebook users can scan and activate compact, consistently aligned right sidebar entries across the main menu and remaining submenus, without oversized icons pushing actions out of view.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

**Implementation status:** Complete

- [x] Icons render within the established 20 × 20 CSS-pixel area, alongside labels rather than inside their text flow.
- [x] Main menu, Import/export export actions, Workspaces, and Workspace backups are checked; correctly sized import icons remain consistent.
- [x] Row height follows its label/description content; a short label does not create a roughly 244-pixel row.
- [x] Labels, descriptions, and bottom entries remain readable and reachable without horizontal overflow on desktop and mobile in both themes.
- [x] Pointer and existing keyboard activation still open representative submenu, settings, and export workflows; usable activation targets do not shrink to the icon size.
- [x] Focused production browser checks reproduce the previous oversized-icon failure and verify the rendered dimensions and navigation behavior.
