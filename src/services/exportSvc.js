import FileSaver from 'file-saver';
import documentSerializationSvc from './documentSerializationSvc';
import markdownConversionSvc from './markdownConversionSvc';
import extensionSvc from './extensionSvc';
import utils from './utils';
import store from '../store';
import localDbSvc from './localDbSvc';
import htmlSanitizer from '../libs/htmlSanitizer';

const escapeHtml = value => `${value}`
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function getHeadings(container) {
  return [...container.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .filter(heading => heading.id)
    .map(heading => ({
      title: heading.textContent,
      anchor: heading.id,
      level: Number(heading.tagName.slice(1)),
      children: [],
    }));
}

function groupHeadings(headings) {
  const root = { children: [] };
  const stack = [root];
  headings.forEach((heading) => {
    const depth = Math.min(heading.level, stack.length);
    while (stack.length > depth) {
      stack.pop();
    }
    const node = { ...heading, children: [] };
    stack[depth - 1].children.push(node);
    stack.push(node);
  });
  return root.children;
}

function appendTocItems(list, headings) {
  headings.forEach((heading) => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${heading.anchor}`;
    link.textContent = heading.title;
    item.appendChild(link);
    if (heading.children.length) {
      const childList = document.createElement('ul');
      appendTocItems(childList, heading.children);
      item.appendChild(childList);
    }
    list.appendChild(item);
  });
}

function makeTableOfContents(headings) {
  if (!headings.length) {
    return '';
  }
  const navigation = document.createElement('nav');
  navigation.className = 'stackedit__toc';
  navigation.setAttribute('aria-label', 'Table of contents');
  const list = document.createElement('ul');
  appendTocItems(list, groupHeadings(headings));
  navigation.appendChild(list);
  return navigation.outerHTML;
}

function preferredFontSource(fontFace) {
  const sourceMatch = fontFace.match(/src:([^;]+);/i);
  if (!sourceMatch) {
    return fontFace;
  }
  const sources = sourceMatch[1].split(/,\s*(?=url\()/i);
  const preferred = sources.find(source => /\.woff2(?:[?#)]|$)/i.test(source))
    || sources.find(source => /\.woff(?:[?#)]|$)/i.test(source))
    || sources[0];
  return fontFace.replace(sourceMatch[0], `src:${preferred};`);
}

async function embedStylesheetAssets(css, stylesheetUrl) {
  const compactFonts = css.replace(/@font-face\s*\{[^}]*\}/gi, preferredFontSource);
  const resources = [...compactFonts.matchAll(/url\((['"]?)([^'")]+)\1\)/gi)];
  const embeddedByUrl = new Map();
  for (const [, , resourceUrl] of resources) {
    if (/^(?:data:|#)/i.test(resourceUrl) || embeddedByUrl.has(resourceUrl)) {
      continue;
    }
    const absoluteUrl = new URL(resourceUrl, stylesheetUrl);
    if (absoluteUrl.origin !== window.location.origin) {
      throw new Error('HTML export cannot include a stylesheet asset from another website.');
    }
    const response = await fetch(absoluteUrl.href, { credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error(`HTML export could not load a required style asset (${response.status}).`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    const extension = absoluteUrl.pathname.split('.').pop().toLowerCase();
    const mediaType = {
      woff2: 'font/woff2',
      woff: 'font/woff',
      ttf: 'font/ttf',
      otf: 'font/otf',
      eot: 'application/vnd.ms-fontobject',
    }[extension] || response.headers.get('content-type') || 'application/octet-stream';
    embeddedByUrl.set(resourceUrl, `data:${mediaType};base64,${btoa(binary)}`);
  }
  return compactFonts.replace(/url\((['"]?)([^'")]+)\1\)/gi, (match, quote, resourceUrl) => (
    embeddedByUrl.has(resourceUrl)
      ? `url(${quote}${embeddedByUrl.get(resourceUrl)}${quote})`
      : match
  ));
}

async function getEmbeddedStyles() {
  const stylesheets = [...document.querySelectorAll('link[rel~="stylesheet"][href]')];
  if (!stylesheets.length) {
    throw new Error('HTML export could not find the notebook styles.');
  }
  const cssBlocks = await Promise.all(stylesheets.map(async (stylesheet) => {
    const response = await fetch(stylesheet.href, { credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error(`HTML export could not load the notebook styles (${response.status}).`);
    }
    const css = await response.text();
    return embedStylesheetAssets(css, stylesheet.href);
  }));
  return cssBlocks.join('\n');
}

export default {
  async renderHtml(fileId, { includeToc = false } = {}) {
    const file = store.state.file.itemsById[fileId];
    const content = await localDbSvc.loadItem(`${fileId}/content`);
    const properties = utils.computeProperties(content.properties);
    const options = extensionSvc.getOptions(properties);
    const converter = markdownConversionSvc.createConverter(options, true);
    const parsingCtx = markdownConversionSvc.parseSections(converter, content.text);
    const conversionCtx = markdownConversionSvc.convert(parsingCtx);
    const html = conversionCtx.htmlSectionList.map(htmlSanitizer.sanitizeHtml).join('');
    const containerElt = document.createElement('div');
    containerElt.className = 'hidden-rendering-container';
    containerElt.innerHTML = html;
    document.body.appendChild(containerElt);
    let renderedHtml;
    let tocHtml = '';
    try {
      await extensionSvc.sectionPreview(containerElt, options);

      containerElt.querySelectorAll('.table-wrapper').cl_each((wrapperElt) => {
        while (wrapperElt.firstChild) {
          wrapperElt.parentNode.insertBefore(wrapperElt.firstChild, wrapperElt.nextSibling);
        }
        wrapperElt.parentNode.removeChild(wrapperElt);
      });

      if (includeToc) {
        tocHtml = makeTableOfContents(getHeadings(containerElt));
      }
      renderedHtml = containerElt.innerHTML;
    } finally {
      containerElt.remove();
    }

    const embeddedStyles = await getEmbeddedStyles();
    const tocColumn = tocHtml ? `<div class="stackedit__left">${tocHtml}</div>` : '';
    const standaloneStyles = [
      includeToc ? '' : '.stackedit__right { left: 0; }',
      '@media print {',
      '  html, body { height: auto !important; }',
      '  body { position: static !important; overflow: visible !important; }',
      '  body div { display: block !important; }',
      '  .stackedit__left { display: none !important; }',
      '  .stackedit__right { position: static !important; left: auto !important; right: auto !important; top: auto !important; }',
      '  .stackedit__html { max-width: none !important; margin: 0 auto !important; padding: 0 !important; }',
      '}',
    ].join('\n');
    return [
      '<!DOCTYPE html>',
      '<html>',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      `<title>${escapeHtml(file.name)}</title>`,
      `<style>${`${embeddedStyles}\n${standaloneStyles}`.replace(/<\/style/gi, '<\\/style')}</style>`,
      '</head>',
      '<body class="stackedit">',
      tocColumn,
      `<div class="stackedit__right"><div class="stackedit__html">${renderedHtml}</div></div>`,
      '</body>',
      '</html>',
    ].join('\n');
  },

  async exportHtmlToDisk(fileId, includeToc = false) {
    const file = store.state.file.itemsById[fileId];
    const html = await this.renderHtml(fileId, { includeToc });
    const blob = new Blob([html], {
      type: 'text/html;charset=utf-8',
    });
    FileSaver.saveAs(blob, `${file.name}.html`);
  },

  async exportMarkdownToDisk(fileId) {
    const file = store.state.file.itemsById[fileId];
    const content = await localDbSvc.loadItem(`${fileId}/content`);
    const markdown = documentSerializationSvc.serializeContent(content);
    const blob = new Blob([markdown], {
      type: 'text/markdown;charset=utf-8',
    });
    FileSaver.saveAs(blob, `${file.name}.md`);
  },
};
