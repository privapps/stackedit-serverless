# 05 — Remove external integrations and account workflows

**What to build:** Users encounter a complete local notebook interface with no account, cloud, publishing, remote-history, or payment workflows, even when old integration state exists.

**Blocked by:** 02 — Open existing workspaces and save locally; 03 — Export fixed HTML and print without templates or servers; 04 — Edit without discussion gutters while preserving annotations.

**Status:** ready-for-agent
**Implementation status:** implemented (independent validation pending)

- [x] Provider/account, OAuth, cloud sync, publishing, Google Photos, CouchDB connection, remote history, sponsorship, and payment controls and operations are removed.
- [x] Navigation, menus, modal registration, icons, shortcuts, and active settings expose supported local workflows without obsolete integration counts or messages.
- [x] Provider adapters/helpers/registry, cloud retries/locks/queues, and account/user lookup code are removed once supported workflows no longer consume them.
- [x] Ordinary link and image URL insertion remains functional.
- [x] Legacy tokens, integration preferences, sync/publish locations, and provider URL parameters cannot activate a removed feature or trigger a network request.
- [x] Stored credentials are not emitted in normal workspace backups, displayed, or used; the update does not introduce automatic credential deletion.
- [x] Local workspace startup, persistence, fixed exports, and editing remain functional after the provider directory is removed.
- [x] Seeded legacy-state browser checks confirm no integration/backend request during startup, reconnect, file activation, menus, or exports.

## Comments
