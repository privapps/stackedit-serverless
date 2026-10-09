# Issue tracker: Local Markdown

Issues and specs for this repository live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation tickets are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` in dependency order
- Each ticket has a `Blocked by` line and a `Status` line near the top
- Ticket discussion is appended under a `## Comments` heading

When a skill says to publish to the issue tracker, create the corresponding Markdown file under `.scratch/<feature-slug>/`.
