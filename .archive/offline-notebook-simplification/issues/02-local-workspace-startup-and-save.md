# 02 — Open existing workspaces and save locally

**What to build:** Users open their existing local notebooks and receive trustworthy local save status without cloud initialization or a server configuration request.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent
**Implementation status:** implemented (independent validation pending)

- [x] The application initializes the Main workspace and IndexedDB without selecting a cloud provider or fetching server configuration.
- [x] Existing locally stored provider-associated workspaces remain selectable, renameable, and removable through local controls, using their existing IDs and database names.
- [x] Legacy URLs resolve existing local copies without connecting to a provider; absent local copies receive a clear outcome without creating an empty substitute or silently opening unrelated notes.
- [x] Local autosave and content loading/unloading remain active; status indicates saving, completed transaction persistence, or failure accurately.
- [x] Failed persistence keeps in-memory edits available and does not display a successful save.
- [x] Existing cross-tab local changes and workspace isolation remain correct without relying on cloud sync timers.
- [x] Embedded/light startup, its parent messaging protocol, and Temp behavior remain functional.
- [x] Isolated database/browser regressions cover old databases, online/offline startup, two tabs, workspace switching, and save failures.

## Comments
