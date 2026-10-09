# StackEdit static-site maintenance and security refresh

**Status:** ready-for-agent

## Problem Statement

StackEdit Serverless is intended to be a static, offline-capable Markdown editor, but its build and dependency stack has not kept up with supported Node.js releases. The project still depends on an old Vue and Webpack toolchain, an outdated lockfile, and an aging CI configuration. A current `npm audit` reports 286 affected packages: 78 critical, 97 high, 99 moderate, and 12 low.

The old dependency tree creates both security exposure and build failures for maintainers trying to use a current environment. The project also retains server, container, Helm, Travis, and release-script paths that do not match the static-site product. Its hand-maintained HTML sanitizer sits on paths that render Markdown, import HTML, and generate exports, so the dependency refresh must improve security without breaking notes, workspaces, or offline use.

## Solution

Refresh the project as a maintained static-site application. Move development and CI to Node 24 LTS and a reproducible npm install, update the application and build dependencies to supported versions, and make `npm audit` report zero vulnerabilities across runtime and development dependencies.

Retain the current Vue editor experience and local-first behavior while moving to Vue 3 compatibility mode, Webpack 5, Workbox, Dart Sass, Vitest, and Vue Test Utils 2. Replace or harden the legacy HTML sanitizer with a maintained sanitizer and an explicit allowlist. Remove unused server-only code and obsolete server deployment paths, and remove the version hook that pushes to a remote and publishes to npm.

Add CI checks for linting, unit and component tests, production builds, browser smoke behavior against the built static app, and a clean dependency audit. Keep the GitHub Pages artifact static and functional below its deployment path. Existing browser workspace data and backup files must continue to work after an update.

## Acceptance Criteria

- A clean Node 24 LTS install with `npm ci` succeeds; lint, unit/component tests, and the production build pass; `npm audit --audit-level=low` reports zero vulnerabilities.
- The production output is a static artifact that works below `/docs/app/` without a runtime server, and the GitHub Pages deployment publishes only the artifact verified by CI.
- Users can edit and preview documents, reload without losing the current document, import and export Markdown and HTML, and export then restore a workspace backup without losing existing data.
- After the service worker has installed and cached the app, it can reload and open the workspace offline from `/docs/app/`; updates preserve workspace data.
- Supported safe document formatting and media remain available, while scripts, event handlers, and unsafe URL schemes remain inert in preview, HTML import, and export.
- A local version bump does not push to a remote or publish to npm, and unused server-only code and obsolete server deployment paths are absent.
- Pull requests and pushes to `main` run the required Node 24 install, lint, tests, build, browser smoke, and full audit; deployment runs only after those checks pass on a push to `main`.

## User Stories

1. As a StackEdit user, I want the editor to load from a static host without a server, so that I can use the serverless edition as intended.
2. As a StackEdit user, I want to create and edit notes in the browser, so that I can work without creating an online account.
3. As a StackEdit user, I want my workspace to remain available after closing and reopening the browser, so that my locally stored notes are preserved.
4. As a StackEdit user, I want an application update to preserve my existing workspace, so that maintenance releases do not erase my notes.
5. As a StackEdit user, I want the editor to continue working offline after the app has loaded, so that I can write without a network connection.
6. As a StackEdit user, I want the offline app to receive updates safely, so that I can use the current version without losing local data.
7. As a StackEdit user, I want Markdown preview and its existing syntax extensions to keep working, so that my documents continue to render as expected.
8. As a StackEdit user, I want safe HTML and media supported by the editor to remain usable, so that existing documents do not lose their intended formatting.
9. As a StackEdit user, I want scripts, event handlers, and unsafe URL schemes in document content to remain inert, so that viewing or importing a document cannot run injected code.
10. As a StackEdit user, I want to import Markdown files and export notes as Markdown, so that I can move documents between StackEdit and other tools.
11. As a StackEdit user, I want to import HTML as Markdown and export notes as HTML, so that I can reuse content in either format safely.
12. As a StackEdit user, I want to export and restore a workspace backup, so that I can move or recover all of my local notes.
13. As a maintainer, I want the project to install reproducibly on Node 24 LTS, so that a clean checkout can be built on a supported runtime.
14. As a contributor, I want the dependency lockfile to cover runtime and development packages, so that local and CI installs resolve the same dependency graph.
15. As a maintainer, I want lint, unit and component tests, production build, browser smoke, and dependency audit checks in CI, so that regressions are caught before release.
16. As a maintainer, I want the complete dependency audit to report zero findings, so that known vulnerable direct and transitive packages are not accepted in either runtime or development dependencies.
17. As a maintainer, I want the production artifact to work at the GitHub Pages deployment path and retain offline behavior, so that the static site can be published without a server.
18. As a maintainer, I want a local version bump to avoid pushing to a remote or publishing to npm, so that versioning cannot trigger an unexpected release.
19. As a maintainer, I want obsolete server deployment paths removed, so that contributors can see and operate the project as a static-site application.

## Implementation Decisions

- Keep the project static-site-only. Do not rebase onto upstream or restore server-backed integrations, APIs, or cloud sync behavior.
- Preserve the browser editor, local IndexedDB workspace, Markdown preview, import/export, workspace backup format, and offline install and update behavior.
- Use Node 24 LTS in development and CI, a lockfile generated by the supported npm toolchain, and `npm ci` for repeatable installs.
- Migrate the application to Vue 3 compatibility mode and a supported build and test stack: Webpack 5, Workbox, Dart Sass, Vitest, and Vue Test Utils 2.
- Refresh or remove vulnerable packages until a full `npm audit` reports zero findings across production and development dependencies. Do not accept known findings through an allowlist.
- Replace or harden the hand-maintained sanitizer with a maintained, parser-based sanitizer and an application-defined allowlist. Preserve supported safe document formatting and media while rejecting executable markup, event-handler attributes, and unsafe URL schemes.
- Remove unused server-only code and the obsolete Docker, Helm, and Travis release paths. Keep the static GitHub Pages build and its current deployment layout.
- Remove the version lifecycle behavior that pushes to a remote or runs `npm publish`; local version changes must not publish externally.
- Do not reset or discard existing IndexedDB data, and do not change the workspace backup format as part of this maintenance.

## Testing Decisions

- Tests should assert user-visible behavior and compatibility, not private component implementation details.
- Add a browser smoke seam that loads the built static artifact at its deployment path and exercises editing, preview, reload persistence, Markdown and HTML import/export, workspace backup restore, and offline reload after initial caching.
- Include a malicious document payload in the browser or sanitizer behavior checks and assert it cannot execute scripts, event handlers, or unsafe links.
- Migrate the existing component tests to Vitest and Vue Test Utils 2. Existing Vue component tests and their shared mounting helpers are the prior art; the browser smoke harness is a new seam.
- CI should use `npm ci` on Node 24 LTS and run lint, unit and component tests, production build, browser smoke, and the full npm audit. Any audit finding fails the maintenance target.
- Verify that existing workspace data and backup fixtures remain readable after the dependency and framework migration.

## Out of Scope

- Restoring server-backed features, cloud sync, or third-party account integrations.
- Rebasing this fork onto upstream StackEdit or expanding the product with new editing features.
- Redesigning the editor UI or changing the user-visible workspace and backup model.
- Publishing a new site, pushing a release, or publishing the npm package as part of this maintenance plan.

## Further Notes

- The audit baseline was captured on 2026-10-07 from the current lockfile: 286 affected packages, with 78 critical, 97 high, 99 moderate, and 12 low.
- No repository glossary or ADRs were present during planning. The spec uses the terms in the README and UI: static site, workspace, note, offline, import, export, and backup.
- GitHub Issues are disabled for this repository. Specs and implementation tickets for this effort are tracked locally in `.scratch/`.
