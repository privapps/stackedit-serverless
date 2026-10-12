import landingHtml from '../../../static/landing/index.html';

describe('landing page navigation', () => {
  it('uses a native Read more link to reach its section without jQuery', () => {
    const landing = new DOMParser().parseFromString(landingHtml, 'text/html');
    const readMoreLink = landing.querySelector('.splash-screen__footer a');

    expect(readMoreLink.getAttribute('href')).toBe('#anchor');
    expect(landing.querySelector('#anchor')).not.toBeNull();
    expect(landing.querySelector('script[src*="jquery"]')).toBeNull();
  });
});
