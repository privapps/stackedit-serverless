# Remediation revalidation — 2026-10-09

**Recorded:** 2026-10-09T08:17:41Z
**Canonical specification:** `spec.md`
**Original independent report:** `validation.md` (historical findings retained; the current full-state result is at the top and end of that file)

## Result

**PASS for the four concrete failures recorded in `validation.md`.** This is a focused remediation record, not a replacement independent full-spec review. The original report's inconclusive backup criteria 01.10 and 01.12 were not re-evaluated.

## Revalidated failures

- **F1 — Greek case-insensitive matching / first occurrence (02.04, 03.07): PASS.** Case folding now normalizes Greek final sigma in both query and source text while retaining source offsets in synchronous and cooperative matching. The service regression verifies exact `ΟΣ` matching and a first offset of 0 despite a later `ος` occurrence. Browser smoke verifies the highlighted snippet and selected editor text are the first uppercase occurrence. Evidence: `src/services/workspaceSearchSvc.js:9,34–65`, `test/unit/specs/workspace-search.spec.js:182–202`, `test/browser-smoke.cjs:433,564–574`.
- **F2 — Stale activation after asynchronous loading (03.09): PASS.** Activation now reloads the live file record and checks Trash/Temp scope after content loading and before committing. It checks again after the editor wait before selecting. Component regressions cover removal and Trash movement during deferred loading, plus movement during the editor wait. Evidence: `src/components/WorkspaceSearchPanel.vue:225–249,272–285`, `test/unit/specs/components/WorkspaceSearchPanel.spec.js:126–209`.
- **F3 — Escape after focus moves to the editor (02.03, 03.11): PASS.** A capture-phase window listener handles Escape while the panel is mounted; close and destruction remove it. Unit coverage dispatches Escape from the focused editor. Browser smoke activates a result, confirms editor focus, presses Escape, confirms the panel closes, and reopens it for subsequent checks. Evidence: `src/components/WorkspaceSearchPanel.vue:182–193,289–306`, `test/unit/specs/components/WorkspaceSearchPanel.spec.js:211–247`, `test/browser-smoke.cjs:555–563`.
- **F4 — Highlighted-snippet documentation (03.16): PASS.** README now says search results show highlighted matching names and context snippets. Evidence: `README.md:19`.

## Checks

- Focused Greek service test: passed.
- Focused stale-load, stale-editor-wait, and Escape component tests: 4 passed.
- `npm test`: exit 0; 13 test files and 88 tests passed. ESLint reported 0 errors and 2,472 warnings.
- `npm run build`: exit 0; production webpack compilation completed with 17 warnings, including Sass deprecations and bundle-size warnings.
- `npm run browser-smoke`: exit 0; production browser smoke passed, including the added Greek first-match and Escape-after-activation checks.
- `git diff --check` on the modified source, tests, README, and this record: passed.

The ignored pre-remediation `dist` directory was preserved at `/tmp/stackedit-serverless-dist-backup-20261009`; browser smoke ran against the newly generated production bundle.
