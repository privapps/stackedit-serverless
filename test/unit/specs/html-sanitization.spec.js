import { mount } from '@vue/test-utils';
import Modal from '../../../src/components/Modal';
import htmlSanitizer from '../../../src/libs/htmlSanitizer';
import store from '../../../src/store';

describe('HTML sanitization', () => {
  it('preserves safe SVG and semantic formatting while removing executable SVG', () => {
    const sanitized = htmlSanitizer.sanitizeHtml(`
      <ruby>漢<rp>(</rp><rt>kan</rt><rp>)</rp></ruby>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)">
        <circle cx="5" cy="5" r="4" fill="red" />
        <path d="M0 0 L10 10" stroke="blue" />
        <a href="javascript:alert(1)"><text x="1" y="2">Label</text></a>
        <use href="javascript:alert(1)" />
        <script>alert(1)</script>
        <foreignObject><p onclick="alert(1)">Unsafe</p></foreignObject>
        <animate attributeName="href" values="javascript:alert(1)" />
      </svg>
    `);
    const fragment = new DOMParser().parseFromString(sanitized, 'text/html');

    expect(fragment.querySelector('ruby rt').textContent).toBe('kan');
    expect(fragment.querySelector('svg').getAttribute('viewBox')).toBe('0 0 10 10');
    expect(fragment.querySelector('circle').getAttribute('fill')).toBe('red');
    expect(fragment.querySelector('path').getAttribute('d')).toBe('M0 0 L10 10');
    expect(fragment.querySelector('script, foreignObject, animate, [onload], [onclick]')).toBeNull();
    expect(fragment.querySelector('[href^="javascript:"]')).toBeNull();
  });

  it('removes executable markup while preserving safe formatting and media', () => {
    const sanitized = htmlSanitizer.sanitizeHtml(`
      <p onclick="alert(1)">Safe <strong>formatting</strong></p>
      <a href="javascript:alert(1)">Unsafe link</a>
      <a href="java&#x0A;script:alert(1)">Obfuscated unsafe link</a>
      <a href="file:///etc/passwd">Local file</a>
      <a href="blob:https://example.com/image">Blob link</a>
      <a href="bl&#x0A;ob:https://example.com/image">Obfuscated blob link</a>
      <a href="da&#x0A;ta:image/svg+xml,<svg></svg>">Obfuscated data link</a>
      <a href="https://example.com">Safe link</a>
      <img src="https://example.com/photo.png" alt="Photo" onerror="alert(1)">
      <img src="data:image/svg+xml,<svg></svg>" alt="Active image">
      <img src="da&#x0A;ta:image/svg+xml,<svg></svg>" alt="Obfuscated active image">
      <img src="blob:https://example.com/image" alt="Blob image">
      <script>alert(document.domain)</script>
      <iframe src="https://attacker.invalid/embed/video"></iframe>
      <iframe src="https://www.youtube.com/embed/video-id" allowfullscreen title="Video"></iframe>
    `);
    const documentFragment = new DOMParser().parseFromString(sanitized, 'text/html');

    expect(documentFragment.querySelector('script, [onclick], [onerror]')).toBeNull();
    expect(documentFragment.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(documentFragment.querySelector('a[href^="file:"]')).toBeNull();
    expect(documentFragment.querySelector('a[href^="blob:"]')).toBeNull();
    expect(documentFragment.querySelector('img[src^="data:image/svg+xml"]')).toBeNull();
    expect(documentFragment.querySelector('iframe[src*="attacker.invalid"]')).toBeNull();
    expect(documentFragment.querySelectorAll('a[href]')).toHaveLength(1);
    expect(
      documentFragment.querySelector('a[href="https://example.com"]').textContent,
    ).toBe('Safe link');
    expect(documentFragment.querySelector('strong').textContent).toBe('formatting');
    expect(documentFragment.querySelector('img[alt="Photo"][src="https://example.com/photo.png"]'))
      .not.toBeNull();
    expect(documentFragment.querySelector('img[alt="Blob image"]')).not.toBeNull();
    expect(documentFragment.querySelector('iframe[src="https://www.youtube.com/embed/video-id"]'))
      .not.toBeNull();
  });

  it('rejects local files and active SVG data from inline image URLs', () => {
    expect(htmlSanitizer.sanitizeUri('file:///etc/passwd', true)).toMatch(/^unsafe:/);
    expect(htmlSanitizer.sanitizeUri('file:///etc/passwd')).toMatch(/^unsafe:/);
    expect(htmlSanitizer.sanitizeUri('data:image/svg+xml,<svg></svg>', true)).toMatch(/^unsafe:/);
    expect(htmlSanitizer.sanitizeUri('data:image/png;base64,AAAA', true))
      .toBe('data:image/png;base64,AAAA');
  });

  it('renders user-provided modal names without executable markup', () => {
    store.commit('modal/setStack', [{
      type: 'folderDeletion',
      item: {
        name: '<img src="x" onerror="alert(1)">',
      },
    }]);
    const wrapper = mount(Modal, {
      global: {
        plugins: [store],
      },
    });

    try {
      expect(wrapper.find('.modal__content [onerror]').exists()).toBe(false);
      expect(wrapper.find('.modal__content').text()).toContain('<img src="x" onerror="alert(1)">');
    } finally {
      wrapper.unmount();
      store.commit('modal/setStack', []);
    }
  });
});
