# 06 — Keep music notation source as ordinary code

**What to build:** Users retain their old music notation source while the notebook no longer ships a specialist music renderer.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent
**Implementation status:** implemented (independent validation pending)

- [x] ABC music rendering, its presets/options, music-specific examples/assets, and its dependency are removed.
- [x] Existing ABC fences retain exact source text and render as ordinary fenced code instead of a music sheet.
- [x] Old properties enabling ABC are tolerated without errors or new rendering behavior.
- [x] Mermaid, KaTeX, emoji, Markdown extensions, highlighting, and normal fenced-code behavior remain available.
- [x] Rendered preview/export regressions cover an old ABC note beside retained diagrams/math; dependency inspection confirms the music library is absent.

## Comments
