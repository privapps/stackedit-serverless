# Workspace Backup Shortcut, Timestamped Downloads, and Workspace Search

Status: ready-for-agent
Blocked by: None

## Problem Statement

Backing up a workspace currently requires navigating to the workspace backup menu. There is no direct backup action beside the explorer controls, making a frequent safeguard unnecessarily inconvenient.

Every workspace backup uses the filename `StackEdit workspace.json`. Repeated downloads are difficult to distinguish and organize because the filename does not identify when the backup was created.

Users cannot search document content across their workspace. The existing find/replace feature operates on the current document, so finding information in another document requires opening documents individually. Workspace search must include documents that are stored locally but are not currently loaded in memory, while preserving the application's offline, serverless behavior.

## Solution

Add an icon button immediately to the left of **Close explorer** in the explorer header. Its tooltip and accessible name are **Export workspace backup**. It performs the same export as the existing menu entry, which remains available.

Both export entry points download a backup named `StackEdit_Workspace_<YYYYMMDD-HHmm>.json`, using the browser's local time in a zero-padded, 24-hour format with minute precision. For example, a backup created at 23:01 on October 8, 2026 is named `StackEdit_Workspace_20261008-2301.json`. The backup JSON format remains compatible with existing import behavior.

Add a search icon in the top navigation that opens a compact floating **Search workspace** panel, following the interaction model observed in StackEditPro. The panel provides a query input, **Name** and **Content** options enabled by default, an optional **Case-sensitive** option disabled by default, and **Search**, **Reset**, and **Close** controls. Enter submits a search.

Search operates entirely locally across the current workspace's active documents, including unopened documents and nested folders, but excluding Trash and Temp. Results show document names, folder paths, and highlighted matching snippets. Selecting a content result opens that document, selects the first matching occurrence, and scrolls it into view.

## Acceptance Criteria

1. The explorer header has an accessible **Export workspace backup** button immediately before **Close explorer**. It and the existing menu entry export the same compatible workspace JSON, including edits made immediately before export.
2. Both backup entry points suggest `StackEdit_Workspace_<YYYYMMDD-HHmm>.json` from one browser-local timestamp. The timestamp is zero-padded, 24-hour, and minute-precision; the exported file remains importable and works offline.
3. The top-navigation search button opens a floating panel whether or not the explorer is open. Name and Content are enabled by default, Case-sensitive is disabled, Enter and Search submit the same query, and Reset, Close, and Escape work by keyboard.
4. Search uses literal substrings over names and raw Markdown content in the current workspace, including nested and unopened active documents and current unsaved edits. It excludes other workspaces, Trash, Temp, and their descendants without changing the active document or document text.
5. Results contain one row per matching document, are ordered by folder path and name, show the folder path, and highlight matching names and a bounded snippet around the first content match. Name-only results have no fabricated content snippet or offset; all displayed user content is safe text.
6. Activating a content result opens the correct document, selects the first matching source text, and scrolls it into view after content is ready. Case-insensitive matching handles Greek final sigma without skipping an earlier exact occurrence; multiline and non-ASCII offsets remain correct. Name-only results open without a jump.
7. Activation rechecks document existence, active-workspace scope, and match validity after asynchronous loading and before selection. Stale results do not activate or select obsolete text. Escape closes the panel even after activation moves focus to the editor.
8. Search shows distinct initial, searching, completed, no-results, validation, and failure states; it does not silently cap results or report a failed scan as empty success. Closing the panel or changing query/workspace prevents obsolete work from publishing results. Search and export require no network service and do not transmit workspace content or queries.
9. Existing backup import, explorer controls, document editing, and current-document find/replace continue to work. User documentation describes the backup shortcut and filename and explains highlighted matching names and context snippets.

## User Stories

1. As a workspace user, I want a backup button beside Close explorer, so that I can export my workspace without navigating through menus.
2. As a workspace user, I want the backup button to have a recognizable icon and an explanatory tooltip, so that I can understand its purpose before clicking it.
3. As a keyboard or assistive-technology user, I want the backup button to have an accessible name and normal keyboard activation, so that I can use the same backup action without a pointer.
4. As a workspace user, I want the existing Export workspace backup menu entry to remain available, so that my established workflow continues to work.
5. As a workspace user, I want both backup entry points to export the same workspace data, so that the shortcut does not produce a different kind of backup.
6. As a workspace user, I want my latest document edits included in a backup, so that clicking export immediately after editing does not lose recent work.
7. As a workspace user, I want the date and time included in backup filenames, so that I can identify when each backup was created.
8. As a workspace user, I want backup timestamps in my browser's local time, so that filenames correspond to the time I recognize.
9. As a workspace user, I want zero-padded filename timestamps, so that backups sort chronologically by name and use a consistent format.
10. As a workspace user, I want the existing JSON backup format preserved, so that renamed downloads can still be imported.
11. As an offline user, I want backup downloads to work without a network connection, so that I can protect locally stored work at any time.
12. As a workspace user, I want a search button in the top navigation, so that I can find documents even when the explorer is closed.
13. As a workspace user, I want search to open in a compact floating panel, so that I can search without leaving the editor.
14. As a workspace user, I want names and document content searched by default, so that I can find a document using either its title or information inside it.
15. As a workspace user, I want to search names only, so that I can locate a document by title without unrelated content matches.
16. As a workspace user, I want to search content only, so that I can find information without title-only matches.
17. As a workspace user, I want case-insensitive search by default, so that capitalization does not prevent useful matches.
18. As a workspace user, I want optional case-sensitive search, so that I can distinguish terms whose capitalization matters.
19. As a workspace user, I want Enter and the Search button to submit the same search, so that I can use my preferred input method.
20. As a workspace user, I want punctuation in my query treated literally, so that I can find code and Markdown text without learning regular expressions.
21. As a workspace user, I want to search all active documents in the current workspace, so that nested folders do not hide relevant information.
22. As a workspace user, I want unopened documents included in results, so that search is not limited to documents I have recently viewed.
23. As a workspace user, I want my latest edits reflected in search, so that I can immediately find information I have just added.
24. As a workspace user, I want Trash and Temp excluded from search, so that deleted or temporary documents do not clutter active-workspace results.
25. As a workspace user, I want other workspaces excluded from search, so that results remain scoped to the workspace I am using.
26. As a workspace user, I want results to display folder paths, so that I can distinguish documents with the same name.
27. As a workspace user, I want highlighted matching snippets, so that I can understand why a document matched without opening it first.
28. As a workspace user, I want one result per matching document, so that repeated occurrences do not overwhelm the document list.
29. As a workspace user, I want selecting a content result to open the document and jump to its first match, so that I do not have to search the document again.
30. As a workspace user, I want selecting a name-only result to open the matching document, so that title searches remain useful even when the query is absent from its content.
31. As a workspace user, I want a result count and a clear no-results message, so that I know whether the submitted search found anything.
32. As a workspace user, I want Reset to clear the query and results, so that I can start another search without reopening the panel.
33. As a keyboard user, I want to navigate and activate results and close the panel with Escape, so that the complete search workflow works without a pointer.
34. As an offline user, I want workspace search to work without external services, so that finding my information does not depend on connectivity.
35. As a privacy-conscious user, I want document content and search queries to remain in my browser, so that workspace search does not transmit my information.
36. As a workspace user, I want search and export failures reported clearly, so that I do not mistake incomplete results or a failed download for success.
37. As a workspace user, I want stale results cleared when changing workspaces, so that a result from an earlier workspace cannot open the wrong document.
38. As a workspace user, I want search and navigation to leave document text unchanged, so that finding information cannot accidentally edit it.
39. As a workspace user, I want current-document find/replace and existing explorer controls to continue working, so that the new features do not disrupt established editing workflows.

## Implementation Decisions

- Keep the application static and serverless. Backups and search use browser-local workspace data; no server, remote search service, external content transmission, or cloud integration is introduced.
- Place the backup shortcut in the explorer header's right-hand action group, immediately before Close explorer. Preserve existing create, delete, rename, and close controls and their relative order.
- Use one shared workspace-export operation for the shortcut and existing backup menu. The backup service is the preferred owner of this behavior, rather than duplicating serialization, download, or filename generation in UI components.
- Resolve the current workspace when the export starts and keep the operation scoped to that workspace. Ensure pending edits are reflected in the exported snapshot, rather than relying on the next periodic persistence cycle.
- Preserve the existing backup record structure and import compatibility. Search exclusions must not be applied to backups: adding the shortcut or renaming downloads must not change which workspace records the existing export includes.
- Generate the filename from a single timestamp captured for the export. Use local calendar components, four-digit year, two-digit month/day/hour/minute, a 24-hour clock, underscores around `Workspace`, one hyphen between date and time, and the `.json` extension.
- Do not add seconds, a timezone suffix, workspace names, or application-generated collision suffixes. Repeated exports within one minute use the same suggested filename; ordinary browser download conflict handling remains unchanged.
- Provide an accessible top-navigation search button independent of explorer visibility. Open a compact floating panel using existing application styling and focus conventions. Focus the query input on opening; provide Close and Escape dismissal.
- Keep the search panel available after result activation so users can inspect another result. Ensure the panel does not prevent the selected match from being brought into view.
- Treat search as a submitted operation, not live search on each keystroke. Enter and Search use identical behavior. Reset clears the query and displayed results, retains the current search options, and focuses the input.
- Default Name and Content to enabled and Case-sensitive to disabled. When both search fields are enabled, match a document if either its name or content contains the query.
- Search literal substrings in document names and raw Markdown source content. Folder names are displayed as context, not searched as independent documents. Do not search comments, discussions, properties, revision history, or rendered-only text.
- An empty query returns the panel to its initial state rather than matching every document. If both Name and Content are disabled, display actionable validation instead of running a meaningless search.
- Scope search to active files in the current workspace. Exclude Trash and Temp and any documents contained beneath those special roots. Do not add an include-Trash option or all-workspaces mode.
- Read the authoritative local workspace data, including content held in IndexedDB but unloaded from the in-memory store. Include current in-memory edits consistently, using the existing persistence boundary or a coherent overlay rather than assuming persisted text is always current.
- Keep search data access separate from document activation. Scanning documents must not open every document, change the current document, update recent-document history, or eagerly load all document contents into the editor store.
- Prefer a single cohesive workspace-search operation responsible for scanning, filtering, and assembling results. Reuse the existing local database and workspace abstractions; avoid unrelated storage rewrites or a persistent indexing subsystem.
- Return one result per document, with stable document identity, display name, folder path, and the information needed to locate a content match. Use a deterministic folder-path/name order. A document matching both its name and content is not duplicated.
- Display a bounded context snippet around the first content occurrence and highlight the matched text. For name-only matches, highlight the matching name and do not fabricate a content snippet or content offset.
- Render names, paths, queries, and snippets as text with controlled highlighting. Treat Markdown or HTML in a snippet as source text, never executable markup.
- Open selected results through the existing document-activation flow. Wait until the correct document content is ready before selecting and scrolling to its first content match. For name-only matches, open normally without an artificial jump.
- Resolve match positions against the actual source string and existing editor selection conventions. Preserve correct navigation for multiline text and non-ASCII text, including text preceding the match.
- Revalidate a result when it is activated. If a document has been removed, moved out of scope, or no longer contains the displayed content match, refresh or explicitly report that the result is stale instead of selecting an obsolete offset.
- Clear workspace-specific results when the workspace changes. Prevent an older in-flight search from replacing results for a newer query or another workspace.
- Display initial, searching, completed, no-results, validation, and failure states distinctly. Use existing notification/error conventions for database or export failures; do not present failed or incomplete operations as successful.
- Keep long scans interruptible or otherwise responsive to closing the panel and changing the query or workspace. Do not impose an undocumented document cap that silently omits eligible results.
- Reuse existing icons, component patterns, and editor APIs where possible. No dependency or database schema change is required by the user-facing design.
- Update the directly related user documentation to describe the backup shortcut, filename format, and workspace search, and remove the obsolete limitation that note search is missing.

## Testing Decisions

- The user approved the existing browser-smoke harness as the primary acceptance-test boundary. Verify features through visible controls, real downloads, persisted workspace data, and actual editor navigation rather than internal method names or private component state.
- Prefer this existing high-level seam over adding production-only test hooks. Use existing component/store and fake-IndexedDB helpers only for focused edge/error cases that are awkward to exercise at the browser boundary.
- Prior art includes browser tests that capture download filenames and bytes, import workspace backups, exercise workspace persistence, edit documents, inspect rendered content, and validate offline application behavior.
- Existing explorer component tests provide prior art for activating header controls and ensuring create, rename, delete, and close behavior remains intact. Existing editor workflow tests provide prior art for mounting real editor components with the application store.
- Existing workspace-persistence tests provide prior art for constructing local databases and verifying records across persistence boundaries. Existing backup-import tests establish compatibility with the current JSON record format.
- Exercise both backup entry points independently. With a fixed local clock and identical workspace state, assert the exact suggested filename and equivalent JSON payloads; do not accept only a loose filename pattern or a mocked export-method call.
- Include zero-padding, minute precision, local-versus-UTC differences, and date-boundary cases in filename coverage. Confirm standard repeated-download behavior without requiring new filename suffix logic.
- Export immediately after an edit and verify the downloaded JSON contains that edit. Import the resulting backup using existing import behavior and verify document names, folder placement, and content remain compatible.
- Confirm exports preserve existing workspace-record coverage rather than adopting the narrower active-document search scope.
- Exercise search through the navigation button, query input, Enter and Search controls, option toggles, Reset, Close, and Escape. Confirm appropriate accessible names and keyboard activation.
- Use a fixture containing nested folders, duplicate document names, name-only matches, content-only matches, repeated occurrences, case variants, punctuation, multiline/non-ASCII content, and nonmatching documents.
- Include documents persisted locally but absent from the loaded content store. Find their content without first opening them, and confirm searching does not alter the active document or recent-document history.
- Include current edits not yet written by the normal periodic persistence cycle and verify they are searchable.
- Include Trash, Temp, descendants of those roots, and another workspace containing the same query. Verify all are excluded while active nested documents remain included.
- Assert one result per document, deterministic ordering, folder paths, accurate result counts, and literal safe highlighting. Ensure HTML-like queries and document text are shown as text and cannot execute.
- Activate a content result and verify the correct document is active, the first matching source text is selected, and the match is visible after content loading. Cover a match far below the initial viewport and a match in an initially unopened document.
- Activate a name-only result and verify normal opening without a fabricated content selection. Confirm the search panel remains usable for a subsequent result.
- Cover empty input, no matches, both search fields disabled, database failures, stale results, query replacement, panel closure during a scan, and workspace changes. Failed scans must not be reported as complete empty results.
- Run acceptance coverage with network access disabled after the application is available locally. Verify backup and search work and do not attempt to transmit queries or workspace content.
- Preserve current-document find/replace, document editing, explorer controls, and backup import behavior. Search, result activation, and backup export must not modify document text.

## Out of Scope

- Implementing these features as part of writing this specification.
- Searching all workspaces, selecting a different workspace from search, or adding workspace scope controls.
- Searching or optionally including Trash and Temp.
- Workspace-wide replace, regular expressions, fuzzy matching, semantic search, stemming, ranking by relevance, or query-language syntax.
- Searching folder names as separate results, comments, discussions, properties, revision history, or external/cloud content.
- Live search on every keystroke.
- A separate Preview action for each result. The agreed behavior is opening the document and jumping to its match.
- Listing every occurrence as a separate result or adding new next/previous-match controls; existing current-document find remains available.
- Remote indexing, new backend services, persistent search indexes, database schema migrations, or unrelated persistence refactoring.
- Changing the backup JSON format, adding encryption or compression, automatically scheduling backups, or changing backup import semantics.
- Adding seconds, workspace identifiers, timezone suffixes, or custom collision handling to backup filenames.
- Copying StackEditPro's implementation or adopting its unrelated navigation, activity, or preview features.

## Further Notes

- The user explicitly selected a top-navigation search icon with a floating panel, current-workspace active-document scope excluding Trash and Temp, result snippets with jump-to-match navigation, and browser-local backup timestamps.
- StackEditPro was inspected in the browser as an interaction reference. Its search panel enables Name and Content by default, disables Case-Sensitive by default, submits on Enter or Search, and lists matching documents with Preview buttons. This specification adopts the agreed interaction model but replaces Preview with the requested snippet-and-jump behavior.
- The user separately approved the browser-level testing boundary before this specification was published.
- Existing content can be unloaded from the in-memory store while remaining in IndexedDB. Searching only loaded content would not satisfy the requirement.
- Workspace persistence runs periodically. Export and search must not assume a user has waited for that periodic save after editing.
- Panel reset behavior, one-result-per-document presentation, first-occurrence navigation, deterministic ordering, and stale-result handling are implementation clarifications synthesized from the agreed design, not additional separately requested features.
- This document is the canonical local specification for the combined feature. Its `ready-for-agent` status maps to the repository's triage vocabulary.
