# 09 — Validate the simplified static notebook in production

**What to build:** Users receive a production static build proven to preserve existing notes and supported offline workflows after all removals, with measured simplification and explicit acceptance evidence.

**Blocked by:** 08 — Finish compatibility storage and describe the local notebook.

**Status:** ready-for-agent
**Implementation status:** implemented (independent validation pending)

- [x] The established lint/unit suite, static production build, dependency audit, and diff checks pass; any validation gaps are stated explicitly.
- [x] The existing isolated browser harness covers retained editing, find/replace, workspace search and navigation, folder operations, imports, fixed exports, printing, and backups.
- [x] Legacy Main and provider-associated workspace fixtures verify names, IDs, local contents, folder relationships, annotations, and inactive metadata after upgrade.
- [x] Two-tab persistence, separate workspace isolation, immediate-edit exports, and persistence failure outcomes are verified.
- [x] Offline startup, exported HTML opened away from the site, nested deployment paths, installation/service-worker scope, waiting updates, and offline reload remain functional.
- [x] Service-worker updates do not force-reload an edited tab; only explicit user resources and legitimate static/update traffic are allowed by the no-integration request assertions.
- [x] Legacy tokens, preferences, URLs, and helper payloads do not cause provider/backend requests or template execution.
- [x] Embedded/light parent messaging and Temp behavior receive regression coverage.
- [x] Record before/after source, bundle, and dependency measurements without claiming an arbitrary reduction target.
- [x] Audit every spec story/decision against evidence and report manual PDF acceptance separately; feature completion requires the final requirement audit to pass.

## Comments

2026-10-10: Production acceptance audit passed. Automated evidence and the separate OS print-dialog limitation are recorded in [validation.md](../validation.md).
