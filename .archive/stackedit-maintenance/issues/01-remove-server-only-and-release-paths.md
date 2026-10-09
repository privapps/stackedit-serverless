# 01 — Remove server-only and unsafe release paths

**What to build:** The static StackEdit site remains the supported product, without unused server deployments or version commands that publish remotely.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent
**Implementation status:** complete

- [x] The static production build remains usable without a runtime server.
- [x] Unused server code, server-only dependencies, and obsolete container, Helm, and Travis deployment paths are removed.
- [x] A local version bump does not push to a remote or publish to npm.
- [x] Project guidance describes the static deployment path as the supported release target.

## Verification

- The static production build completes without a runtime server.
- Tracked server, Docker, Helm, and Travis deployment paths have been removed.
- `package.json` version scripts only run local `npm version` commands; `README.md` documents that they do not push or publish.
- `README.md` identifies GitHub Pages as the supported static release target.
