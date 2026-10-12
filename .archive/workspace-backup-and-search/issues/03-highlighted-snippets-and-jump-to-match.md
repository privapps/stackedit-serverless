# 03 — Highlighted search snippets and jump-to-match navigation

**What to build:** Help users understand each search result and reach its relevant text immediately. Extend the working workspace search with highlighted names and context snippets; activating a content result opens the document, selects its first matching occurrence, and brings it into view without editing the text.

**Blocked by:** 02 — Offline workspace search from the navigation bar.

**Status:** ready-for-agent

**Implementation status:** Complete

- [x] Add a bounded context snippet around the first content occurrence to each content-matching document result and highlight the matching text without producing one row per occurrence.
- [x] Highlight matching document-name text. For a name-only result, do not fabricate a content snippet or content offset.
- [x] A document matching both name and content remains one result and uses its first content occurrence for jump navigation.
- [x] Render snippets, names, paths, and query text safely with controlled highlighting. Markdown and HTML-like source remains text and cannot execute.
- [x] Pointer and keyboard activation use the existing document-opening flow and wait for the correct document content to be ready before selecting a match.
- [x] For a content result, select the first matching occurrence in the actual source text and scroll it into view, including a match far below the initial viewport and one in an unopened document.
- [x] Match positions respect the submitted case-sensitivity option and existing editor selection conventions. Multiline text and non-ASCII text, including characters preceding the match, yield the correct selection.
- [x] A name-only result opens normally without an artificial content selection or jump.
- [x] Revalidate document scope and match information when a result is activated. If the document was removed, moved outside active scope, or no longer contains the displayed match, refresh or explicitly report the stale result rather than selecting an obsolete offset.
- [x] Workspace changes and obsolete navigation requests cannot select a match in the wrong document or workspace after asynchronous content loading.
- [x] Keep the panel available for another result after activation, without obscuring the selected match. Close and Escape continue working with appropriate focus behavior.
- [x] Search, highlighting, and result activation do not modify document text or replace existing current-document find/replace behavior.
- [x] Browser acceptance coverage verifies visible highlighted snippets, name-only highlighting, one result for repeated occurrences, actual active document identity, exact selected source text, and visibility of a distant match.
- [x] Cover name-only activation, combined name/content matches, case-sensitive matches, multiline/non-ASCII offsets, stale results, and activation races through the existing browser and focused component/persistence boundaries.
- [x] Confirm keyboard activation and repeated result selection work offline, and regress document editing, current-document find/replace, explorer actions, and the existing backup workflow without introducing production-only test hooks.
- [x] Update search documentation to describe highlighted snippets and first-match navigation. Keep regex, fuzzy search, all-workspaces search, Trash/Temp search, separate Preview actions, and new next/previous-match controls out of scope.

## Comments

- Revalidated on 2026-10-09. `npm test` passes with 83 tests and lint reports 0 errors; `npm run build` and `npm run browser-smoke` pass. Added cross-chunk Unicode and multiline source-offset coverage, plus a component regression proving a newer search invalidates pending result activation.
- Full current-state validation on 2026-10-09 passed. Component tests cover workspace changes, removals, Trash moves, changed content during loading, newer queries, and scope changes while waiting for editor content. Browser smoke confirms exact visible ordering, Escape dismissal, and that the selected match is not covered by the search panel.
