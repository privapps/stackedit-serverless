const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const distDirectory = path.resolve(__dirname, '../dist');
const appPath = '/docs/app';
const serviceWorkerUpdateActivationPath = `${appPath}/__smoke-update-activated`;
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function createStaticServer() {
  let serveUpdatedServiceWorker = false;
  let serviceWorkerUpdateActivated = false;
  const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, 'http://localhost');
    if (requestUrl.pathname !== appPath && !requestUrl.pathname.startsWith(`${appPath}/`)) {
      response.writeHead(404).end();
      return;
    }

    if (
      request.method === 'POST'
      && requestUrl.pathname === serviceWorkerUpdateActivationPath
    ) {
      serviceWorkerUpdateActivated = true;
      response.writeHead(204).end();
      return;
    }

    const relativePath = requestUrl.pathname === appPath || requestUrl.pathname === `${appPath}/`
      ? 'index.html'
      : decodeURIComponent(requestUrl.pathname.slice(appPath.length + 1));
    const filePath = path.resolve(distDirectory, relativePath);
    const pathFromDist = path.relative(distDirectory, filePath);
    if (pathFromDist.startsWith('..') || path.isAbsolute(pathFromDist)) {
      response.writeHead(403).end();
      return;
    }

    try {
      const body = await fs.readFile(filePath);
      const responseBody = relativePath === 'service-worker.js' && serveUpdatedServiceWorker
        ? Buffer.concat([
          body,
          Buffer.from(`
self.addEventListener('activate', event => {
  event.waitUntil(fetch(new URL('__smoke-update-activated', self.registration.scope), {
    method: 'POST',
  }));
});
`),
        ])
        : body;
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream',
      });
      response.end(request.method === 'HEAD' ? undefined : responseBody);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'EISDIR') {
        response.writeHead(404).end();
        return;
      }
      console.error(`Failed to serve ${requestUrl.pathname}:`, error);
      response.writeHead(500).end();
    }
  });

  return {
    server,
    enableServiceWorkerUpdate() {
      serveUpdatedServiceWorker = true;
    },
    async waitForServiceWorkerUpdate() {
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        if (serviceWorkerUpdateActivated) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error('Timed out waiting for the updated service worker to activate.');
    },
  };
}

async function clickIfVisible(page, buttonName) {
  const button = page.getByRole('button', { name: buttonName, exact: true });
  if (await button.isVisible()) {
    await button.click();
  }
}

async function dismissPrompts(page) {
  await clickIfVisible(page, 'SKIP');
  await clickIfVisible(page, 'NO');
}

async function openMenu(page, menuName) {
  const mainMenuButton = page.locator('button[aria-label="Main menu"]');
  if (await mainMenuButton.isVisible()) {
    await mainMenuButton.click();
  } else {
    await page.locator('button[aria-label="Toggle side bar"]').click();
  }
  const menuEntry = page.locator('.side-bar__panel--menu .menu-entry')
    .filter({ hasText: menuName });
  await menuEntry.waitFor({ state: 'visible' });
  await menuEntry.click();
}

async function downloadText(page, click) {
  const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
  await click();
  const download = await downloadPromise;
  const filePath = await download.path();
  assert.ok(filePath, `Download ${download.suggestedFilename()} should be available`);
  return {
    filename: download.suggestedFilename(),
    text: await fs.readFile(filePath, 'utf8'),
  };
}

async function waitForStoredDocument(page, marker) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const storedDocument = await page.evaluate(async (expectedMarker) => {
      const request = indexedDB.open('stackedit-db');
      const db = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!db.objectStoreNames.contains('objects')) {
        db.close();
        return null;
      }
      const items = await new Promise((resolve, reject) => {
        const getAll = db.transaction('objects', 'readonly').objectStore('objects').getAll();
        getAll.onsuccess = () => resolve(getAll.result);
        getAll.onerror = () => reject(getAll.error);
      });
      db.close();
      const content = items.find(item => (
        item.type === 'content' && item.text?.includes(expectedMarker)
      ));
      if (!content) {
        return null;
      }
      const fileId = content.id.replace(/\/content$/, '');
      const lastOpened = items.find(item => item.type === 'data' && item.id === 'lastOpened');
      const file = items.find(item => item.type === 'file' && item.id === fileId);
      return lastOpened?.data?.[fileId] && file ? { fileName: file.name } : null;
    }, marker);
    if (storedDocument) {
      return storedDocument;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for stored document containing ${marker}.`);
}

async function waitForServiceWorker(page, expectedScope) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const hasActiveWorker = await page.evaluate(async (scope) => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.some(registration => (
        registration.scope === scope && Boolean(registration.active)
      ));
    }, expectedScope);
    if (hasActiveWorker) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for active service worker at ${expectedScope}.`);
}

async function exportHtml(page) {
  const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
  await page.locator('.side-bar__panel--menu .menu-entry')
    .filter({ hasText: 'Export as HTML' })
    .click();
  const exportButton = page.locator('.modal__button-bar .button--resolve');
  await exportButton.waitFor({ state: 'visible' });
  await exportButton.click();
  const download = await downloadPromise;
  const filePath = await download.path();
  assert.ok(filePath, `Download ${download.suggestedFilename()} should be available`);
  await page.locator('.modal').waitFor({ state: 'hidden' });
  return {
    filename: download.suggestedFilename(),
    text: await fs.readFile(filePath, 'utf8'),
  };
}

async function assertPreviewSafe(page, expectedText) {
  const state = await page.evaluate(() => {
    const preview = document.querySelector('.preview');
    return {
      text: preview?.innerText || '',
      scriptCount: preview?.querySelectorAll('script').length || 0,
      eventHandlerCount: preview?.querySelectorAll('[onclick], [onerror], [onload]').length || 0,
      unsafeLinkCount: [...(preview?.querySelectorAll('a[href]') || [])]
        .filter(link => /^\s*javascript:/i.test(link.getAttribute('href'))).length,
      scriptExecuted: window.__stackeditSmokeScriptExecuted,
      eventHandlerExecuted: window.__stackeditSmokeEventHandlerExecuted,
      unsafeLinkExecuted: window.__stackeditSmokeUnsafeLinkExecuted,
    };
  });

  assert.match(state.text, new RegExp(expectedText));
  assert.equal(state.scriptCount, 0);
  assert.equal(state.eventHandlerCount, 0);
  assert.equal(state.unsafeLinkCount, 0);
  assert.equal(state.scriptExecuted, false);
  assert.equal(state.eventHandlerExecuted, false);
  assert.equal(state.unsafeLinkExecuted, false);
}

async function main() {
  await fs.access(path.join(distDirectory, 'index.html'));
  const cssDirectory = path.join(distDirectory, 'static/css');
  const stylesheets = [
    path.join(distDirectory, 'style.css'),
    ...(await fs.readdir(cssDirectory))
      .filter(filename => filename.endsWith('.css'))
      .map(filename => path.join(cssDirectory, filename)),
  ];
  for (const stylesheet of stylesheets) {
    const css = await fs.readFile(stylesheet, 'utf8');
    for (const match of css.matchAll(/url\(([^)]+)\)/g)) {
      const url = match[1].replace(/^["']|["']$/g, '');
      if (/^(?:data:|https?:|#|\/\/)/i.test(url)) {
        continue;
      }
      const asset = path.resolve(path.dirname(stylesheet), url.split(/[?#]/)[0]);
      assert.ok(!path.relative(distDirectory, asset).startsWith('..'), url);
      const bytes = await fs.readFile(asset);
      assert.doesNotMatch(bytes.subarray(0, 100).toString(), /export default|module\.exports/);
    }
  }
  const staticServer = createStaticServer();
  const { server } = staticServer;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  const appUrl = `http://127.0.0.1:${port}${appPath}/`;
  let browser;

  try {
    const manifestUrl = new URL('assets/manifest.webmanifest', appUrl);
    const manifest = await (await fetch(manifestUrl)).json();
    assert.equal(new URL(manifest.start_url, manifestUrl).href, appUrl);
    assert.equal(new URL(manifest.scope, manifestUrl).href, appUrl);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const browserErrors = [];
    page.on('console', message => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    page.on('pageerror', error => browserErrors.push(error.message));

    await page.goto(appUrl);
    await page.waitForSelector('.editor__inner', { state: 'visible', timeout: 30_000 });
    await dismissPrompts(page);
    await openMenu(page, 'Import/export');
    await page.locator('#import-markdown-file-input').setInputFiles({
      name: 'smoke-markdown.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(
        '# Imported Markdown\n\nSMOKE_MARKDOWN_MARKER\n\nThis **Markdown** file was imported.',
      ),
    });
    await page.waitForFunction(
      () => document.querySelector('.preview h1')?.textContent === 'Imported Markdown',
      undefined,
      { timeout: 20_000 },
    );

    const persistenceMarker = 'PERSISTENCE_MARKER';
    await page.locator('.editor__inner').fill(
      '# Imported Markdown\n\nSMOKE_MARKDOWN_MARKER\n\nPERSISTENCE_MARKER\n\nEdited in the browser.',
    );
    await page.waitForFunction(
      marker => document.querySelector('.preview')?.innerText.includes(marker),
      persistenceMarker,
      { timeout: 10_000 },
    );
    const storedMarkdown = await waitForStoredDocument(page, persistenceMarker);
    assert.equal(storedMarkdown.fileName, 'smoke-markdown.md');
    await page.reload();
    await page.waitForSelector('.editor__inner', { state: 'visible', timeout: 20_000 });
    await dismissPrompts(page);
    await page.waitForFunction(
      marker => document.querySelector('.editor__inner')?.textContent.includes(marker),
      persistenceMarker,
      { timeout: 20_000 },
    );
    assert.match(await page.locator('.editor__inner').textContent(), /PERSISTENCE_MARKER/);
    assert.equal(await page.locator('.preview h1').textContent(), 'Imported Markdown');

    await openMenu(page, 'Import/export');
    const markdownExport = await downloadText(page, () => page.locator(
      '.side-bar__panel--menu .menu-entry',
    ).filter({ hasText: 'Export as Markdown' }).click());
    assert.match(markdownExport.filename, /\.md$/);
    assert.match(markdownExport.text, /SMOKE_MARKDOWN_MARKER/);
    assert.match(markdownExport.text, /PERSISTENCE_MARKER/);

    await page.locator('#import-markdown-file-input').setInputFiles({
      name: 'smoke-diagrams.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from([
        '# Diagram export',
        '```mermaid\ngraph TD\n  A[DIAGRAMSTART] --> B[DIAGRAMEND]\n```',
        '```mermaid\nsequenceDiagram\n  Alice->>Bob: DIAGRAMMESSAGE\n```',
        '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="red" /></svg>',
      ].join('\n\n')),
    });
    await page.waitForFunction(() => (
      document.querySelectorAll('.preview svg[id^="mermaid-svg-"]').length === 2
      && document.querySelector('.preview svg[viewBox="0 0 10 10"] circle')
    ), undefined, { timeout: 20_000 }).catch(async error => {
      console.error('Diagram rendering state:', await page.evaluate(() => ({
        svgIds: [...document.querySelectorAll('.preview svg')].map(svg => svg.id),
        preview: document.querySelector('.preview__inner-2')?.innerHTML.slice(0, 4000),
      })), browserErrors);
      throw error;
    });
    const diagramExport = await exportHtml(page);
    assert.match(diagramExport.text, /<svg[^>]*id="mermaid-svg-/);
    assert.match(diagramExport.text, /DIAGRAMSTART/);
    assert.match(diagramExport.text, /DIAGRAMMESSAGE/);
    assert.match(diagramExport.text, /<circle[^>]*fill="red"/);
    assert.doesNotMatch(diagramExport.text, /<code\b[^>]*\blanguage-mermaid\b/);
    await openMenu(page, 'Import/export');

    await page.evaluate(() => {
      window.__stackeditSmokeScriptExecuted = false;
      window.__stackeditSmokeEventHandlerExecuted = false;
      window.__stackeditSmokeUnsafeLinkExecuted = false;
    });
    await page.locator('.editor__inner').fill([
      '# Unsafe Markdown',
      'SMOKE_MARKDOWN_MARKER',
      '<script>window.__stackeditSmokeScriptExecuted = true</script>',
      '<p onclick="window.__stackeditSmokeEventHandlerExecuted = true">Unsafe handler</p>',
      '<a href="javascript:window.__stackeditSmokeUnsafeLinkExecuted = true">Unsafe link</a>',
    ].join('\n\n'));
    await page.waitForFunction(
      () => document.querySelector('.preview h1')?.textContent === 'Unsafe Markdown',
      undefined,
      { timeout: 10_000 },
    );
    await assertPreviewSafe(page, 'Unsafe Markdown');

    const markdownHtmlExport = await exportHtml(page);
    assert.match(markdownHtmlExport.filename, /\.html$/);
    assert.match(markdownHtmlExport.text, /Unsafe Markdown/);
    assert.doesNotMatch(
      markdownHtmlExport.text,
      /<script\b|onclick\s*=|href=["']\s*javascript:/i,
    );

    await openMenu(page, 'Import/export');
    await page.evaluate(() => {
      window.__stackeditSmokeScriptExecuted = false;
      window.__stackeditSmokeEventHandlerExecuted = false;
      window.__stackeditSmokeUnsafeLinkExecuted = false;
    });
    await page.locator('#import-html-file-input').setInputFiles({
      name: 'smoke-html.html',
      mimeType: 'text/html',
      buffer: Buffer.from([
        '<h1>Imported HTML</h1>',
        '<p>HTMLIMPORTMARKER</p>',
        '<script>window.__stackeditSmokeScriptExecuted = true</script>',
        '<p onclick="window.__stackeditSmokeEventHandlerExecuted = true">Unsafe handler</p>',
        '<a href="javascript:window.__stackeditSmokeUnsafeLinkExecuted = true">Unsafe link</a>',
        '<img src="missing-image.png" alt="Broken image" onerror="window.__stackeditSmokeEventHandlerExecuted = true">',
      ].join('\n')),
    });
    await page.waitForFunction(
      () => document.querySelector('.preview h1')?.textContent === 'Imported HTML',
      undefined,
      { timeout: 20_000 },
    );
    await assertPreviewSafe(page, 'HTMLIMPORTMARKER');
    const storedHtml = await waitForStoredDocument(page, 'HTMLIMPORTMARKER');
    assert.equal(storedHtml.fileName, 'smoke-html.html');

    const htmlExport = await exportHtml(page);
    assert.match(htmlExport.text, /HTMLIMPORTMARKER/);
    assert.doesNotMatch(htmlExport.text, /<script\b|onerror\s*=|onclick\s*=|href=["']\s*javascript:/i);

    const explorerTree = page.locator('.explorer__tree');
    if (!(await explorerTree.isVisible())) {
      await page.locator('button[aria-label="Toggle explorer"]').click();
    }
    await explorerTree.waitFor({ state: 'visible' });
    const markdownRows = page.locator('.explorer-node__item')
      .filter({ hasText: 'smoke-markdown.md' });
    const originalMarkdownCount = await markdownRows.count();
    assert.equal(originalMarkdownCount, 1);

    await openMenu(page, 'Workspace backups');
    const backupDownload = await downloadText(page, () => page.locator(
      '.side-bar__panel--menu .menu-entry',
    ).filter({ hasText: 'Export workspace backup' }).click());
    const backup = JSON.parse(backupDownload.text.replace(/^\uFEFF/, ''));
    const markdownFile = Object.values(backup)
      .find(item => item.type === 'file' && item.name === 'smoke-markdown.md');
    assert.ok(markdownFile, 'Workspace backup should include the imported Markdown file');
    assert.match(backup[`${markdownFile.id}/content`].text, /SMOKE_MARKDOWN_MARKER/);

    await page.locator('#import-backup-file-input').setInputFiles({
      name: 'StackEdit workspace.json',
      mimeType: 'application/json',
      buffer: Buffer.from(backupDownload.text),
    });
    await page.waitForFunction(({ name, count }) => (
      [...document.querySelectorAll('.explorer-node__item')]
        .filter(item => item.textContent.trim() === name).length === count
    ), {
      name: 'smoke-markdown.md',
      count: originalMarkdownCount + 1,
    }, { timeout: 20_000 });
    await markdownRows.last().click();
    await page.waitForFunction(
      marker => document.querySelector('.editor__inner')?.textContent.includes(marker),
      'SMOKE_MARKDOWN_MARKER',
      { timeout: 10_000 },
    );
    const restoredMarkdown = await page.locator('.editor__inner').textContent();
    await page.locator('.editor__inner').fill(`${restoredMarkdown}\n\nBACKUPRESTOREMARKER`);
    await page.waitForFunction(
      () => document.querySelector('.preview')?.innerText.includes('BACKUPRESTOREMARKER'),
      undefined,
      { timeout: 10_000 },
    );
    const storedRestoredMarkdown = await waitForStoredDocument(page, 'BACKUPRESTOREMARKER');
    assert.equal(storedRestoredMarkdown.fileName, 'smoke-markdown.md');

    const appScope = appUrl;
    await waitForServiceWorker(page, appScope);
    await page.reload();
    await page.waitForSelector('.editor__inner', { state: 'visible', timeout: 20_000 });
    await page.waitForFunction(
      () => document.querySelector('.editor__inner')?.textContent.includes('BACKUPRESTOREMARKER'),
      undefined,
      { timeout: 20_000 },
    );
    await page.waitForFunction(
      () => Boolean(navigator.serviceWorker.controller),
      undefined,
      { timeout: 15_000 },
    );
    await dismissPrompts(page);

    staticServer.enableServiceWorkerUpdate();
    await page.evaluate(async scope => {
      const registration = await navigator.serviceWorker.getRegistration(scope);
      if (!registration?.active) {
        throw new Error(`No active service worker registered at ${scope}.`);
      }
      await registration.update();
    }, appScope);
    await page.waitForFunction(async scope => {
      const registration = await navigator.serviceWorker.getRegistration(scope);
      return registration?.waiting?.state === 'installed';
    }, appScope, { timeout: 20_000 });
    const updateState = await page.evaluate(async scope => {
      const registration = await navigator.serviceWorker.getRegistration(scope);
      return {
        hasController: Boolean(navigator.serviceWorker.controller),
        activeState: registration?.active?.state,
      };
    }, appScope);
    assert.equal(updateState.hasController, true);
    assert.equal(updateState.activeState, 'activated');
    await page.waitForFunction(
      () => document.querySelector('.editor__inner')?.textContent.includes('BACKUPRESTOREMARKER'),
      undefined,
      { timeout: 15_000 },
    );

    await page.close();
    await staticServer.waitForServiceWorkerUpdate();
    const updatedPage = await context.newPage();
    await updatedPage.goto(appUrl);
    await updatedPage.waitForSelector('.editor__inner', { state: 'visible', timeout: 20_000 });
    await updatedPage.waitForFunction(
      () => document.querySelector('.editor__inner')?.textContent.includes('BACKUPRESTOREMARKER'),
      undefined,
      { timeout: 20_000 },
    );
    await updatedPage.waitForFunction(
      async scope => {
        const registration = await navigator.serviceWorker.getRegistration(scope);
        return registration?.active?.state === 'activated'
          && navigator.serviceWorker.controller === registration.active;
      },
      appScope,
      { timeout: 15_000 },
    );

    await context.setOffline(true);
    try {
      await updatedPage.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
      try {
        await updatedPage.waitForSelector('.editor__inner', { state: 'visible', timeout: 20_000 });
      } catch (error) {
        const offlineState = await updatedPage.evaluate(async () => {
          const cachedJavaScript = [];
          for (const name of await caches.keys()) {
            const cache = await caches.open(name);
            const keys = await cache.keys();
            cachedJavaScript.push(...keys
              .map(request => request.url)
              .filter(url => /\/static\/js\/[^/]+\.js(?:\?|$)/.test(url)));
          }
          return {
            url: location.href,
            controller: Boolean(navigator.serviceWorker.controller),
            cachedJavaScript,
            body: document.body.innerText.slice(0, 500),
          };
        });
        console.error('Offline reload state:', JSON.stringify(offlineState, null, 2));
        throw error;
      }
      await updatedPage.waitForFunction(
        () => document.querySelector('.editor__inner')?.textContent.includes('BACKUPRESTOREMARKER'),
        undefined,
        { timeout: 15_000 },
      );
    } finally {
      await context.setOffline(false);
    }

    console.log('Production browser smoke passed at /docs/app (editing, imports/exports, backup restore, security, safe service-worker update, offline reload).');
    await context.close();
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
