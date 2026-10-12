# Offline notebook simplification

**Status:** ready-for-agent

## Problem Statement

StackEdit Serverless is a static website intended for local, offline Markdown editing, but it retains integration, account, publishing, discussion, sponsorship, and specialist rendering machinery inherited from the hosted application. Some controls are hidden while their implementations remain reachable; other controls still advertise external features. Local workspace startup depends on a cloud provider, and the application still attempts to load server configuration.

Users need a coherent notebook whose controls work locally, whose exports are useful without an account, and whose existing notes remain accessible after simplification. Maintainers need fewer runtime dependencies and obsolete workflows to support.

## Solution

Make the application an offline Markdown notebook for writing, organizing, searching, previewing, importing, exporting, printing, and backing up notes. Remove external integrations, accounts, cloud synchronization, publishing, collaboration controls, sponsorship, server conversion, music notation, custom templates, JavaScript template helpers, and badges.

Retain rich Markdown, diagrams, math, syntax highlighting, local workspaces, local autosave, backups, workspace search, and offline installation. Provide fixed styled HTML export and browser Print / Save as PDF. Preserve existing local data and compatible document metadata without activating removed integrations.

## Acceptance Criteria

The feature is accepted when every checklist criterion is satisfied in full in each of these implementation tickets:

1. [Preserve document serialization independently of providers](issues/01-preserve-document-serialization.md).
2. [Open existing workspaces and save locally](issues/02-local-workspace-startup-and-save.md).
3. [Export fixed HTML and print without templates or servers](issues/03-fixed-html-export-and-browser-print.md).
4. [Edit without discussion gutters while preserving annotations](issues/04-remove-discussion-ui-preserve-annotations.md).
5. [Remove external integrations and account workflows](issues/05-remove-external-integrations-and-accounts.md).
6. [Keep music notation source as ordinary code](issues/06-remove-music-notation.md).
7. [Remove badges and achievement bookkeeping](issues/07-remove-badges.md).
8. [Finish compatibility storage and describe the local notebook](issues/08-contract-storage-settings-and-help.md).
9. [Validate the simplified static notebook in production](issues/09-production-validation.md).

These linked checklists make the criteria directly auditable; the user stories and implementation decisions below retain the feature's complete user-facing scope.

## User Stories

1. As a writer, I want the editor to start without an account, so that I can write immediately.
2. As an offline user, I want the installed application to reopen without a network connection, so that my notebook remains usable offline.
3. As an existing user, I want my Main workspace to reopen after the update, so that my notes remain accessible.
4. As an existing user, I want locally stored workspaces formerly associated with providers to remain accessible, so that removing an integration does not hide their notes.
5. As a notebook user, I want to switch between existing local workspaces, so that I can keep collections separate.
6. As a notebook user, I want existing workspace rename and removal controls to work locally, so that I can manage my collections.
7. As a writer, I want to create, rename, move, and delete files and folders, so that I can organize notes.
8. As a writer, I want local autosave, so that I do not need to upload my notes to retain changes.
9. As a writer, I want save status to reflect completed local persistence or a failure, so that I know whether my changes were saved.
10. As a user with multiple browser tabs, I want the existing coordination of local changes to survive the update, so that tabs do not overwrite unrelated changes.
11. As a writer, I want Markdown formatting controls and undo/redo, so that I can edit efficiently.
12. As a writer, I want tables, task lists, footnotes, and code highlighting, so that technical notes remain expressive.
13. As a technical writer, I want Mermaid diagrams, so that I can document relationships locally.
14. As a technical writer, I want mathematical notation, so that formulas remain readable locally.
15. As a writer, I want editor and preview scrolling to stay linked, so that I can compare Markdown with its rendering.
16. As a writer, I want themes, layout controls, and useful keyboard shortcuts, so that I can adjust the writing experience.
17. As a notebook user, I want document find/replace, so that I can edit text quickly.
18. As a notebook user, I want workspace search to include unopened documents and nested folders, so that I can find local notes.
19. As a notebook user, I want search results and navigation to retain their current behavior, so that simplification does not weaken search.
20. As a writer, I want to import Markdown and HTML locally, so that I can bring existing material into the notebook.
21. As an existing user, I want Markdown carrying StackEdit metadata to remain readable, so that earlier exports remain useful.
22. As a writer, I want to export Markdown, so that I can use my notes in other editors.
23. As a writer, I want fixed styled HTML export with an optional table of contents, so that I can share a readable document without designing a template.
24. As a recipient, I want exported HTML to render offline away from the application, so that its styling does not depend on the original website.
25. As a writer, I want browser Print / Save as PDF, so that I can produce a printable copy without a conversion server.
26. As a notebook user, I want timestamped workspace backups, so that I can keep recognizable local snapshots.
27. As a notebook user, I want backups to retain the current complete workspace snapshot behavior, so that unopened content and recent edits are included.
28. As an existing user, I want supported older backups to restore notes and folders, so that my saved copies remain usable.
29. As an existing user, I want legacy comments and document metadata preserved without collaboration controls, so that simplification does not silently erase their contents.
30. As an existing user, I want legacy template and synchronization records retained as inactive data in existing workspace snapshots, so that an update does not destroy archived information.
31. As a writer, I want menus to describe supported local capabilities, so that I do not encounter obsolete account and cloud actions.
32. As a writer, I want image insertion by URL to remain available without Google Photos controls, so that ordinary Markdown image editing still works.
33. As a writer with music notation in old notes, I want its source to remain intact as a code block, so that removing music rendering does not delete text.
34. As a notebook user, I want imports and preview to retain HTML sanitization, so that opening a note does not execute its embedded markup.
35. As an existing user, I want obsolete preferences to be tolerated without executing removed features, so that my saved settings do not prevent startup.
36. As a new user, I want welcome content and help to describe the offline notebook, so that I can learn its actual capabilities.
37. As a user, I want application startup and notebook operations to avoid provider and backend requests, so that my local workflow does not depend on external services.
38. As a maintainer, I want unused implementations, dependencies, icons, and static assets removed, so that the supported application is easier to maintain.

## Implementation Decisions

- The supported release remains a static production artifact suitable for GitHub Pages and local HTTP serving. Preserve the existing deployment origin, base-path behavior, service-worker scope, installation, and update lifecycle.
- Separate document serialization from provider behavior before removing providers. Prefer the existing parsing and serialization interface, with explicit metadata preservation and no authentication, registry, or network dependency.
- Initialize local workspace selection and IndexedDB directly. Preserve existing workspace IDs, database names, file IDs, folder relationships, and existing local copies of former provider workspaces.
- Legacy provider URLs may resolve an existing local workspace without reconnecting. Missing local copies must receive a clear local-unavailability outcome rather than creating an empty replacement or silently selecting unrelated notes.
- Retain local autosave, localStorage coordination, content loading/unloading, workspace isolation, and existing cross-tab behavior. Cloud sync locks and retries are not substitutes for local persistence.
- Display local persistence status independently of connectivity. Report saved only after the write transaction completes; report failures without claiming success or discarding the in-memory edit.
- Remove all provider adapters, account and OAuth flows, synchronization and publication operations, Google Photos selection, remote revision history, sponsorship/payment flows, and server configuration/conversion requests.
- Retain normal link and image URL insertion. User-authored remote resources may still require a network connection; integration removal does not rewrite links or fetch their contents into the notebook.
- Remove discussion controls, gutters, avatars, highlighting, marker relocation, and collaboration state. Keep archived comment/discussion values in document data; their original offsets are archival and are not updated as text changes.
- Preserve legacy workspace record types through a minimal inert storage representation when needed for read/export compatibility. No archived record may trigger authentication, remote synchronization, script execution, or automatic deletion.
- Keep old custom template records inactive in existing workspace snapshots. Keep stored account credentials outside ordinary workspace exports and never use them; changing credential retention is outside this feature.
- Preserve the established backup import scope: supported StackEdit v4/v5 notes and folders, supported document properties and annotation data, and leading byte-order marks. Do not promise full restoration of historical cloud state, credentials, global preferences, or all records from a workspace export.
- Preserve workspace export snapshot integrity, initiating-workspace isolation, recent in-memory edits, unopened records, Trash/Temp inclusion, compatible JSON, and browser-local timestamped filenames.
- Replace custom templates with fixed styled HTML export and an optional table of contents. Include needed styles and packaged rendering assets so downloaded output renders offline away from the application. Render diagrams/math before export and produce no executable template helpers.
- Remove the template editor, custom helper execution worker, Handlebars, server PDF/Pandoc converters, and the Pandoc-only renderer when their callers are removed. Browser printing remains available.
- Remove ABC music rendering and its dependency, presets, examples, and controls. Preserve source fences and retain diagrams, math, emoji, Markdown extensions, and syntax highlighting.
- Remove badges and achievement bookkeeping throughout the application.
- Remove obsolete generated settings and defaults while tolerating old stored preferences. Retire cloud sync shortcuts; retain normal browser Save behavior for the former sync shortcut rather than adding an unrequested download shortcut.
- Preserve the existing embedded/light editing protocol and Temp behavior through local initialization; removing it is outside scope.
- Delete obsolete code and assets after consumers have migrated. Retain HTML sanitization, diff support used by local editing/undo, and dependencies still required by supported workflows.
- Each ticket delivers an observable local workflow and its relevant regressions. Use staged prefactoring followed by feature removal and final contraction to keep intermediate changes usable.

## Testing Decisions

- The primary acceptance seam is the existing production browser harness against the real static build served under a nested path, using isolated browser storage and owned local servers.
- Good tests drive visible user actions and assert rendered results, persisted data, downloads, failure outcomes, and network requests. Avoid private methods, implementation-shaped snapshots, and arbitrary delay assertions.
- Supplement browser acceptance with focused public-interface checks for document parsing/serialization, workspace persistence, backup export/import, and HTML sanitization. Reuse the existing editor workflow, workspace persistence, backup, search, and sanitization suites.
- Exercise the existing Main database and multiple existing provider-associated databases before upgrading. Verify IDs, names, file contents, folder relationships, and selected-workspace behavior after migration.
- Check local save acknowledgement and failure handling at transaction completion; verify two tabs in one workspace and separate workspaces without promising a new collaborative conflict resolver.
- Check legacy Markdown metadata and old backups, including Unicode, missing/malformed metadata, archived comments, inactive templates, and sync records. Compare supported payloads semantically, not only file counts or text markers.
- Verify immediate-edit backup capture, unopened content, complete stable export equality, Trash/Temp inclusion, initiating-workspace isolation, and imported note/folder compatibility.
- Verify fixed HTML export, optional table of contents, escaped titles, safe rendered diagrams/math, styles/assets when opened offline away from the application, and browser print invocation/layout. Operating-system PDF dialogs are a manual acceptance check where browser automation cannot validate the actual PDF.
- Seed removed-feature preferences, credentials, provider parameters, and template helpers. Assert no provider/backend request or helper execution on startup, reconnect, menu use, file activation, or export; allow static assets, service-worker update traffic, and explicit document resources.
- Verify retained editor, search, accessibility, keyboard controls, embedded/light behavior, and service-worker update/offline reload. A waiting update must not force-reload an edited tab.
- During implementation, run the established lint/unit suite, production build, browser smoke, dependency audit, and diff checks. Compare source/bundle/dependency measurements with a recorded baseline; do not invent a bundle-size saving or require an arbitrary percentage.

## Out of Scope

- Adding a backend, provider replacement, cloud storage, synchronization, authentication, publishing, collaboration, or remote history.
- Replacing the editor, framework, bundler, storage engine, or upstream fork.
- Removing Mermaid, KaTeX, syntax highlighting, rich Markdown, workspace search, backups, or embedded/light editing.
- Adding local revision history, a new workspace-creation flow, encryption, remote-resource downloading, or direct PDF/Word/EPUB conversion.
- Moving deployment to a new origin or recovering records that were never stored locally.
- Executing or converting old custom templates, reconnecting old sync records, or restoring credentials from backups.
- Improving the existing cross-tab conflict model beyond regression prevention.
- Deleting stored credentials as part of an update, changing Trash/Temp retention rules, or resetting existing user data.

## Further Notes

This is a simplification of supported behavior, not a rewrite. Static hosting alone does not prevent browser-to-service integrations; their removal is the chosen product scope. Archived annotations remain data rather than live anchors. Workspace snapshots preserve existing records, while backup import continues its supported note/folder contract.

The scope includes the user's requested removal of niche music notation and custom templates. Retain diagrams and math initially. Publish this spec and its approved tickets as one local Markdown feature bundle; documentation drafting does not authorize implementation.
