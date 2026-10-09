# 06 — Clear all remaining npm audit findings

**What to build:** Maintainers can install the complete application dependency graph without known npm audit vulnerabilities.

**Blocked by:**

- 01 — Remove server-only and unsafe release paths
- 02 — Build the static app on Node 24 with supported tooling
- 03 — Keep editor workflows running on Vue 3 compatibility mode
- 04 — Preserve offline installation and updates with Workbox
- 05 — Protect preview and import/export HTML with a maintained sanitizer

**Status:** ready-for-agent
**Implementation status:** complete

- [x] Runtime and development dependencies resolve to supported versions with no `npm audit` findings at any severity.
- [x] Direct and transitive dependencies are covered by the audit result.
- [x] Known findings are not suppressed through an allowlist or audit exception.
- [x] A clean Node 24 `npm ci` install and production build succeed with the refreshed lockfile.

## Implementation notes

- Updated the runtime dependency stack, migrated the YAML and Markdown-It APIs, initialized the new IndexedDB shim explicitly, and upgraded ESLint to its supported major.
- Replaced the Gulp postinstall with a Node script and removed the vulnerable Stylelint/webpack-dev-server chain. `npm start` now runs webpack in watch mode and serves the output with history fallback and live reload; ESLint and the production Sass compilation remain the lint/syntax checks.
- Moved web-app manifest generation to the existing Favicons plugin, removing the legacy Jimp dependency path. Mermaid uses the maintained KaTeX override, and Workbox resolves glob 13.

## Verification

- `npm ci` — passed on Node 24.
- `npm audit --audit-level=low` — 0 vulnerabilities.
- `npm test` — passed; 9 test files and 62 tests.
- `npm run build` — passed, including Workbox and Sass compilation.
