import DOMPurify from 'dompurify';

const aHrefSanitizationWhitelist = /^\s*(https?|ftp|mailto|tel):/;
const imgSrcSanitizationWhitelist =
  /^\s*((https?|ftp|blob):|data:image\/(?:avif|bmp|gif|jpe?g|png|webp)(?:;[^,]*)?,)/i;
const imageDataUriRegExp = /^data:image\/(?:avif|bmp|gif|jpe?g|png|webp)(?:;[^,]*)?,/i;
const allowedUriRegExp =
  /^\s*(?:(?:https?|ftp|mailto|tel|blob):|data:image\/|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;
const urlParsingNode = window.document.createElement('a');
const allowedTags = [
  'a', 'abbr', 'article', 'aside', 'b', 'blockquote', 'br', 'caption', 'center', 'code',
  'col', 'colgroup', 'dd', 'del', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'font',
  'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'i', 'iframe', 'img', 'ins',
  'kbd', 'li', 'mark', 'ol', 'p', 'pre', 'q', 's', 'samp', 'section', 'small', 'span',
  'strike', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr',
  'u', 'ul', 'wbr',
  'acronym', 'address', 'area', 'bdi', 'bdo', 'big', 'cite', 'dfn', 'dir', 'hgroup',
  'label', 'map', 'menu', 'nav', 'rp', 'rt', 'ruby', 'time', 'tt', 'var',
  'circle', 'defs', 'desc', 'ellipse', 'g', 'image', 'line', 'linearGradient', 'marker',
  'metadata', 'path', 'polygon', 'polyline', 'radialGradient', 'rect', 'stop', 'svg',
  'switch', 'text', 'title', 'tspan', 'use',
];
const allowedAttributes = [
  'abbr', 'align', 'allow', 'allowfullscreen', 'alt', 'axis', 'bgcolor', 'border', 'cellpadding',
  'cellspacing', 'cite', 'class', 'clear', 'colspan', 'color', 'cols', 'compact', 'coords', 'dir',
  'face', 'frameborder', 'headers', 'height', 'hreflang', 'hspace', 'id', 'ismap', 'lang',
  'href', 'loading', 'longdesc', 'nohref', 'nowrap', 'referrerpolicy', 'rel', 'rev', 'role',
  'rows', 'rowspan', 'rules', 'scope', 'scrolling', 'shape', 'size', 'span', 'src', 'start',
  'summary', 'tabindex', 'target', 'title', 'type', 'usemap', 'valign', 'value', 'vspace', 'width',
  'cx', 'cy', 'd', 'dx', 'dy', 'fill', 'fill-rule', 'font-family', 'font-size', 'font-style',
  'font-weight', 'fx', 'fy', 'gradientTransform', 'gradientUnits', 'marker-end', 'marker-mid',
  'marker-start', 'markerHeight', 'markerUnits', 'markerWidth', 'offset', 'opacity', 'orient',
  'pathLength', 'points', 'preserveAspectRatio', 'r', 'refX', 'refY', 'rx', 'ry', 'stop-color',
  'stop-opacity', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap',
  'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'text-anchor',
  'transform', 'version', 'viewBox', 'visibility', 'x', 'x1', 'x2', 'xlink:href', 'xml:space',
  'xmlns', 'xmlns:xlink', 'y', 'y1', 'y2',
];
const trustedEmbedPaths = new Map([
  ['player.vimeo.com', /^\/video\/[^/]+\/?$/],
  ['www.youtube-nocookie.com', /^\/embed\/[^/]+\/?$/],
  ['www.youtube.com', /^\/embed\/[^/]+\/?$/],
]);

function sanitizeUri(uri, isImage) {
  const regex = isImage ? imgSrcSanitizationWhitelist : aHrefSanitizationWhitelist;
  urlParsingNode.setAttribute('href', uri);
  const normalizedVal = urlParsingNode.href;
  if (normalizedVal !== '' && !normalizedVal.match(regex)) {
    return `unsafe:${normalizedVal}`;
  }
  return uri;
}

function isTrustedEmbed(uri) {
  try {
    const url = new URL(uri);
    const pathRegExp = trustedEmbedPaths.get(url.hostname);
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && pathRegExp?.test(url.pathname);
  } catch {
    return false;
  }
}

DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName === 'iframe' && !isTrustedEmbed(node.getAttribute('src'))) {
    node.remove();
  }
});

DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  const uri = data.attrValue.replace(/[\u0000-\u0020\u007f]/g, '');
  if (/^(?:blob|data):/i.test(uri)) {
    data.keepAttr = node.nodeName === 'IMG'
      && data.attrName === 'src'
      && (/^blob:/i.test(uri) || imageDataUriRegExp.test(uri));
  }
});

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.nodeName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

function sanitizeHtml(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_ATTR: allowedAttributes,
    ALLOWED_TAGS: allowedTags,
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: allowedUriRegExp,
  });
}

export default {
  sanitizeHtml,
  sanitizeUri,
};
