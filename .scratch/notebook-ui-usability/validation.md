# Validation — notebook UI usability

**Date:** 2026-10-11

**Status:** PASS

**Scope:** Current implementation and all five acceptance tickets in `spec.md`.

## Validation gates

- **PASS — `npm test` (revalidated 2026-10-11):** 17 test files and 122 tests passed. ESLint reported 0 errors and 1,089 warnings.
- **PASS — `npm run build` (revalidated 2026-10-11):** production build completed and emitted `dist/static/js/app.28b59ad939e88a0d9ef6.js`. The app compilation reported 75 warnings; the standalone style compilation reported 17. They include Sass deprecations and bundle/asset size recommendations.
- **PASS — `npm run browser-smoke` (revalidated after build):** full run passed at `/` and `/docs/app`, including the menu layout matrix, short- and long-line search activation, HTML export failure handling, downloads, offline reload/search, workspace isolation, backups, and restore.
- **PASS — `node --check test/browser-smoke.cjs` and `git diff --check`:** passed after the final harness changes.
- **Ego Browser review:** the production artifact was reviewed on a fresh local origin. Captures below cover desktop `1728 × 905`, mobile `390 × 844`, reduced height `390 × 480`, light and dark themes, plus the search-with-sidebar-open state. Application sources were unchanged after that review; the final build emitted the same hashed application asset.

One earlier full smoke run timed out in the separate injected autosave-abort scenario. Five subsequent full smoke runs passed without code changes to that path. No product regression was reproduced; this transient harness result is recorded rather than hidden.

Known validation warnings are limited to the lint/Sass/bundle-size notices above. No additional usability defect was confirmed in the production review. No live deployment was performed.

## Ticket 01 — compact sidebar icons

| Criterion | Evidence |
| --- | --- |
| Every icon uses the 20 × 20 CSS-pixel area beside its label. | `assertMenuIconGeometry` checks wrapper and SVG dimensions and text alignment for every visible entry at `test/browser-smoke.cjs:199-309`. |
| Main menu, Import/export, Workspaces, Workspace backups, and import entries are covered. | The production browser invokes the geometry check for all four menu surfaces at `test/browser-smoke.cjs:2177-2182`; Import/export includes both import labels and export actions. |
| Short entries stay compact and row targets remain usable. | The same check requires row heights from 40px up to under 120px; public pointer/keyboard flows also activate submenu, Settings, and export actions. |
| Labels, descriptions, and bottom entries remain visible and reachable without horizontal overflow in both themes and all tested sizes. | The check loops light/dark and `1728 × 905`, `390 × 844`, and `390 × 480`; it checks page/panel width and scrolls to prove the bottom entry is reachable. Visual references: [main menu, light desktop](evidence/final-production-main-menu-light-desktop-1728x905.png), [main menu, dark desktop](evidence/final-production-main-menu-dark-desktop-1728x905.png), [main menu, light mobile](evidence/final-production-main-menu-light-mobile-390x844.png), [main menu, dark mobile](evidence/final-production-main-menu-dark-mobile-390x844.png), [Import/export, light desktop](evidence/ego-production-import-export-light-desktop-1728x905.png), [Import/export, dark mobile](evidence/ego-production-import-export-dark-mobile-390x844.png), [Workspaces, light desktop](evidence/ego-production-workspaces-light-desktop-1728x905.png), and [Workspace backups, dark desktop](evidence/ego-production-backups-dark-desktop-1728x905.png). |
| Pointer and keyboard navigation remain functional with targets larger than the icon. | `openMenu` exercises pointer navigation; the main smoke uses Enter on Workspaces and Settings and successfully opens HTML export and downloads it (`test/browser-smoke.cjs:2177-2191`, `1151-1311`, `2870-2940`). |
| Production checks catch the former oversized SVG layout. | The exact 20px assertions fail for the prior 200px SVG geometry; the reviewed production screenshots show the corrected rows and aligned icons (links above). |

## Ticket 02 — readable responsive workspace search

| Criterion | Evidence |
| --- | --- |
| Query, options, actions, close icon, result text, statuses, and errors are readable in both themes. | `measureSearchContrast`, `assertSearchStatusContrastBothThemes`, and `assertSearchLayoutAndContrast` measure rendered colors in `test/browser-smoke.cjs:575-831`; initial, populated, no-result, validation, and failure states are checked. |
| Enabled text contrast is at least 4.5:1; essential icons/focus indicators are at least 3:1. | The search checks include computed opacity composition, hover and focus states, query/name/path/snippet/highlight/action colors, close icon contrast, and focus-ring contrast (`test/browser-smoke.cjs:575-831`). |
| Names, paths, and snippets retain original case and visual hierarchy. | The populated 24-result fixture uses mixed-case long names and paths; computed `text-transform` must be `none`, and content matching includes mixed-case and Unicode checks (`test/browser-smoke.cjs:2345-2352`, `2483-2502`, `2740-2770`). |
| Desktop search leaves usable right-sidebar controls clear, including with the sidebar open. | The 1728px layout assertion requires the panel to end before a visible sidebar; production desktop captures show both together: [light](evidence/ego-production-search-light-desktop-1728x905.png) and [dark](evidence/ego-production-search-dark-desktop-1728x905.png). |
| Mobile and reduced-height search fit the viewport and keep query, actions, close, and results reachable. | Automated layout checks cover `390 × 844` and `390 × 480` in both themes, including scroll-to-actions and scroll-to-last-result checks (`test/browser-smoke.cjs:647-831`). See [light mobile](evidence/ego-production-search-light-mobile-390x480.png), [dark mobile](evidence/ego-production-search-dark-mobile-390x844.png), and [reduced-height scrolled results](evidence/ego-production-search-light-mobile-390x480-scrolled.png). |
| Many results stay bounded; long names, nested paths, and snippets wrap inside the panel. | A seeded nested folder and 24 long mixed-case filenames provide the result set; the harness checks bounded scrolling and every name/path/snippet’s horizontal bounds at each theme/viewport (`test/browser-smoke.cjs:2345-2485`, `647-831`). |
| Pointer/keyboard activation opens the right document, focuses/selects the first match, keeps search open, and avoids covering short and long matches. | Desktop keyboard activation asserts a distant selected match and open panel; mobile pointer activation asserts visible, uncovered short-line and long-line selections (`test/browser-smoke.cjs:2620-2695`). The long-line fixture contains one logical line with 28 wrapped context segments before its target. See [light selected mobile match](evidence/ego-production-search-selected-light-mobile-390x844.png) and [dark selected mobile match](evidence/ego-production-search-selected-dark-mobile-390x844.png). |
| Reset, both Close controls, and Escape work, including Escape after editor focus. | Reset restores default options and focuses the query; both Close controls are used; after result activation transfers focus to the editor, Escape closes search (`test/browser-smoke.cjs:2700-2785`, `2620-2695`). |
| Initial, searching, populated, empty, invalid-option, and failure states are visible; focus remains visible without a trap. | The harness checks initial/searching/completed/no-result/validation/failure states and keyboard focus/activation. It simulates a database failure through the public search workflow (`test/browser-smoke.cjs:630-831`, `2480-2575`, `2700-2785`). |
| Existing local search behavior remains intact. | Public smoke fixtures cover unloaded content, current edits, nested folders, workspace isolation, Trash/Temp exclusion, case sensitivity, Unicode, safe text, stale results, first-match selection, and offline search (`test/browser-smoke.cjs:2325-2375`, `2620-2785`, `3190-3240`). |
| Production browser visuals cover both themes and viewport sizes. | Search captures include both themes on desktop and mobile, reduced height, selected matches, and the open sidebar (references above). |

## Ticket 03 — bounded Settings dialog

| Criterion | Evidence |
| --- | --- |
| Custom and Default dialogs stay bounded on desktop/mobile in both themes, including reduced height. | `assertSettingsDialogUsability` checks Custom in both themes at desktop, `390 × 844`, and `390 × 480`; it checks Default sizing in light and dark at those sizes, then checks custom validation at reduced height (`test/browser-smoke.cjs:310-629`). Visual references: [light defaults, desktop](evidence/ego-production-settings-default-light-desktop-1728x905.png), [dark defaults, desktop](evidence/ego-production-settings-default-dark-desktop-1728x905.png), [light defaults, reduced height](evidence/ego-production-settings-default-light-mobile-390x480.png), [dark defaults, reduced height](evidence/final-production-settings-default-dark-mobile-390x480.png), [light custom, desktop](evidence/final-production-settings-light-desktop-1728x905.png), and [dark custom, reduced height](evidence/ego-production-settings-custom-dark-mobile-390x480.png). |
| Long defaults and validation content stay inside the dialog; tabs and actions remain reachable without page overflow. | The harness proves default content scrolls, sticky tabs stay reachable, long invalid YAML and its validation message scroll, then verifies tabs and Cancel/OK remain inside the dialog (`test/browser-smoke.cjs:360-510`). |
| Defaults stay read-only and tab changes preserve custom edits. | The Default editor is asserted `contenteditable=false`; a custom YAML draft is retained after switching to Default and back (`test/browser-smoke.cjs:333-341`, `420-438`). |
| Valid YAML saves and reopens; Cancel does not save. | The test captures persisted settings, verifies Cancel leaves them unchanged, saves valid dark-theme YAML, reopens it, then restores the original settings (`test/browser-smoke.cjs:310-500`). |
| Invalid YAML shows a reachable error, cannot save, and valid YAML can subsequently save. | Invalid YAML exposes the error and disables OK; correcting the YAML re-enables OK, then Cancel leaves persisted settings unchanged and a valid save is reopened (`test/browser-smoke.cjs:440-560`). |
| Pointer and keyboard users can change tabs, scroll, and reach focused actions. | The test clicks and presses Enter on tabs, scrolls default and invalid content, tabs through Cancel/OK, checks visible focus contrast, and activates save/cancel (`test/browser-smoke.cjs:310-629`). |
| Production checks reproduce the full-default-content pressure and verify the bounded result. | The production dialog test renders the full default YAML, asserts that its content scrolls internally while the dialog/actions stay within the viewport, and the desktop/mobile Settings captures show the rendered dialog (`test/browser-smoke.cjs:370-460`; default Settings evidence above). |

## Ticket 04 — HTML download contrast and behavior

| Criterion | Evidence |
| --- | --- |
| Enabled Download HTML text meets 4.5:1 in default/hover/focus and both themes, with visible focus. | `exportHtml` measures contrast and focus for light/dark at desktop and mobile viewports, including hover and focus (`test/browser-smoke.cjs:1151-1311`). See [light desktop](evidence/ego-production-html-export-light-desktop-1728x905.png), [dark desktop](evidence/ego-production-html-export-dark-desktop-1728x905.png), and [dark mobile](evidence/ego-production-html-export-dark-mobile-390x480.png). |
| Preparation and error states keep unavailable actions disabled. | The helper observes Download HTML disabling and re-enabling during TOC preparation. `assertHtmlExportFailure` simulates a local stylesheet fetch failure through the visible export workflow, checks the alert plus disabled Copy/Download, and verifies no download event (`test/browser-smoke.cjs:1151-1364`). |
| Copy, Cancel, and table-of-contents controls remain reachable and work. | The test selects TOC, copies rendered HTML to the clipboard, cancels a simulated error, and performs real downloads with and without TOC (`test/browser-smoke.cjs:1151-1311`, `2870-2940`). |
| Downloaded HTML retains selected content/TOC and works offline with embedded assets. | Export assertions verify rendered Mermaid/SVG/math/code, TOC anchors, embedded CSS/fonts, no external styles, and offline opening (`test/browser-smoke.cjs:2850-2940`, `1365-1414`). |
| Shared action styling leaves Settings OK and other visible consumers readable/functioning. | Settings OK contrast/focus and successful save are checked; the main menu/export flows are also activated (`test/browser-smoke.cjs:310-629`, `1151-1364`, `2177-2191`). |
| Production checks verify an enabled real download and visual appearance. | Download readiness is awaited before contrast assertions; Playwright captures the file and the Ego Browser screenshots show the enabled action in both themes (references above). |

## Ticket 05 — combined production review

| Criterion | Evidence |
| --- | --- |
| Lint/unit, production build, full browser smoke, and scoped diff checks pass. | Gate results are listed above: 1,089 lint warnings, 75 main compilation warnings, and 17 standalone style compilation warnings; all build warnings are Sass or bundle/asset size notices. |
| Ego review covers desktop/mobile in both themes and reduced height on the completed production artifact. | Screenshot links above cover both themes and viewports; reduced-height search, Settings, and HTML export captures are included. The browser smoke served the built static output at `/` and `/docs/app`. |
| Every ticket criterion maps to concrete checks and visual evidence. | Tickets 01–04 are mapped criterion by criterion in this document. |
| Review covers welcome/editor/preview, explorer, sidebar/submenus, search, Settings, and HTML export; no further defect was confirmed. | Production captures include the Welcome/editor/preview, explorer, all menu surfaces, search, Settings, and HTML export. The combined smoke exercised public workflows. |
| Sidebar/search, result focus/Escape, Settings tab/error, and enabled export/download combinations work together. | Search is checked while the sidebar is open; result activation leaves focus in the editor and Escape closes it; Settings long/error content and tab switching are exercised; export preparation, failure, copy, TOC, and download are covered. |
| Editing, autosave/persistence, workspace isolation, import/export, backup/restore, and offline behavior remain covered. | Full smoke covers editing and persisted reload, imported Markdown/HTML, workspace isolation, backup contents and restore, offline search/reload, and standalone HTML. |
| Fixtures are isolated and user browser data is preserved; stale service-worker behavior is separated. | The smoke creates isolated Playwright browser contexts and test-local IndexedDB/localStorage fixtures, uses a fresh production review origin, and tests service-worker updates separately. No user browser profile data was cleared. |
| Validation identifies the artifact, viewport/theme/state, results, and limitations. | This file records the build asset, test results, screenshot matrix, warnings, and the single transient autosave-scenario timeout followed by five successful full reruns. |
