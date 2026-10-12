# 07 — Remove badges and achievement bookkeeping

**What to build:** Users perform notebook actions without achievement dialogs or background badge bookkeeping.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent
**Implementation status:** implemented (independent validation pending)

- [x] Badge dialogs, achievements, counters, feature descriptions, and badge-writing call sites are removed.
- [x] Formatting, file/folder management, search, workspace actions, import/export, and backup actions work without badge state or modules.
- [x] Existing badge records remain inert without automatic deletion or recreation on ordinary actions.
- [x] Default state and new installations no longer create badge-tracking records.
- [x] Representative browser workflows and source/state checks confirm core actions do not require or write achievements.

## Comments
