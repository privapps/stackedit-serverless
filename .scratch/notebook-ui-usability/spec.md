# Notebook UI usability fixes

**Status:** ready-for-agent

**Implementation status:** Complete
**Validation:** PASS — see [validation.md](validation.md)

## Problem Statement

The simplified offline notebook passes its existing functional checks, but a production browser review exposed four usability problems. Oversized right sidebar icons make navigation unnecessarily tall. Workspace search has nearly unreadable controls and results, forces result text into uppercase, and floats over the writing area and sidebar. Default settings extend beyond the viewport and put confirmation actions out of reach. The enabled HTML download button needs better text contrast.

These problems make supported local workflows harder to discover and use, particularly on smaller screens. The user requested a comprehensive review and a todo list before implementation.

## Solution

Restore compact sidebar navigation, make workspace search readable and deliberately positioned across screen sizes, keep settings within the viewport with scrollable content and reachable actions, and give the HTML download action readable styling. Preserve local notebook behavior while improving these visible surfaces.

Deliver four independently verifiable fixes followed by a combined production browser review. Acceptance covers desktop and mobile in both light and dark themes.

## Acceptance Criteria

Completion requires every checklist criterion in these tickets to pass:

1. [Restore compact sidebar navigation icons](issues/01-compact-sidebar-icons.md).
2. [Make workspace search readable and responsive](issues/02-readable-responsive-search.md).
3. [Keep settings content and actions within the viewport](issues/03-bounded-settings-dialog.md).
4. [Improve HTML download action contrast](issues/04-readable-html-download-action.md).
5. [Validate the combined notebook UI fixes in production](issues/05-combined-production-review.md).

## User Stories

1. As a notebook user, I want compact right sidebar icons, so that I can scan supported actions without excessive scrolling.
2. As a notebook user, I want icons aligned with their labels and descriptions, so that I can identify each action quickly.
3. As a notebook user, I want consistent icon sizing in the main menu and its submenus, so that navigation feels coherent.
4. As a notebook user, I want every sidebar action to remain reachable, so that compact styling does not hide capabilities.
5. As a mobile user, I want sidebar entries to fit the screen and remain easy to activate, so that smaller icons do not create smaller usable targets.
6. As a writer, I want readable workspace search controls, so that I can enter a query and choose search options confidently.
7. As a notebook user, I want search results to show recognizable names, folder paths, and snippets, so that I can choose the correct document.
8. As a writer, I want result text to retain its original letter case, so that filenames and content remain recognizable.
9. As a notebook user, I want readable highlighted matches, so that I can see why each document was returned.
10. As a user of either theme, I want readable search text and icons in all interactive states, so that theme choice does not make search unusable.
11. As a desktop writer, I want search positioned deliberately alongside my writing workflow, so that it does not obscure sidebar controls or the selected match.
12. As a mobile writer, I want search controls and results to fit the available screen, so that I can search without horizontal overflow or unreachable actions.
13. As a notebook user with many results, I want a bounded, scrollable results area, so that I can reach every result without losing access to search controls.
14. As a notebook user with long filenames and nested folders, I want result text to wrap within the panel, so that long labels do not break its layout.
15. As a keyboard user, I want visible focus and keyboard activation for search controls and results, so that I can use search without a pointer.
16. As a writer, I want selecting a content result to open its document and reveal its match while search stays open, so that I can compare results and continue navigating.
17. As a notebook user, I want Close and Escape to dismiss search after result activation, so that I can return to writing easily.
18. As an offline user, I want workspace search to retain its existing local scope and matching behavior, so that visual fixes do not change which notes I can find.
19. As a notebook user, I want readable initial, searching, empty, validation, and failure messages, so that I understand search outcomes.
20. As a writer, I want Default settings to scroll inside a bounded dialog, so that I can inspect all defaults without losing the dialog actions.
21. As a writer, I want Custom settings to remain editable and retain edits when switching tabs, so that reviewing defaults does not discard my changes.
22. As a writer, I want reachable Cancel and OK actions even with long YAML or validation errors, so that I can finish or abandon a settings change.
23. As a mobile user, I want settings content and tabs to fit the available viewport, so that settings remain usable on my phone.
24. As a writer, I want valid settings to save and invalid settings to report their error, so that layout changes preserve configuration behavior.
25. As a writer, I want a clearly readable Download HTML action, so that I can confidently export my document.
26. As a writer, I want export preparation and errors to remain distinguishable from an enabled action, so that I do not attempt an unavailable download.
27. As a writer, I want HTML download, Copy, and the table-of-contents option to retain their behavior, so that improved styling does not weaken export.
28. As an existing notebook user, I want these UI fixes to preserve editing, local autosave, imports, backups, and offline reopening, so that improving usability does not risk my notes.

## Implementation Decisions

- Keep the supported product a static offline notebook. This work introduces no backend, account, provider, storage migration, or document format change.
- Correct the sidebar menu-entry icon composition and sizing for all remaining consumers, including main navigation, Import/export, Workspaces, and Workspace backups. Use the existing compact 20 × 20 CSS-pixel icon area as the reference. Labels and descriptions stay alongside the icon; taller rows are justified only by their text. Keep usable row activation targets independent of icon size.
- Treat the legacy named-slot behavior as a likely contributor to misplaced SVGs, not as a required implementation prescription. Acceptance depends on the rendered result and working actions.
- Give workspace search explicit, coherent foreground and background styling that works in both themes. Normal text, including composed muted text and highlighted matches, must meet a minimum contrast ratio of 4.5:1 against its rendered background. Essential icons and focus indicators must meet 3:1 against adjacent colors. Apply these thresholds to enabled default, hover, and focus states; disabled controls must remain identifiable.
- Preserve original case for result names, paths, and snippets. Keep the visual distinction between name, path, snippet, and highlighted match without inheriting unrelated action-button typography.
- Use a deliberate responsive, non-modal search layout. On desktop, opening search must not cover usable right sidebar controls. On mobile, the panel must fit the viewport and provide usable controls and scrollable results. In both layouts, content-result activation must reveal the selected match without covering it while keeping search open. Do not add a modal focus trap that prevents the established return to editor focus.
- Keep long search text within the panel, avoid horizontal page overflow, and ensure query, actions, close control, and every result remain reachable. Bound the results region rather than allowing result volume to obscure controls.
- Retain the public search contract: names/content options, case sensitivity, current-workspace isolation, unloaded local documents and current in-memory edits, Trash/Temp exclusion, safe text rendering, reset, status/error messages, stale-result handling, first-match navigation, editor focus, and Close/Escape dismissal.
- Bound the settings dialog by the available viewport. Scroll long YAML and error content inside the dialog, with tabs and Cancel/OK reachable throughout. Preserve read-only defaults, editable custom settings, tab-switch edit retention, validation, cancellation, and saving.
- Improve enabled HTML download text contrast to at least 4.5:1 in default, hover, and focus states in both themes. Preserve rendering/error disabled states, Copy, Cancel, optional table of contents, and self-contained offline download behavior.
- Prefer changes confined to the affected surfaces. If an existing shared menu or button abstraction changes, verify its remaining visible consumers as part of the same fix. No prerequisite refactor is established by the review.

## Testing Decisions

- Approved primary seam: the existing production browser harness operating the public notebook UI, backed by ego-browser visual review of the built static artifact. Reuse existing public workflows and fixtures instead of introducing a new service or component testing seam.
- A good regression check reproduces a user's observable failure and proves the outcome: rendered icon dimensions and label alignment, readable composed colors, bounded panel/dialog geometry, reachable controls, result navigation, or a successful download. Do not assert template syntax, slot internals, stylesheet structure, or private component state.
- Extend existing browser coverage where it already exercises sidebar menus, workspace search and editor navigation, settings, HTML downloads, and offline behavior. Each fix includes its own focused regression verification; the final combined review does not substitute for that verification.
- Minimum visual matrix: desktop 1728 × 905 and mobile 390 × 844 CSS pixels, each in light and dark themes. Include a reduced-height viewport and a search state with the right sidebar open. Check supported layout changes without asserting exact decorative pixel positions.
- Sidebar checks cover every remaining menu-entry surface, including export actions. Verify approximately 20 × 20 rendered icons, side-by-side labels, reachable entries, and successful representative pointer/keyboard navigation.
- Search checks cover initial and populated states, no results, invalid options, failure messages, long mixed-case names and paths, many results, highlighted snippets, hover/focus, reset, Close, and Escape after editor focus. Use computed rendered colors including opacity composition for contrast evidence and screenshots for visual judgment.
- Retain existing search regression coverage for unloaded documents, current edits, nested folders, scope exclusions, case sensitivity and Unicode matching, safe snippets, stale results, first-match selection, visible editor navigation, and offline search. Use representative short-line and long-line matches so placement does not pass only for one convenient match position.
- Settings checks cover both tabs with short and long content, a long validation message, switching tabs without losing custom edits, read-only defaults, successful save/reopen, Cancel without saving, and invalid YAML remaining unsaved. Verify content scroll and reachable actions in every viewport/theme combination.
- Export checks wait for preparation to finish before judging the enabled button. Check enabled default/hover/focus contrast, distinguish disabled/error states, and retain existing public Copy, table-of-contents, download, and standalone offline-render checks.
- Run the established lint/unit checks, static production build, full production browser smoke, and scoped diff checks for the completed implementation. Record results and visual evidence against every acceptance criterion, with explicit gaps rather than inferring visual correctness from a functional PASS.
- Use isolated test data and a fresh review origin or isolated browser context where needed. Preserve user browser data and existing build artifacts; stale service-worker bundles from a reused review origin are not automatically a product regression.

## Out of Scope

- Implementing these fixes during the specification and ticketing step.
- A general application redesign, new search capabilities, changes to matching semantics, or a new settings editor.
- Restoring removed integrations, account workflows, templates, or collaboration features.
- Changes to local database identity, workspace records, backup payloads, import compatibility, or deployment origin and service-worker lifecycle.
- A repository-wide accessibility overhaul, unrelated dependency cleanup, or a new testing framework.
- Live deployment or remote issue publication; this repository uses the local Markdown tracker.

## Further Notes

The prior ego-browser review inspected the saved production build on desktop and mobile. It covered the welcome tour, editor/preview, explorer, right sidebar, Import/export, Settings, HTML export, and mobile sidebar/search.

Confirmed findings, in priority order:

1. High: main-menu SVGs rendered at 200 × 200 inside a sidebar approximately 278 pixels wide, creating rows approximately 244 pixels tall. Icon wrappers were empty while legacy slotted SVGs appeared in the text area. Export actions were affected; explicit import icon wrappers rendered at 20 × 20.
2. High: search control and result text rendered near rgb(51, 51, 51) against rgb(44, 44, 44). An “offline” query returned Welcome correctly but its result text was nearly unreadable. Result text inherited uppercase styling. Desktop search overlapped the preview/sidebar; mobile search occupied most of the editor.
3. Medium: Default settings produced a dialog approximately 1,868 pixels tall in a 905-pixel viewport, with Cancel/OK near y = 1,824.
4. Low: the enabled HTML download button used white text on #349be8. Its initially observed disabled appearance was transient rendering state, not a permanently invisible button.

The earlier simplification bundle has been archived. Create this follow-up as the separate `notebook-ui-usability` feature without changing that bundle or unrelated dirty work. The four fixes have no genuine blocking edges between them; combined validation waits for all four.

The user approved the testing approach, five-ticket granularity, and blocking edges on 2026-10-10. Tickets 01–04 can start independently; ticket 05 follows all four.
