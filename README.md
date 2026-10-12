# StackEdit Serverless

A static, browser-based Markdown notebook based on [StackEdit](https://github.com/benweet/stackedit).

https://privapps.github.io/stackedit-serverless

## What it does

Write and organize Markdown files in local browser workspaces. Changes save to this browser automatically, and the installed or cached application can be used offline. Workspace search finds names and Markdown content across nested folders and unopened notes.

Import Markdown and HTML, export individual notes as Markdown or styled HTML with its styles and rendering assets included, print from the browser, and download a workspace backup. Mermaid diagrams, mathematical notation, syntax highlighting, and rich Markdown remain supported.

The notebook has no account, cloud sync, publishing, collaboration, or remote-history workflows. Notes stay in the current browser until exported; clearing its site data removes the local copy. Keep a workspace backup somewhere safe.

## Run the static site

This repository has no backend service. The production build is hosted on GitHub Pages. To serve the published static files locally:

```bash
curl -skL https://github.com/privapps/stackedit-serverless/tarball/gh-pages -o ses.tar.gz
tar xf ses.tar.gz
cd <folder-with-docs>
python3 -m http.server 8010
```

Then open `http://localhost:8010` in a browser. Links and image URLs authored in notes remain external and may still require an internet connection in the notebook or exported HTML.

## Build and test

Use Node.js 24 LTS and npm 10 or newer:

```bash
npm ci
npm run build
npm run lint
npm run unit
npm run browser-smoke
```

The browser harness serves the real build under a nested path. `npm version patch|minor|major` updates the version locally; it does not push or publish. GitHub Actions builds the static site.

## Credits

- [StackEdit](https://github.com/benweet/stackedit)
