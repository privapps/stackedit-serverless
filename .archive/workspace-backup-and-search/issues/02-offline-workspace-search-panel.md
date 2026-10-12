# 02 — Offline workspace search from the navigation bar

**What to build:** Let users search document names and content across the current workspace from a floating panel opened through the top navigation. Deliver useful result lists with folder paths and basic document opening, including reliable access to unopened local documents. Highlighted snippets and jump-to-match behavior are added by Ticket 03.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

**Implementation status:** Complete

- [x] Add an accessible top-navigation search icon that opens a compact floating Search workspace panel independently of explorer visibility. Focus the query input when the panel opens and follow existing application styling and focus conventions.
- [x] Provide Name and Content options enabled by default, Case-sensitive disabled by default, and Search, Reset, and Close controls.
- [x] Enter and Search submit identical searches; typing alone does not run live searches. Reset clears the query and results, retains the selected options, and focuses the input. Close and Escape dismiss the panel.
- [x] Search literal substrings in document names and raw Markdown source content. When both fields are enabled, either field may match. Respect case sensitivity and treat punctuation literally, not as a regular expression.
- [x] Search every active document in the current workspace, including nested folders. Exclude Trash, Temp, their descendants, and documents in other workspaces. Folder names are context, not independent search targets.
- [x] Include documents persisted in IndexedDB whose content is absent from the loaded store, without first opening them. Include latest in-memory edits consistently rather than relying on the next periodic save.
- [x] Scanning does not change the current document, recent-document history, or document text, and does not eagerly load all scanned content into the editor store.
- [x] Use a cohesive workspace-search operation and the existing local persistence abstractions. No backend, external search service, persistent search index, database schema migration, or unrelated storage rewrite is introduced.
- [x] Display one result per matching document, its document name and folder path, an accurate document count, and deterministic folder-path/name ordering. Matching both fields or multiple occurrences must not duplicate a document.
- [x] Selecting a result opens the correct document through the existing activation flow. In this slice, opening is normal document navigation; do not claim snippet highlighting or match selection before Ticket 03.
- [x] Display distinct initial, searching, completed, no-results, validation, and failure states. Empty input returns to the initial state; disabling both fields produces actionable validation.
- [x] Report database failures using the existing error conventions. Do not present a failed or incomplete scan as an empty successful search.
- [x] Clear results when the workspace changes. Older in-flight searches cannot overwrite newer submitted searches or display results for another workspace; closing the panel does not allow a late scan to reopen it or change the document.
- [x] Keep scans responsive to query replacement, panel closure, and workspace changes. Do not silently omit eligible documents through an undocumented result or document cap.
- [x] Provide keyboard access to the panel controls and result activation. Keep the panel usable after opening a result.
- [x] Display document names, paths, and query-related text safely as text, including HTML-like input; no user content is executed as markup.
- [x] Browser acceptance coverage submits queries through both Enter and Search and verifies default options, Name-only and Content-only searches, case variants, literal punctuation, paths for duplicate names, deduplication, ordering, and result counts.
- [x] Acceptance fixtures include an unopened persisted document, a just-edited document, nested active documents, Trash and Temp descendants, another workspace containing the same query, and nonmatching documents.
- [x] Cover empty input, no matches, disabled search fields, database failure, obsolete query completion, panel closure during scanning, and workspace changes using existing browser/component/IndexedDB test seams where appropriate.
- [x] With network access disabled after the application is locally available, search and result opening still work without transmitting queries or document content.
- [x] Preserve document editing, current-document find/replace, explorer controls, and backup workflows. Add user documentation for this working search slice and remove the obsolete note-search limitation.

## Comments

- Revalidated on 2026-10-09. `npm test` passes with 83 tests and lint reports 0 errors; `npm run build` and `npm run browser-smoke` pass. Added coverage for cancellation during IndexedDB result processing and large-content matching, and confirmed 1,100 matches are returned without a cap.
- Full current-state validation on 2026-10-09 passed. Browser smoke asserts visible folder-path/name ordering and observes requests from the offline search page; service tests prove sorting independently of database insertion order.
