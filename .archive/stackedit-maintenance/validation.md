## Validation — 2026-10-07T19:36:36-07:00

**Feature:** `stackedit-maintenance`
**Status:** FAIL
**Spec:** `.scratch/stackedit-maintenance/spec.md` — selected because no explicit spec path was supplied.
**Tickets:** 7 checked

### Workflow metadata

All tickets are marked `ready-for-agent` with implementation status `complete`. Their dependency graph is consistent and acyclic: 01 has no blockers; 02→01; 03→02; 04→02; 05→03; 06→01–05; 07→03, 04, 05, 06. These workflow statuses are not implementation failures. The feature directory had no plan or prior `validation.md`.

### Acceptance criteria

- INCONCLUSIVE — A clean Node 24 LTS install with `npm ci`, lint, unit/component tests, production build, and audit: lint, tests, build, and audit passed on Node `v26.10.0`; CI selects Node 24 (`.github/workflows/main.yml:18–27`). A fresh Node 24 `npm ci` and build were not run.
- PASS — Static artifact and gated GitHub Pages deployment: build produced `dist/`; browser smoke passed at `/docs/app/`. CI uploads the verified artifact and deploys it only after verification on a push to `main` (`.github/workflows/main.yml:32–43, 49–60`).
- PASS — Editing, preview/reload persistence, Markdown and HTML import/export, and workspace backup restore: browser smoke passed (`test/browser-smoke.cjs:216–257, 292–363`).
- INCONCLUSIVE — Offline reload after initial caching preserved data (`test/browser-smoke.cjs:365–412`), but an actual app-version service-worker update was not exercised.
- PASS — Safe formatting/media and inert malicious content: DOMPurify applies explicit allowlists; sanitizer tests and browser smoke cover safe content and malicious scripts, handlers, and links (`src/libs/htmlSanitizer.js:10–25, 76–83`; `test/browser-smoke.cjs:172–193, 264–315`).
- FAIL — No publishing side effects and obsolete server deployment paths absent: `README.md:30–31` still documents Docker-container hosting, contrary to the ticket’s removal of obsolete container deployment paths.
- PASS — Required checks run on pull requests and pushes to `main`, with deployment gated on verification (`.github/workflows/main.yml:3–7, 18–43`).

### Ticket checklist evidence

- **01 — Remove server-only and unsafe release paths:** PASS — static build/browser smoke; no tracked Dockerfile, Helm, or Travis deployment files found. FAIL — Docker hosting instructions remain in `README.md:30–31`. PASS — local version scripts and no-publish guidance (`package.json:20–23`, `README.md:35–36`). PASS — README identifies GitHub Pages as supported (`README.md:12–14`).
- **02 — Build the static app on Node 24:** PASS — Node requirement and CI runtime (`package.json:113–115`, `.github/workflows/main.yml:18–23`); Webpack 5/Dart Sass declarations (`package.json:90–104`); lockfile present (`package-lock.json:4`); production build emitted `dist/`, packaged under `docs/app` by CI (`main.yml:32–37, 60`). INCONCLUSIVE — fresh Node 24 install/build were not run.
- **03 — Keep editor workflows running on Vue 3 compatibility mode:** PASS — compatibility mode (`src/vueCompat.js:3`, `build/vue-loader.conf.js:7`); legacy workspace data test (`test/unit/specs/workspace-persistence.spec.js:47–68`); Vitest/Vue Test Utils 2 declared (`package.json:66, 97`); behavior tests cover editing, preview, and persistence (`test/unit/specs/editor-workflows.spec.js:10–35`, `workspace-persistence.spec.js:76–135`).
- **04 — Preserve offline installation and updates with Workbox:** PASS — Workbox and deployment-path configuration (`build/webpack.prod.conf.js:99–105`, `config/index.js:7–11`); offline smoke passed; no AppCache/obsolete offline-plugin references found. INCONCLUSIVE — update-preservation behavior was not tested across an actual app-version update.
- **05 — Protect preview and import/export HTML with a maintained sanitizer:** PASS — explicit sanitizer allowlists (`src/libs/htmlSanitizer.js:10–25, 76–83`); safe formatting/media tests (`test/unit/specs/html-sanitization.spec.js:7–43`); sanitizer used in preview, comments, import, and export (`src/services/editorSvc.js:162`, `src/components/Comment.vue:45`, `src/components/CurrentDiscussion.vue:60`, `src/components/ImportExportMenu.vue:91–100`, `src/services/exportSvc.js:55`); malicious-payload tests passed.
- **06 — Clear all remaining npm audit findings:** PASS — full audit reported zero findings across the lockfile dependency graph; no audit allowlist/exception found. INCONCLUSIVE — fresh Node 24 `npm ci` and build were not run.
- **07 — Verify static workflows and enforce the CI gate:** PASS — Node 24 and `npm ci` configured (`.github/workflows/main.yml:18–23`); lint, unit, build, audit, and browser smoke configured; smoke covers editing, persistence, import/export, backup restore, offline reload, and malicious content; deployment depends on verification (`.github/workflows/main.yml:40–43`).

### Repository checks

- `node --version` — `v26.10.0`.
- `npm --version` — `11.19.1`.
- `npm run lint` — PASS, exit 0; warnings emitted.
- `npm run unit` — PASS, 11 test files and 65 tests.
- `npm run build` — PASS; `dist/index.html` and `dist/service-worker.js` present.
- `npm run browser-smoke` — PASS; editing, import/export, backup restore, security, and offline reload passed at `/docs/app/`.
- `npm audit --audit-level=low` — PASS, 0 vulnerabilities.
- `git diff --check -- README.md package.json package-lock.json build src test .github/workflows .scratch/stackedit-maintenance` — PASS, no output.
- Node 24 `npm ci` — NOT RUN; Node 24 was unavailable. The CI Playwright install step was also not run locally; cached Chromium supported the passing browser smoke.

### Limitations

Node 24 install/build and service-worker update behavior lack fresh execution evidence. The referenced `workflow-contract.md` was not present in `.agents/skills`; the review followed the supplied validation instructions. No relevant tracked changes were reported. Existing untracked `.agents/`, `AGENTS.md`, and `docs/` paths were left untouched.

## Validation — 2026-10-07T21:34:29-07:00

**Feature:** `stackedit-maintenance`
**Status:** PASS
**Spec:** `.scratch/stackedit-maintenance/spec.md` — local spec selected; acceptance criteria at lines 19–27.
**Tickets:** 7 checked

### Workflow metadata

- All seven tickets have `Status: ready-for-agent` and `Implementation status: complete`; dependency graph is acyclic: 01 none; 02→01; 03→02; 04→02; 05→03; 06→01–05; 07→03–06.
- No separate plan was present. The pre-existing validation report was inspected and preserved.

### Acceptance criteria

- PASS — Clean Node 24 install, lint, unit/component tests, production build, and zero-vulnerability audit: Node `v24.21.0`; clean install passed; unit tests passed (11 files, 65 tests); lint passed with 0 errors / 2,387 warnings; build passed with 17 warnings; audit found 0 vulnerabilities.
- PASS — Static artifact works at `/docs/app/` and only the verified artifact deploys: relative paths in `config/index.js:6–11`, Workbox in `build/webpack.prod.conf.js:99–104`; smoke serves the built artifact at `test/browser-smoke.cjs:8, 246`; CI uploads `dist/` and gates deployment on verification (`.github/workflows/main.yml:32–43, 49–53, 78`).
- PASS — Editing, preview, reload persistence, Markdown/HTML import/export, and backup restore: browser smoke at `test/browser-smoke.cjs:252–299, 366–404`.
- PASS — Offline reload and service-worker update preserve workspace data: browser smoke checks update install/activation, retains `BACKUPRESTOREMARKER`, verifies the updated worker controls the next page, and reloads offline (`test/browser-smoke.cjs:406–497`).
- PASS — Safe formatting/media and inert scripts, event handlers, and unsafe URLs: DOMPurify allowlists (`src/libs/htmlSanitizer.js:10–25, 76–83`), behavior tests (`test/unit/specs/html-sanitization.spec.js:7–50`), sanitizer call sites (`src/services/editorSvc.js:162`, `src/components/gutters/Comment.vue:45`, `src/components/gutters/CurrentDiscussion.vue:60`, `src/components/menus/ImportExportMenu.vue:94`, `src/services/exportSvc.js:55`), and browser checks (`test/browser-smoke.cjs:305–359`).
- PASS — Local version changes do not push/publish; server/container deployment paths are absent: local scripts (`package.json:20–23`), no-push/no-publish guidance (`README.md:32–34`), GitHub Pages deployment description (`README.md:12–14`); tracked-path searches found no Docker, Helm, or Travis deployment artifacts. `build/dev-server.js` remains only as the local `npm start` server (`package.json:12`).
- PASS — PRs and `main` run Node 24 install, lint, tests, build, audit, browser smoke; deploy is gated: `.github/workflows/main.yml:3–7, 18–37, 40–53`.

### Ticket checklist evidence

- **01:** PASS — static-only hosting guidance, local version scripts, and removed Docker instructions; README and `package.json:20–23`.
- **02:** PASS — Node requirement (`package.json:113–115`), Webpack 5/Dart Sass (`package.json:90–104`), lockfile (`package-lock.json:4`), and Node 24 install/build.
- **03:** PASS — Vue compatibility (`src/vueCompat.js:3`, `build/vue-loader.conf.js:7`), legacy workspace data (`test/unit/specs/workspace-persistence.spec.js`), and 65 passing behavior tests.
- **04:** PASS — Workbox and deployment path, real update activation and workspace preservation, and offline reload (`build/webpack.prod.conf.js:99–104`, `config/index.js:6–11`, `test/browser-smoke.cjs:406–497`).
- **05:** PASS — maintained sanitizer allowlist, preserved safe content, and malicious-payload tests.
- **06:** PASS — full audit returned zero findings, with no exception/allowlist; clean Node 24 install and build passed.
- **07:** PASS — CI checks, deploy gate, and production browser smoke passed.

### Repository checks

- `npm exec --yes --package=node@24 -- node "$(npm root -g)/npm/bin/npm-cli.js" ci` — PASS; 1,062 packages installed, 0 vulnerabilities.
- `npm exec --yes --package=node@24 -- node "$(npm root -g)/npm/bin/npm-cli.js" run lint` — PASS; 0 errors, 2,387 warnings.
- `npm exec --yes --package=node@24 -- node "$(npm root -g)/npm/bin/npm-cli.js" run unit` — PASS; 11 files, 65 tests.
- `npm exec --yes --package=node@24 -- node "$(npm root -g)/npm/bin/npm-cli.js" run build` — PASS; `dist/index.html` and `dist/service-worker.js` present.
- `npm exec --yes --package=node@24 -- node "$(npm root -g)/npm/bin/npm-cli.js" audit --audit-level=low` — PASS; 0 vulnerabilities.
- `npm exec --yes --package=node@24 -- node "$(npm root -g)/npm/bin/npm-cli.js" run browser-smoke` — PASS at `/docs/app/`, including service-worker update and offline reload.
- `node --check test/browser-smoke.cjs` — PASS (host Node `v26.10.0`).
- `git diff --check 3809024e5f04254a0c3a9e48e5e1b7f9eeb351e1...HEAD -- README.md test/browser-smoke.cjs` — PASS, no output.

### Limitations

- `.agents/skills/workflow-contract.md` is absent; the local validator skill and supplied instructions provided the process, so evidence remained complete.
- CI's separate `npx playwright install --with-deps chromium` step was not run locally; browser smoke passed with available Chromium.
- Existing untracked `.agents/`, `AGENTS.md`, `docs/`, and `validation.md` were left untouched apart from appending this report.


## Validation — 2026-10-09T05:34:56Z

**Feature:** `stackedit-maintenance`
**Status:** PASS
**Spec:** `.scratch/stackedit-maintenance/spec.md`
**Tickets:** 7 checked; all implementation statuses are complete.

### Defect-first review

Reviewed the complete maintenance change from merge base `7f08dc71a3a40a7d205982aca404109e60adc5ee` through `cd7c2ed`, plus the resulting working-tree fixes, against the local spec and tickets. Reviewed application/build/test changes directly, removed server/deployment paths and their call sites, and the lockfile dependency sources and audit. No remaining qualifying findings.

The following findings were confirmed and fixed:

- **[P2] Serve generated development assets before falling back to static files — build/dev-server.js:45.** The replacement server sent every `/static/` request to the source static directory, so the emitted Lato font returned HTTP 404. It now prefers compiled assets; a clean, isolated development build served the font with HTTP 200, MIME `font/woff`, a valid `wOFF` header, and 309,192 bytes. The static landing page also returned HTTP 200.
- **[P2] Await Mermaid rendering before serializing HTML exports — src/extensions/mermaidExtension.js:56.** Mermaid's new asynchronous API returned after export serialized its container. A browser reproduction showed a rendered preview but raw Mermaid code in the HTML download. Extension preview hooks now return their completion promises and export waits for them. Rendering and export use separate temporary containers with cleanup. Production smoke verifies two rendered diagrams and inline SVG in the download, with no remaining Mermaid code elements.
- **[P2] Preserve supported safe SVG and semantic HTML — src/libs/htmlSanitizer.js:10.** The replacement allowlist removed all inline SVG and ruby annotations previously accepted by the editor. Safe elements and drawing attributes are restored explicitly while scripts, handlers, foreign objects, animation, and unsafe URLs remain rejected. Corrected the URI regex's unintended character range so safe numeric SVG paths survive. The new sanitizer behavior test failed before the fix and passes afterward; the browser checks inline SVG in preview and export.
- **[P2] Resolve the installed application's launch URL to the editor — build/webpack.prod.conf.js:95.** The manifest lives under `assets/`, so `start_url: './'` launched that directory. Start URL and scope now resolve through `../` to the editor deployment root. Smoke verifies both resolve exactly to `/docs/app/`.
- **[P2] Emit usable fonts and images with correct stylesheet URLs — build/webpack.base.conf.js:77.** Webpack 5 asset handling combined with legacy loaders emitted JavaScript wrappers as font/image files, and extracted CSS referenced nonexistent files beside the stylesheet. Native asset modules now emit the actual bytes, and extracted styles use paths relative to their output directories. A regression check failed on the wrapper content before rebuilding; it now checks every local asset referenced by both app and standalone stylesheets for existence and rejects JavaScript wrappers.

### Acceptance criteria and repository checks

All seven spec acceptance criteria pass with the implementation and fresh checks below. The existing validation entries and evidence are preserved above.

Commands used Node `v24.21.0` through `npm exec --yes --package=node@24 -- node /opt/homebrew/lib/node_modules/npm/bin/npm-cli.js <command>`:

- `ci` — PASS; clean install of 1,062 packages, 0 vulnerabilities.
- `run lint` — PASS; 0 errors and 2,387 existing warnings.
- `run unit` — PASS; 11 files and 66 tests, including legacy workspace readability and reactive IndexedDB persistence.
- `run build` — PASS; application build and standalone export styles complete. The application compiler reports 120 warnings and standalone styles report 17 warnings, including legacy Sass deprecations and bundle-size recommendations.
- `audit --audit-level=low` — PASS; 0 vulnerabilities across runtime and development dependencies.
- `run browser-smoke` — PASS at `/docs/app/`; stylesheet asset integrity, manifest launch/scope resolution, editing, persistence, Markdown and HTML import/export, two Mermaid diagrams and inline SVG, malicious content, backup restore, service-worker update activation and workspace preservation, and offline reload.
- `node --check test/browser-smoke.cjs`, `node --check build/dev-server.js`, and `git diff --check` — PASS.
- Clean isolated Node 24 development build and HTTP asset checks — PASS as described above.

### Remaining limits

- GitHub Actions and deployment were not executed; the full local checks pass and the configured CI gate was reviewed. No commit, staging operation, push, or deployment was performed.
- Existing lint, Sass, and bundle-size warnings remain; they do not fail the project's gates.
- The shared `workflow-contract.md` referenced by the archive skill is absent from the available skill installations. The supplied archive rules and local tracker documentation identify the canonical spec unambiguously as `.scratch/stackedit-maintenance/spec.md`; no override or legacy-spec fallback is needed.
