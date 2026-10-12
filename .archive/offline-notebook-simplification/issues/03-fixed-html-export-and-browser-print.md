# 03 — Export fixed HTML and print without templates or servers

**What to build:** Users download readable styled HTML or print/save a PDF through the browser, with no custom scripts, template editor, account, or conversion server.

**Blocked by:** 01 — Preserve document serialization independently of providers.

**Status:** ready-for-agent
**Implementation status:** implemented (independent validation pending)

- [x] Markdown export/import retains the compatible document format supplied by the local serialization interface.
- [x] HTML export offers a fixed styled output and optional table of contents, with copy/download behavior and a compatible filename.
- [x] Downloaded HTML renders offline away from the application, including required styles and packaged assets, headings, code highlighting, diagrams, and math.
- [x] Document names and content remain sanitized/escaped appropriately; exported content and legacy helpers do not execute scripts.
- [x] Custom template editing, selection, and helper execution are removed; existing custom template data remains inactive and preserved in existing snapshots.
- [x] Browser Print remains available without credentials or conversion endpoints; existing print styling supports a readable document.
- [x] Server PDF/Pandoc actions, their modals/settings, sponsorship gates, template worker, Handlebars, and the Pandoc-only renderer are removed when unused.
- [x] Browser regressions cover fixed HTML, TOC, offline exported output, print invocation, and no server conversion/helper execution; actual OS Save as PDF is recorded as manual acceptance when needed.

## Comments

2026-10-10: Browser print invocation, print layout, and non-empty PDF generation passed. The native operating-system Print / Save as PDF dialog was not opened; see [validation.md](../validation.md).
