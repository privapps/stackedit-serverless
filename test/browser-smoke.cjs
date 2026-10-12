const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const distDirectory = path.resolve(__dirname, '../dist');
const appPath = '/docs/app';
const landingAssetPath = '/static/landing/';
const lightHostPath = '/docs/light-host';
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
    if (requestUrl.pathname === '/') {
      const body = await fs.readFile(path.join(distDirectory, 'static/landing/index.html'));
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/html; charset=utf-8',
      });
      response.end(body);
      return;
    }
    if (requestUrl.pathname.startsWith(landingAssetPath)) {
      const relativePath = decodeURIComponent(requestUrl.pathname.slice(1));
      const filePath = path.resolve(distDirectory, relativePath);
      const pathFromDist = path.relative(distDirectory, filePath);
      if (pathFromDist.startsWith('..') || path.isAbsolute(pathFromDist)) {
        response.writeHead(403).end();
        return;
      }
      try {
        const body = await fs.readFile(filePath);
        response.writeHead(200, {
          'Cache-Control': 'no-store',
          'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream',
        });
        response.end(body);
      } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'EISDIR') {
          response.writeHead(404).end();
          return;
        }
        console.error(`Failed to serve ${requestUrl.pathname}:`, error);
        response.writeHead(500).end();
      }
      return;
    }
    if (requestUrl.pathname === '/app/style.css') {
      const body = await fs.readFile(path.join(distDirectory, 'style.css'));
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': mimeTypes['.css'],
      });
      response.end(body);
      return;
    }
    if (requestUrl.pathname === lightHostPath) {
      const origin = `http://${request.headers.host}`;
      const embeddedUrl = new URL(`${appPath}/`, origin);
      embeddedUrl.hash = new URLSearchParams({
        origin,
        fileName: 'Embedded note.md',
        contentText: 'EMBEDDED_INITIAL',
      }).toString();
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/html; charset=utf-8',
      });
      response.end(`<!doctype html><html><body>
<script>window.__stackeditMessages=[];window.addEventListener('message',event=>window.__stackeditMessages.push({origin:event.origin,data:event.data}));</script>
<iframe title="Embedded StackEdit" src="${embeddedUrl.href}"></iframe>
</body></html>`);
      return;
    }
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

async function showMainMenu(page) {
  const sideBar = page.locator('.layout__panel--side-bar');
  if (!(await sideBar.isVisible())) {
    await page.locator('button[aria-label="Toggle side bar"]').click();
  }
  const mainMenuButton = page.locator('.side-title__button[aria-label="Main menu"]');
  if (await mainMenuButton.isVisible()) {
    await mainMenuButton.click();
  }
  await page.waitForSelector('.side-bar__panel--menu', { state: 'visible' });
}

async function openMenu(page, menuName) {
  await showMainMenu(page);
  const menuEntry = page.locator('.side-bar__panel--menu .menu-entry')
    .filter({ hasText: menuName });
  await menuEntry.waitFor({ state: 'visible' });
  await menuEntry.click();
}

async function assertMenuIconGeometry(page, panelName) {
  const originalViewport = page.viewportSize() || { width: 1728, height: 905 };
  const originalClasses = await page.locator('.app').getAttribute('class');
  const menuPanel = page.locator('.side-bar__panel--menu');
  try {
    for (const theme of ['light', 'dark']) {
      await page.locator('.app').evaluate((element, selectedTheme) => {
        element.classList.remove('app--light', 'app--dark');
        element.classList.add(`app--${selectedTheme}`);
      }, theme);
      for (const viewport of [
        { width: 1728, height: 905 },
        { width: 390, height: 844 },
        { width: 390, height: 480 },
      ]) {
        await page.setViewportSize(viewport);
        await page.waitForFunction(({ width, height }) => (
          window.innerWidth === width && window.innerHeight === height
        ), viewport);
        await menuPanel.waitFor({ state: 'visible' });
        const geometry = await menuPanel.evaluate((panel) => {
          const panelRect = panel.getBoundingClientRect();
          const entries = [...panel.querySelectorAll('.menu-entry')].map((entry) => {
            const wrapper = entry.querySelector('.menu-entry__icon');
            const icon = wrapper?.querySelector('svg');
            const text = entry.querySelector('.menu-entry__text')
              || [...entry.children].find(child => child !== wrapper);
            const wrapperRect = wrapper?.getBoundingClientRect();
            const iconRect = icon?.getBoundingClientRect();
            const textRect = text?.getBoundingClientRect();
            const entryRect = entry.getBoundingClientRect();
            return {
              label: entry.textContent.trim(),
              rect: {
                left: entryRect.left,
                right: entryRect.right,
                height: entryRect.height,
              },
              wrapper: wrapperRect && { width: wrapperRect.width, height: wrapperRect.height },
              icon: iconRect && {
                width: iconRect.width,
                height: iconRect.height,
                right: iconRect.right,
              },
              text: textRect && { left: textRect.left },
            };
          });
          return {
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
            panel: {
              left: panelRect.left,
              right: panelRect.right,
              top: panelRect.top,
              bottom: panelRect.bottom,
              width: panel.clientWidth,
              scrollWidth: panel.scrollWidth,
            },
            entries,
          };
        });
        assert.ok(geometry.entries.length, `${panelName} has visible menu entries`);
        assert.ok(geometry.documentWidth <= viewport.width,
          `${panelName} has no page-level horizontal overflow at ${viewport.width}x${viewport.height}`);
        assert.ok(geometry.panel.left >= 0 && geometry.panel.right <= viewport.width,
          `${panelName} fits the viewport width at ${viewport.width}x${viewport.height}`);
        assert.ok(geometry.panel.scrollWidth <= geometry.panel.width + 1,
          `${panelName} has no horizontal menu overflow at ${viewport.width}x${viewport.height}`);
        for (const entry of geometry.entries) {
          assert.deepEqual(entry.wrapper, { width: 20, height: 20 },
            `${theme} ${viewport.width}x${viewport.height} ${panelName} ${entry.label} keeps the compact icon wrapper`);
          assert.deepEqual({ width: entry.icon?.width, height: entry.icon?.height },
            { width: 20, height: 20 },
            `${theme} ${viewport.width}x${viewport.height} ${panelName} ${entry.label} renders a 20px icon`);
          assert.ok(entry.text.left >= entry.icon.right,
            `${panelName} ${entry.label} keeps its text alongside the icon`);
          assert.ok(entry.rect.left >= geometry.panel.left - 1
            && entry.rect.right <= geometry.panel.right + 1,
          `${panelName} ${entry.label} stays within the menu width`);
          assert.ok(entry.rect.height >= 40 && entry.rect.height < 120,
            `${panelName} ${entry.label} has a usable row height without an oversized icon`);
        }

        await menuPanel.evaluate((panel) => {
          panel.scrollTop = panel.scrollHeight;
        });
        const lastEntry = menuPanel.locator('.menu-entry').last();
        const lastEntryState = await lastEntry.evaluate((entry) => {
          const row = entry.getBoundingClientRect();
          const panel = entry.closest('.side-bar__panel--menu').getBoundingClientRect();
          return { rowTop: row.top, rowBottom: row.bottom, panelTop: panel.top, panelBottom: panel.bottom };
        });
        assert.ok(lastEntryState.rowTop >= lastEntryState.panelTop
          && lastEntryState.rowBottom <= lastEntryState.panelBottom,
        `${panelName} bottom entry remains reachable after scrolling at ${viewport.width}x${viewport.height}`);
        await menuPanel.evaluate((panel) => {
          panel.scrollTop = 0;
        });
      }
    }
  } finally {
    await page.setViewportSize(originalViewport);
    await page.locator('.app').evaluate((element, classes) => {
      element.className = classes;
    }, originalClasses);
    await menuPanel.evaluate((panel) => {
      panel.scrollTop = 0;
    });
  }
}

async function assertSettingsDialogUsability(page) {
  const storedSettings = await page.evaluate(() => (
    document.querySelector('#app').__vue_app__._context.provides.store.getters['data/settings']
  ));
  const originalViewport = page.viewportSize();
  await openMenu(page, 'Settings');
  let dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await dialog.waitFor({ state: 'visible' });
  const settingsButton = dialog.getByRole('button', { name: 'Ok', exact: true });
  const cancelButton = dialog.getByRole('button', { name: 'Cancel', exact: true });
  await assertEnabledButtonContrast(settingsButton, 'Default Settings OK');
  await settingsButton.hover();
  await assertEnabledButtonContrast(settingsButton, 'Hovered Settings OK');
  await cancelButton.focus();
  await page.keyboard.press('Tab');
  assert.equal(await settingsButton.evaluate(element => document.activeElement === element), true,
    'Keyboard navigation reaches Settings OK');
  await assertFocusIndicatorContrast(settingsButton, 'Settings OK', '.modal__inner-2');
  const customEditor = dialog.locator('.code-editor');
  const initialDraft = 'colorTheme: light\nfontSizeFactor: 1.25\n';
  await customEditor.fill(initialDraft);
  const customOriginalClasses = await page.locator('.app').getAttribute('class');
  for (const theme of ['light', 'dark']) {
    await page.locator('.app').evaluate((element, selectedTheme) => {
      element.classList.remove('app--light', 'app--dark');
      element.classList.add(`app--${selectedTheme}`);
    }, theme);
    for (const viewport of [
      { width: 1728, height: 905 },
      { width: 390, height: 844 },
      { width: 390, height: 480 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForFunction(({ width, height }) => (
        window.innerWidth === width && window.innerHeight === height
      ), viewport);
      const customState = await dialog.evaluate((element) => {
        const box = element.querySelector('.modal__inner-2').getBoundingClientRect();
        const buttons = element.querySelector('.modal__button-bar').getBoundingClientRect();
        return {
          box: { top: box.top, bottom: box.bottom, left: box.left, right: box.right },
          buttons: { top: buttons.top, bottom: buttons.bottom },
          width: window.innerWidth,
          height: window.innerHeight,
          documentWidth: document.documentElement.scrollWidth,
        };
      });
      assert.ok(customState.box.top >= 0 && customState.box.bottom <= customState.height
        && customState.box.left >= 0 && customState.box.right <= customState.width,
      `Custom settings fit ${theme} ${viewport.width}x${viewport.height}`);
      assert.ok(customState.documentWidth <= customState.width,
        `Custom settings have no page overflow in ${theme} at ${viewport.width}x${viewport.height}`);
      assert.ok(customState.buttons.top >= customState.box.top
        && customState.buttons.bottom <= customState.box.bottom,
      `Custom settings actions stay inside the dialog in ${theme} at ${viewport.width}x${viewport.height}`);
    }
  }
  await page.locator('.app').evaluate((element, classes) => {
    element.className = classes;
  }, customOriginalClasses);
  await page.setViewportSize(originalViewport);
  const defaultTab = dialog.getByRole('tab', { name: 'Default settings', exact: true });
  await defaultTab.locator('a').focus();
  await defaultTab.locator('a').press('Enter');
  const defaultEditor = dialog.locator('.code-editor');
  assert.equal(await defaultEditor.getAttribute('contenteditable'), 'false',
    'Default settings remain read-only');
  const defaultState = await dialog.evaluate((element) => {
    const box = element.querySelector('.modal__inner-2').getBoundingClientRect();
    const content = element.querySelector('.modal__content');
    const buttons = element.querySelector('.modal__button-bar').getBoundingClientRect();
    const tabs = element.querySelector('.tabs').getBoundingClientRect();
    return {
      box: { top: box.top, bottom: box.bottom, left: box.left, right: box.right },
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      contentScrollHeight: content.scrollHeight,
      contentClientHeight: content.clientHeight,
      buttons: { top: buttons.top, bottom: buttons.bottom },
      tabs: { top: tabs.top, bottom: tabs.bottom },
    };
  });
  assert.ok(defaultState.box.top >= 0 && defaultState.box.bottom <= defaultState.viewportHeight,
    'The full default settings dialog stays within the viewport');
  assert.ok(defaultState.box.left >= 0 && defaultState.box.right <= defaultState.viewportWidth,
    'The settings dialog stays within the viewport width');
  assert.ok(defaultState.contentScrollHeight > defaultState.contentClientHeight,
    'Long default settings scroll inside the dialog content');
  assert.ok(defaultState.buttons.top >= defaultState.box.top
    && defaultState.buttons.bottom <= defaultState.box.bottom,
  'Cancel and OK remain inside the bounded dialog');

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 390, height: 480 },
  ]) {
    await page.setViewportSize(viewport);
    const mobileState = await dialog.evaluate((element) => {
      const box = element.querySelector('.modal__inner-2').getBoundingClientRect();
      const buttons = element.querySelector('.modal__button-bar').getBoundingClientRect();
      return {
        box: { top: box.top, bottom: box.bottom, left: box.left, right: box.right },
        buttons: { top: buttons.top, bottom: buttons.bottom },
        width: window.innerWidth,
        height: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    assert.ok(mobileState.box.top >= 0 && mobileState.box.bottom <= mobileState.height,
      `Default settings fit ${viewport.width}x${viewport.height}`);
    assert.ok(mobileState.box.left >= 0 && mobileState.box.right <= mobileState.width,
      `Settings have no horizontal overflow at ${viewport.width}x${viewport.height}`);
    assert.ok(mobileState.buttons.top >= mobileState.box.top
      && mobileState.buttons.bottom <= mobileState.box.bottom,
    `Settings actions stay inside the dialog at ${viewport.width}x${viewport.height}`);
    assert.ok(mobileState.documentWidth <= mobileState.width,
      `Settings do not cause page overflow at ${viewport.width}x${viewport.height}`);
  }
  await page.setViewportSize(originalViewport);

  await dialog.locator('.modal__content').evaluate(content => {
    content.scrollTop = content.scrollHeight;
  });
  await page.waitForTimeout(30);
  const scrolledSettings = await dialog.evaluate((element) => ({
    tabs: element.querySelector('.tabs').getBoundingClientRect().toJSON(),
    content: element.querySelector('.modal__content').getBoundingClientRect().toJSON(),
    buttons: element.querySelector('.modal__button-bar').getBoundingClientRect().toJSON(),
  }));
  assert.ok(scrolledSettings.tabs.top <= scrolledSettings.content.top + 2,
    'Settings tabs stay reachable while content scrolls');
  assert.ok(scrolledSettings.buttons.bottom <= defaultState.viewportHeight,
    'Settings actions remain reachable after scrolling defaults');

  await dialog.getByRole('tab', { name: 'Custom settings', exact: true }).click();
  assert.equal(await dialog.locator('.code-editor').getAttribute('contenteditable'), 'true');
  assert.match(await dialog.locator('.code-editor').textContent(), /fontSizeFactor: 1\.25/,
    'Unsaved custom YAML survives switching tabs');
  const longInvalidYaml = `invalid: [${'x'.repeat(800)}`;
  await page.setViewportSize({ width: 390, height: 480 });
  await dialog.locator('.code-editor').fill(longInvalidYaml);
  const error = dialog.locator('.modal__error--settings');
  await error.waitFor({ state: 'visible' });
  assert.ok((await error.textContent()).trim().length > 0,
    'Invalid YAML has a visible validation message');
  assert.equal(await dialog.getByRole('button', { name: 'Ok', exact: true }).isDisabled(), true,
    'Invalid YAML cannot be saved');
  const errorState = await dialog.evaluate((element) => {
    const box = element.querySelector('.modal__inner-2').getBoundingClientRect();
    const buttons = element.querySelector('.modal__button-bar').getBoundingClientRect();
    return {
      box: { top: box.top, bottom: box.bottom, left: box.left, right: box.right },
      buttons: { top: buttons.top, bottom: buttons.bottom },
      width: window.innerWidth,
      height: window.innerHeight,
      documentWidth: document.documentElement.scrollWidth,
    };
  });
  assert.ok(errorState.box.top >= 0 && errorState.box.bottom <= errorState.height);
  assert.ok(errorState.box.left >= 0 && errorState.box.right <= errorState.width);
  assert.ok(errorState.documentWidth <= errorState.width,
    'Long settings errors do not create horizontal page overflow');
  assert.ok(errorState.buttons.top >= errorState.box.top
    && errorState.buttons.bottom <= errorState.box.bottom,
  'Cancel and OK remain reachable with a long validation error');
  await dialog.locator('.modal__content').evaluate((content) => {
    content.scrollTop = content.scrollHeight;
  });
  await page.waitForTimeout(30);
  const scrolledError = await dialog.evaluate((element) => {
    const box = element.querySelector('.modal__inner-2').getBoundingClientRect();
    const content = element.querySelector('.modal__content');
    const tabs = element.querySelector('.tabs').getBoundingClientRect();
    const buttons = element.querySelector('.modal__button-bar').getBoundingClientRect();
    return {
      boxBottom: box.bottom,
      contentScrollHeight: content.scrollHeight,
      contentClientHeight: content.clientHeight,
      contentTop: content.getBoundingClientRect().top,
      tabsTop: tabs.top,
      buttonsBottom: buttons.bottom,
    };
  });
  assert.ok(scrolledError.contentScrollHeight > scrolledError.contentClientHeight,
    'Long YAML and its validation message scroll inside Settings');
  assert.ok(scrolledError.tabsTop <= scrolledError.contentTop + 2,
    'Settings tabs remain reachable while the invalid custom content scrolls');
  assert.ok(scrolledError.buttonsBottom <= scrolledError.boxBottom,
    'Settings actions remain reachable after scrolling the validation message');
  await dialog.locator('.code-editor').fill(initialDraft);
  await error.waitFor({ state: 'hidden' });
  assert.equal(await dialog.getByRole('button', { name: 'Ok', exact: true }).isDisabled(), false,
    'Correcting invalid YAML enables Settings OK again');
  await dialog.locator('.code-editor').focus();
  await page.keyboard.press('Tab');
  assert.equal(await cancelButton.evaluate(element => document.activeElement === element), true,
    'Keyboard navigation reaches Settings Cancel');
  const cancelFocus = await cancelButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outline: style.outlineStyle, width: style.outlineWidth };
  });
  assert.notEqual(cancelFocus.outline, 'none', 'Settings Cancel has visible keyboard focus');
  await assertFocusIndicatorContrast(cancelButton, 'Settings Cancel', '.modal__inner-2');
  await cancelButton.press('Enter');
  await page.setViewportSize(originalViewport);
  assert.equal(await page.evaluate(() => (
    document.querySelector('#app').__vue_app__._context.provides.store.getters['data/settings']
  )), storedSettings, 'Cancel leaves persisted settings unchanged');

  await openMenu(page, 'Settings');
  dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await dialog.waitFor({ state: 'visible' });
  await dialog.locator('.code-editor').fill('colorTheme: dark\nfontSizeFactor: 1.25\n');
  const saveButton = dialog.getByRole('button', { name: 'Ok', exact: true });
  await saveButton.focus();
  await saveButton.press('Enter');
  await page.waitForFunction(() => (
    document.querySelector('#app .app')?.classList.contains('app--dark')
  ));
  const savedSettings = await page.evaluate(() => (
    document.querySelector('#app').__vue_app__._context.provides.store.getters['data/settings']
  ));
  assert.match(savedSettings, /colorTheme: dark/);
  await openMenu(page, 'Settings');
  dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await dialog.waitFor({ state: 'visible' });
  assert.match(await dialog.locator('.code-editor').textContent(), /colorTheme: dark/,
    'Saved custom YAML is present when settings reopen');
  await dialog.getByRole('tab', { name: 'Default settings', exact: true }).click();
  for (const viewport of [
    originalViewport,
    { width: 390, height: 844 },
    { width: 390, height: 480 },
  ]) {
    await page.setViewportSize(viewport);
    const darkSettingsBox = await dialog.locator('.modal__inner-2').evaluate((element) => {
      const box = element.getBoundingClientRect();
      const buttons = element.querySelector('.modal__button-bar').getBoundingClientRect();
      return {
        top: box.top,
        bottom: box.bottom,
        left: box.left,
        right: box.right,
        buttonsBottom: buttons.bottom,
        width: innerWidth,
        height: innerHeight,
      };
    });
    assert.ok(darkSettingsBox.top >= 0 && darkSettingsBox.bottom <= darkSettingsBox.height
      && darkSettingsBox.left >= 0 && darkSettingsBox.right <= darkSettingsBox.width
      && darkSettingsBox.buttonsBottom <= darkSettingsBox.bottom,
    `Settings stay bounded in the dark theme at ${viewport.width}x${viewport.height}`);
  }
  await page.setViewportSize(originalViewport);
  await dialog.getByRole('tab', { name: 'Custom settings', exact: true }).click();
  await dialog.locator('.code-editor').fill(storedSettings);
  await dialog.getByRole('button', { name: 'Ok', exact: true }).click();
  await page.waitForFunction(() => (
    document.querySelector('#app .app')?.classList.contains('app--light')
  ));
  assert.equal(await page.evaluate(() => (
    document.querySelector('#app').__vue_app__._context.provides.store.getters['data/settings']
  )), storedSettings, 'The isolated browser fixture restores its original settings');
}

async function measureSearchContrast(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('.workspace-search');
    const parseColor = (color) => {
      const values = color.match(/[\d.]+/g)?.map(Number) || [];
      return [values[0] || 0, values[1] || 0, values[2] || 0, values[3] ?? 1];
    };
    const composite = (foreground, background, alpha) => foreground.slice(0, 3).map((value, index) => (
      Math.round((value * alpha) + (background[index] * (1 - alpha)))
    ));
    const luminance = (rgb) => {
      const channels = rgb.map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return (channels[0] * 0.2126) + (channels[1] * 0.7152) + (channels[2] * 0.0722);
    };
    const contrast = (left, right) => {
      const [light, dark] = [luminance(left), luminance(right)].sort((a, b) => b - a);
      return (light + 0.05) / (dark + 0.05);
    };
    const effectiveColors = (element) => {
      const ancestry = [];
      for (let node = element; node; node = node.parentElement) {
        ancestry.push(node);
        if (node === panel) break;
      }
      ancestry.reverse();
      let background = [255, 255, 255];
      let opacity = 1;
      ancestry.forEach((node) => {
        const style = getComputedStyle(node);
        const color = parseColor(style.backgroundColor);
        if (color[3] > 0) background = composite(color, background, color[3]);
        opacity *= Number(style.opacity);
      });
      const text = parseColor(getComputedStyle(element).color);
      const foreground = composite(text, background, opacity * text[3]);
      return { ratio: contrast(foreground, background), foreground, background };
    };
    const query = panel.querySelector('.workspace-search__query');
    const status = panel.querySelector('.workspace-search__status');
    const name = panel.querySelector('.workspace-search__result-name');
    const path = panel.querySelector('.workspace-search__result-path');
    const snippet = panel.querySelector('.workspace-search__snippet');
    const mark = panel.querySelector('mark');
    const button = panel.querySelector('.workspace-search__actions button:focus-visible')
      || panel.querySelector('.workspace-search__actions button');
    const closeIcon = panel.querySelector('.workspace-search__close svg');
    return Object.fromEntries(Object.entries({ query, status, name, path, snippet, mark, button, closeIcon })
      .filter(([, element]) => element)
      .map(([label, element]) => [label, effectiveColors(element)]));
  });
}

async function assertSearchStatusContrastBothThemes(page, searchPanel, stateName) {
  const originalClasses = await page.locator('.app').getAttribute('class');
  for (const theme of ['light', 'dark']) {
    await page.locator('.app').evaluate((element, selectedTheme) => {
      element.classList.remove('app--light', 'app--dark');
      element.classList.add(`app--${selectedTheme}`);
    }, theme);
    const contrast = await measureSearchContrast(page);
    assert.ok(contrast.status?.ratio >= 4.5,
      `${theme} ${stateName} status contrast is at least 4.5:1`);
  }
  await page.locator('.app').evaluate((element, classes) => {
    element.className = classes;
  }, originalClasses);
  assert.ok(await searchPanel.isVisible(), `${stateName} search state remains visible`);
}

async function assertSearchLayoutAndContrast(page, searchPanel, viewport, theme) {
  await page.setViewportSize(viewport);
  await page.waitForFunction(({ width, height }) => (
    window.innerWidth === width && window.innerHeight === height
  ), viewport);
  await page.locator('.app').evaluate((element, selectedTheme) => {
    element.classList.remove('app--light', 'app--dark');
    element.classList.add(`app--${selectedTheme}`);
  }, theme);

  const geometry = await page.evaluate(() => {
    const panel = document.querySelector('.workspace-search').getBoundingClientRect();
    const sidebar = document.querySelector('.layout__panel--side-bar');
    const sidebarRect = sidebar?.getBoundingClientRect();
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      panel: { left: panel.left, right: panel.right, top: panel.top, bottom: panel.bottom },
      sidebarVisible: Boolean(sidebar && sidebar.getBoundingClientRect().width),
      sidebar: sidebarRect && { left: sidebarRect.left, right: sidebarRect.right },
    };
  });
  assert.ok(geometry.documentWidth <= geometry.width,
    `${theme} ${viewport.width}x${viewport.height} search causes no horizontal page overflow`);
  assert.ok(geometry.panel.left >= 0 && geometry.panel.right <= geometry.width,
    `${theme} ${viewport.width}x${viewport.height} search fits the viewport width`);
  assert.ok(geometry.panel.top >= 0 && geometry.panel.bottom <= geometry.height,
    `${theme} ${viewport.width}x${viewport.height} search fits the viewport height`);
  if (viewport.width >= 1060 && geometry.sidebarVisible) {
    assert.ok(geometry.panel.right <= geometry.sidebar.left,
      'Desktop search stays clear of usable right sidebar controls');
  }

  await searchPanel.evaluate((element) => {
    element.scrollTop = 0;
  });
  const queryState = await searchPanel.locator('input[aria-label="Search workspace query"]')
    .evaluate(element => element.getBoundingClientRect().toJSON());
  assert.ok(queryState.top >= 0 && queryState.bottom <= geometry.height,
    'The search query remains reachable at the top of the bounded panel');
  const closeState = await searchPanel.locator('.workspace-search__close')
    .evaluate(element => element.getBoundingClientRect().toJSON());
  assert.ok(closeState.top >= 0 && closeState.bottom <= geometry.height,
    'The search close control remains reachable at the top of the bounded panel');
  const actionState = await searchPanel.locator('.workspace-search__actions')
    .evaluate((element) => {
      element.scrollIntoView({ block: 'center' });
      return element.getBoundingClientRect().toJSON();
    });
  assert.ok(actionState.top >= 0 && actionState.bottom <= geometry.height,
    'Search actions remain reachable by scrolling the bounded panel');
  const resultList = searchPanel.locator('.workspace-search__results');
  await resultList.evaluate((list) => {
    list.scrollIntoView({ block: 'center' });
    list.scrollTop = list.scrollHeight;
  });
  const resultMetrics = await resultList.evaluate((list) => {
    const lastName = list.lastElementChild.querySelector('.workspace-search__result-name');
    lastName.scrollIntoView({ block: 'nearest' });
    return {
      scrollHeight: list.scrollHeight,
      clientHeight: list.clientHeight,
      rect: list.getBoundingClientRect().toJSON(),
      lastName: lastName.getBoundingClientRect().toJSON(),
    };
  });
  assert.ok(resultMetrics.clientHeight > 0 && resultMetrics.scrollHeight > resultMetrics.clientHeight,
    'Many results remain in a bounded scrollable region at each viewport size');
  assert.ok(resultMetrics.lastName.top >= resultMetrics.rect.top - 1
    && resultMetrics.lastName.bottom <= resultMetrics.rect.bottom + 1,
  'The last result name remains visible after scrolling at each viewport size');
  const resultTextBounds = await resultList.evaluate((list) => {
    const listRect = list.getBoundingClientRect();
    const selectors = [
      '.workspace-search__result-name',
      '.workspace-search__result-path',
      '.workspace-search__snippet',
    ];
    return {
      list: { left: listRect.left, right: listRect.right },
      text: [...list.querySelectorAll(selectors.join(','))].map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label: element.textContent.trim().slice(0, 80),
          left: rect.left,
          right: rect.right,
        };
      }),
    };
  });
  assert.ok(resultTextBounds.text.length > 0, 'Search results render names, paths, and snippets');
  for (const text of resultTextBounds.text) {
    assert.ok(text.left >= resultTextBounds.list.left - 1
      && text.right <= resultTextBounds.list.right + 1,
    `${theme} ${viewport.width}x${viewport.height} result text wraps inside the list: ${text.label}`);
  }
  await searchPanel.evaluate((element) => {
    element.scrollTop = 0;
  });

  const contrast = await measureSearchContrast(page);
  for (const [target, value] of Object.entries(contrast)) {
    const required = target === 'closeIcon' ? 3 : 4.5;
    assert.ok(value.ratio >= required,
      `${theme} ${target} contrast is ${value.ratio.toFixed(2)}:1 (minimum ${required}:1)`);
  }
  const caseStyling = await searchPanel.locator('.workspace-search__result-name')
    .first()
    .evaluate(element => getComputedStyle(element).textTransform);
  assert.equal(caseStyling, 'none', 'Search results preserve their source letter case');

  const searchButton = searchPanel.getByRole('button', { name: 'Search', exact: true });
  const closeButton = searchPanel.getByRole('button', { name: 'Close search workspace', exact: true });
  await closeButton.hover();
  const hoveredCloseContrast = await measureSearchContrast(page);
  assert.ok(hoveredCloseContrast.closeIcon.ratio >= 3,
    `${theme} hovered search close icon contrast is at least 3:1`);
  await closeButton.focus();
  const closeFocus = await closeButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outline: style.outlineStyle, width: style.outlineWidth };
  });
  assert.notEqual(closeFocus.outline, 'none', 'Search close control has visible keyboard focus');
  assert.ok(parseFloat(closeFocus.width) >= 2);
  await assertFocusIndicatorContrast(closeButton, `${theme} search close`, '.workspace-search');
  const focusedCloseContrast = await measureSearchContrast(page);
  assert.ok(focusedCloseContrast.closeIcon.ratio >= 3,
    `${theme} focused search close icon contrast is at least 3:1`);

  await searchButton.hover();
  const hoverContrast = await measureSearchContrast(page);
  assert.ok(hoverContrast.button.ratio >= 4.5,
    `${theme} hovered search action contrast is ${hoverContrast.button.ratio.toFixed(2)}:1`);

  await searchButton.focus();
  await page.keyboard.press('Tab');
  const focusState = await page.evaluate(() => {
    const element = document.activeElement;
    const style = getComputedStyle(element);
    return { width: style.outlineWidth, style: style.outlineStyle };
  });
  assert.notEqual(focusState.style, 'none', 'Search controls show visible keyboard focus');
  assert.ok(parseFloat(focusState.width) >= 2, 'Search focus indicator is at least 2px wide');
  await assertFocusIndicatorContrast(
    searchPanel.locator('.workspace-search__actions button:focus-visible'),
    `${theme} search action`,
    '.workspace-search',
  );
  const focusedActionContrast = await measureSearchContrast(page);
  assert.ok(focusedActionContrast.button.ratio >= 4.5,
    `${theme} focused search action text retains 4.5:1 contrast`);

  const firstResult = searchPanel.locator('.workspace-search__result').first();
  await firstResult.hover();
  const hoveredResultContrast = await measureSearchContrast(page);
  for (const target of ['name', 'path', 'snippet', 'mark']) {
    if (hoveredResultContrast[target]) {
      assert.ok(hoveredResultContrast[target].ratio >= 4.5,
        `${theme} hovered result ${target} retains 4.5:1 contrast`);
    }
  }
  await firstResult.focus();
  await page.keyboard.press('Tab');
  const resultFocus = await searchPanel.locator('.workspace-search__result').nth(1)
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return { outline: style.outlineStyle, width: style.outlineWidth };
    });
  assert.notEqual(resultFocus.outline, 'none', 'Search results show keyboard focus');
  assert.ok(parseFloat(resultFocus.width) >= 2);
  await assertFocusIndicatorContrast(
    searchPanel.locator('.workspace-search__result').nth(1),
    `${theme} search result`,
    '.workspace-search',
  );
  const focusedResultContrast = await measureSearchContrast(page);
  for (const target of ['name', 'path', 'snippet', 'mark']) {
    if (focusedResultContrast[target]) {
      assert.ok(focusedResultContrast[target].ratio >= 4.5,
        `${theme} focused result ${target} retains 4.5:1 contrast`);
    }
  }
}

async function ensureExplorerVisible(page) {
  const explorer = page.locator('.explorer__tree');
  if (!(await explorer.isVisible())) {
    await page.getByRole('button', { name: 'Toggle explorer', exact: true }).click();
  }
  await explorer.waitFor({ state: 'visible' });
}

async function createExplorerItem(page, name, isFolder = false) {
  const previousEditorText = isFolder
    ? null
    : await page.locator('.editor__inner').textContent();
  await page.locator(isFolder
    ? '.side-title__button--new-folder'
    : '.side-title__button--new-file').click();
  const input = page.locator('.explorer-node__new-child input').last();
  await input.waitFor({ state: 'visible' });
  await input.fill(name);
  await input.press('Enter');
  await page.waitForFunction(expectedName => (
    [...document.querySelectorAll('.explorer-node__item')]
      .some(item => item.textContent.trim() === expectedName)
  ), name, { timeout: 10_000 });
  if (!isFolder) {
    await page.waitForFunction(expectedName => (
      document.querySelector('.navigation-bar__title--input')?.value === expectedName
    ), name, { timeout: 10_000 });
    await page.waitForFunction(({ expectedName, previousText }) => (
      document.querySelector('.navigation-bar__title--input')?.value === expectedName
      && document.querySelector('.editor__inner')?.textContent !== previousText
    ), { expectedName: name, previousText: previousEditorText }, { timeout: 10_000 });
  }
}

async function renameCurrentFile(page, name) {
  const titleInput = page.locator('.navigation-bar__title--input');
  await titleInput.click();
  await titleInput.fill(name);
  await titleInput.press('Enter');
  await page.waitForFunction(expectedName => (
    document.querySelector('.navigation-bar__title--input')?.value === expectedName
  ), name, { timeout: 10_000 });
}

async function openWorkspaceSearch(page) {
  await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Search workspace', exact: true });
  await panel.waitFor({ state: 'visible' });
  return panel;
}

async function submitWorkspaceSearch(page, query, useEnter = true) {
  const panel = page.locator('.workspace-search');
  const queryInput = panel.locator('input[aria-label="Search workspace query"]');
  await queryInput.fill(query);
  if (useEnter) {
    await queryInput.press('Enter');
  } else {
    await panel.getByRole('button', { name: 'Search', exact: true }).click();
  }
  await page.waitForFunction(() => {
    const status = document.querySelector('.workspace-search__status')?.textContent || '';
    return status
      && !status.includes('Search document names and content in this workspace')
      && !status.includes('Searching workspace');
  }, undefined, { timeout: 20_000 });
  return panel;
}

async function setSearchOption(panel, label, enabled) {
  const option = panel.locator('fieldset label').filter({ hasText: label }).locator('input');
  const checked = await option.isChecked();
  if (enabled && !checked) {
    await option.check({ force: true });
  } else if (!enabled && checked) {
    await option.uncheck({ force: true });
  }
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

async function assertEnabledButtonContrast(button, label) {
  const colors = await button.evaluate((element) => {
    const rgba = (value) => {
      const channels = value.match(/[\d.]+/g)?.map(Number) || [];
      return [channels[0] || 0, channels[1] || 0, channels[2] || 0, channels[3] ?? 1];
    };
    const composite = (foreground, background) => foreground.slice(0, 3).map((channel, index) => (
      Math.round((channel * foreground[3]) + (background[index] * (1 - foreground[3])))
    ));
    const luminance = color => color.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((total, channel, index) => (
      total + (channel * [0.2126, 0.7152, 0.0722][index])
    ), 0);
    const ratio = (foreground, background) => {
      const [light, dark] = [luminance(foreground), luminance(background)]
        .sort((left, right) => right - left);
      return (light + 0.05) / (dark + 0.05);
    };
    const style = getComputedStyle(element);
    const surface = rgba(getComputedStyle(element.closest('.modal__inner-2')).backgroundColor);
    const background = composite(rgba(style.backgroundColor), composite(surface, [255, 255, 255]));
    const foreground = composite(rgba(style.color), background);
    const focusColor = composite(rgba(style.outlineColor), composite(surface, [255, 255, 255]));
    return {
      text: ratio(foreground, background),
      foreground: style.color,
      background: style.backgroundColor,
      effectiveForeground: foreground,
      effectiveBackground: background,
      opacity: style.opacity,
      focus: ratio(focusColor, composite(surface, [255, 255, 255])),
      outlineWidth: style.outlineWidth,
      outlineStyle: style.outlineStyle,
    };
  });
  assert.ok(colors.text >= 4.5,
    `${label} enabled text contrast is ${colors.text.toFixed(2)}:1 (text ${colors.foreground}, background ${colors.background}, opacity ${colors.opacity}; composed ${colors.effectiveForeground} on ${colors.effectiveBackground})`);
  return colors;
}

async function assertFocusIndicatorContrast(element, label, surfaceSelector) {
  const contrast = await element.evaluate((focusedElement, selector) => {
    const rgba = (value) => {
      const channels = value.match(/[\d.]+/g)?.map(Number) || [];
      return [channels[0] || 0, channels[1] || 0, channels[2] || 0, channels[3] ?? 1];
    };
    const composite = (foreground, background) => foreground.slice(0, 3).map((channel, index) => (
      Math.round((channel * foreground[3]) + (background[index] * (1 - foreground[3])))
    ));
    const luminance = color => color.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((total, channel, index) => total + (channel * [0.2126, 0.7152, 0.0722][index]), 0);
    const style = getComputedStyle(focusedElement);
    const surfaceColor = rgba(getComputedStyle(document.querySelector(selector)).backgroundColor);
    const surface = composite(surfaceColor, [255, 255, 255]);
    const outlineColor = rgba(style.outlineColor);
    const outline = composite(outlineColor, surface);
    const [light, dark] = [luminance(outline), luminance(surface)].sort((a, b) => b - a);
    return {
      ratio: (light + 0.05) / (dark + 0.05),
      outlineColor: style.outlineColor,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      surfaceColor: getComputedStyle(document.querySelector(selector)).backgroundColor,
      surface,
      outline,
    };
  }, surfaceSelector);
  assert.ok(contrast.ratio >= 3,
    `${label} focus indicator contrast is ${contrast.ratio.toFixed(2)}:1 (minimum 3:1); rendered outline ${contrast.outlineColor} (${contrast.outlineStyle} ${contrast.outlineWidth}) against ${contrast.surfaceColor}`);
  return contrast.ratio;
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
      return lastOpened?.data?.[fileId] && file
        ? { fileName: file.name, text: content.text }
        : null;
    }, marker);
    if (storedDocument) {
      return storedDocument;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for stored document containing ${marker}.`);
}

async function seedWorkspaceDatabase(page, workspaceId, items) {
  await page.evaluate(async ({ databaseName, workspaceItems }) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      const objectStore = db.createObjectStore('objects', { keyPath: 'id' });
      objectStore.createIndex('tx', 'tx', { unique: false });
    };
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction('objects', 'readwrite');
    const objectStore = transaction.objectStore('objects');
    workspaceItems.forEach(item => objectStore.put(item));
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Workspace seed aborted.'));
    });
    db.close();
  }, {
    databaseName: workspaceId === 'main' ? 'stackedit-db' : `stackedit-db-${workspaceId}`,
    workspaceItems: items,
  });
}

async function addLocalWorkspaceDescriptor(page, workspaceId, descriptor) {
  await page.evaluate(async ({ id, workspace }) => {
    const store = document.querySelector('#app').__vue_app__._context.provides.store;
    await store.dispatch('workspace/patchWorkspacesById', { [id]: workspace });
  }, { id: workspaceId, workspace: descriptor });
}

async function seedLegacyWorkspaceRecords(page) {
  await page.evaluate(async () => {
    window.__stackeditLegacyHelperExecuted = false;
    const request = indexedDB.open('stackedit-db');
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const existingItems = await new Promise((resolve, reject) => {
      const read = db.transaction('objects', 'readonly').objectStore('objects').getAll();
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });
    const existingTemplateItem = existingItems.find(item => item.id === 'templates');
    const existingFile = existingItems.find(item => item.type === 'file');
    const nextTransaction = Math.max(0, ...existingItems.map(item => item.tx || 0)) + 1;
    const legacyTemplate = {
      name: 'Archived offline template',
      value: '<script>window.__stackeditLegacyHelperExecuted = true</script>',
      helpers: 'self.postMessage([null, window.__stackeditLegacyHelperExecuted = true]);',
      isAdditional: true,
    };
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('objects', 'readwrite');
      transaction.objectStore('objects').put({
        id: 'templates',
        type: 'data',
        data: {
          ...existingTemplateItem?.data,
          archivedOffline: legacyTemplate,
        },
        hash: Date.now(),
        tx: nextTransaction,
      });
      transaction.objectStore('objects').put({
        id: 'legacy-sync-location',
        type: 'syncLocation',
        fileId: existingFile?.id,
        providerId: 'googleDrive',
        url: 'https://drive.google.com/legacy-note',
        hash: 1,
        tx: nextTransaction + 1,
      });
      transaction.objectStore('objects').put({
        id: 'legacy-publish-location',
        type: 'publishLocation',
        fileId: existingFile?.id,
        providerId: 'github',
        url: 'https://github.com/legacy-note',
        templateId: 'archived-template',
        hash: 1,
        tx: nextTransaction + 2,
      });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();
  });
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

async function exportHtml(page, { tableOfContents = false, copy = false } = {}) {
  const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
  downloadPromise.catch(() => {});
  await openMenu(page, 'Import/export');
  await page.locator('.side-bar__panel--menu .menu-entry')
    .filter({ hasText: 'Export as HTML' })
    .click();
  const modal = page.locator('.modal');
  await modal.getByText('Fixed styled HTML', { exact: false }).waitFor({ state: 'visible' });
  const exportButton = page.locator('.modal__button-bar .button--resolve');
  await exportButton.waitFor({ state: 'visible' });
  await exportButton.waitFor({ state: 'attached' });
  await page.waitForFunction(() => {
    const button = document.querySelector('.modal .modal__button-bar .button--resolve');
    return Boolean(button && !button.disabled);
  });
  assert.equal(await exportButton.isDisabled(), false,
    'Download HTML is enabled before its contrast is evaluated');
  const tocCheckbox = modal.getByRole('checkbox', { name: 'Include table of contents' });
  const currentTocState = await tocCheckbox.isChecked();
  if (currentTocState !== tableOfContents) {
    await page.evaluate(() => {
      const button = document.querySelector('.modal .modal__button-bar .button--resolve');
      window.__htmlExportDisabledTransitions = [];
      window.__htmlExportDisabledObserver?.disconnect();
      window.__htmlExportDisabledObserver = new MutationObserver((mutations) => {
        window.__htmlExportDisabledTransitions.push(
          ...mutations.map(mutation => mutation.oldValue === null),
        );
      });
      window.__htmlExportDisabledObserver.observe(button, {
        attributes: true,
        attributeFilter: ['disabled'],
        attributeOldValue: true,
      });
    });
    if (tableOfContents) {
      await tocCheckbox.check();
    } else {
      await tocCheckbox.uncheck();
    }
    try {
      await page.waitForFunction(() => {
        const states = window.__htmlExportDisabledTransitions || [];
        const disabledIndex = states.indexOf(true);
        return disabledIndex !== -1 && states.indexOf(false, disabledIndex + 1) !== -1;
      });
    } finally {
      await page.evaluate(() => window.__htmlExportDisabledObserver?.disconnect());
    }
  }
  await page.waitForFunction(() => {
    const button = document.querySelector('.modal .modal__button-bar .button--resolve');
    return Boolean(button && !button.disabled);
  });
  assert.equal(await exportButton.isDisabled(), false,
    'Download HTML is enabled after export preparation');
  await assertEnabledButtonContrast(exportButton, 'Default Download HTML');
  await exportButton.hover();
  await assertEnabledButtonContrast(exportButton, 'Hovered Download HTML');
  const cancelButton = modal.getByRole('button', { name: 'Cancel', exact: true });
  await cancelButton.focus();
  await page.waitForFunction(() => (
    document.activeElement === document.querySelector('.modal__button-bar .button:not(.button--resolve):not(.button--copy)')
  ));
  for (let tab = 0; tab < 8; tab += 1) {
    if (await exportButton.evaluate(element => document.activeElement === element)) {
      break;
    }
    await page.keyboard.press('Tab');
  }
  assert.equal(await exportButton.evaluate(element => document.activeElement === element), true,
    'Tab navigation can reach the enabled Download HTML action');
  const focusStyle = await assertEnabledButtonContrast(exportButton, 'Focused Download HTML');
  assert.notEqual(focusStyle.outlineStyle, 'none', 'Download HTML has a visible focus outline');
  assert.ok(parseFloat(focusStyle.outlineWidth) >= 2);

  const originalViewport = page.viewportSize();
  const originalAppClasses = await page.locator('.app').getAttribute('class');
  for (const theme of ['light', 'dark']) {
    await page.locator('.app').evaluate((element, selectedTheme) => {
      element.classList.remove('app--light', 'app--dark');
      element.classList.add(`app--${selectedTheme}`);
    }, theme);
    for (const viewport of [
      { width: 1728, height: 905 },
      { width: 390, height: 480 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForFunction(({ width, height }) => (
        window.innerWidth === width && window.innerHeight === height
      ), viewport);
      const layout = await modal.evaluate((element) => {
        const box = element.querySelector('.modal__inner-2').getBoundingClientRect();
        const buttons = [...element.querySelectorAll('.modal__button-bar > .button')].map(button => ({
          text: button.textContent.trim(),
          rect: button.getBoundingClientRect().toJSON(),
          clientWidth: button.clientWidth,
          scrollWidth: button.scrollWidth,
        }));
        return {
          box: box.toJSON(),
          width: window.innerWidth,
          height: window.innerHeight,
          documentWidth: document.documentElement.scrollWidth,
          buttons,
        };
      });
      assert.ok(layout.box.left >= 0 && layout.box.right <= layout.width
        && layout.box.top >= 0 && layout.box.bottom <= layout.height,
      `HTML export dialog fits ${theme} ${viewport.width}x${viewport.height}`);
      assert.ok(layout.documentWidth <= layout.width,
        `HTML export causes no horizontal overflow at ${viewport.width}x${viewport.height}`);
      for (const button of layout.buttons) {
        assert.ok(button.scrollWidth <= button.clientWidth + 1,
          `${button.text} is not clipped at ${viewport.width}x${viewport.height}`);
        assert.ok(button.rect.left >= layout.box.left && button.rect.right <= layout.box.right,
          `${button.text} remains inside the dialog at ${viewport.width}x${viewport.height}`);
      }
      const defaultContrast = await assertEnabledButtonContrast(exportButton,
        `${theme} ${viewport.width}x${viewport.height} Download HTML`);
      assert.ok(defaultContrast.text >= 4.5);
      await exportButton.hover();
      const hoverContrast = await assertEnabledButtonContrast(exportButton,
        `${theme} ${viewport.width}x${viewport.height} hovered Download HTML`);
      assert.ok(hoverContrast.text >= 4.5);
      await exportButton.focus();
      const focusedContrast = await assertEnabledButtonContrast(exportButton,
        `${theme} ${viewport.width}x${viewport.height} focused Download HTML`);
      assert.ok(focusedContrast.text >= 4.5);
      assert.notEqual(focusedContrast.outlineStyle, 'none');
      assert.ok(parseFloat(focusedContrast.outlineWidth) >= 2);
      await assertFocusIndicatorContrast(exportButton,
        `${theme} ${viewport.width}x${viewport.height} Download HTML`, '.modal__inner-2');
    }
  }
  await page.locator('.app').evaluate((element, originalClasses) => {
    element.className = originalClasses;
  }, originalAppClasses);
  await page.setViewportSize(originalViewport);

  assert.equal(await modal.locator('select').count(), 0, 'HTML export has no template selector');
  assert.equal(await modal.getByText('Configure templates', { exact: false }).count(), 0);
  if (copy) {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await modal.getByRole('button', { name: 'Copy', exact: true }).click();
    const copiedHtml = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(copiedHtml, /<!DOCTYPE html>/i);
  }
  await exportButton.click();
  const download = await downloadPromise;
  const filePath = await download.path();
  assert.ok(filePath, `Download ${download.suggestedFilename()} should be available`);
  await page.locator('.modal').waitFor({ state: 'hidden' });
  return {
    filename: download.suggestedFilename(),
    path: filePath,
    text: await fs.readFile(filePath, 'utf8'),
  };
}

async function assertHtmlExportFailure(page) {
  await page.evaluate(() => {
    window.__htmlExportOriginalFetch = window.fetch;
    window.fetch = function fetchWithStylesheetFailure(input, ...args) {
      const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
      if (url.pathname.endsWith('.css')) {
        return Promise.resolve(new Response('', { status: 503, statusText: 'Unavailable' }));
      }
      return window.__htmlExportOriginalFetch.call(this, input, ...args);
    };
  });

  try {
    await openMenu(page, 'Import/export');
    await page.locator('.side-bar__panel--menu .menu-entry')
      .filter({ hasText: 'Export as HTML' })
      .click();
    const modal = page.locator('.modal');
    await modal.locator('.modal__error[role="alert"]')
      .filter({ hasText: 'HTML export could not be prepared' })
      .waitFor({ state: 'visible' });
    const downloadButton = modal.getByRole('button', { name: 'Download HTML', exact: true });
    const copyButton = modal.getByRole('button', { name: 'Copy', exact: true });
    assert.equal(await downloadButton.isDisabled(), true,
      'A preparation error keeps Download HTML disabled');
    assert.equal(await copyButton.isDisabled(), true,
      'A preparation error keeps Copy disabled');

    let downloadStarted = false;
    const recordDownload = () => {
      downloadStarted = true;
    };
    page.on('download', recordDownload);
    try {
      await downloadButton.evaluate(button => button.click());
      await page.waitForTimeout(100);
    } finally {
      page.off('download', recordDownload);
    }
    assert.equal(downloadStarted, false,
      'An unavailable HTML export cannot start a download');
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
  } finally {
    await page.evaluate(() => {
      if (window.__htmlExportOriginalFetch) {
        window.fetch = window.__htmlExportOriginalFetch;
        delete window.__htmlExportOriginalFetch;
      }
    });
  }
}

async function assertOfflineHtmlRenders(browser, filePath, expectedHeading) {
  const offlineContext = await browser.newContext({ offline: true });
  const exportedPage = await offlineContext.newPage();
  const htmlPath = `${filePath}.html`;
  await fs.copyFile(filePath, htmlPath);
  try {
    const externalRequests = [];
    exportedPage.on('request', request => {
      if (/^https?:/i.test(request.url())) {
        externalRequests.push(request.url());
      }
    });
    await exportedPage.goto(pathToFileURL(htmlPath).href, { waitUntil: 'domcontentloaded' });
    await exportedPage.locator('.stackedit__html').waitFor({ state: 'attached' });
    const exportedBody = await exportedPage.locator('body').innerHTML();
    assert.equal(
      await exportedPage.locator('.stackedit__html').count(),
      1,
      `Offline HTML should retain its document wrapper: ${exportedBody.slice(0, 500)}`,
    );
    const exportedStyle = await exportedPage.locator('.stackedit__html').evaluate(element => ({
      headings: [...element.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(heading => heading.textContent),
      headingHeight: element.querySelector('h1,h2,h3,h4,h5,h6')?.getBoundingClientRect().height || 0,
      maxWidth: getComputedStyle(element).maxWidth,
      stylesheetRules: [...document.styleSheets].reduce((count, sheet) => {
        try {
          return count + sheet.cssRules.length;
        } catch (error) {
          return count;
        }
      }, 0),
    }));
    assert.ok(exportedStyle.headings.includes(expectedHeading), 'Downloaded document renders its Markdown headings');
    assert.ok(exportedStyle.headingHeight > 0, 'Downloaded heading is visible with its embedded styles');
    assert.equal(exportedStyle.maxWidth, '750px');
    assert.ok(exportedStyle.stylesheetRules > 0, 'Exported document includes its own stylesheet');
    assert.deepEqual(externalRequests, [], 'Offline export does not request app or third-party assets');
    await exportedPage.emulateMedia({ media: 'print' });
    const printLayout = await exportedPage.locator('.stackedit__right').evaluate(element => ({
      display: getComputedStyle(element).display,
      headingHeight: element.querySelector('h1,h2,h3,h4,h5,h6')?.getBoundingClientRect().height || 0,
    }));
    assert.equal(printLayout.display, 'block');
    assert.ok(printLayout.headingHeight > 0, 'Standalone print styles keep document content visible');
  } finally {
    await offlineContext.close();
    await fs.rm(htmlPath, { force: true });
  }
}

async function assertFindReplaceWorks(page) {
  await ensureExplorerVisible(page);
  await createExplorerItem(page, 'find-replace-regression.md');
  const editor = page.locator('.editor__inner');
  const originalText = 'Find replace regression: needle and needle.';
  await editor.fill(originalText);
  await page.waitForFunction(expected => (
    document.querySelector('.preview')?.innerText.includes(expected)
  ), originalText, { timeout: 10_000 });
  await editor.click();
  const shortcutModifier = await page.evaluate(() => (
    /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'Meta' : 'Control'
  ));
  await page.keyboard.press(`${shortcutModifier}+f`);

  const findReplace = page.locator('.find-replace');
  await findReplace.waitFor({ state: 'visible' });
  await findReplace.locator('.find-replace__text-input--find').fill('NEEDLE');
  await page.waitForFunction(() => (
    document.querySelector('.find-replace__find-stats')?.textContent.includes('of 2')
  ));
  await findReplace.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForFunction(() => (
    document.querySelector('.find-replace__find-stats')?.textContent.trim() === '1 of 2'
  ));
  assert.equal(
    await findReplace.locator('.find-replace__find-stats').textContent(),
    '1 of 2',
    'Current-document find selects the first case-insensitive match',
  );
  await findReplace.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForFunction(() => (
    document.querySelector('.find-replace__find-stats')?.textContent.trim() === '2 of 2'
  ));

  await page.keyboard.press(`${shortcutModifier}+Alt+f`);
  await findReplace.locator('.find-replace__text-input--replace').waitFor({ state: 'visible' });
  await findReplace.locator('.find-replace__text-input--replace').fill('REPLACED');
  await findReplace.getByRole('button', { name: 'All', exact: true }).click();
  await page.waitForFunction(() => {
    const text = document.querySelector('.editor__inner')?.textContent || '';
    return text.includes('REPLACED and REPLACED') && !text.includes('needle');
  }, undefined, { timeout: 10_000 });
  assert.equal(
    await page.locator('.editor__inner').textContent(),
    'Find replace regression: REPLACED and REPLACED.\n',
  );
  await page.keyboard.press('Escape');
  await findReplace.waitFor({ state: 'hidden' });
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
  await assert.rejects(fs.access(path.join(distDirectory, 'static/oauth2/callback.html')),
    { code: 'ENOENT' }, 'The production artifact must not contain an OAuth callback');
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
    const landingPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await landingPage.goto(`http://127.0.0.1:${port}/`);
    await landingPage.locator('.splash-screen__footer a').click();
    await landingPage.waitForFunction(() => {
      const anchor = document.querySelector('#anchor');
      if (window.location.hash !== '#anchor' || !anchor) {
        return false;
      }
      const { top, bottom } = anchor.getBoundingClientRect();
      return top >= -1 && bottom <= window.innerHeight;
    });
    assert.ok(
      await landingPage.evaluate(() => window.scrollY > 0),
      'Read more should scroll to its section',
    );
    await landingPage.close();

    const formattingContext = await browser.newContext();
    try {
      const formattingPage = await formattingContext.newPage();
      await formattingPage.goto(appUrl);
      await formattingPage.locator('.editor__inner').waitFor({
        state: 'visible',
        timeout: 20_000,
      });
      await dismissPrompts(formattingPage);
      const editorField = formattingPage.locator('.editor__inner');
      await editorField.fill('FORMAT_AND_UNDO_MARKER');
      await formattingPage.waitForTimeout(1_200);
      await editorField.selectText();
      assert.equal(
        await formattingPage.evaluate(() => window.getSelection()?.toString()),
        'FORMAT_AND_UNDO_MARKER',
        'The formatting smoke selects the complete marker',
      );
      await formattingPage.locator('button[title^="Bold"]').click();
      await formattingPage.waitForFunction(() => (
        document.querySelector('.editor__inner')?.textContent.replace(/\n$/, '')
          === '**FORMAT_AND_UNDO_MARKER**'
      ), undefined, { timeout: 10_000 });
      const undoButton = formattingPage.locator('button[title^="Undo"]');
      await undoButton.waitFor({ state: 'visible' });
      await undoButton.click();
      await formattingPage.waitForFunction(() => (
        document.querySelector('.editor__inner')?.textContent.replace(/\n$/, '')
          === 'FORMAT_AND_UNDO_MARKER'
      ), undefined, { timeout: 10_000 });
      await formattingPage.locator('button[title^="Redo"]').click();
      await formattingPage.waitForFunction(() => (
        document.querySelector('.editor__inner')?.textContent.replace(/\n$/, '')
          === '**FORMAT_AND_UNDO_MARKER**'
      ), undefined, { timeout: 10_000 });
    } finally {
      await formattingContext.close();
    }

    const saveContext = await browser.newContext();
    try {
      const savePage = await saveContext.newPage();
      await savePage.addInitScript(() => {
        const originalSetInterval = window.setInterval;
        window.__holdAutosave = false;
        window.setInterval = (callback, interval, ...args) => {
          if (interval >= 1000 && interval < 1200) {
            window.__runAutosave = callback;
            return originalSetInterval(() => {
              if (!window.__holdAutosave) callback(...args);
            }, interval);
          }
          return originalSetInterval(callback, interval, ...args);
        };
        const originalPut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function put(...args) {
          const request = originalPut.apply(this, args);
          if (window.__abortSave && args[0].type === 'content') this.transaction.abort();
          return request;
        };
      });
      await savePage.goto(appUrl);
      await savePage.locator('.editor__inner').waitFor({ state: 'visible', timeout: 20_000 });
      await savePage.waitForFunction(() => (
        document.querySelector('[data-local-save-status]')?.dataset.localSaveStatus === 'saved'
      ));
      await savePage.evaluate(async () => {
        window.__holdAutosave = true;
        await window.__runAutosave();
      });
      const originalSavedText = await savePage.locator('.editor__inner').textContent();
      await savePage.locator('.editor__inner').fill('# UNSAVED_PUBLIC_EDIT_MARKER');
      await savePage.waitForFunction(() => (
        document.querySelector('[data-local-save-status]')?.dataset.localSaveStatus === 'saving'
      ));
      const readSavedText = () => savePage.evaluate(async () => {
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open('stackedit-db');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const items = await new Promise((resolve, reject) => {
          const request = db.transaction('objects', 'readonly').objectStore('objects').getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        db.close();
        return items.find(item => item.type === 'content')?.text;
      });
      assert.equal(await readSavedText(), originalSavedText,
        'Saving status is visible while the ordinary edit is still absent from IndexedDB');
      await savePage.evaluate(async () => {
        window.__abortSave = true;
        await window.__runAutosave();
      });
      await savePage.waitForFunction(() => (
        document.querySelector('[data-local-save-status]')?.dataset.localSaveStatus === 'error'
      ));
      assert.match(await savePage.locator('.editor__inner').textContent(), /UNSAVED_PUBLIC_EDIT_MARKER/);
      assert.equal(await readSavedText(), originalSavedText,
        'An aborted save preserves the previous database content and the in-memory edit');
      await savePage.evaluate(async () => {
        window.__abortSave = false;
        window.__holdAutosave = false;
        await new Promise(resolve => setTimeout(resolve, 250));
        await window.__runAutosave();
      });
      try {
        await savePage.waitForFunction(() => (
          document.querySelector('[data-local-save-status]')?.dataset.localSaveStatus === 'saved'
        ), undefined, { timeout: 15_000 });
      } catch (error) {
        const saveState = await savePage.evaluate(() => {
          const store = document.querySelector('#app').__vue_app__._context.provides.store;
          return {
            status: store.state.localSaveStatus,
            error: store.state.localSaveError,
            autosaveHeld: window.__holdAutosave,
            abortEnabled: window.__abortSave,
          };
        });
        throw new Error(`Scheduled autosave retry did not settle: ${JSON.stringify(saveState)}; ${error.message}`);
      }
      assert.match(await readSavedText(), /UNSAVED_PUBLIC_EDIT_MARKER/);
    } finally {
      await saveContext.close();
    }

    for (const { workspaceId, workspace, tokens, retainTrash } of [
      { workspaceId: 'main', workspace: { name: 'Main workspace' },
        tokens: { google: { oldUser: { isLogin: true } } }, retainTrash: true },
      { workspaceId: 'aged-github', workspace: {
        name: 'Aged local archive', providerId: 'githubWorkspace', sub: 'oldUser',
      }, tokens: { github: { oldUser: { accessToken: 'inert-legacy-token' } } }, retainTrash: true },
      { workspaceId: 'aged-github-unmatched', workspace: {
        name: 'Unmatched local archive', providerId: 'githubWorkspace', sub: 'oldUser',
      }, tokens: { github: { otherUser: {} } }, retainTrash: false },
    ]) {
      const retentionContext = await browser.newContext();
      try {
        const retentionPage = await retentionContext.newPage();
        const retentionRequests = [];
        retentionPage.on('request', request => retentionRequests.push(request.url()));
        await retentionPage.goto(appUrl);
        await retentionPage.locator('.editor__inner').waitFor({ state: 'visible', timeout: 20_000 });
        await addLocalWorkspaceDescriptor(retentionPage, workspaceId, workspace);
        await seedWorkspaceDatabase(retentionPage, workspaceId, [
          { id: 'aged-trash-file', type: 'file', name: 'Recoverable.md',
            parentId: 'trash', hash: 51, tx: 1000 },
          { id: 'aged-trash-file/content', type: 'content', text: 'OLD_TRASH_CONTENT',
            properties: '\n', discussions: {}, comments: {}, history: [], hash: 52, tx: 1001 },
        ]);
        await retentionPage.evaluate(({ id, legacyTokens }) => {
          localStorage.setItem(`${id}/lastWindowFocus`, Date.now() - 8 * 24 * 60 * 60 * 1000);
          localStorage.setItem('data/tokens', JSON.stringify({
            id: 'tokens', data: legacyTokens, hash: 53,
          }));
        }, { id: workspaceId, legacyTokens: tokens });
        await retentionPage.goto(`${appUrl}?smoke=trash-retention#workspaceId=${workspaceId}`);
        await retentionPage.locator('.editor__inner').waitFor({ state: 'visible', timeout: 20_000 });
        await retentionPage.waitForFunction(() => (
          document.querySelector('[data-local-save-status]')?.dataset.localSaveStatus === 'saved'
        ));
        const retained = await retentionPage.evaluate(async (id) => {
          const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(id === 'main' ? 'stackedit-db' : `stackedit-db-${id}`);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          const file = await new Promise((resolve, reject) => {
            const request = db.transaction('objects', 'readonly').objectStore('objects').get('aged-trash-file');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          db.close();
          return { file, tokens: JSON.parse(localStorage.getItem('data/tokens')).data };
        }, workspaceId);
        assert.equal(!!retained.file?.hash, retainTrash,
          'Old Trash eligibility uses only the former workspace credential presence');
        if (retainTrash) assert.equal(retained.file.parentId, 'trash');
        assert.deepEqual(retained.tokens, tokens, 'Legacy credential records remain untouched');
        assert.deepEqual(retentionRequests.filter(url => new URL(url).origin !== new URL(appUrl).origin), [],
          'Preserving old Trash eligibility does not reconnect a former provider');
      } finally {
        await retentionContext.close();
      }
    }

    const legacyWorkspaceContext = await browser.newContext();
    const legacyWorkspacePage = await legacyWorkspaceContext.newPage();
    const legacyWorkspaceRequests = [];
    legacyWorkspacePage.on('request', request => legacyWorkspaceRequests.push(request.url()));
    await legacyWorkspacePage.addInitScript(() => {
      if (!localStorage.getItem('data/workspaces')) {
        localStorage.setItem('data/workspaces', JSON.stringify({
          id: 'workspaces',
          data: {
            main: { id: 'main', name: 'Main workspace' },
            'legacy-github-workspace': {
              id: 'legacy-github-workspace',
              name: 'Old GitHub workspace',
              providerId: 'githubWorkspace',
              owner: 'writer',
              repo: 'legacy-notebook',
            },
          },
          hash: 1,
        }));
      }
    });
    await legacyWorkspacePage.goto(`${appUrl}#workspaceId=legacy-github-workspace`);
    const unavailableMessage = legacyWorkspacePage.getByRole('alert');
    await unavailableMessage.waitFor({ state: 'visible', timeout: 20_000 });
    assert.match(await unavailableMessage.textContent(), /not available in this browser/i);
    assert.equal(await legacyWorkspacePage.evaluate(async () => (
      (await indexedDB.databases()).some(database => (
        database.name === 'stackedit-db-legacy-github-workspace'
      ))
    )), false, 'A missing provider-associated workspace does not create a replacement database');
    const localProviderWorkspaceId = 'legacy-local-copy';
    await legacyWorkspacePage.evaluate((id) => {
      const storedWorkspaces = JSON.parse(localStorage.getItem('data/workspaces'));
      localStorage.setItem('data/workspaces', JSON.stringify({
        ...storedWorkspaces,
        data: {
          ...storedWorkspaces.data,
          [id]: {
            id,
            name: 'Old GitHub workspace with a local copy',
            providerId: 'githubWorkspace',
            owner: 'writer',
            repo: 'archived-notebook',
          },
        },
        hash: (storedWorkspaces.hash || 0) + 1,
      }));
    }, localProviderWorkspaceId);
    await seedWorkspaceDatabase(legacyWorkspacePage, localProviderWorkspaceId, [
      {
        id: 'legacy-folder-01',
        type: 'folder',
        name: 'Legacy Folder',
        parentId: null,
        hash: 11,
        tx: 1,
      },
      {
        id: 'legacy-file-01',
        type: 'file',
        name: 'legacy-note.md',
        parentId: 'legacy-folder-01',
        hash: 12,
        tx: 2,
      },
      {
        id: 'legacy-file-01/content',
        type: 'content',
        text: '# Local legacy note\n\nPROVIDER_LOCAL_COPY_MARKER',
        properties: 'title: Local legacy note\n',
        discussions: { archivedThread: { start: 0, end: 6 } },
        comments: { archivedComment: { text: 'Preserved annotation.' } },
        history: [],
        hash: 13,
        tx: 3,
      },
      {
        id: 'lastOpened',
        type: 'data',
        data: { 'legacy-file-01': Date.now() },
        hash: 14,
        tx: 4,
      },
    ]);
    await legacyWorkspacePage.goto(
      `${appUrl}?smoke=legacy-local-copy#workspaceId=${localProviderWorkspaceId}`,
    );
    await legacyWorkspacePage.waitForSelector('.editor__inner', {
      state: 'visible',
      timeout: 20_000,
    });
    await legacyWorkspacePage.waitForFunction(
      () => document.querySelector('.editor__inner')?.textContent.includes('PROVIDER_LOCAL_COPY_MARKER'),
      undefined,
      { timeout: 10_000 },
    );
    assert.equal(
      await legacyWorkspacePage.locator('.navigation-bar__title--input').inputValue(),
      'legacy-note.md',
    );
    await ensureExplorerVisible(legacyWorkspacePage);
    assert.equal(await legacyWorkspacePage.locator('.explorer-node__item')
      .filter({ hasText: 'Legacy Folder' }).count(), 1);
    assert.equal(await legacyWorkspacePage.locator('.explorer-node__item')
      .filter({ hasText: 'legacy-note.md' }).count(), 1);
    const retainedLocalCopy = await legacyWorkspacePage.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('stackedit-db-legacy-local-copy');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const items = await new Promise((resolve, reject) => {
        const request = db.transaction('objects', 'readonly').objectStore('objects').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return Object.fromEntries(items.map(item => [item.id, item]));
    });
    assert.equal(retainedLocalCopy['legacy-file-01'].parentId, 'legacy-folder-01');
    assert.equal(retainedLocalCopy['legacy-file-01/content'].discussions.archivedThread.end, 6);
    assert.equal(
      retainedLocalCopy['legacy-file-01/content'].comments.archivedComment.text,
      'Preserved annotation.',
    );
    assert.deepEqual(
      legacyWorkspaceRequests.filter(url => new URL(url).origin !== new URL(appUrl).origin),
      [],
      'Legacy workspace links never reconnect to their former provider',
    );
    await openMenu(legacyWorkspacePage, 'Workspaces');
    await legacyWorkspacePage.locator('.side-bar__panel--menu .menu-entry')
      .filter({ hasText: 'Manage workspaces' }).click();
    const workspaceManager = legacyWorkspacePage.getByRole('dialog', {
      name: 'Manage workspaces',
    });
    const providerWorkspaceEntry = workspaceManager.locator('.workspace-entry')
      .filter({ hasText: 'Old GitHub workspace with a local copy' });
    await providerWorkspaceEntry.locator('button[title="Edit name"]').click();
    const workspaceNameInput = workspaceManager.locator('input.text-input');
    await workspaceNameInput.fill('Renamed local archive');
    await workspaceNameInput.press('Enter');
    await legacyWorkspacePage.waitForFunction(id => (
      JSON.parse(localStorage.getItem('data/workspaces')).data[id]?.name === 'Renamed local archive'
    ), localProviderWorkspaceId);
    await legacyWorkspacePage.goto(`${appUrl}#workspaceId=main`);
    await legacyWorkspacePage.waitForSelector('.editor__inner', {
      state: 'visible',
      timeout: 20_000,
    });
    await openMenu(legacyWorkspacePage, 'Workspaces');
    await legacyWorkspacePage.locator('.side-bar__panel--menu .menu-entry')
      .filter({ hasText: 'Manage workspaces' }).click();
    const inactiveWorkspaceEntry = legacyWorkspacePage.getByRole('dialog', {
      name: 'Manage workspaces',
    }).locator('.workspace-entry').filter({ hasText: 'Renamed local archive' });
    await inactiveWorkspaceEntry.locator('button[title="Remove"]').click();
    await legacyWorkspacePage.getByRole('button', { name: 'Yes, remove', exact: true }).click();
    await legacyWorkspacePage.waitForFunction(id => (
      !JSON.parse(localStorage.getItem('data/workspaces')).data[id]
    ), localProviderWorkspaceId);
    assert.equal(await legacyWorkspacePage.evaluate(async () => (
      (await indexedDB.databases()).some(database => (
        database.name === 'stackedit-db-legacy-local-copy'
      ))
    )), false, 'Removing a local workspace drops its local database');
    await legacyWorkspaceContext.close();

    const legacyMainContext = await browser.newContext({ acceptDownloads: true });
    const legacyMainPage = await legacyMainContext.newPage();
    const legacyMainRequests = [];
    legacyMainPage.on('request', request => legacyMainRequests.push(request.url()));
    await legacyMainPage.goto(appUrl);
    await legacyMainPage.waitForSelector('.editor__inner', {
      state: 'visible',
      timeout: 20_000,
    });
    await seedWorkspaceDatabase(legacyMainPage, 'main', [
      {
        id: 'main-legacy-folder',
        type: 'folder',
        name: 'Main Archive',
        parentId: null,
        hash: 31,
        tx: 1,
      },
      {
        id: 'main-legacy-file',
        type: 'file',
        name: 'main-legacy-note.md',
        parentId: 'main-legacy-folder',
        hash: 32,
        tx: 2,
      },
      {
        id: 'main-legacy-file/content',
        type: 'content',
        text: '# Existing Main note\n\nMAIN_LEGACY_CONTENT_MARKER',
        properties: 'title: Existing Main note\n',
        discussions: { mainThread: { start: 0, end: 19 } },
        comments: { mainComment: { text: 'Main annotation survives.' } },
        history: [{ text: 'Older Main content' }],
        hash: 33,
        tx: 3,
      },
      {
        id: 'lastOpened',
        type: 'data',
        data: { 'main-legacy-file': Date.now() },
        hash: 34,
        tx: 4,
      },
    ]);
    await seedLegacyWorkspaceRecords(legacyMainPage);
    await legacyMainPage.reload();
    await legacyMainPage.waitForSelector('.editor__inner', {
      state: 'visible',
      timeout: 20_000,
    });
    await ensureExplorerVisible(legacyMainPage);
    const mainArchiveRow = legacyMainPage.locator('.explorer-node__item')
      .filter({ hasText: 'Main Archive' });
    await mainArchiveRow.waitFor({ state: 'visible' });
    await mainArchiveRow.click();
    const mainLegacyNoteRow = legacyMainPage.locator('.explorer-node__item')
      .filter({ hasText: 'main-legacy-note.md' });
    await mainLegacyNoteRow.waitFor({ state: 'visible' });
    await legacyMainPage.evaluate(() => {
      [...document.querySelectorAll('.explorer-node__item')]
        .find(item => item.textContent.trim() === 'main-legacy-note.md')
        ?.click();
    });
    await legacyMainPage.waitForFunction(
      () => document.querySelector('.editor__inner')?.textContent.includes('MAIN_LEGACY_CONTENT_MARKER'),
      undefined,
      { timeout: 15_000 },
    );
    assert.equal(
      await legacyMainPage.locator('.navigation-bar__title--input').inputValue(),
      'main-legacy-note.md',
    );
    await ensureExplorerVisible(legacyMainPage);
    await mainArchiveRow.waitFor({ state: 'visible' });
    await mainLegacyNoteRow.waitFor({ state: 'visible' });
    assert.equal(await mainArchiveRow.count(), 1);
    assert.equal(await mainLegacyNoteRow.count(), 1);
    const legacyMainItems = await legacyMainPage.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('stackedit-db');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const items = await new Promise((resolve, reject) => {
        const request = db.transaction('objects', 'readonly').objectStore('objects').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return Object.fromEntries(items.map(item => [item.id, item]));
    });
    assert.equal(legacyMainItems['main-legacy-file'].parentId, 'main-legacy-folder');
    assert.equal(legacyMainItems['main-legacy-file/content'].discussions.mainThread.end, 19);
    assert.equal(
      legacyMainItems['main-legacy-file/content'].comments.mainComment.text,
      'Main annotation survives.',
    );
    await openMenu(legacyMainPage, 'Workspace backups');
    const legacyMainBackup = await downloadText(legacyMainPage, () => legacyMainPage.locator(
      '.side-bar__panel--menu .menu-entry',
    ).filter({ hasText: 'Export workspace backup' }).click());
    const legacyMainPayload = JSON.parse(legacyMainBackup.text.replace(/^\uFEFF/, ''));
    assert.equal(legacyMainPayload['legacy-sync-location']?.providerId, 'googleDrive');
    assert.equal(legacyMainPayload['legacy-publish-location']?.providerId, 'github');
    assert.equal(legacyMainPayload['main-legacy-file/content'].comments.mainComment.text,
      'Main annotation survives.');
    assert.equal(
      legacyMainRequests.filter(url => new URL(url).origin !== new URL(appUrl).origin).length,
      0,
      'Upgrading an existing Main database does not contact an external service',
    );
    await legacyMainContext.close();

    const legacyParametersContext = await browser.newContext();
    const legacyParametersPage = await legacyParametersContext.newPage();
    const legacyParameterRequests = [];
    legacyParametersPage.on('request', request => legacyParameterRequests.push(request.url()));
    await legacyParametersPage.goto(
      `${appUrl}#providerId=googleDriveAppData&paymentSuccess=true&success=true`,
    );
    await legacyParametersPage.waitForSelector('.editor__inner', {
      state: 'visible',
      timeout: 20_000,
    });
    assert.equal(await legacyParametersPage.locator('.modal').count(), 0,
      'Legacy payment and provider parameters do not open account or sponsorship flows');
    assert.deepEqual(
      legacyParameterRequests.filter(url => new URL(url).origin !== new URL(appUrl).origin),
      [],
      'Legacy provider parameters do not trigger network requests',
    );
    await legacyParametersContext.close();

    const crossTabContext = await browser.newContext();
    const firstTab = await crossTabContext.newPage();
    const secondTab = await crossTabContext.newPage();
    const secondTabRequests = [];
    secondTab.on('request', request => secondTabRequests.push(request.url()));
    await firstTab.goto(appUrl);
    await firstTab.waitForSelector('.editor__inner', { state: 'visible', timeout: 20_000 });
    await secondTab.goto(appUrl);
    await secondTab.waitForSelector('.editor__inner', { state: 'visible', timeout: 20_000 });
    const twoTabEdit = `${await firstTab.locator('.editor__inner').textContent()}\n\nTWO_TAB_WRITE_MARKER`;
    await firstTab.locator('.editor__inner').fill(twoTabEdit);
    await firstTab.waitForFunction(
      () => document.querySelector('[data-local-save-status]')?.dataset.localSaveStatus === 'saved',
      undefined,
      { timeout: 10_000 },
    );
    await waitForStoredDocument(firstTab, 'TWO_TAB_WRITE_MARKER');
    await secondTab.reload();
    await secondTab.waitForSelector('.editor__inner', { state: 'visible', timeout: 20_000 });
    await secondTab.waitForFunction(
      () => document.querySelector('.editor__inner')?.textContent.includes('TWO_TAB_WRITE_MARKER'),
      undefined,
      { timeout: 10_000 },
    );

    const isolatedWorkspaceId = 'isolated-local-workspace';
    await addLocalWorkspaceDescriptor(firstTab, isolatedWorkspaceId, {
      name: 'Isolated local workspace',
      providerId: 'githubWorkspace',
      owner: 'writer',
      repo: 'separate-local-copy',
    });
    await seedWorkspaceDatabase(firstTab, isolatedWorkspaceId, [
      {
        id: 'isolated-folder-01',
        type: 'folder',
        name: 'Separate collection',
        parentId: null,
        hash: 21,
        tx: 1,
      },
      {
        id: 'isolated-file-01',
        type: 'file',
        name: 'isolated.md',
        parentId: 'isolated-folder-01',
        hash: 22,
        tx: 2,
      },
      {
        id: 'isolated-file-01/content',
        type: 'content',
        text: '# Separate workspace\n\nISOLATED_WORKSPACE_MARKER',
        properties: '\n',
        discussions: {},
        comments: {},
        history: [],
        hash: 23,
        tx: 3,
      },
      {
        id: 'lastOpened',
        type: 'data',
        data: { 'isolated-file-01': Date.now() },
        hash: 24,
        tx: 4,
      },
    ]);
    await secondTab.goto(
      `${appUrl}?smoke=workspace-isolation#workspaceId=${isolatedWorkspaceId}`,
    );
    await secondTab.waitForSelector('.editor__inner', { state: 'visible', timeout: 20_000 });
    await secondTab.waitForFunction(
      () => document.querySelector('.editor__inner')?.textContent.includes('ISOLATED_WORKSPACE_MARKER'),
      undefined,
      { timeout: 10_000 },
    );
    assert.equal(await secondTab.locator('.editor__inner').textContent()
      .then(text => text.includes('TWO_TAB_WRITE_MARKER')), false,
    'A different local workspace does not expose Main workspace content');
    assert.equal(await firstTab.locator('.editor__inner').textContent()
      .then(text => text.includes('TWO_TAB_WRITE_MARKER')), true,
    'Switching another tab does not change the initiating workspace');
    assert.deepEqual(
      secondTabRequests.filter(url => new URL(url).origin !== new URL(appUrl).origin),
      [],
      'Opening a provider-associated local workspace does not reconnect to its provider',
    );
    await crossTabContext.close();

    const context = await browser.newContext({
      acceptDownloads: true,
      timezoneId: 'America/Vancouver',
    });
    const page = await context.newPage();
    const browserErrors = [];
    const networkRequests = [];
    page.on('console', message => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    page.on('pageerror', error => browserErrors.push(error.message));
    page.on('request', request => networkRequests.push({
      url: request.url(),
      postData: request.postData() || '',
    }));

    const legacyTokens = {
      google: {
        'old-account': {
          accessToken: 'legacy-access-token-must-remain-private',
          refreshToken: 'legacy-refresh-token-must-remain-private',
        },
      },
    };
    await page.addInitScript((tokens) => {
      window.__stackeditLegacyHelperExecuted = false;
      localStorage.setItem('data/tokens', JSON.stringify({
        id: 'tokens',
        data: tokens,
        hash: 1,
      }));
      localStorage.setItem('data/serverConf', JSON.stringify({
        id: 'serverConf',
        data: { allowSponsorship: true, legacy: 'server configuration' },
        hash: 1,
      }));
    }, legacyTokens);

    await page.goto(appUrl);
    await page.waitForSelector('.editor__inner', { state: 'visible', timeout: 30_000 });
    await page.waitForFunction(
      () => document.querySelector('[data-local-save-status]')?.dataset.localSaveStatus === 'saved',
      undefined,
      { timeout: 10_000 },
    );
    assert.equal(await page.locator('[data-local-save-status]').textContent(), 'Saved locally');
    await dismissPrompts(page);
    await showMainMenu(page);
    await assertMenuIconGeometry(page, 'Main menu');
    for (const panelName of ['Import/export', 'Workspaces', 'Workspace backups']) {
      await openMenu(page, panelName);
      await assertMenuIconGeometry(page, panelName);
    }
    await page.locator('.side-title__button[aria-label="Main menu"]').click();
    const workspacesEntry = page.locator('.side-bar__panel--menu .menu-entry')
      .filter({ hasText: 'Workspaces' });
    await workspacesEntry.focus();
    await workspacesEntry.press('Enter');
    await page.waitForFunction(() => (
      document.querySelector('.side-title__title')?.textContent.trim() === 'Workspaces'
    ));
    await assertSettingsDialogUsability(page);
    const mainMenuEntries = await page.locator('.side-bar__panel--menu .menu-entry').allTextContents();
    assert.equal(mainMenuEntries.some(text => /synchroni[sz]e|publish|accounts?|history/i.test(text)), false,
      'Legacy credentials do not expose account, sync, publish, or remote-history controls');
    assert.equal(mainMenuEntries.some(text => /signed in|synced with|not synced/i.test(text)), false,
      'The local notebook does not display account or provider status');

    await ensureExplorerVisible(page);
    await createExplorerItem(page, 'url-image-regression.md');
    await page.waitForFunction(
      () => document.querySelector('[data-local-save-status]')?.dataset.localSaveStatus === 'saved',
      undefined,
      { timeout: 10_000 },
    );
    assert.equal(
      await page.locator('.editor__inner').getAttribute('contenteditable'),
      'true',
      'New local files remain editable after their first save',
    );
    await page.locator('button[title^="Image"]').click();
    const imageDialog = page.getByRole('dialog', { name: 'Insert image' });
    await imageDialog.waitFor({ state: 'visible' });
    assert.equal(await imageDialog.getByText(/Google Photos/).count(), 0,
      'Image insertion keeps its URL field without Google Photos controls');
    await imageDialog.locator('.textfield').fill('data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=');
    await imageDialog.getByRole('button', { name: 'Ok', exact: true }).click();
    await page.waitForFunction(() => (
      document.querySelector('.editor__inner')?.textContent.includes('data:image/gif;base64,')
    ), undefined, { timeout: 10_000 });

    const originalViewport = page.viewportSize();
    const editorWidthBeforeResize = await page.locator('.layout__panel--editor').evaluate(
      element => parseFloat(element.style.width),
    );
    await page.setViewportSize({ ...originalViewport, width: originalViewport.width + 160 });
    await page.waitForFunction(({ expectedWidth, previousEditorWidth }) => (
      document.documentElement.clientWidth === expectedWidth
      && parseFloat(document.querySelector('.layout__panel--editor')?.style.width)
        > previousEditorWidth
    ), {
      expectedWidth: originalViewport.width + 160,
      previousEditorWidth: editorWidthBeforeResize,
    }, { timeout: 10_000 });
    const editorWidthAfterResize = await page.locator('.layout__panel--editor').evaluate(
      element => parseFloat(element.style.width),
    );
    assert.ok(editorWidthAfterResize > editorWidthBeforeResize,
      'The editor layout responds to a wider browser viewport');
    await page.setViewportSize(originalViewport);

    await openMenu(page, 'Import/export');
    const importedDocumentMetadata = {
      properties: 'title: Imported Unicode note\n',
      discussions: {
        'legacy-thread': { start: 0, end: 7 },
      },
      comments: {
        'legacy-comment': {
          discussionId: 'legacy-thread',
          text: 'Résumé 📝 stays attached.',
        },
      },
      history: [{ text: 'Before import' }],
    };
    const encodedDocumentMetadata = Buffer.from(
      JSON.stringify(importedDocumentMetadata),
      'utf8',
    ).toString('base64').replace(/(.{50})/g, '$1\n');
    await page.locator('#import-markdown-file-input').setInputFiles({
      name: 'smoke-markdown.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(
        '# Imported Markdown\n\nSMOKE_MARKDOWN_MARKER\n\n'
        + 'This **Markdown** file was imported.\n\n'
        + `<!--stackedit_data:\n${encodedDocumentMetadata}\n-->`,
      ),
    });
    await page.waitForFunction(
      () => document.querySelector('.preview h1')?.textContent === 'Imported Markdown',
      undefined,
      { timeout: 20_000 },
    );
    assert.equal(await page.locator('.gutter').count(), 0, 'Annotated notes do not create discussion gutters');
    assert.equal(await page.getByTitle('Start a discussion').count(), 0);
    assert.equal(await page.locator('.comment-list, .current-discussion, .sticky-comment').count(), 0);

    const persistenceMarker = 'PERSISTENCE_MARKER';
    await page.locator('.editor__inner').fill(
      '   # Imported Markdown\n\nSMOKE_MARKDOWN_MARKER\n\n'
      + 'PERSISTENCE_MARKER\n\nEdited in the browser.',
    );
    await page.waitForFunction(
      marker => document.querySelector('.preview')?.innerText.includes(marker),
      persistenceMarker,
      { timeout: 10_000 },
    );
    const storedMarkdown = await waitForStoredDocument(page, persistenceMarker);
    assert.equal(storedMarkdown.fileName, 'smoke-markdown.md');
    await page.waitForFunction(
      () => document.querySelector('[data-local-save-status]')?.dataset.localSaveStatus === 'saved',
      undefined,
      { timeout: 10_000 },
    );
    await page.reload();
    await page.waitForSelector('.editor__inner', { state: 'visible', timeout: 20_000 });
    await dismissPrompts(page);
    await page.waitForFunction(
      marker => document.querySelector('.editor__inner')?.textContent.includes(marker),
      persistenceMarker,
      { timeout: 20_000 },
    );
    assert.match(await page.locator('.editor__inner').textContent(), /PERSISTENCE_MARKER/);
    await page.waitForFunction(
      marker => document.querySelector('.preview')?.innerText.includes(marker),
      persistenceMarker,
      { timeout: 20_000 },
    );
    assert.equal(
      await page.locator('.preview h1').textContent(),
      'Imported Markdown',
      await page.locator('.preview').innerHTML(),
    );

    await openMenu(page, 'Import/export');
    const markdownExport = await downloadText(page, () => page.locator(
      '.side-bar__panel--menu .menu-entry',
    ).filter({ hasText: 'Export as Markdown' }).click());
    assert.match(markdownExport.filename, /\.md$/);
    assert.match(markdownExport.text, /SMOKE_MARKDOWN_MARKER/);
    assert.match(markdownExport.text, /PERSISTENCE_MARKER/);
    const exportedMetadata = markdownExport.text.match(
      /<!--stackedit_data:([A-Za-z0-9+/=\s]+)-->\s*$/,
    );
    assert.ok(exportedMetadata, 'Markdown export should include StackEdit metadata');
    assert.deepEqual(
      JSON.parse(Buffer.from(exportedMetadata[1].replace(/\s/g, ''), 'base64').toString('utf8')),
      importedDocumentMetadata,
      'Import, edit, and export should retain supported properties and annotations',
    );

    await page.locator('.editor__inner').fill([
      '# Imported Markdown',
      'SMOKE_MARKDOWN_MARKER',
      'PERSISTENCE_MARKER',
      'LATEST_BACKUP_MARKER',
      'Edited in the browser immediately before the workspace search test.',
    ].join('\n\n'));
    await page.waitForFunction(
      () => document.querySelector('.preview')?.innerText.includes('LATEST_BACKUP_MARKER'),
      undefined,
      { timeout: 10_000 },
    );

    await ensureExplorerVisible(page);
    await createExplorerItem(page, 'Search Fixtures', true);
    await createExplorerItem(page, 'duplicate.md');
    const primarySearchText = [
      '# Primary search fixture',
      'PRIMARY_SEARCH_DOCUMENT',
      ...Array.from({ length: 90 }, (_, index) => `Line ${index + 1}: distant content.`),
      `LONG_LINE_PREFIX ${'long wrapped context '.repeat(28)}LONG_LINE_SEARCH_TARGET ${'trailing wrapped context '.repeat(8)} LONG_LINE_SUFFIX`,
      '🔥 SHARED_SEARCH_TOKEN appears here and again: SHARED_SEARCH_TOKEN.',
      'MixedCaseNeedle should be found regardless of capitalization.',
      'ΟΣ Greek first literal; ος Greek second literal.',
      'A literal punctuation marker [a-z].* stays literal.',
      '<script>window.__workspaceSearchExecuted = true</script>',
    ].join('\n\n');
    await page.locator('.editor__inner').fill(primarySearchText);
    await page.waitForFunction(
      () => document.querySelector('.preview')?.innerText.includes('PRIMARY_SEARCH_DOCUMENT'),
      undefined,
      { timeout: 10_000 },
    );
    const primarySearchDocumentBeforeActivation = await waitForStoredDocument(
      page,
      'PRIMARY_SEARCH_DOCUMENT',
    );
    assert.equal(primarySearchDocumentBeforeActivation.fileName, 'duplicate.md');
    assert.ok(primarySearchDocumentBeforeActivation.text.includes('SHARED_SEARCH_TOKEN'));

    await createExplorerItem(page, 'Nested Search', true);
    await createExplorerItem(page, 'duplicate.md');
    const nestedSearchText = [
      '# Nested search fixture',
      'NESTED_SEARCH_DOCUMENT',
      'SHARED_SEARCH_TOKEN appears in this second document.',
    ].join('\n\n');
    await page.locator('.editor__inner').fill(nestedSearchText);
    await page.waitForFunction(
      () => document.querySelector('.preview')?.innerText.includes('NESTED_SEARCH_DOCUMENT'),
      undefined,
      { timeout: 10_000 },
    );

    await createExplorerItem(page, 'TITLE_ONLY_SIGNAL.md');
    await page.locator('.editor__inner').fill('This document has no title signal in its content.');
    await page.waitForFunction(
      () => document.querySelector('.preview')?.innerText.includes('no title signal'),
      undefined,
      { timeout: 10_000 },
    );

    await createExplorerItem(page, 'stale-search.md');
    await page.locator('.editor__inner').fill('STALE_ONLY_SIGNAL');
    await page.waitForFunction(
      () => document.querySelector('.preview')?.innerText.includes('STALE_ONLY_SIGNAL'),
      undefined,
      { timeout: 10_000 },
    );

    await createExplorerItem(page, 'trash-backup.md');
    await page.locator('.editor__inner').fill('TRASH_BACKUP_ONLY');
    await page.waitForFunction(
      () => document.querySelector('.preview')?.innerText.includes('TRASH_BACKUP_ONLY'),
      undefined,
      { timeout: 10_000 },
    );
    const trashBackupRow = page.locator('.explorer-node__item')
      .filter({ hasText: 'trash-backup.md' }).last();
    await trashBackupRow.click();
    await page.waitForTimeout(50);
    await page.locator('.side-title__button--delete').click();

    const tempFolderRow = page.locator('.explorer-node--temp > .explorer-node__item');
    await tempFolderRow.click();
    await page.waitForTimeout(50);
    await createExplorerItem(page, 'temp-backup.md');
    await page.locator('.editor__inner').fill('TEMP_BACKUP_ONLY');
    await page.waitForFunction(
      () => document.querySelector('.preview')?.innerText.includes('TEMP_BACKUP_ONLY'),
      undefined,
      { timeout: 10_000 },
    );

    await page.waitForFunction(() => (
      document.querySelector('[data-local-save-status]')?.dataset.localSaveStatus === 'saved'
    ), undefined, { timeout: 10_000 });
    const visualSearchItems = [];
    const visualSearchFolderId = 'visual-search-layout-folder';
    visualSearchItems.push({
      id: visualSearchFolderId,
      type: 'folder',
      name: 'Workspace Search Fixtures with a Deliberately Long Folder Name',
      parentId: null,
      hash: 50_000,
      tx: 50_000,
    });
    for (let index = 1; index <= 24; index += 1) {
      const fileId = `visual-search-layout-${String(index).padStart(2, '0')}`;
      const tx = 50_000 + (index * 2);
      visualSearchItems.push(
        {
          id: fileId,
          type: 'file',
          name: `MixedCase responsive search result ${String(index).padStart(2, '0')} with a long notebook name.md`,
          parentId: visualSearchFolderId,
          properties: '\n',
          hash: tx,
          tx,
        },
        {
          id: `${fileId}/content`,
          type: 'content',
          text: `Short line ${index}. ${'Context that wraps safely within the search panel. '.repeat(2)}VISUAL_LAYOUT_SEARCH_TOKEN ${index}.`,
          properties: '\n',
          discussions: {},
          comments: {},
          history: [],
          hash: tx + 1,
          tx: tx + 1,
        },
      );
    }
    await seedWorkspaceDatabase(page, 'main', visualSearchItems);
    await page.reload();
    await page.locator('.editor__inner').waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForFunction(() => (
      document.querySelector('[data-local-save-status]')?.dataset.localSaveStatus === 'saved'
    ), undefined, { timeout: 10_000 });
    await dismissPrompts(page);

    let searchPanel = await openWorkspaceSearch(page);
    const defaultOptions = await searchPanel.locator('fieldset input').evaluateAll(inputs => (
      inputs.map(input => input.checked)
    ));
    assert.deepEqual(defaultOptions, [true, true, false]);
    assert.equal(await searchPanel.locator('input[aria-label="Search workspace query"]')
      .evaluate(input => document.activeElement === input), true);
    await searchPanel.locator('input[aria-label="Search workspace query"]').press('Enter');
    await page.waitForFunction(() => (
      document.querySelector('.workspace-search__status')?.textContent
        .includes('Search document names and content in this workspace')
    ));
    await assertSearchStatusContrastBothThemes(page, searchPanel, 'initial');
    assert.equal(await searchPanel.locator('.workspace-search__result').count(), 0);

    await searchPanel.locator('input[aria-label="Search workspace query"]')
      .fill('VISUAL_LAYOUT_SEARCH_TOKEN');
    await searchPanel.locator('form').evaluate((form) => {
      window.__searchingStatusAtSubmit = null;
      form.addEventListener('submit', () => {
        requestAnimationFrame(() => {
          window.__searchingStatusAtSubmit = document.querySelector('.workspace-search__status')
            ?.textContent.trim() || '';
        });
      }, { once: true });
    });
    await searchPanel.locator('input[aria-label="Search workspace query"]').press('Enter');
    await page.waitForFunction(() => (
      document.querySelector('.workspace-search__status')?.textContent.includes('24 documents found')
    ), undefined, { timeout: 20_000 });
    assert.match(await page.evaluate(() => window.__searchingStatusAtSubmit), /Searching workspace/,
      'The searching status is visible while a workspace scan is in progress');
    assert.equal(await searchPanel.locator('.workspace-search__result').count(), 24,
      'The visual search fixture returns many public workspace results');
    const visualSearchResults = await searchPanel.locator('.workspace-search__results').evaluate((list) => ({
      scrollHeight: list.scrollHeight,
      clientHeight: list.clientHeight,
      first: list.firstElementChild.getBoundingClientRect().toJSON(),
      last: list.lastElementChild.getBoundingClientRect().toJSON(),
    }));
    assert.ok(visualSearchResults.scrollHeight > visualSearchResults.clientHeight,
      'Many results scroll inside a bounded results region');
    await searchPanel.locator('.workspace-search__results').evaluate((list) => {
      list.scrollTop = list.scrollHeight;
    });
    const visibleResults = await searchPanel.locator('.workspace-search__results').evaluate((list) => {
      const lastName = list.lastElementChild.querySelector('.workspace-search__result-name');
      lastName.scrollIntoView({ block: 'nearest' });
      return {
        scrollTop: list.scrollTop,
        rect: list.getBoundingClientRect().toJSON(),
        lastName: lastName.getBoundingClientRect().toJSON(),
      };
    });
    assert.ok(visibleResults.lastName.bottom <= visibleResults.rect.bottom + 1
      && visibleResults.lastName.top >= visibleResults.rect.top - 1,
    `The final result name remains visible through the bounded results list: ${JSON.stringify(visibleResults)}`);

    const searchOriginalViewport = page.viewportSize();
    const appTheme = await page.locator('.app').getAttribute('class');
    for (const theme of ['light', 'dark']) {
      for (const viewport of [
        { width: 1728, height: 905 },
        { width: 390, height: 844 },
        { width: 390, height: 480 },
      ]) {
        await assertSearchLayoutAndContrast(page, searchPanel, viewport, theme);
      }
    }
    await page.locator('.app').evaluate((element, originalClasses) => {
      element.className = originalClasses;
    }, appTheme);
    await page.setViewportSize(searchOriginalViewport);
    await searchPanel.locator('.workspace-search__results').evaluate((list) => {
      list.scrollTop = 0;
    });

    await page.evaluate(() => {
      const prototype = IDBDatabase.prototype;
      if (!window.__workspaceSearchOriginalTransaction) {
        window.__workspaceSearchOriginalTransaction = prototype.transaction;
        prototype.transaction = function transaction(...args) {
          if (window.__failWorkspaceSearch) {
            throw new Error('Simulated workspace database failure');
          }
          return window.__workspaceSearchOriginalTransaction.apply(this, args);
        };
      }
      window.__failWorkspaceSearch = true;
    });
    searchPanel = await submitWorkspaceSearch(page, 'FORCED_WORKSPACE_SEARCH_FAILURE');
    assert.match(await searchPanel.getByRole('alert').textContent(), /Simulated workspace database failure/,
      'Workspace search failures have a visible, actionable message');
    await assertSearchStatusContrastBothThemes(page, searchPanel, 'failure');
    await page.evaluate(() => {
      window.__failWorkspaceSearch = false;
    });

    searchPanel = await submitWorkspaceSearch(page, 'SHARED_SEARCH_TOKEN');
    const sharedResults = searchPanel.locator('.workspace-search__result');
    await sharedResults.first().waitFor({ state: 'visible' });
    assert.equal(await sharedResults.count(), 2, 'Repeated occurrences produce one result per file');
    assert.equal(
      (await sharedResults.allTextContents()).some(text => text.includes('Search Fixtures / Nested Search')),
      true,
      'Duplicate names include their folder paths',
    );
    assert.deepEqual(
      await sharedResults.evaluateAll(results => results.map((result) => ({
        name: result.querySelector('.workspace-search__result-name').textContent.trim(),
        path: result.querySelector('.workspace-search__result-path').textContent.trim(),
      }))),
      [
        { name: 'duplicate.md', path: 'Search Fixtures' },
        { name: 'duplicate.md', path: 'Search Fixtures / Nested Search' },
      ],
      'Results are ordered by folder path and then document name',
    );
    assert.equal(await searchPanel.locator('.workspace-search__result mark').first().textContent(), 'SHARED_SEARCH_TOKEN');
    assert.equal(await searchPanel.locator('.workspace-search__snippet').count(), 2);
    assert.match(await searchPanel.locator('.workspace-search__status').textContent(), /2 documents found/);

    const primaryResult = sharedResults.first();
    await primaryResult.focus();
    await primaryResult.press('Enter');
    await page.waitForFunction(
      () => document.querySelector('.editor__inner')?.textContent.includes('PRIMARY_SEARCH_DOCUMENT'),
      undefined,
      { timeout: 10_000 },
    );
    await page.waitForFunction(
      () => window.getSelection()?.toString() === 'SHARED_SEARCH_TOKEN',
      undefined,
      { timeout: 10_000 },
    );
    const jumpState = await page.evaluate(() => {
      const editor = document.querySelector('.editor');
      const range = window.getSelection().getRangeAt(0);
      const match = range.getBoundingClientRect();
      const viewport = editor.getBoundingClientRect();
      const panel = document.querySelector('.workspace-search').getBoundingClientRect();
      return {
        scrollTop: editor.scrollTop,
        visible: match.top >= viewport.top && match.bottom <= viewport.bottom,
        overlapsPanel: match.left < panel.right
          && match.right > panel.left
          && match.top < panel.bottom
          && match.bottom > panel.top,
      };
    });
    assert.ok(jumpState.scrollTop > 0, 'A distant search match scrolls the editor');
    assert.equal(jumpState.visible, true, 'The selected match is visible');
    assert.equal(jumpState.overlapsPanel, false, 'The open search panel does not cover the selected match');
    assert.equal(await searchPanel.isVisible(), true, 'Search remains open after result activation');
    assert.match(
      await page.evaluate(() => String(document.activeElement?.className || '')),
      /editor__inner/,
      'Activating a content result moves focus into the editor',
    );
    await page.keyboard.press('Escape');
    await searchPanel.waitFor({ state: 'hidden' });

    await page.setViewportSize({ width: 390, height: 844 });
    searchPanel = await openWorkspaceSearch(page);
    await submitWorkspaceSearch(page, 'LONG_LINE_SEARCH_TARGET');
    const longLineResult = searchPanel.locator('.workspace-search__result');
    assert.equal(await longLineResult.count(), 1,
      'The long-line fixture produces one content result');
    await longLineResult.click();
    await page.waitForFunction(
      () => window.getSelection()?.toString() === 'LONG_LINE_SEARCH_TARGET',
      undefined,
      { timeout: 10_000 },
    );
    const longLineJumpState = await page.evaluate(() => {
      const selection = window.getSelection();
      const match = selection.getRangeAt(0).getBoundingClientRect();
      const editor = document.querySelector('.editor');
      const editorRect = editor.getBoundingClientRect();
      const panel = document.querySelector('.workspace-search').getBoundingClientRect();
      return {
        scrollTop: editor.scrollTop,
        selectedText: selection.toString(),
        visible: match.top >= editorRect.top
          && match.bottom <= editorRect.bottom
          && match.left >= editorRect.left
          && match.right <= editorRect.right,
        overlapsPanel: match.left < panel.right
          && match.right > panel.left
          && match.top < panel.bottom
          && match.bottom > panel.top,
      };
    });
    assert.equal(longLineJumpState.selectedText, 'LONG_LINE_SEARCH_TARGET');
    assert.ok(longLineJumpState.scrollTop > 0,
      'Activating a long-line match scrolls the mobile editor to the selection');
    assert.equal(longLineJumpState.visible, true,
      'A long-line match stays fully visible in the mobile editor');
    assert.equal(longLineJumpState.overlapsPanel, false,
      'The open mobile search panel does not cover a long-line match');
    assert.equal(await searchPanel.isVisible(), true,
      'Mobile search stays open after long-line result activation');
    await page.keyboard.press('Escape');
    await searchPanel.waitFor({ state: 'hidden' });
    await page.setViewportSize(originalViewport);

    await page.setViewportSize({ width: 390, height: 844 });
    searchPanel = await openWorkspaceSearch(page);
    await submitWorkspaceSearch(page, 'NESTED_SEARCH_DOCUMENT');
    const shortLineResult = searchPanel.locator('.workspace-search__result');
    assert.equal(await shortLineResult.count(), 1);
    await shortLineResult.click();
    await page.waitForFunction(
      () => window.getSelection()?.toString() === 'NESTED_SEARCH_DOCUMENT',
      undefined,
      { timeout: 10_000 },
    );
    const mobileJumpState = await page.evaluate(() => {
      const editor = document.querySelector('.editor');
      const match = window.getSelection().getRangeAt(0).getBoundingClientRect();
      const editorRect = editor.getBoundingClientRect();
      const panel = document.querySelector('.workspace-search').getBoundingClientRect();
      return {
        visible: match.top >= editorRect.top && match.bottom <= editorRect.bottom,
        overlapsPanel: match.left < panel.right
          && match.right > panel.left
          && match.top < panel.bottom
          && match.bottom > panel.top,
      };
    });
    assert.equal(mobileJumpState.visible, true,
      'A short-line result stays visible in the mobile editor');
    assert.equal(mobileJumpState.overlapsPanel, false,
      'Mobile search moves clear of a selected short-line match');
    assert.equal(await searchPanel.isVisible(), true,
      'Mobile search stays open after pointer result activation');
    await page.keyboard.press('Escape');
    await searchPanel.waitFor({ state: 'hidden' });
    await page.setViewportSize(originalViewport);

    searchPanel = await openWorkspaceSearch(page);
    await submitWorkspaceSearch(page, 'ΟΣ');
    assert.equal(await searchPanel.locator('.workspace-search__result').count(), 1);
    assert.equal(await searchPanel.locator('.workspace-search__snippet mark').textContent(), 'ΟΣ');
    const greekResult = searchPanel.locator('.workspace-search__result');
    await greekResult.focus();
    await greekResult.press('Enter');
    await page.waitForFunction(
      () => window.getSelection()?.toString() === 'ΟΣ',
      undefined,
      { timeout: 10_000 },
    );
    const storedPrimarySearchDocument = await waitForStoredDocument(page, 'PRIMARY_SEARCH_DOCUMENT');
    assert.equal(storedPrimarySearchDocument.fileName, 'duplicate.md');
    assert.equal(storedPrimarySearchDocument.text, primarySearchDocumentBeforeActivation.text);

    await setSearchOption(searchPanel, 'Content', false);
    await submitWorkspaceSearch(page, 'TITLE_ONLY_SIGNAL', false);
    assert.equal(await searchPanel.locator('.workspace-search__result').count(), 1);
    assert.equal(await searchPanel.locator('.workspace-search__snippet').count(), 0);
    assert.equal(await searchPanel.locator('.workspace-search__result-name mark').textContent(), 'TITLE_ONLY_SIGNAL');
    await searchPanel.locator('.workspace-search__result').click();
    await page.waitForFunction(
      () => document.querySelector('.editor__inner')?.textContent.includes('no title signal'),
      undefined,
      { timeout: 10_000 },
    );
    assert.equal(await page.evaluate(() => window.getSelection()?.isCollapsed), true);

    await setSearchOption(searchPanel, 'Name', false);
    await setSearchOption(searchPanel, 'Content', true);
    await submitWorkspaceSearch(page, 'mixedcaseneedle');
    assert.equal(await searchPanel.locator('.workspace-search__result').count(), 1);
    await setSearchOption(searchPanel, 'Case-sensitive', true);
    await submitWorkspaceSearch(page, 'mixedcaseneedle', false);
    assert.match(await searchPanel.locator('.workspace-search__status').textContent(), /No documents found/);
    await assertSearchStatusContrastBothThemes(page, searchPanel, 'no-results');
    await setSearchOption(searchPanel, 'Content', false);
    await submitWorkspaceSearch(page, 'mixedcaseneedle');
    assert.match(await searchPanel.getByRole('alert').textContent(), /Select Name or Content/);
    await assertSearchStatusContrastBothThemes(page, searchPanel, 'validation');
    assert.equal(await searchPanel.locator('.workspace-search__result').count(), 0);
    await setSearchOption(searchPanel, 'Content', true);
    await submitWorkspaceSearch(page, '[a-z].*');
    assert.equal(await searchPanel.locator('.workspace-search__result').count(), 1);
    await submitWorkspaceSearch(page, '<script>');
    assert.equal(await searchPanel.locator('.workspace-search__result').count(), 1);
    assert.match(await searchPanel.locator('.workspace-search__snippet').textContent(), /<script>/);
    const unsafeSearchState = await page.evaluate(() => ({
      panelScripts: document.querySelectorAll('.workspace-search script').length,
      executed: window.__workspaceSearchExecuted,
    }));
    assert.equal(unsafeSearchState.panelScripts, 0);
    assert.notEqual(unsafeSearchState.executed, true);

    await setSearchOption(searchPanel, 'Name', true);
    await setSearchOption(searchPanel, 'Content', false);
    await submitWorkspaceSearch(page, 'TITLE_ONLY_SIGNAL');
    await searchPanel.getByRole('button', { name: 'Reset', exact: true }).click();
    assert.equal(await searchPanel.locator('input[aria-label="Search workspace query"]').inputValue(), '');
    assert.deepEqual(await searchPanel.locator('fieldset input').evaluateAll(inputs => (
      inputs.map(input => input.checked)
    )), [true, true, false]);
    assert.equal(await searchPanel.locator('.workspace-search__result').count(), 0);
    assert.equal(await searchPanel.locator('input[aria-label="Search workspace query"]')
      .evaluate(input => document.activeElement === input), true);
    await searchPanel.getByRole('button', { name: 'Close', exact: true }).click();
    await searchPanel.waitFor({ state: 'hidden' });
    searchPanel = await openWorkspaceSearch(page);
    await searchPanel.locator('input[aria-label="Search workspace query"]').press('Escape');
    await searchPanel.waitFor({ state: 'hidden' });

    await page.clock.setFixedTime(new Date('2026-10-09T06:01:00.000Z'));
    await page.locator('.editor__inner').fill('IMMEDIATE_BACKUP_MARKER');
    await page.waitForFunction(
      () => document.querySelector('.preview')?.innerText.includes('IMMEDIATE_BACKUP_MARKER'),
      undefined,
      { timeout: 10_000 },
    );
    const editorTextBeforeBackup = await page.locator('.editor__inner').textContent();
    const immediateShortcutBackup = await downloadText(
      page,
      () => page.locator('.side-title__button--backup').click(),
    );
    assert.equal(immediateShortcutBackup.filename, 'StackEdit_Workspace_20261008-2301.json');
    const parseBackup = download => JSON.parse(download.text.replace(/^\uFEFF/, ''));
    const immediateShortcutItems = parseBackup(immediateShortcutBackup);
    assert.ok(Object.values(immediateShortcutItems).some(item => (
      item.type === 'content' && item.text?.includes('IMMEDIATE_BACKUP_MARKER')
    )), 'Immediate shortcut export should include the unsaved edit');

    // Once the edit has reached IndexedDB, compare both UI entry points against one stable
    // workspace snapshot. Read-only exports must preserve every serialized backup field.
    await waitForStoredDocument(page, 'IMMEDIATE_BACKUP_MARKER');
    const shortcutBackup = await downloadText(
      page,
      () => page.locator('.side-title__button--backup').click(),
    );
    assert.equal(shortcutBackup.filename, 'StackEdit_Workspace_20261008-2301.json');
    await openMenu(page, 'Workspace backups');
    const fixtureBackupDownload = await downloadText(page, () => page.locator(
      '.side-bar__panel--menu .menu-entry',
    ).filter({ hasText: 'Export workspace backup' }).click());
    assert.equal(fixtureBackupDownload.filename, shortcutBackup.filename);
    assert.deepEqual(parseBackup(fixtureBackupDownload), parseBackup(shortcutBackup));
    assert.equal(await page.locator('.editor__inner').textContent(), editorTextBeforeBackup);
    const fixtureBackup = parseBackup(fixtureBackupDownload);
    const fixtureBackupFiles = Object.values(fixtureBackup).filter(item => item.type === 'file');
    const fixtureMarkdownFile = fixtureBackupFiles.find(item => item.name === 'smoke-markdown.md');
    const fixtureTrashedFile = fixtureBackupFiles.find(item => item.name === 'trash-backup.md');
    const fixtureTempFile = fixtureBackupFiles.find(item => item.name === 'temp-backup.md');
    assert.ok(fixtureMarkdownFile, 'Workspace backup should include the imported Markdown file');
    assert.match(fixtureBackup[`${fixtureMarkdownFile.id}/content`].text, /LATEST_BACKUP_MARKER/);
    assert.equal(fixtureTrashedFile?.parentId, 'trash');
    assert.equal(fixtureTempFile?.parentId, 'temp');
    assert.ok(Object.values(fixtureBackup).some(item => (
      item.type === 'content' && item.text?.includes('IMMEDIATE_BACKUP_MARKER')
    )), 'Both stable exports should include the edit made immediately before export');
    await page.clock.setSystemTime(new Date());
    searchPanel = await openWorkspaceSearch(page);
    await submitWorkspaceSearch(page, 'TRASH_BACKUP_ONLY');
    assert.equal(await searchPanel.locator('.workspace-search__result').count(), 0);
    await submitWorkspaceSearch(page, 'TEMP_BACKUP_ONLY');
    assert.equal(await searchPanel.locator('.workspace-search__result').count(), 0);
    await submitWorkspaceSearch(page, 'STALE_ONLY_SIGNAL');
    const staleResult = searchPanel.locator('.workspace-search__result');
    assert.equal(await staleResult.count(), 1);
    const staleFileRow = page.locator('.explorer-node__item')
      .filter({ hasText: 'stale-search.md' }).last();
    await staleFileRow.click();
    await page.waitForTimeout(50);
    await page.locator('.side-title__button--delete').click();
    await staleResult.click();
    assert.match(await searchPanel.locator('.workspace-search__status').textContent(), /result has changed/);
    await searchPanel.getByRole('button', { name: 'Close', exact: true }).click();
    await assertFindReplaceWorks(page);
    await openMenu(page, 'Import/export');

    await page.locator('#import-markdown-file-input').setInputFiles({
      name: 'smoke-diagrams.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from([
        '# Diagram export',
        '```js\nconst highlightSignal = 1;\n```',
        '```abc\nX: 1\nT: Legacy song\nM: 4/4\nK: C\nCDEF|\n```',
        '$$\nE = mc^2\n$$',
        '```mermaid\ngraph TD\n  A[DIAGRAMSTART] --> B[DIAGRAMEND]\n```',
        '```mermaid\nsequenceDiagram\n  Alice->>Bob: DIAGRAMMESSAGE\n```',
        '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="red" /></svg>',
      ].join('\n\n')),
    });
    await page.waitForFunction(() => (
      document.querySelectorAll('.preview svg[id^="mermaid-svg-"]').length === 2
      && document.querySelector('.preview svg[viewBox="0 0 10 10"] circle')
      && document.querySelector('.preview .katex')
      && document.querySelector('.preview pre code .token.keyword')?.textContent === 'const'
    ), undefined, { timeout: 20_000 }).catch(async error => {
      console.error('Diagram rendering state:', await page.evaluate(() => ({
        svgIds: [...document.querySelectorAll('.preview svg')].map(svg => svg.id),
        preview: document.querySelector('.preview__inner-2')?.innerHTML.slice(0, 4000),
      })), browserErrors);
      throw error;
    });
    const abcPreviewCode = page.locator('.preview pre code.language-abc');
    assert.equal(await abcPreviewCode.count(), 1, 'ABC source should remain an ordinary code fence');
    assert.equal(await abcPreviewCode.textContent(), 'X: 1\nT: Legacy song\nM: 4/4\nK: C\nCDEF|\n');
    assert.equal(await page.locator('.preview .abc-notation-block').count(), 0);
    await assertHtmlExportFailure(page);
    const diagramExport = await exportHtml(page, { tableOfContents: true, copy: true });
    assert.match(diagramExport.filename, /^smoke-diagrams\.md\.html$/);
    assert.match(diagramExport.text, /<svg[^>]*id="mermaid-svg-/);
    assert.match(diagramExport.text, /DIAGRAMSTART/);
    assert.match(diagramExport.text, /DIAGRAMMESSAGE/);
    assert.match(diagramExport.text, /<circle[^>]*fill="red"/);
    assert.doesNotMatch(diagramExport.text, /<code\b[^>]*\blanguage-mermaid\b/);
    assert.match(diagramExport.text, /<code\b[^>]*\blanguage-abc\b/);
    assert.match(diagramExport.text, /X: 1\nT: Legacy song\nM: 4\/4\nK: C\nCDEF\|/);
    assert.match(diagramExport.text, /class="katex"/);
    assert.match(diagramExport.text, /<span class="token keyword">const<\/span>/,
      'Fixed HTML output retains rendered JavaScript syntax highlighting');
    assert.match(diagramExport.text, /<nav\b[^>]*class="stackedit__toc"/);
    assert.match(diagramExport.text, /href="#diagram-export"/);
    const exportStyles = diagramExport.text.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i)?.[1] || '';
    assert.match(exportStyles, /\.stackedit__html/);
    assert.match(exportStyles, /data:font\/woff2;base64,/);
    assert.doesNotMatch(diagramExport.text, /<link\b[^>]*stylesheet/i);
    assert.doesNotMatch(exportStyles, /url\((?!["']?(?:data:|#))/i);
    await assertOfflineHtmlRenders(browser, diagramExport.path, 'Diagram export');

    await page.evaluate(() => {
      window.__stackeditPrintCalled = false;
      window.print = () => { window.__stackeditPrintCalled = true; };
    });
    await openMenu(page, 'Print');
    assert.equal(await page.evaluate(() => window.__stackeditPrintCalled), true);
    const printedDocument = await page.pdf({ format: 'A4', printBackground: true });
    assert.equal(printedDocument.subarray(0, 5).toString(), '%PDF-');
    assert.ok(printedDocument.length > 1_000, 'Browser printing produces a non-empty PDF document');
    const mainMenuItems = await page.locator('.side-bar__panel--menu .menu-entry').allTextContents();
    assert.doesNotMatch(mainMenuItems.join('\n'), /Templates|Handlebars/i);
    await page.locator('.side-bar__panel--menu .menu-entry')
      .filter({ hasText: 'Import/export' })
      .click();

    const originalDiagramName = 'smoke-diagrams.md';
    const unsafeDiagramName = 'Unsafe "<script>" & document.md';
    await renameCurrentFile(page, unsafeDiagramName);
    const escapedTitleExport = await exportHtml(page);
    assert.match(
      escapedTitleExport.text,
      /<title>Unsafe &quot;&lt;script&gt;&quot; &amp; document\.md<\/title>/,
    );
    assert.doesNotMatch(escapedTitleExport.text, /<title>Unsafe ["']<script>/i);
    await renameCurrentFile(page, originalDiagramName);

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
    assert.doesNotMatch(markdownHtmlExport.text, /class="stackedit__toc"/);
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

    assert.deepEqual(
      networkRequests.filter(request => /\/(?:pdfExport|pandocExport)(?:\?|$)/i.test(request.url)),
      [],
      'Local export does not call server conversion endpoints',
    );
    assert.deepEqual(
      networkRequests.filter(request => new URL(request.url).origin !== new URL(appUrl).origin),
      [],
      'Startup, menus, and exports do not contact providers or backend services',
    );
    assert.equal(
      await page.evaluate(() => window.__stackeditLegacyHelperExecuted || false),
      false,
      'Stored or authored legacy helpers do not execute during export',
    );

    const explorerTree = page.locator('.explorer__tree');
    if (!(await explorerTree.isVisible())) {
      await page.locator('button[aria-label="Toggle explorer"]').click();
    }
    await explorerTree.waitFor({ state: 'visible' });
    const markdownRows = page.locator('.explorer-node__item')
      .filter({ hasText: 'smoke-markdown.md' });
    const originalMarkdownCount = await markdownRows.count();
    assert.equal(originalMarkdownCount, 1);

    await seedLegacyWorkspaceRecords(page);
    await page.reload();
    await page.waitForSelector('.editor__inner', { state: 'visible', timeout: 20_000 });
    await dismissPrompts(page);
    await openMenu(page, 'Workspace backups');
    const backupDownload = await downloadText(page, () => page.locator(
      '.side-bar__panel--menu .menu-entry',
    ).filter({ hasText: 'Export workspace backup' }).click());
    const backup = JSON.parse(backupDownload.text.replace(/^\uFEFF/, ''));
    assert.deepEqual(backup.templates?.data?.archivedOffline, {
      name: 'Archived offline template',
      value: '<script>window.__stackeditLegacyHelperExecuted = true</script>',
      helpers: 'self.postMessage([null, window.__stackeditLegacyHelperExecuted = true]);',
      isAdditional: true,
    }, 'Workspace snapshots retain old custom template data as inert data');
    assert.equal(backup['legacy-sync-location']?.providerId, 'googleDrive');
    assert.equal(backup['legacy-publish-location']?.providerId, 'github');
    assert.equal(backup['legacy-publish-location']?.templateId, 'archived-template');
    assert.equal(JSON.stringify(backup).includes('legacy-access-token-must-remain-private'), false,
      'Workspace backups do not include credentials kept in local storage');
    assert.equal(backup.serverConf, undefined,
      'Workspace backups do not include the old server configuration');
    assert.equal(
      await page.evaluate(() => window.__stackeditLegacyHelperExecuted),
      false,
      'Archived template helpers remain inactive during the workspace export',
    );
    const retainedCredentials = await page.evaluate(() => ({
      tokens: JSON.parse(localStorage.getItem('data/tokens')).data,
      serverConf: JSON.parse(localStorage.getItem('data/serverConf')).data,
    }));
    assert.deepEqual(retainedCredentials.tokens, legacyTokens,
      'The update leaves existing local credentials untouched');
    assert.deepEqual(retainedCredentials.serverConf, {
      allowSponsorship: true,
      legacy: 'server configuration',
    });
    const markdownFile = Object.values(backup)
      .find(item => item.type === 'file' && item.name === 'smoke-markdown.md');
    assert.ok(markdownFile, 'Workspace backup should include the imported Markdown file');
    assert.match(backup[`${markdownFile.id}/content`].text, /SMOKE_MARKDOWN_MARKER/);
    assert.ok(Object.values(backup).some(item => (
      item.type === 'content' && item.text?.includes('IMMEDIATE_BACKUP_MARKER')
    )), 'The backup selected for restore should retain the edit made before its first export');

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
    const restoredNestedSearchPanel = await openWorkspaceSearch(page);
    await submitWorkspaceSearch(page, 'NESTED_SEARCH_DOCUMENT');
    const restoredNestedResults = restoredNestedSearchPanel.locator('.workspace-search__result');
    assert.equal(await restoredNestedResults.count(), 2);
    assert.ok((await restoredNestedResults.allTextContents()).every(result => (
      result.includes('Search Fixtures') && result.includes('Nested Search')
    )), 'Restore should preserve nested folder placement');
    await restoredNestedSearchPanel.getByRole('button', { name: 'Close', exact: true }).click();
    const restoredEditSearchPanel = await openWorkspaceSearch(page);
    await submitWorkspaceSearch(page, 'IMMEDIATE_BACKUP_MARKER');
    assert.equal(
      await restoredEditSearchPanel.locator('.workspace-search__result').count(),
      2,
      'Import should restore the immediately edited document alongside its original',
    );
    await restoredEditSearchPanel.getByRole('button', { name: 'Close', exact: true }).click();
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

    updatedPage.on('request', (request) => {
      networkRequests.push({
        url: request.url(),
        postData: request.postData() || '',
      });
    });
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
      const searchButton = updatedPage.getByRole('button', {
        name: 'Search workspace',
        exact: true,
      });
      await searchButton.focus();
      await searchButton.press('Enter');
      const offlineSearchPanel = updatedPage.locator('.workspace-search');
      await offlineSearchPanel.waitFor({ state: 'visible' });
      await submitWorkspaceSearch(updatedPage, 'BACKUPRESTOREMARKER');
      const offlineResult = offlineSearchPanel.locator('.workspace-search__result');
      await offlineResult.waitFor({ state: 'visible' });
      assert.equal(await offlineResult.count(), 1);
      await offlineResult.focus();
      await offlineResult.press('Enter');
      await updatedPage.waitForFunction(
        () => window.getSelection()?.toString() === 'BACKUPRESTOREMARKER',
        undefined,
        { timeout: 10_000 },
      );
      assert.equal(await offlineSearchPanel.isVisible(), true);
      await submitWorkspaceSearch(updatedPage, 'BACKUPRESTOREMARKER');
      const repeatedOfflineResult = offlineSearchPanel.locator('.workspace-search__result');
      await repeatedOfflineResult.focus();
      await repeatedOfflineResult.press('Enter');
      await updatedPage.waitForFunction(
        () => window.getSelection()?.toString() === 'BACKUPRESTOREMARKER',
        undefined,
        { timeout: 10_000 },
      );
      assert.equal(networkRequests.some(request => (
        request.url.includes('BACKUPRESTOREMARKER')
        || request.postData.includes('BACKUPRESTOREMARKER')
      )), false, 'Offline search does not transmit query or document text');

      await offlineSearchPanel.getByRole('button', { name: 'Close', exact: true }).click();
      await ensureExplorerVisible(updatedPage);
      const offlineBackup = await downloadText(
        updatedPage,
        () => updatedPage.locator('.side-title__button--backup').click(),
      );
      assert.match(offlineBackup.filename, /^StackEdit_Workspace_\d{8}-\d{4}\.json$/);
      const offlineBackupItems = JSON.parse(offlineBackup.text.replace(/^\uFEFF/, ''));
      const restoredBackupFiles = Object.values(offlineBackupItems).filter(item => (
        item.type === 'file' && item.name === 'smoke-markdown.md'
      ));
      assert.ok(restoredBackupFiles.length, 'Offline backup should include the restored Markdown file');
      assert.ok(restoredBackupFiles.some(file => (
        offlineBackupItems[`${file.id}/content`].text.includes('BACKUPRESTOREMARKER')
      )), 'Offline backup should include the latest restored Markdown edit');
    } finally {
      await context.setOffline(false);
    }

    await context.close();

    const lightContext = await browser.newContext();
    const lightHost = await lightContext.newPage();
    const lightRequests = [];
    lightHost.on('request', request => lightRequests.push(request.url()));
    await lightHost.goto(`http://127.0.0.1:${port}${lightHostPath}`);
    const embedded = lightHost.frameLocator('iframe[title="Embedded StackEdit"]');
    await embedded.locator('.editor__inner').waitFor({ state: 'visible', timeout: 20_000 });
    await lightHost.waitForFunction(
      () => window.__stackeditMessages.some(message => message.data.type === 'ready'),
      undefined,
      { timeout: 15_000 },
    );
    assert.equal(await embedded.getByRole('button', {
      name: 'Close StackEdit',
      exact: true,
    }).count(), 1, 'Embedded mode retains its close control');
    await embedded.locator('.editor__inner').fill('EMBEDDED_EDIT_MARKER');
    await lightHost.waitForFunction(
      () => window.__stackeditMessages.some(message => (
        message.data.type === 'fileChange'
        && message.data.payload.content.text.includes('EMBEDDED_EDIT_MARKER')
      )),
      undefined,
      { timeout: 15_000 },
    );
    const embeddedFrame = lightHost.frames().find(frame => frame.url().includes(appPath));
    const embeddedState = await embeddedFrame.evaluate(() => {
      const store = document.querySelector('#app').__vue_app__._context.provides.store;
      return {
        parentId: store.getters['file/current'].parentId,
        text: store.getters['content/current'].text,
      };
    });
    assert.equal(embeddedState.parentId, 'temp', 'Embedded documents remain in the Temp folder');
    assert.match(embeddedState.text, /EMBEDDED_EDIT_MARKER/);
    await embedded.getByRole('button', { name: 'Close StackEdit', exact: true }).click();
    await lightHost.waitForFunction(
      () => window.__stackeditMessages.some(message => message.data.type === 'close'),
      undefined,
      { timeout: 10_000 },
    );
    assert.equal(
      lightRequests.some(url => new URL(url).origin !== new URL(appUrl).origin),
      false,
      'Embedded startup and edits do not contact external services',
    );
    await lightContext.close();

    console.log('Production browser smoke passed at / and /docs/app (Read more navigation, workspace search, backups, restore, security, service-worker update, offline reload, cross-tab saves, workspace isolation, embedded messaging).');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
