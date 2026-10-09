# 04 — Preserve offline installation and updates with Workbox

**What to build:** Users can install StackEdit from its static site and continue using it offline after the first successful load.

**Blocked by:** 02 — Build the static app on Node 24 with supported tooling.

**Status:** ready-for-agent
**Implementation status:** complete

- [x] The production static artifact includes a Workbox service worker configured for the deployment path.
- [x] After the app has loaded once, the editor and its cached assets are available offline.
- [x] Service worker updates activate safely and preserve the local workspace.
- [x] The obsolete offline plugin and AppCache behavior are removed.
