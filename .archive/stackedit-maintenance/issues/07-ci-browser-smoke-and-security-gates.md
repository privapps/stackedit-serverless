# 07 — Verify static workflows and enforce the CI gate

**What to build:** Maintainers receive a reliable CI result for the built static app, its key user workflows, and the complete dependency security audit.

**Blocked by:**

- 03 — Keep editor workflows running on Vue 3 compatibility mode
- 04 — Preserve offline installation and updates with Workbox
- 05 — Protect preview and import/export HTML with a maintained sanitizer
- 06 — Clear all remaining npm audit findings

**Status:** ready-for-agent
**Implementation status:** complete

- [x] CI runs on Node 24 and installs dependencies with `npm ci`.
- [x] CI runs lint, unit and component tests, production build, browser smoke, and the full npm audit.
- [x] Browser smoke covers editing, reload persistence, Markdown and HTML import/export, workspace backup restore, and offline reload against the built static artifact.
- [x] Browser behavior checks confirm malicious document content cannot execute scripts or unsafe links.
- [x] Any failing check or npm audit finding fails CI.

## Implementation notes

- The browser smoke exposed and fixed IndexedDB persistence of nested Vuex values, HTML-export modal cleanup under Vue 3, UTF-8 backup imports with a byte-order mark, and offline startup when the vendor bundle exceeded the prior Workbox precache size limit.
- CI uploads the verified `dist/` artifact and deploys that artifact only after all checks pass on a push to `main`.

## Verification

- `npm test` — passed (11 test files, 65 tests).
- `npm run build` — passed.
- `npm run browser-smoke` — passed at `/docs/app/`, including offline reload and malicious Markdown/HTML checks.
- `npm audit --audit-level=low` — 0 vulnerabilities.
