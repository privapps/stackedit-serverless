# Production validation

Date: 2026-10-10  
Result: **PASS** for the production and automated acceptance audit. The operating-system Print / Save as PDF dialog was not manually opened; browser print invocation, print layout, and PDF generation were verified separately below.

## Validation runs

- `npm test` — PASS: ESLint reported 0 errors and 1,060 warnings; Vitest passed 16 files and 108 tests. The lint command accepts these warnings; they were not compared with a baseline lint run.
- `npm run build` — PASS: production static build completed. Webpack reported 78 warnings in the application build and 17 in the stylesheet build, including Sass deprecations and bundle-size recommendations; there were no build errors.
- `npm run browser-smoke` — PASS against the built application under `/docs/app`. Coverage includes local editing and save status, find/replace, workspace search and navigation, folder/file operations, Markdown/HTML import and export, offline HTML, print, backups and restore, Main and former-provider workspaces, workspace rename/removal, legacy state, cross-tab persistence, service-worker update/offline reload, no-integration requests, and embedded/light messaging with Temp storage.
- `npm audit --audit-level=low` — PASS: 0 vulnerabilities.
- `node --check test/browser-smoke.cjs` and `git diff --check` — PASS.

The browser print check confirms the Print action invokes `window.print`, print media leaves document content visible, and Chromium produces a PDF beginning with `%PDF-` larger than 1,000 bytes. The native operating-system print dialog and its Save as PDF flow remain a manual acceptance check and were not exercised in this run.

## Before/after measurements

Measurements use all files below `src/`, all files in the production `dist/`, and the non-source-map JavaScript files in `dist/static/js/`. Source lines are newline counts. The comparison uses the archived baseline checkout at `/tmp/stackedit-offline-baseline-20261010`.

| Measure | Baseline | Simplified build |
| --- | ---: | ---: |
| Source files | 290 | 180 |
| Source lines | 35,305 | 21,077 |
| Source bytes | 2,267,506 | 1,808,384 |
| Production artifact bytes | 43,966,557 | 39,946,398 |
| Main JavaScript bytes (without maps) | 7,476,325 | 6,677,062 |
| Runtime dependencies | 31 | 28 |
| Development dependencies | 46 | 46 |
| Lockfile package entries | 1,174 | 1,167 |

These are measurements, not a target or a claim that all size reductions represent runtime savings. The validated build output was kept separate from the pre-existing ignored `dist`; the original `dist` was restored after browser validation.

## User-story audit

The story numbers below follow `spec.md`; every story is accounted for by the listed production, unit, browser, documentation, or source evidence.

| Stories | Evidence and result |
| --- | --- |
| 1–10 | PASS — isolated browser fixtures verify Main startup, opening and isolating former-provider local copies, clear missing-copy behavior, workspace rename/removal, local autosave, cross-tab reload persistence, and local workspace isolation. `workspace-startup.spec.js` and `workspace-persistence.spec.js` cover selection, existing databases, save acknowledgement, and transaction failure recovery. |
| 11–16 | PASS — retained editing and preview are covered by `editor-workflows.spec.js`, `ButtonBar.spec.js`, and `NavigationBar.spec.js`; the production smoke exercises normal edits, preview, layout controls, and Mermaid/math rendering. Source inspection confirms tables, task lists, footnotes, code highlighting, themes, and shortcut support remain configured. |
| 17–19 | PASS — the browser smoke exercises find/replace, nested workspace search, result highlighting/navigation, and stale-result handling; `workspace-search.spec.js` and `WorkspaceSearchPanel.spec.js` cover unloaded content, ordering, Unicode matching, cancellation, and isolation. |
| 20–22 | PASS — browser import/edit/export covers Markdown metadata round-trips and sanitized HTML import/export; `document-serialization.spec.js` covers Unicode, missing metadata, and malformed metadata. |
| 23–25 | PASS — browser checks fixed styled HTML, optional TOC, escaping, packaged styles/assets, offline rendering away from the application, and print layout/PDF generation. The OS print dialog limitation is recorded above. |
| 26–28 | PASS — browser checks timestamped workspace backups, immediate edits, unopened records, stable payload equality, Trash/Temp inclusion, nested-folder restore, and offline backup. `backup.spec.js` covers BOM and v4 import, snapshot isolation, and failure outcomes. |
| 29–30 | PASS — Main and former-provider database fixtures retain file/folder IDs, local contents, archived discussion/comment offsets, history, and inactive sync/publish/template records. Markdown export preserves supported annotation metadata; the fixtures confirm archived template helpers do not execute. |
| 31–32 | PASS — menu assertions contain no account, sync, publish, or remote-history controls; image URL insertion works without Google Photos controls. |
| 33–34 | PASS — ABC source remains an ordinary code fence beside retained Mermaid/math output; `abc-legacy-properties.spec.js` and `html-sanitization.spec.js` cover legacy settings and executable-markup removal. |
| 35–36 | PASS — seeded legacy credentials, server settings, URL parameters, and ABC preferences do not reactivate removed behavior; README, welcome, FAQ, menus, and landing copy describe local saving, search, backup, export, and printing. |
| 37–38 | PASS — request assertions find no provider/backend requests during startup, legacy workspace access, menus, export, or embedded editing. Source/dependency inspection confirms removed integration, discussion, music, badge, template, and conversion machinery/assets, while sanitizer, diff, diagram, math, search, and backup support remain. |

## Implementation-decision audit

| Decisions in `spec.md` | Evidence and result |
| --- | --- |
| Static hosting, existing origin/base path, manifest, service-worker scope/update lifecycle (1) | PASS — production build and nested `/docs/app` smoke verify manifest start/scope, service-worker installation, waiting update activation without reloading an edited tab, and offline reload. |
| Serialization separation and local workspace IDs/databases; legacy URLs and missing-copy behavior (2–4) | PASS — public serialization unit tests and Main/provider-associated IndexedDB fixtures verify existing IDs, contents, hierarchy, and no replacement database or provider reconnect. |
| Autosave, local coordination, transaction status/failure, workspace isolation (5–6) | PASS — persistence unit tests verify transaction completion and retry after failure; browser smoke verifies save status, two-tab persistence, and workspace isolation. |
| Provider removal while retaining ordinary links/image URLs (7) | PASS — source scan and request assertions show no active provider/backend calls; image URL insertion remains available. |
| Discussion UI removal with archival annotations retained (8) | PASS — no discussion controls/gutters appear; stored annotation values and original offsets survive open, edit, import, backup, and export checks. |
| Inert legacy records, templates, and credentials (9–10) | PASS — workspace snapshots preserve template, sync, and publish records; helper payloads remain inert; local credentials are retained but excluded from backups and never sent. |
| Supported v4/v5 backup import scope and BOM handling (11) | PASS — `backup.spec.js` covers v4 and BOM imports; browser restore verifies notes, nested folders, properties, and annotations. No claim is made for cloud state, credentials, or global preferences. |
| Snapshot integrity and filename behavior (12) | PASS — browser and unit tests verify immediate edits, unopened content, complete stable exports, initiating-workspace isolation, Trash/Temp inclusion, and browser-local timestamps. |
| Fixed HTML, packaged offline rendering, diagrams/math, no executable helpers; removal of template/conversion machinery (13–14) | PASS — downloaded output is opened from a local file in an offline browser context; styles, fonts, TOC, headings, SVG, and KaTeX are present; unsafe markup and helper execution are absent. Print CSS and PDF output are verified. |
| ABC removal with source preservation and retained Markdown features (15) | PASS — dependency/source inspection plus browser and unit regressions confirm ABC fences remain code while Mermaid and math render. |
| Badge bookkeeping removal (16) | PASS — source scan finds no active badge/seal code; `ExplorerNode.spec.js` confirms a legacy `badgeCreations` record remains untouched and is not loaded into active state during ordinary file creation. |
| Obsolete settings tolerance and retired sync shortcut behavior (17) | PASS — legacy settings are tolerated; menus and shortcuts expose supported local behavior, with normal browser Save retained. |
| Embedded/light protocol and Temp behavior (18) | PASS — browser host receives `ready`, `fileChange`, and `close`; edited content remains in Temp without external requests. |
| Remove unused machinery while retaining sanitizer, diff, and supported dependencies; complete staged tickets (19–21) | PASS — lint/unit/build/audit/source measurements and the ticket-by-ticket regression suite pass; source checks confirm required local support remains. |

The operating-system PDF dialog is the only manual acceptance item not exercised. No deployed application site was used; the browser harness exercised the built artifact on owned local HTTP servers.

## Validation — 2026-10-10T09:13:13Z

**Feature:** offline-notebook-simplification
**Status:** FAIL
**Spec:** `.scratch/offline-notebook-simplification/spec.md`
**Tickets:** 9 checked; 65 checklist criteria reviewed

### Acceptance criteria

- PASS — Tickets 01–07 and 09 were independently reviewed against their checklists and the spec; the reviewer found supporting implementation and regression evidence across serialization, local startup/persistence, fixed exports, retained annotations, integration/music/badge removal, production browser workflows, and documented baseline measurements.
- FAIL — Ticket 08 requires unused code to be removed. `build/webpack.prod.conf.js:45-46` still excludes a `template-worker` chunk from `splitChunks`, although the worker is gone. This stale production-build exception is the sole concrete acceptance miss.
- PASS — All nine ticket triage values are valid `ready-for-agent` values; blocker references resolve and form an acyclic dependency graph.
- PASS — The resolved local spec has an explicit Acceptance Criteria section and links all nine implementation tickets.

### Repository checks

- PASS — `npm test` — ESLint: 0 errors, 1,060 warnings; Vitest: 17 files, 110 tests.
- PASS — `npm run build` — production application and stylesheet builds completed with Sass deprecation and bundle-size warnings.
- PASS — `npm run browser-smoke` — passed against the rebuilt production artifact at `/` and `/docs/app`; included workspace, editing, import/export, offline HTML, print/PDF, backup, legacy-state, network, service-worker, and embedded Temp coverage.
- PASS — `npm audit --audit-level=low` — 0 vulnerabilities.
- PASS — `node --check test/browser-smoke.cjs`.
- PASS — `git diff --check -- .` — tracked worktree changes.

### Limitations

- The native OS Print / Save as PDF dialog was not opened; browser print invocation, layout, and PDF generation were verified.
- No deployed site was tested; browser acceptance used owned local HTTP servers.
- The fresh measurements differed slightly from the earlier report: source bytes 1,808,500; production artifact bytes 39,946,424; main JavaScript bytes 6,677,178. Other baseline counts and dependency totals matched.
- `npm run build` regenerated ignored `dist/`; no source or workflow files were edited during review. The original ignored build remains backed up at `/tmp/stackedit-dist-backup-20261010-offline-notebook/dist`.

## Validation — 2026-10-10T09:20:09Z

**Feature:** `offline-notebook-simplification`  
**Status:** FAIL  
**Spec:** `.scratch/offline-notebook-simplification/spec.md`  
**Tickets:** 9 checked; 65 checklist criteria reviewed

### Workflow metadata and spec

All nine tickets have canonical `ready-for-agent` triage labels and `implemented (independent validation pending)` implementation statuses. Their blocker references resolve and form an acyclic graph: 03 and 04 depend on 01; 05 depends on 02, 03, and 04; 08 depends on 05, 06, and 07; 09 depends on 08. The status values match [triage-labels.md](docs/agents/triage-labels.md).

The selected local spec has an explicit `Acceptance Criteria` section linking all nine tickets. I read the full spec, ticket files, current `validation.md` including the preserved first independent FAIL, and inspected the relevant implementation, tests, build configuration, and documentation. The reported repair is present: the production splitChunks exclusion is gone from `build/webpack.prod.conf.js`, and `test/unit/jest.conf.js` plus `test/unit/mocks/templateWorkerMock.js` are deleted with no active references.

### Ticket acceptance evidence

- **01 — Preserve document serialization:** PASS for criteria 1–5. Import/export uses `documentSerializationSvc` through [ImportExportMenu.vue](src/components/menus/ImportExportMenu.vue:41); serialization retains properties, discussions, comments, and history in [documentSerializationSvc.js](src/services/documentSerializationSvc.js:10). Public tests cover Unicode round trips, absent metadata, and malformed trailers in [document-serialization.spec.js](test/unit/specs/document-serialization.spec.js:4); the browser smoke verifies import, edit, and metadata export at `test/browser-smoke.cjs:1183-1269`.

- **02 — Local workspace startup and save:** PASS for criteria 1–8. [App.vue](src/components/App.vue:55) selects an existing local workspace and initializes IndexedDB without server configuration; [workspaceSvc.js](src/services/workspaceSvc.js:57) resolves Main, explicit local IDs, and legacy provider URLs only when their records exist. [localDbSvc.js](src/services/localDbSvc.js:109) checks for an existing database without creating a missing one, and save status follows transaction outcomes. Unit tests cover old databases, missing-database checks, persisted metadata, and failed-write recovery in [workspace-persistence.spec.js](test/unit/specs/workspace-persistence.spec.js:118). Browser evidence covers missing and existing provider-associated workspaces, rename/removal, two-tab writes, and workspace isolation at `test/browser-smoke.cjs:694-1084`.

- **03 — Fixed HTML export and browser print:** PASS for criteria 1–8. [exportSvc.js](src/services/exportSvc.js:139) renders sanitized fixed HTML, optional TOC, and embedded styles/assets; [HtmlExportModal.vue](src/components/modals/HtmlExportModal.vue:2) exposes copy and download without a template selector. The browser smoke checks offline rendering and print styling at `test/browser-smoke.cjs:474-521`, fixed export, TOC, escaped titles, diagram/math output, `window.print`, and generated PDF at `test/browser-smoke.cjs:1580-1651`. Removed converter dependencies and features are absent from `package.json`; the splitChunks exception repair is verified. The native OS Print / Save as PDF dialog was not opened.

- **04 — Remove discussion UI, preserve annotations:** PASS for criteria 1–7. Discussion gutter components and active discussion service/store are deleted; remaining editor and preview components contain no discussion controls. Document metadata preservation is covered by `document-serialization.spec.js:4-58` and the browser assertions for archived annotations and absent gutters at `test/browser-smoke.cjs:1183-1217`, `1262-1269`, and `743-818`. Editing, formatting, undo/redo, preview, layout resizing, and search navigation are covered by browser smoke at `test/browser-smoke.cjs:655-690`, `1162-1180`, and `1402-1438`.

- **05 — Remove external integrations and accounts:** PASS for criteria 1–8. Provider, account, sync, publish, history, payment, and discussion implementations and controls are removed from the source tree; menus expose local workspace, import/export, backup, print, and settings flows. Browser checks verify legacy credentials and URL parameters do not expose controls or cause external requests, image URL insertion remains available, and credentials stay in local storage but out of backups at `test/browser-smoke.cjs:977-995`, `1102-1179`, and `1712-1774`. Archived sync/publish records remain inert in snapshots.

- **06 — Keep music notation source as ordinary code:** PASS for criteria 1–5. ABC renderer and dependency are removed; [abc-legacy-properties.spec.js](test/unit/specs/abc-legacy-properties.spec.js:6) covers old settings and source fences. Browser smoke verifies exact ABC source remains code while Mermaid, KaTeX, SVG, and Prism highlighting render in `test/browser-smoke.cjs:1580-1618`; retained preset features are in [presets.js](src/data/presets.js:66).

- **07 — Remove badges and achievement bookkeeping:** PASS for criteria 1–5. Badge service and dialogs are deleted; defaults no longer create badge state. [ExplorerNode.spec.js](test/unit/specs/components/ExplorerNode.spec.js:105) checks new file creation does not create badge records and that a seeded legacy record remains untouched.

- **08 — Compatibility storage, settings, and help:** Criteria 1–5 and 7–9 PASS. The store keeps only inert sync/publish record modules for compatibility in [store/index.js](src/store/index.js:35); backup export/import preserves archived records and supported v4/v5 metadata in [backupSvc.js](src/services/backupSvc.js:20) and [backup.spec.js](test/unit/specs/backup.spec.js:8). Browser coverage checks immediate edits, stable exports, workspace isolation, and Trash/Temp inclusion at `test/browser-smoke.cjs:1511-1556`; defaults omit obsolete settings in [defaultSettings.yml](src/data/defaults/defaultSettings.yml:1), and README, welcome, FAQ, and landing copy describe local workflows.

  **Criterion 6 FAILS:** [exportSvc.js](src/services/exportSvc.js:212) retains `exportToDisk(fileId)` as a forwarding alias to `exportHtmlToDisk`. The repository-wide search found only this definition; the UI callers now use `exportMarkdownToDisk` or `exportHtmlToDisk`/`renderHtml` at `ImportExportMenu.vue:91` and `HtmlExportModal.vue:59-73`. No direct or indirect caller remains, and the module is not exported as a public application API. This leaves unused forwarding code after its consumers migrated, contrary to ticket 08, line 15, and the spec’s cleanup decision.

- **09 — Production validation:** Criteria 1–10 PASS except that the requirement audit inherits ticket 08’s concrete cleanup miss. All required repository commands below passed. The browser harness covers retained editing, search, workspace migration, exports, backups, service-worker update/offline reload, and embedded Temp behavior; key assertions include `test/browser-smoke.cjs:694-1084`, `1285-1509`, `1511-1556`, `1827-1977`, and `1981-2025`. The audit limitation for the native print dialog is recorded below.

### Spec story and decision audit

I checked the 38 user stories and implementation decisions against source, tests, and the fresh browser run. Evidence includes workspace migration and local save (`test/browser-smoke.cjs:694-1084`), retained editing and search (`655-690`, `1285-1509`), Markdown/HTML import-export and metadata (`1183-1269`, `1580-1710`), backups and restore (`1511-1556`, `1742-1825`), legacy credentials and no-provider requests (`1102-1137`, `1712-1774`), offline and service-worker behavior (`1827-1977`), and embedded messaging (`1981-2025`). The cleanup miss above means the “remove unused code after consumers migrate” decision and corresponding maintainer story are not fully satisfied.

### Repository checks

- PASS — `npm test` — exit 0; ESLint: 0 errors and 1,060 warnings; Vitest: 17 files and 110 tests passed.
- PASS — `npm run build` — exit 0; production build completed with Sass deprecation and bundle-size warnings.
- PASS — `npm run browser-smoke` — exit 0; production browser smoke passed at `/` and `/docs/app`.
- PASS — `npm audit --audit-level=low` — exit 0; 0 vulnerabilities.
- PASS — `node --check test/browser-smoke.cjs` — exit 0.
- PASS — `git diff --check -- .` — exit 0 for tracked worktree changes.
- PASS — alias/reference search — only the `exportToDisk` definition remains; current callers use the specialized export methods.

Fresh measurements against `/tmp/stackedit-offline-baseline-20261010`: source files 290 → 180; source lines 35,305 → 21,077; source bytes 2,267,506 → 1,808,500; production artifact bytes 43,966,557 → 39,847,241; non-map JavaScript bytes 7,476,325 → 6,671,393; runtime dependencies 31 → 28; development dependencies remain 46; lockfile packages 1,174 → 1,167. These are measurements, not reduction targets.

### Limitations

The native OS Print / Save as PDF dialog was not opened, as instructed; the browser print invocation, print media layout, and generated PDF were verified. No deployed site was tested; browser acceptance used the owned local HTTP servers. `npm test` lint warnings were not compared with a baseline. `git diff --check -- .` covers tracked changes; the worktree also contains untracked feature files. The production build regenerated ignored `dist/`; the parent will restore the pre-review build backup.

No source, test, documentation, workflow, or validation files were edited during this review.

## Validation — 2026-10-10T09:27:11Z

**Feature:** `offline-notebook-simplification`  
**Status:** FAIL  
**Spec:** `.scratch/offline-notebook-simplification/spec.md`  
**Tickets:** 9 checked; 65 checklist criteria reviewed

### Workflow metadata

All tickets have canonical `ready-for-agent` triage status and `implemented (independent validation pending)` implementation status. Blocker references resolve and form an acyclic graph: 03 and 04 depend on 01; 05 depends on 02, 03, and 04; 08 depends on 05, 06, and 07; 09 depends on 08. The selected local spec has an explicit Acceptance Criteria section linking all nine canonical tickets. Prior validation history was reviewed.

### Acceptance criteria

- PASS — Ticket 01 (5/5): serialization preserves supported properties, discussions, comments, history, Unicode, and malformed or absent metadata behavior; public-interface tests and browser import/edit/export cover the workflow.
- PASS — Ticket 02 (8/8): local startup and workspace resolution avoid provider/server setup; unit and browser coverage checks legacy local copies, missing workspaces, local save/failure status, tabs, isolation, and embedded Temp behavior.
- PASS — Ticket 03 (8/8): fixed HTML, optional TOC, offline rendering/assets, sanitization, print/PDF and removed conversion/template paths are covered. The `template-worker` exclusion and worker test artifacts are absent.
- PASS — Ticket 04 (7/7): discussion UI/active machinery is removed; archival annotation data/offsets and editing, undo/redo, preview, search and layout behavior are covered.
- PASS — Ticket 05 (8/8): provider/account/sync/publish/payment/remote-history features are removed; seeded legacy state causes no external request; ordinary image URL insertion remains and credentials stay out of backups.
- PASS — Ticket 06 (5/5): ABC renderer/dependency are absent; ABC source remains ordinary code and retained Mermaid/KaTeX/highlighting and legacy-setting behavior are covered.
- PASS — Ticket 07 (5/5): badge UI/service/bookkeeping are removed; new state omits badges and old badge records remain inert.
- PASS — Ticket 08 (9/9): archived records remain inert, compatible backups/snapshots/settings/help are covered, and a scoped search found no `exportToDisk` definition or reference. The UI uses specialized Markdown/HTML exports.
- PASS — Ticket 09 criteria 2–10: production browser coverage and the spec’s 38 user stories/implementation decisions are supported by browser, unit, source, and documentation evidence.
- FAIL — Ticket 09 criterion 1: the first `npm test` execution exited 1 with Vitest `EnvironmentTeardownError` while it ran concurrently with the production build. Vitest reported all 17 files/110 tests passing but also an unhandled worker teardown error. The isolated retry exited 0; the validation contract treats a failed applicable check as FAIL.

### Repository checks

- FAIL — `npm test` — first concurrent execution exited 1 with the Vitest teardown error above.
- PASS — `npm test` — isolated rerun exited 0; ESLint: 0 errors, 1,060 warnings; Vitest: 17 files, 110 tests.
- PASS — `npm run build` — exit 0 with Sass deprecation and bundle-size warnings.
- PASS — `npm run browser-smoke` — passed on fresh production output at `/` and `/docs/app`.
- PASS — `npm audit --audit-level=low` — 0 vulnerabilities.
- PASS — `node --check test/browser-smoke.cjs`.
- PASS — `git diff --check -- .` — tracked worktree changes only; untracked files are excluded.
- PASS — scoped alias/template-worker reference search — no matching references in implementation, tests, build config, or package metadata.

### Measurements

Against `/tmp/stackedit-offline-baseline-20261010`: source files 290 → 180; source lines 35,305 → 21,073; source bytes 2,267,506 → 1,808,421; production artifact bytes 43,966,557 → 39,847,028; main JavaScript bytes 7,476,325 → 6,671,338; runtime dependencies 31 → 28; development dependencies 46 → 46; lockfile entries 1,174 → 1,167. These are measurements, not reduction targets.

### Limitations

- The native OS Print / Save as PDF dialog was not opened; browser print invocation, print layout, and Playwright PDF generation were verified.
- No deployed site was tested; browser acceptance used owned local HTTP servers.
- Lint warnings were not compared with a baseline.
- The worktree was already dirty; review made no source or workflow edits. The production build regenerated ignored `dist/`; the original backup is retained at `/tmp/stackedit-dist-backup-20261010-offline-notebook/dist`.

## Validation — 2026-10-10T09:32:48Z

**Feature:** `offline-notebook-simplification`  
**Status:** PASS  
**Spec:** `.scratch/offline-notebook-simplification/spec.md`  
**Tickets:** 9 checked; 65 checklist criteria reviewed

### Workflow metadata

The resolved local spec has an explicit Acceptance Criteria section linking all nine tickets. Every ticket has the valid `ready-for-agent` triage status and `implemented (independent validation pending)` implementation status. All blockers resolve and the dependency graph is acyclic: 03 and 04 depend on 01; 05 depends on 02, 03, and 04; 08 depends on 05, 06, and 07; 09 depends on 08.

### Acceptance criteria

- **01 — Preserve document serialization (5/5 PASS):** Import/export uses the serialization service and specialized Markdown export; serialization preserves supported properties, discussions, comments, history, and Unicode. Missing and malformed metadata retain the established fallback. Public tests cover round trips and fallback behavior, and the browser smoke covers import/edit/export. Evidence: `ImportExportMenu.vue:41,68-97`, `exportSvc.js:212-219`, `documentSerializationSvc.js:10-67`, `document-serialization.spec.js:4-73`, browser smoke `1183-1269`. The final scoped search found no `exportToDisk` definition or call site.

- **02 — Local workspace startup and save (8/8 PASS):** Startup selects local workspaces without provider/server setup; legacy provider URLs resolve only to existing local copies and missing copies show a local-unavailability error. Local management controls and tests cover existing workspaces, save acknowledgement and failure recovery, cross-tab updates, isolation, and embedded Temp behavior. Evidence: `App.vue:55-78`, `workspaceSvc.js:51-73`, `localDbSvc.js:109-129`, `workspace-startup.spec.js:4-44`, `workspace-persistence.spec.js:118-260`, browser smoke `694-1084` and `1981-2025`.

- **03 — Fixed HTML export and browser print (8/8 PASS):** Markdown export uses the compatible serializer. HTML is fixed, styled, optionally includes a TOC, and supports copy/download; content is sanitized, titles escaped, and styles/assets are embedded for offline use. The production smoke covers offline output, print invocation/layout, PDF generation, and absence of helper execution. Removed template/conversion dependencies and the production worker split exception were checked. Evidence: `exportSvc.js:139-220`, `HtmlExportModal.vue:1-74`, browser smoke `474-521` and `1580-1651`, `package.json:25-53`, `build/webpack.prod.conf.js:36-50`. The native OS print dialog was not opened.

- **04 — Remove discussion UI while preserving annotations (7/7 PASS):** The editor and preview expose no discussion controls; serialization retains annotations and their original offsets. Browser/unit evidence covers annotated legacy notes through editing, import, backup, and export, alongside editing, formatting, undo/redo, preview, search, and layout behavior. Evidence: `Editor.vue:1-20`, `Preview.vue:1-51`, `documentSerializationSvc.js:16-20,51-56`, `document-serialization.spec.js:4-58`, browser smoke `743-818`, `1183-1269`, `1402-1438`.

- **05 — Remove external integrations and account workflows (8/8 PASS):** Menus expose local workflows; browser checks cover ordinary image URL insertion, legacy credentials/preferences/URLs, no provider/backend requests, credentials excluded from backups but retained locally, and functional local startup, persistence, exports, and editing. Evidence: `WorkspacesMenu.vue`, `WorkspaceManagementModal.vue:7-42,75-105`, `README.md:7-13`, browser smoke `977-995`, `1102-1179`, `1712-1774`.

- **06 — Keep music notation source as ordinary code (5/5 PASS):** Legacy ABC properties are tolerated, ABC fences remain exact ordinary code, and Mermaid/math remain enabled. Dependency and browser evidence cover rendered preview/export and retained highlighting. Evidence: `abc-legacy-properties.spec.js:6-29`, `package.json:25-53`, browser smoke `1580-1618`.

- **07 — Remove badges and achievement bookkeeping (5/5 PASS):** Active badge bookkeeping is absent; new file actions do not create badge state and a seeded legacy badge record remains inert. Evidence: `ExplorerNode.spec.js:105-145`, `defaultSettings.yml:1-70`; representative actions are covered by the passing browser smoke.

- **08 — Compatibility storage, settings, and help (9/9 PASS):** The store retains only inert legacy record modules; backup code covers supported v4/v5 and BOM imports, current snapshot overlays, workspace isolation, archived data, and Trash/Temp. Defaults and README/welcome/FAQ describe supported local behavior. Specialized export callers remain, and final searches found no `exportToDisk`, `template-worker`, or `templateWorker` references in `src`, `test`, `build`, `package.json`, or `package-lock.json`. Deleted `test/unit/jest.conf.js` and `test/unit/mocks/templateWorkerMock.js` are absent. Evidence: `store/index.js:35-38`, `backupSvc.js:10-124`, `backup.spec.js`, browser smoke `1511-1556` and `1747-1774`, `defaultSettings.yml:1-70`, `README.md:7-40`, `welcomeFile.md:26-43`, `faq.md:1-9`, `exportSvc.js:203-220`, `build/webpack.prod.conf.js:44-46`.

- **09 — Production validation (10/10 PASS):** The required lint/unit/build/audit/diff checks and production browser harness pass. Browser evidence covers retained workflows, legacy workspaces, tabs and isolation, backup/restore, offline/nested-path/service-worker behavior, no-integration requests, and embedded Temp messaging. Before/after source, bundle, and dependency measurements are recorded in the earlier validation history. The spec's stories and decisions were audited below, with the native print-dialog limitation recorded. Evidence: serial command results below; browser smoke at `/` and `/docs/app`; measurement record in this log.

### Spec story and decision audit

All 38 stories were checked against current source, docs, unit tests, and the fresh production browser run. Stories 1–10 are covered by local startup, workspace selection/management, persistence, and isolation evidence; 11–19 by editing, Markdown features, find/replace, and workspace search; 20–25 by import, serialization, fixed HTML, offline rendering, and browser print; 26–30 by backup/restore, annotations, and inert archived records; 31–36 by local menus, image URLs, ABC preservation, sanitization, legacy settings, and updated help; 37–38 by request assertions and removal of obsolete machinery.

All implementation decisions were checked as well: static deployment and service-worker scope/update behavior; serialization and workspace ID preservation; local saves and cross-tab behavior; integration removal with normal links/images retained; archived annotations and records; supported backup import and snapshot integrity; fixed offline HTML and browser print; music/badge removal; legacy settings and sync-shortcut behavior; embedded/Temp behavior; and cleanup while retaining sanitization, diff, search, backup, diagrams, math, and supported dependencies.

### Repository checks

- PASS — `npm test` — exit 0; ESLint reported 0 errors and 1,060 warnings; Vitest passed 17 files and 110 tests.
- PASS — `npm audit --audit-level=low` — exit 0; 0 vulnerabilities.
- PASS — `node --check test/browser-smoke.cjs` — exit 0.
- PASS — `npm run build` — exit 0; production build completed with Sass deprecation and bundle-size warnings.
- PASS — `npm run browser-smoke` — exit 0; production smoke passed at `/` and `/docs/app`.
- PASS — `git diff --check -- .` — exit 0 for tracked worktree changes.
- PASS — scoped `rg` searches for `exportToDisk`, `template-worker`, and `templateWorker` — no matches.

### Limitations

- The native OS Print / Save as PDF dialog was not opened; browser print behavior and PDF output are covered by the harness.
- No deployed site was tested; browser acceptance used owned local HTTP servers.
- Lint warnings were not compared with a baseline. `git diff --check -- .` does not inspect untracked files.
- The production build regenerated ignored `dist/`; the original backup remains at `/tmp/stackedit-dist-backup-20261010-offline-notebook/dist`.

No source or workflow files were edited during this validation.

## Validation — 2026-10-10T16:46:41Z

**Feature:** offline-notebook-simplification
**Status:** FAIL
**Spec:** `.scratch/offline-notebook-simplification/spec.md`
**Tickets:** 9 checked; 65 checklist criteria independently inspected

### Input and dependency metadata

The canonical local feature directory and spec resolve inside the repository. No explicit spec override was supplied. The spec has an explicit Acceptance Criteria section linking all nine ticket checklists. All tickets have `ready-for-agent` triage status and separate `implemented (independent validation pending)` implementation status. Blocker references resolve, are acyclic, and match the approved graph: 03 and 04 depend on 01; 05 depends on 02/03/04; 08 depends on 05/06/07; 09 depends on 08. No malformed workflow metadata was found. Earlier validation entries were read but do not substitute for fresh evidence.

### Findings

1. **False local save acknowledgement for normal edits.** `src/services/editorSvc.js:67-73` dispatches `content/patchCurrent`, which commits `patchItem` (`src/store/content.js:26-32`, `src/store/moduleTemplate.js:24-29`). The persistence subscriber at `src/services/localDbSvc.js:146-157` only observes `setItem` and `deleteItem`. Consequently normal edits and renames fail to advance `changeVersion` or mark pending saves. The transaction completion branch at `src/services/localDbSvc.js:247-258` can acknowledge a stale snapshot. Independently reproduced in a production browser with the autosave interval held: before edit `Saved locally`; after filling the editor with `# UNSAVED_PUBLIC_EDIT_MARKER`, status still `Saved locally`, edit present in memory, marker absent from IndexedDB. The existing save test only uses `content/setItem` and never enables the subscriber (`test/unit/specs/workspace-persistence.spec.js:253-290`), so it misses this user path.
2. **Upgrade changes historical Trash retention.** Current startup at `src/services/localDbSvc.js:512-518` performs age-only Trash deletion. The previous implementation additionally required absence of `workspace/syncToken`; see `git show HEAD:src/services/localDbSvc.js` and `git show HEAD:src/store/workspace.js`. A seeded Main workspace with an old local login token, an aged focus timestamp, and a Trash document retained by the old behavior loses that document after the update. Independently reproduced: `legacyLoginPreserved: true`, `trashFileVisible: false`; persisted file is a deletion marker `{id: "upgrade-trash-file", type: "file", tx: 1002}`. This violates the explicit unchanged Trash/Temp retention requirement and upgrade data compatibility.
3. **OAuth deployment machinery remains reachable.** `.github/workflows/main.yml:67-81` moves the OAuth callback into the published artifact, creates `app/conf`, and creates the callback alias. `static/oauth2/callback.html:5-6` still forwards URL hash/search to the parent/opener via postMessage; the build copies it into dist through `build/webpack.prod.conf.js:75-82`. These obsolete OAuth/server artifacts were not removed by the source cleanup, contrary to tickets 05 and 08. The old font duplication step is also obsolete for the currently emitted CSS paths.

### Acceptance criteria

Criterion numbers below follow checklist order within each canonical ticket. Every criterion is accounted for.

**01 — Preserve document serialization (5 criteria)**

- PASS — 01.1: Markdown import/export uses the local serializer with no provider/account/network dependency. Evidence: `src/components/menus/ImportExportMenu.vue:41,68-97`, `src/services/exportSvc.js:212-219`, `src/services/documentSerializationSvc.js:1-67`.
- PASS — 01.2: Unicode, Markdown, properties, discussion/comment values and history round-trip. Evidence: `test/unit/specs/document-serialization.spec.js:4-36`, production smoke `test/browser-smoke.cjs:1183-1269`.
- PASS — 01.3: Absent/malformed trailers preserve readable text and legacy fallback. Evidence: serializer `:36-65`, serialization tests `:38-77`.
- PASS — 01.4: Current callers migrated and temporary forwarding API is absent. Evidence: import/export implementations above and scoped search for `exportToDisk`/Provider imports returned no active definition/caller.
- PASS — 01.5: Public parsing/serialization and browser import/edit/export regression coverage passes. Evidence: three serializer tests and smoke import/export assertions `:1183-1269`; `npm test`, `npm run browser-smoke`.

**02 — Open existing workspaces and save locally (8 criteria)**

- PASS — 02.1: Main/IndexedDB startup bypasses cloud providers/config fetch. Evidence: `src/components/App.vue:55-72`, `src/services/localDbSvc.js:475-491`; smoke initial startup.
- PASS — 02.2: Provider-associated local workspaces preserve IDs/databases and local selection/rename/removal. Evidence: `src/store/workspace.js:16-26,35-71`, `src/components/modals/WorkspaceManagementModal.vue:86-130`; smoke `:694-861`.
- PASS — 02.3: Legacy URL resolution requires a local record/database; absent copy yields alert without replacement. Evidence: `src/services/workspaceSvc.js:7-74`, App `:62-67`; startup tests `test/unit/specs/workspace-startup.spec.js:4-46`; smoke `:717-731`.
- FAIL — 02.4: Autosave/load/unload remain, but normal `patchItem` edits continue displaying completed-save status before persistence and may be acknowledged across a stale transaction. Evidence: finding 1 and isolated production editor repro.
- PASS — 02.5: Transaction failure retains edits, displays error, and permits retry. Evidence: `src/services/localDbSvc.js:217-235`, persistence regression `:253-290`. Normal-edit saving transitions are separately failed under 02.4.
- PASS — 02.6: Existing tab coordination/workspace isolation preserved for persisted changes. Evidence: read/write transaction coordination `src/services/localDbSvc.js:78-81,299-418`; browser smoke `:997-1084`. Save acknowledgement race is separately failed under 02.4.
- PASS — 02.7: Embedded/light parent messaging and Temp startup remain. Evidence: `src/services/tempFileSvc.js`, App `:70-72`; smoke `:1981-2025`.
- PASS — 02.8: Existing isolated tests cover old DBs, offline startup, tabs, switching and save failures. Evidence: persistence/startup tests and smoke `:694-1084,1827-2025`; the additional normal-edit status gap is demonstrated by finding 1.

**03 — Fixed HTML export and browser print (8 criteria)**

- PASS — 03.1: Markdown format uses compatible serializer. Evidence: `src/services/exportSvc.js:212-219`, serializer tests and smoke metadata checks.
- PASS — 03.2: Fixed HTML supports optional TOC, Copy/Download and filename. Evidence: `src/components/modals/HtmlExportModal.vue:1-74`, export service `:140-209`; smoke `:1606-1619`.
- PASS — 03.3: Export includes embedded styles/fonts, rendered diagrams/math/headings/highlighting and works offline off-origin. Evidence: export service `:72-136,145-200`; smoke `:474-521,1606-1625`.
- PASS — 03.4: Titles escaped, rendered HTML sanitized, legacy helpers inert. Evidence: export service `:10-15,148`, `src/libs/htmlSanitizer.js`, sanitization tests; smoke `:1640-1725`.
- PASS — 03.5: Template UI/worker removed; old template records retained inert in snapshots. Evidence: removed TemplatesModal/templateWorker paths, generic data storage; backup tests `:118-238`; smoke `:1747-1752`.
- PASS — 03.6: Browser Print invokes local window.print and print media remains readable. Evidence: `src/components/menus/MainMenu.vue`; smoke `:1627-1635` and offline export layout `:474-521`.
- PASS — 03.7: Server conversion modals/settings/gates, Handlebars/worker and Pandoc-only renderer removed. Evidence: source/dependency inspection, `package.json`; smoke `:1712-1725`.
- PASS — 03.8: Fixed output/TOC/offline/print/security/no-helper checks pass. Native OS Save as PDF remains explicitly unperformed manual acceptance. Evidence: smoke `:474-521,1580-1725`, ticket 03 comments, prior report limitation.

**04 — Remove discussion UI, preserve annotations (7 criteria)**

- PASS — 04.1: Discussion/reply/delete/avatar/gutter/highlight controls absent. Evidence: Editor/Preview/Layout/Modal source diff, removed gutters/user components; smoke `:1214-1216`.
- PASS — 04.2: Active discussion state/relocation/hover/layout removed. Evidence: removed store/discussion and editorSvcDiscussions, simplified `src/store/layout.js` and editor/layout paths.
- PASS — 04.3: Archived comments/discussions survive supported formats without user lookup. Evidence: serializer `:16-20,51-55`, generic content state; serialization/backup tests, smoke metadata checks.
- PASS — 04.4: Original offsets remain inert and unchanged. Evidence: editorSvc patches whole content without anchor relocation `:67-73`; smoke `:1266-1269` compares archived metadata after editing.
- PASS — 04.5: Typing/formatting/selection/preview/undo/redo/search/resizing retained. Evidence: `test/unit/specs/editor-workflows.spec.js`, component suites; smoke `:655-690,1170-1179,1285-1509,1574`.
- PASS — 04.6: Opening/edit/export does not remove annotations. Evidence: smoke Main/provider upgrade `:694-970` and import/edit/export `:1183-1269`.
- PASS — 04.7: Legacy annotated-note and retained editor regressions pass. Evidence: serializer/backup/editor suites and smoke cited above.

**05 — Remove integrations and accounts (8 criteria)**

- FAIL — 05.1: Application provider/account/cloud/publishing/Photos/CouchDB/history/payment controls are removed, but reachable deployed OAuth callback remains. Evidence: finding 3, `.github/workflows/main.yml:67-81`, `static/oauth2/callback.html:5-6`.
- PASS — 05.2: Active menus/modal registry/icons/shortcuts/settings expose local workflows. Evidence: MainMenu/WorkspacesMenu/Modal/icons/defaults/shortcuts; smoke `:1134-1154,1637`.
- PASS — 05.3: Provider directory, retries/locks/queues/account-user lookup removed after callers migrated. Evidence: git diff deletions and repository source inspection; `src/components/App.vue:55-72`.
- PASS — 05.4: Normal links/images remain functional. Evidence: ImageModal/pagedown/shortcuts; smoke `:1138-1154`.
- PASS — 05.5: Old tokens/preferences/locations/URL parameters do not activate provider network operations. Evidence: `src/store/data.js` removed token getters; smoke `:977-995,1102-1137,1712-1774`.
- PASS — 05.6: Credentials remain unused/private, excluded from workspace backup and not auto-deleted. Evidence: constants `:13-19`, backupSvc `:23-42`, smoke `:1756-1774`.
- PASS — 05.7: Startup/persistence/export/edit function with provider directory absent. Evidence: fresh full test/build/browser runs and provider deletion inspection.
- PASS — 05.8: Seeded legacy-state browser request assertions pass across startup/menu/export/embedded/offline activity. Evidence: smoke `:977-995,1102-1137,1712-1774,1955-1959,1981-2025`.

**06 — Remove music notation (5 criteria)**

- PASS — 06.1: ABC extension/presets/options/examples/assets/dependency removed. Evidence: extensions/defaults/welcome/landing/package inspection and deleted abcExtension.
- PASS — 06.2: ABC source fences retained exactly as code. Evidence: smoke `:1602-1605,1613-1614`, `test/unit/specs/abc-legacy-properties.spec.js:7-33`.
- PASS — 06.3: Old ABC settings tolerated without activating renderer. Evidence: legacy properties public conversion test above.
- PASS — 06.4: Mermaid/KaTeX/emoji/Markdown/highlighting retained. Evidence: `src/extensions/index.js`, `src/data/presets.js`, package dependencies; smoke `:1580-1625`.
- PASS — 06.5: Preview/export legacy ABC beside diagrams/math regression passes and library absent. Evidence: fresh unit/browser checks and package-lock inspection.

**07 — Remove badges (5 criteria)**

- PASS — 07.1: Badge dialogs/features/counters/call sites removed. Evidence: deleted badgeSvc/features/BadgeManagementModal and source search.
- PASS — 07.2: Core notebook actions work without badge modules. Evidence: browser actions and component suites (`ButtonBar`, `Explorer`, `ExplorerNode`, `WorkspaceSearchPanel`).
- PASS — 07.3: Old generic data records remain inert without action-driven deletion/recreation. Evidence: `src/store/data.js:17-29,88-108`, constants types; absence of badge callers.
- PASS — 07.4: New defaults no longer create badge records. Evidence: `src/data/defaults/defaultLocalSettings.js`, generic lazy defaults, source search.
- PASS — 07.5: Browser core workflows and source/state inspection confirm no achievement dependency/write. Evidence: fresh smoke and deletion/call-site inspection.

**08 — Contract storage/settings/help (9 criteria)**

- PASS — 08.1: Minimal inert legacy types retained without active features. Evidence: `src/store/index.js:35-38`, `src/store/data.js:17-29`, constants types.
- PASS — 08.2: Snapshots retain templates/sync/publish/history/annotations without reactivation. Evidence: backupSvc `:23-42`, backup tests `:118-238`, smoke `:1747-1763`.
- PASS — 08.3: Supported BOM/v4/v5 note/folder/property/annotation restore remains, without full cloud-state promise. Evidence: backupSvc `:56-123`, `test/unit/specs/backup.spec.js:8-97`.
- PASS — 08.4: Timestamped backup includes immediate edits/unopened records/stable payloads/initiating workspace/Trash/Temp. Evidence: backupSvc `:10-49`, backup tests `:118-238`, smoke `:1511-1556`.
- FAIL — 08.5: Obsolete preferences tolerated/new defaults trimmed, but historical Trash eligibility changed. Evidence: finding 2; localDbSvc `:512-518`; seeded production upgrade reproduction.
- FAIL — 08.6: Forwarding interfaces/most unused dependencies/assets removed, but obsolete OAuth/server artifact and deploy/font preparation remain. Evidence: finding 3; workflow `:67-81`, static callback, build copy pattern.
- PASS — 08.7: Product menus/welcome/FAQ/landing/README explain local save/search/backup/fixed HTML/print and removed workflows. Evidence: fresh reads of README, welcomeFile, faq, MainMenu, ImportExportMenu and landing product sections. Historical canonical/social/credit links do not reactivate integrations.
- PASS — 08.8: Required diff/undo/sanitization/diagrams/math/search/backup/light implementations/dependencies retained. Evidence: package metadata, editor services, htmlSanitizer, smoke and focused suites.
- PASS — 08.9: Compatibility tests cover payloads/old DBs/round trips/removed state/fixed export. Evidence: backup/serializer/startup/persistence suites and smoke cited above. Missing retention scenario is failed under 08.5.

**09 — Production validation (10 criteria)**

- PASS — 09.1: Existing lint/unit/build/audit/syntax/scoped diff checks pass. Evidence: exact commands below. Historical report Markdown hard-break whitespace is a pre-existing append-only formatting limitation.
- PASS — 09.2: Harness covers editing/find-replace/search/folders/import/export/printing/backups. Evidence: smoke `:655-690,1183-1825`, fresh browser pass.
- PASS — 09.3: Main and provider fixtures verify names/IDs/content/relationships/annotations/inert metadata. Evidence: smoke `:694-970`.
- PASS — 09.4: Existing two-tab/isolation/immediate exports/failure scenarios verified. Evidence: smoke `:997-1084,1511-1556`; persistence failure test `:253-290`. Normal-edit acknowledgement miss is separately failed under 02.4.
- PASS — 09.5: Offline/nested/off-site HTML/manifest/scope/waiting updates/reload covered. Evidence: smoke `:474-521,629-635,1827-1977`.
- PASS — 09.6: Waiting worker leaves edited page intact; request assertions allow legitimate static/update/user traffic. Evidence: Workbox `build/webpack.prod.conf.js:99-105`; smoke `:1843-1870,1955-1959`.
- PASS — 09.7: Seeded tokens/preferences/URLs/helpers inert and network/execution assertions pass. Evidence: smoke `:977-995,1102-1137,1712-1774`.
- PASS — 09.8: Embedded parent messaging and Temp regressions pass. Evidence: smoke `:1981-2025`.
- PASS — 09.9: Before/after measured without arbitrary targets. Fresh values below verify historical baseline measurements.
- FAIL — 09.10: Prior story/decision audit claims completion, but trustworthy save state, unchanged retention and removal cleanup fail. Native PDF limitation is correctly stated separately. Evidence: findings 1–3 and spec audit below.

### Spec stories and decisions

All 38 stories and implementation decisions were inspected against the current implementation and fresh checks. Stories 1–8 and 10–38 have the corresponding startup/workspace/editor/search/import/export/backup/rendering/network/data-preservation evidence listed above, subject to the specific retention and OAuth cleanup failures. Story 9 (trustworthy save status) fails finding 1; story 30/38 and the cleanup decisions remain incomplete for OAuth deployment. The explicit unchanged retention/out-of-scope constraint fails finding 2. Static deployment, storage IDs, legacy URL resolution, serializer, inert data, supported backup restore, fixed offline HTML, annotations, normal resources, sanitization, diagrams/math, ABC/badge removal, settings/shortcuts and embedded Temp behavior otherwise match the plan. No feature is accepted while these concrete failures remain.

### Repository checks

Checks discovered from package scripts, README and `.github/workflows/main.yml` were run against the frozen initial state. Test/build/browser commands ran sequentially.

- PASS — `npm test > /tmp/stackedit-validate-20261010T163634Z/npm-test-review.log 2>&1` — exit 0; lint 0 errors / 1,060 warnings; 17 Vitest files / 110 tests pass, no teardown errors.
- PASS — `npm run build > /tmp/stackedit-validate-20261010T163634Z/npm-build-review.log 2>&1` — exit 0; static application and standalone stylesheet built, with Sass/performance warnings.
- PASS — `npm run browser-smoke > /tmp/stackedit-validate-20261010T163634Z/browser-smoke-review.log 2>&1` — exit 0; production smoke at `/` and `/docs/app`.
- PASS — `npm audit --audit-level=low` — exit 0; found 0 vulnerabilities.
- PASS — `node --check test/browser-smoke.cjs` — exit 0.
- PASS — `git diff --check -- README.md build package.json package-lock.json src static test .scratch/offline-notebook-simplification` — exit 0.
- PASS — `git show HEAD:src/services/localDbSvc.js` and `git show HEAD:src/store/workspace.js` — read-only baseline comparisons establish the previous sync-token-dependent Trash behavior.
- FAIL (behavior) — isolated `node` stdin production-browser reproduction using the existing createStaticServer seam, Playwright Chromium, held 1,000–1,200ms autosave interval, and editor `.fill('# UNSAVED_PUBLIC_EDIT_MARKER')` — process exit 0; visible completed-save status while marker absent from persisted DB confirms finding 1.
- FAIL (behavior) — isolated `node` stdin production-browser upgrade reproduction using same static server, seeded synthetic Google `isLogin` record, focus timestamp `1`, Trash file/content at tx 1000/1001, reload — process exit 0; Trash file became deletion marker confirms finding 2. No real credentials were used.
- PASS with historical-report limitation — read-only Python whitespace inspection of 16 applicable untracked text files — source/tests/spec/tickets clean; only prior validation.md hard-break lines have trailing spaces, left untouched under append-only rules.
- PASS — read-only Python artifact/source/package measurement against `/tmp/stackedit-offline-baseline-20261010` — source files 290 → 180; source lines 35,305 → 21,073; source bytes 2,267,506 → 1,808,421; artifact bytes 43,966,557 → 39,847,028; non-map JavaScript 7,476,325 → 6,671,338; runtime dependencies 31 → 28; development dependencies 46 → 46; lockfile packages 1,174 → 1,167.

### Limitations

- Native operating-system Print / Save as PDF dialog not exercised; window.print invocation, print layout and generated nonempty Chromium PDF passed.
- Tests exercise production builds on owned local servers, not the live published site or remote GitHub Actions deploy.
- Build regenerates ignored dist; the parent preserved the pre-validation dist for restoration. Reviewer made no implementation/workflow edits or Git mutations.
- Existing lint/build warnings and historical append-only report Markdown hard breaks are preserved, not silently repaired.

## Validation — 2026-10-10T16:55:51Z

**Feature:** offline-notebook-simplification
**Status:** PASS
**Spec:** `.scratch/offline-notebook-simplification/spec.md`
**Tickets:** 9 checked; all 65 checklist criteria satisfied

### Inputs and metadata

The canonical local feature and specification remain inside the repository. No explicit override was supplied; the local spec is selected. Its explicit Acceptance Criteria links every canonical ticket checklist. All nine tickets use canonical `ready-for-agent` triage status and separate `implemented (independent validation pending)` implementation status. Dependencies resolve and are acyclic: 03/04 depend on 01; 05 depends on 02/03/04; 08 depends on 05/06/07; 09 depends on 08. No input/workflow ambiguity or missing metadata limits completeness.

This is the same independent read-only reviewer's final recheck after the initial FAIL entry. Root performed the authorized repairs; the reviewer made no source/test/documentation/workflow edits and did not stage, commit, push, or change branches.

### Repairs independently verified

- Normal content/file/folder patches now mark local changes pending. `src/services/localDbSvc.js:146-159` observes `patchItem` as well as set/delete; scalar data deletions are handled safely. The public `content/patchCurrent` regression verifies visible saving before the write and verifies an edit made during a transaction remains pending until its own transaction completes. Production browser checks independently hold autosave, edit, abort a transaction, and retry: “Saving locally…” appears while DB still contains the prior version, errors retain the in-memory edit, and “Saved locally” appears after the marker is persisted.
- Historical Trash eligibility is preserved without reconnecting accounts. `src/store/workspace.js:32-51` returns only a boolean matching the former syncToken lookup: Main/default Google isLogin, provider-specific matching subject for Drive/GitHub/GitLab, workspace ID for CouchDB. Startup age cleanup also checks this exemption. Eleven public eligibility cases and three aged-workspace browser upgrades verify retention when eligible and deletion when ineligible; credential records remain untouched and no external request occurs.
- OAuth callback and obsolete Pages conf/font/callback preparation were removed. Exact extracted Prepare GitHub Pages artifact shell succeeds in an isolated copied cwd; landing/sitemap/app/manifest/fonts remain present, every emitted stylesheet resource resolves, and no OAuth/conf artifact is published.
- The first post-repair full suite found an asynchronous Vitest console teardown error despite all assertions passing. Root added `enableAutoUnmount(afterEach)` to the shared component-test helper (`test/unit/specs/specUtils.js:1,22`), releasing mounted component watchers between cases without suppressing warnings. Two consecutive full `npm test` runs then passed with 17 files / 122 tests and no unhandled errors.

### Acceptance criteria

### 01 — Preserve document serialization independently of providers

- PASS — 01.1: Markdown import/export uses a document serialization interface without provider registration, account lookup, or network operations. Evidence: `src/services/documentSerializationSvc.js:1-67`, `src/components/menus/ImportExportMenu.vue:41,68-97`, `src/services/exportSvc.js:212-219`.
- PASS — 01.2: Plain Markdown, Unicode, supported properties, discussions/comments, and embedded metadata round-trip without silently losing supported values. Evidence: `test/unit/specs/document-serialization.spec.js:4-36`; browser `test/browser-smoke.cjs:1320-1406`.
- PASS — 01.3: Missing or malformed embedded metadata preserves readable text and follows the established fallback behavior. Evidence: `src/services/documentSerializationSvc.js:36-65`; serialization tests `:38-77`.
- PASS — 01.4: Existing callers remain functional during prefactoring; any temporary forwarding interface is removed only after its callers migrate. Evidence: current import/export callers above; search `rg -n "exportToDisk|services/providers|Provider" src` finds no obsolete forwarding API/provider import.
- PASS — 01.5: Public-interface regression checks cover parsing/serialization and an import/edit/export browser workflow. Evidence: public serializer tests and browser import/edit/export `test/browser-smoke.cjs:1320-1406`; clean `npm test` / `npm run browser-smoke`.

### 02 — Open existing workspaces and save locally

- PASS — 02.1: The application initializes the Main workspace and IndexedDB without selecting a cloud provider or fetching server configuration. Evidence: `src/components/App.vue:55-72`, `src/services/localDbSvc.js:475-491`; browser local startup.
- PASS — 02.2: Existing locally stored provider-associated workspaces remain selectable, renameable, and removable through local controls, using their existing IDs and database names. Evidence: `src/store/workspace.js:16-26,55-91`, workspace-management controls; browser `test/browser-smoke.cjs:830-997`.
- PASS — 02.3: Legacy URLs resolve existing local copies without connecting to a provider; absent local copies receive a clear outcome without creating an empty substitute or silently opening unrelated notes. Evidence: `src/services/workspaceSvc.js:7-74`, App `:62-67`; startup tests `test/unit/specs/workspace-startup.spec.js:4-47`; browser missing-copy assertions `:852-867`.
- PASS — 02.4: Local autosave and content loading/unloading remain active; status indicates saving, completed transaction persistence, or failure accurately. Evidence: `src/services/localDbSvc.js:132-159,242-258,425-469`; new ordinary/overlapping patch test `test/unit/specs/workspace-persistence.spec.js:306-387`; browser held-autosave regression `:696-767`.
- PASS — 02.5: Failed persistence keeps in-memory edits available and does not display a successful save. Evidence: `src/services/localDbSvc.js:217-235`; save failure/retry test `test/unit/specs/workspace-persistence.spec.js:253-299`; browser abort/retry retains edit and old persisted content `:739-764`.
- PASS — 02.6: Existing cross-tab local changes and workspace isolation remain correct without relying on cloud sync timers. Evidence: local readwrite DB coordination `src/services/localDbSvc.js:78-81,299-418`; browser tabs/isolation `:1133-1221` now waits persisted marker `:1149`.
- PASS — 02.7: Embedded/light startup, its parent messaging protocol, and Temp behavior remain functional. Evidence: `src/services/tempFileSvc.js`, App `:70-72`; browser embedded/light parent messaging and Temp `:2118-2162`.
- PASS — 02.8: Isolated database/browser regressions cover old databases, online/offline startup, two tabs, workspace switching, and save failures. Evidence: full persistence/startup suites and production browser old DB/startup/tabs/isolation/offline/save-failure regressions.

### 03 — Export fixed HTML and print without templates or servers

- PASS — 03.1: Markdown export/import retains the compatible document format supplied by the local serialization interface. Evidence: `src/services/exportSvc.js:212-219`, serializer tests and browser metadata export `:1396-1406`.
- PASS — 03.2: HTML export offers a fixed styled output and optional table of contents, with copy/download behavior and a compatible filename. Evidence: `src/components/modals/HtmlExportModal.vue:1-74`, export `:140-209`; browser styled HTML/TOC filename `:1743-1762`.
- PASS — 03.3: Downloaded HTML renders offline away from the application, including required styles and packaged assets, headings, code highlighting, diagrams, and math. Evidence: export embedded stylesheet assets `src/services/exportSvc.js:72-136,145-200`; browser offline exported HTML `:474-521,1743-1762`.
- PASS — 03.4: Document names and content remain sanitized/escaped appropriately; exported content and legacy helpers do not execute scripts. Evidence: export escaped titles `src/services/exportSvc.js:10-15,192`, HTML sanitizer `:148`; sanitization suite and browser `:1777-1862`.
- PASS — 03.5: Custom template editing, selection, and helper execution are removed; existing custom template data remains inactive and preserved in existing snapshots. Evidence: custom-template UI/worker removed; `src/store/data.js` generic inert records; backup suite `test/unit/specs/backup.spec.js:118-238`; browser `:1884-1889`.
- PASS — 03.6: Browser Print remains available without credentials or conversion endpoints; existing print styling supports a readable document. Evidence: MainMenu browser Print; production browser `:1764-1772` validates window.print and generated PDF; exported print layout `:474-521`.
- PASS — 03.7: Server PDF/Pandoc actions, their modals/settings, sponsorship gates, template worker, Handlebars, and the Pandoc-only renderer are removed when unused. Evidence: removed PDF/Pandoc/template/gate files; package.json no Handlebars/worker dependency; scoped obsolete-service search.
- PASS — 03.8: Browser regressions cover fixed HTML, TOC, offline exported output, print invocation, and no server conversion/helper execution; actual OS Save as PDF is recorded as manual acceptance when needed. Evidence: production browser fixed HTML/TOC/offline/print/security/no-helper checks `:474-521,1717-1862`; native OS Save as PDF limitation explicit.

### 04 — Edit without discussion gutters while preserving annotations

- PASS — 04.1: New discussion, reply, delete-comment, avatar, gutter, and discussion highlighting controls are absent from editor and preview. Evidence: Editor/Preview/Layout/Modal simplified; gutters/user components removed; browser `:1351-1353`.
- PASS — 04.2: Discussion state, marker relocation, hover/click behavior, and discussion-specific layout calculations are removed from active editing. Evidence: discussion store and editorSvcDiscussions deleted, discussion-specific editor/layout calculations removed.
- PASS — 04.3: Existing archived comments/discussions remain present in document data and supported exports/imports without remote user lookups. Evidence: serializer `src/services/documentSerializationSvc.js:16-20,51-55`, backup and serialization tests, browser metadata comparisons.
- PASS — 04.4: Archived offsets retain their original values and are treated as archival metadata rather than maintained anchors. Evidence: editor patches preserve whole content without anchor relocation `src/services/editorSvc.js:67-73`; browser archived metadata comparison `:1403-1406`.
- PASS — 04.5: Typing, formatting, selection, preview, undo/redo, search navigation, and layout resizing retain their current behavior. Evidence: editor-workflows/component tests; browser formatting/undo/redo `:655-690`, resizing `:1307-1316`, search `:1422-1646`, find/replace `:1711`.
- PASS — 04.6: No annotation removal occurs simply from opening, editing, exporting, or upgrading a note. Evidence: browser Main/provider upgrades `:830-1107` and import/edit/export archived annotation comparisons `:1320-1406`.
- PASS — 04.7: Browser/public-interface regressions cover annotated legacy notes and retained editing behavior. Evidence: fresh serializer/backup/editor suites and annotated legacy browser checks.

### 05 — Remove external integrations and account workflows

- PASS — 05.1: Provider/account, OAuth, cloud sync, publishing, Google Photos, CouchDB connection, remote history, sponsorship, and payment controls and operations are removed. Evidence: provider/account/cloud/publish/history/payment source removed; `static/oauth2/callback.html` deleted; exact deploy preparation packaging confirms no OAuth/conf.
- PASS — 05.2: Navigation, menus, modal registration, icons, shortcuts, and active settings expose supported local workflows without obsolete integration counts or messages. Evidence: MainMenu/WorkspacesMenu/Modal/icons/defaults/shortcuts simplified; browser menu/image assertions `:1271-1291,1774`.
- PASS — 05.3: Provider adapters/helpers/registry, cloud retries/locks/queues, and account/user lookup code are removed once supported workflows no longer consume them. Evidence: provider directory, network/sync/publish/user services and cloud queue modules deleted; App local startup `:55-72`; obsolete-service search clean.
- PASS — 05.4: Ordinary link and image URL insertion remains functional. Evidence: ImageModal/pagedown and link/image shortcuts retained; browser URL insertion `:1275-1291`.
- PASS — 05.5: Legacy tokens, integration preferences, sync/publish locations, and provider URL parameters cannot activate a removed feature or trigger a network request. Evidence: no active token/account getter/operation; boolean retention compatibility only; browser legacy-state URL/network assertions `:1113-1131,1239-1274,1849-1911`.
- PASS — 05.6: Stored credentials are not emitted in normal workspace backups, displayed, or used; the update does not introduce automatic credential deletion. Evidence: credentials retained locally and excluded from backups; constants `:13-19`, backupSvc `:23-42`; browser `:1893-1911`, retention fixtures `:770-825`.
- PASS — 05.7: Local workspace startup, persistence, fixed exports, and editing remain functional after the provider directory is removed. Evidence: fresh full unit/build/browser checks with provider directory absent.
- PASS — 05.8: Seeded legacy-state browser checks confirm no integration/backend request during startup, reconnect, file activation, menus, or exports. Evidence: legacy-state request assertions across startup, workspace access, activation, menus, reconnect/offline, exports and embedded browser workflows.

### 06 — Keep music notation source as ordinary code

- PASS — 06.1: ABC music rendering, its presets/options, music-specific examples/assets, and its dependency are removed. Evidence: ABC extension/presets/options/examples/assets/dependency removed; src/extensions/defaults/welcome/landing/package inspection.
- PASS — 06.2: Existing ABC fences retain exact source text and render as ordinary fenced code instead of a music sheet. Evidence: legacy ABC public conversion test `test/unit/specs/abc-legacy-properties.spec.js:7-33`; browser preview/export exact source `:1739-1742,1750-1751`.
- PASS — 06.3: Old properties enabling ABC are tolerated without errors or new rendering behavior. Evidence: legacy ABC settings are ignored through real extension/conversion interface; abc-legacy-properties test.
- PASS — 06.4: Mermaid, KaTeX, emoji, Markdown extensions, highlighting, and normal fenced-code behavior remain available. Evidence: extensions index/presets retain Mermaid/math/emoji/Markdown/highlighting; package dependencies; browser diagram/math export `:1717-1762`.
- PASS — 06.5: Rendered preview/export regressions cover an old ABC note beside retained diagrams/math; dependency inspection confirms the music library is absent. Evidence: fresh legacy ABC unit/browser regression beside diagram/math and package-lock absence of abcjs.

### 07 — Remove badges and achievement bookkeeping

- PASS — 07.1: Badge dialogs, achievements, counters, feature descriptions, and badge-writing call sites are removed. Evidence: badgeSvc/features/BadgeManagementModal deleted, removed counters/call sites verified by source inspection.
- PASS — 07.2: Formatting, file/folder management, search, workspace actions, import/export, and backup actions work without badge state or modules. Evidence: full core notebook browser workflows and ButtonBar/Explorer/ExplorerNode/WorkspaceSearchPanel suites pass without badges.
- PASS — 07.3: Existing badge records remain inert without automatic deletion or recreation on ordinary actions. Evidence: generic data storage retains old records; ExplorerNode legacy badge localStorage assertions `test/unit/specs/components/ExplorerNode.spec.js:109-152`.
- PASS — 07.4: Default state and new installations no longer create badge-tracking records. Evidence: defaultLocalSettings no achievement defaults; new-file no-badge regression `test/unit/specs/components/ExplorerNode.spec.js:109-121`.
- PASS — 07.5: Representative browser workflows and source/state checks confirm core actions do not require or write achievements. Evidence: fresh browser core actions and explicit ExplorerNode state/source checks confirm no badge module/write.

### 08 — Finish compatibility storage and describe the local notebook

- PASS — 08.1: Active state/settings retain only supported behavior; legacy record types needed for read/export compatibility use a minimal inert representation. Evidence: generic inert publish/sync/syncedContent modules `src/store/index.js:35-38`; generic data storage without feature getters; compatibility retention exposes boolean only.
- PASS — 08.2: Existing workspace snapshots retain archived templates, sync/publish records, history, supported document metadata, and other existing records without reactivating removed code. Evidence: backup snapshot `src/services/backupSvc.js:23-42`; backup archived history/template/sync/publish regression `:118-238`; browser `:1884-1900`.
- PASS — 08.3: Supported old backup import continues restoring v4/v5 notes/folders/properties/annotations, including leading byte-order marks; it does not claim full cloud/global-state restoration. Evidence: backupSvc supported restore `:56-123`; BOM/v4/v5 note/folder/annotation/property tests `test/unit/specs/backup.spec.js:8-97`.
- PASS — 08.4: Timestamped backups retain immediate in-memory edits, unopened content, complete stable payload equality, initiating-workspace isolation, and Trash/Temp inclusion. Evidence: timestamp/snapshot backup service `:10-49`; backup async-start isolation/immediate edits tests `:118-238`; browser `:1648-1693`.
- PASS — 08.5: Removed-feature preferences are tolerated without errors or execution, while new defaults omit obsolete settings; existing Trash/Temp retention behavior is preserved. Evidence: `src/store/workspace.js:32-51` matches historical HEAD credential-presence rules; `src/services/localDbSvc.js:513-520` retains age+exemption; 11 eligibility cases and three browser upgrade cases `:770-825`; defaults/Temp behavior retained.
- PASS — 08.6: Temporary forwarding interfaces and unused code, dependencies, icons, landing media, defaults, and assets are removed after all consumers have migrated. Evidence: obsolete forwarding/provider/template/music/badge assets gone; OAuth callback deleted and deploy conf/font/callback preparation gone; exact packaging and emitted CSS resources check pass.
- PASS — 08.7: Welcome/help, menus, landing content, and README accurately describe local saving, search, backup, fixed HTML export, printing, and removed features. Evidence: fresh README/welcome/FAQ/MainMenu/ImportExportMenu/landing reads accurately describe local save/search/backup/styled HTML/Print and removed workflows.
- PASS — 08.8: Local editing/undo diff support, HTML sanitization, diagrams/math, search, backups, and embedded/light behavior retain necessary implementations and dependencies. Evidence: package dependencies retain diff/DOMPurify/Mermaid/KaTeX; editor/search/backup/light services and full suites remain.
- PASS — 08.9: Compatibility regressions compare supported payloads and demonstrate old-workspace upgrade, backup round trips, removed-state tolerance, and fixed export. Evidence: fresh backup/serializer/startup/persistence suites and production old-database/removed-state/backup/export/retention regressions pass.

### 09 — Validate the simplified static notebook in production

- PASS — 09.1: The established lint/unit suite, static production build, dependency audit, and diff checks pass; any validation gaps are stated explicitly. Evidence: two clean consecutive `npm test` executions (122 tests), production build/browser/audit/syntax/scoped diff; first teardown failure and root repair documented below.
- PASS — 09.2: The existing isolated browser harness covers retained editing, find/replace, workspace search and navigation, folder operations, imports, fixed exports, printing, and backups. Evidence: full existing production harness passes retained editing/find-replace/search/folder/import/export/print/backup workflows.
- PASS — 09.3: Legacy Main and provider-associated workspace fixtures verify names, IDs, local contents, folder relationships, annotations, and inactive metadata after upgrade. Evidence: browser Main/provider old-database fixtures `:830-1107` verify IDs/names/content/folder relationships/annotations/inert metadata.
- PASS — 09.4: Two-tab persistence, separate workspace isolation, immediate-edit exports, and persistence failure outcomes are verified. Evidence: new ordinary/overlapping patch tests; held-autosave/abort/retry browser `:696-767`; cross-tab persisted marker `:1149`, isolation, immediate-edit exports.
- PASS — 09.5: Offline startup, exported HTML opened away from the site, nested deployment paths, installation/service-worker scope, waiting updates, and offline reload remain functional. Evidence: offline HTML `:474-521`; nested path/manifest/scope checks; service-worker update/offline reload `:1964-2114`; exact Pages preparation packaging verified.
- PASS — 09.6: Service-worker updates do not force-reload an edited tab; only explicit user resources and legitimate static/update traffic are allowed by the no-integration request assertions. Evidence: Workbox no forced skipWaiting/client claim `build/webpack.prod.conf.js:99-105`; waiting worker leaves edited page intact; browser legitimate-request assertions.
- PASS — 09.7: Legacy tokens, preferences, URLs, and helper payloads do not cause provider/backend requests or template execution. Evidence: seeded credentials/preferences/URLs/helpers remain inert; browser `:1113-1131,1239-1274,1849-1911`; deployment OAuth absence check.
- PASS — 09.8: Embedded/light parent messaging and Temp behavior receive regression coverage. Evidence: browser embedded parent messaging/close and Temp regression `:2118-2162`.
- PASS — 09.9: Record before/after source, bundle, and dependency measurements without claiming an arbitrary reduction target. Evidence: fresh before/after counts below reproduce baseline measurement without target percentage.
- PASS — 09.10: Audit every spec story/decision against evidence and report manual PDF acceptance separately; feature completion requires the final requirement audit to pass. Evidence: all 38 stories/implementation decisions and all 65 checklist criteria independently reassessed against current code/tests; native OS PDF acceptance remains separately documented.

### Spec stories and implementation decisions

All 38 user stories and all implementation decisions were reassessed in the final state. Stories 1–10 have current local startup/workspace/save/coordination evidence, including the repaired ordinary-edit acknowledgement; 11–19 have retained editor/formatting/undo/preview/search evidence; 20–28 have compatible imports, fixed standalone exports, browser Print and workspace snapshot/restore evidence; 29–30 retain archived annotations/templates/sync metadata inertly; 31–38 have accurate local controls/help, normal URL insertion, legacy ABC code, sanitization/settings tolerance, and removed-provider/backend/obsolete-code evidence. Historical Trash/Temp retention, credentials staying unused/private, data IDs/database names, origin/deployment paths, no forced service-worker reload, light parent messaging and Temp behavior remain within the explicit constraints. OAuth cleanup and save/retention misses from the initial review are resolved.

### Repository checks

The README, package scripts and GitHub Actions workflow establish lint/unit/build/audit/production-browser checks. Commands ran sequentially for test/build/browser workloads. All latest applicable checks pass; the earlier teardown failure is retained as evidence of the repair cycle.

- Initial post-repair failure, resolved — `npm test > /tmp/stackedit-validate-20261010T163634Z/npm-test-final-review.log 2>&1` — exit 1; 17 files / 122 assertions pass, but one `EnvironmentTeardownError: [vitest-worker]: Closing rpc while "onUserConsoleLog" was pending` in the ExplorerNode worker. Root repaired test wrapper lifecycle as described above.
- PASS — `npm run build > /tmp/stackedit-validate-20261010T163634Z/npm-build-final-review.log 2>&1` — exit 0; application and standalone style builds complete with Sass/performance warnings.
- PASS — `npm run browser-smoke > /tmp/stackedit-validate-20261010T163634Z/browser-smoke-final-review.log 2>&1` — exit 0; real production build under `/` and `/docs/app`, including new save status/failure/retry and historical Trash scenarios.
- PASS — `npm test > /tmp/stackedit-validate-20261010T163634Z/npm-test-final-clean-1.log 2>&1` — exit 0; lint 0 errors / 1,060 warnings, 17 files / 122 tests, no unhandled errors.
- PASS — `npm test > /tmp/stackedit-validate-20261010T163634Z/npm-test-final-clean-2.log 2>&1` — exit 0; same 17 files / 122 tests pass again with no unhandled errors.
- PASS — `npm audit --audit-level=low` — exit 0; found 0 vulnerabilities.
- PASS — `node --check test/browser-smoke.cjs` — exit 0.
- PASS — `git diff --check -- README.md build package.json package-lock.json src static test .github/workflows/main.yml .scratch/offline-notebook-simplification` — exit 0.
- PASS — read-only `node` stdin packaging check: parse `.github/workflows/main.yml` with js-yaml, extract only deploy's exact `Prepare GitHub Pages artifact` run body, copy current static/dist into isolated temp, execute `bash -e -c <exact run body>`, assert required output and resolve all emitted CSS url resources. Process and extracted shell exit 0. Temp: `/var/folders/ph/ytq0kx9n5r17x4qq05_8q0w40000gp/T/stackedit-pages-final-review-bELlah`; 174 packaged files, no OAuth or conf. This executes no Git/deployment/publishing step.
- PASS — `rg -n 'oauth2|pdfExport|pandocExport|networkSvc|syncSvc|badgeSvc|templateWorker|exportToDisk|abcjs|handlebars' src build package.json .github static` — no remaining matches for removed operations/dependencies/artifacts.
- PASS — read-only `git show HEAD:src/store/data.js`, prior localDb/workspace inspection — current boolean-only Trash compatibility mirrors the historical token lookup rules without reinstating account operations.
- PASS — Python read-only whitespace check using `git ls-files --others --exclude-standard src static test build .github .scratch/offline-notebook-simplification` — 16 applicable untracked text files; implementation/test/spec/tickets clean. Ten existing validation.md Markdown hard-break lines preserved under append-only rules.
- PASS — Python read-only source/artifact/package measurements against `/tmp/stackedit-offline-baseline-20261010` — counts below.

### Measurements

| Measure | Baseline | Final |
| --- | ---: | ---: |
| Source files | 290 | 180 |
| Source lines | 35,305 | 21,093 |
| Source bytes | 2,267,506 | 1,809,408 |
| Production artifact bytes | 43,966,557 | 39,848,637 |
| Non-map JavaScript bytes | 7,476,325 | 6,671,833 |
| Runtime dependencies | 31 | 28 |
| Development dependencies | 46 | 46 |
| Lockfile packages | 1,174 | 1,167 |

Measurements are evidence rather than an arbitrary reduction target; ignored dist was rebuilt for this review; the parent preserved its complete pre-review contents at `/tmp/stackedit-validate-20261010T163634Z/dist-before-validation` for restoration.

### Limitations

- Native operating-system Print / Save as PDF dialog remains a manual acceptance item. Browser Print invocation, print layout and generated nonempty Chromium PDF passed.
- Production checks used owned local servers and an isolated exact artifact preparation run; no live site deployment or remote Actions run was performed.
- Existing lint/Sass/performance warnings remain; they do not fail the repository's checks.
- Prior report Markdown hard-break spaces were preserved, and earlier FAIL entries are not rewritten.
