# 01 — Preserve document serialization independently of providers

**What to build:** Users can import and export their existing Markdown and metadata through a local document interface, preparing provider removal without changing readable note contents.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent
**Implementation status:** implemented (independent validation pending)

- [x] Markdown import/export uses a document serialization interface without provider registration, account lookup, or network operations.
- [x] Plain Markdown, Unicode, supported properties, discussions/comments, and embedded metadata round-trip without silently losing supported values.
- [x] Missing or malformed embedded metadata preserves readable text and follows the established fallback behavior.
- [x] Existing callers remain functional during prefactoring; any temporary forwarding interface is removed only after its callers migrate.
- [x] Public-interface regression checks cover parsing/serialization and an import/edit/export browser workflow.

## Comments
