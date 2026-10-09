# 02 — Build the static app on Node 24 with supported tooling

**What to build:** A maintainer can install and build the static app reproducibly from a clean checkout using the supported Node.js runtime.

**Blocked by:** 01 — Remove server-only and unsafe release paths.

**Status:** ready-for-agent
**Implementation status:** complete

- [x] Node 24 LTS is supported for development and production builds.
- [x] The build uses Webpack 5 and Dart Sass with compatible loaders and plugins.
- [x] A refreshed lockfile supports reproducible `npm ci` installs.
- [x] The production build emits the static artifact at the existing deployment layout.

## Verification

- `package.json` declares Node.js `>=24.11.0` and the supported Webpack 5 / Dart Sass toolchain.
- `package-lock.json` is present for reproducible `npm ci` installs.
- The production build emits `dist/`; the GitHub Pages workflow packages it under `docs/app`.
- Node 24 `npm ci` and production build verification are recorded in issue 06.
