# 05 — Protect preview and import/export HTML with a maintained sanitizer

**What to build:** Users can render and convert supported document content without executing injected scripts or unsafe links.

**Blocked by:** 03 — Keep editor workflows running on Vue 3 compatibility mode.

**Status:** ready-for-agent
**Implementation status:** complete

- [x] A maintained, parser-based sanitizer applies an explicit allowlist to rendered and imported HTML.
- [x] Supported safe formatting and media continue to work in Markdown preview and HTML conversion.
- [x] Scripts, event-handler attributes, and unsafe URL schemes remain inert across preview, comments, import, and export paths.
- [x] Behavior tests cover malicious payloads and expected safe document content.
