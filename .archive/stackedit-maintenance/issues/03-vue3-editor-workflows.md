# 03 — Keep editor workflows running on Vue 3 compatibility mode

**What to build:** StackEdit users can keep editing, previewing, and reopening their local workspace after the app moves to Vue 3 compatibility mode.

**Blocked by:** 02 — Build the static app on Node 24 with supported tooling.

**Status:** ready-for-agent
**Implementation status:** complete

- [x] The editor and its existing workspace flows run under Vue 3 compatibility mode.
- [x] Existing local workspace data remains readable and is not reset during the migration.
- [x] The component suite runs on Vitest and Vue Test Utils 2.
- [x] Behavior checks cover editing, preview, and local persistence rather than private component details.
