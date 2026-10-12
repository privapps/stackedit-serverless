# 04 — Improve HTML download action contrast

**What to build:** Writers can clearly identify and use the enabled Download HTML action while preparation, errors, Copy, Cancel, and the table-of-contents option retain their behavior.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

**Implementation status:** Complete

- [x] Enabled Download HTML text meets 4.5:1 contrast in default, hover, and focus states in both themes; its focus indicator is visible.
- [x] Contrast verification waits for preparation to finish; rendering/error disabled states remain identifiable and do not permit unavailable downloads.
- [x] Copy, Cancel, and the table-of-contents option remain readable, reachable, and functional on desktop and mobile.
- [x] Downloaded HTML preserves the selected content and table-of-contents choice and renders standalone offline with its embedded styles/assets.
- [x] Any other visible consumer affected by a shared action-style change remains readable and functional, including Settings OK.
- [x] Focused production browser checks verify enabled contrast and a real download, with ego-browser inspection of the relevant states.
