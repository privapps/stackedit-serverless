import { describe, expect, it } from 'vitest';
import extensionSvc from '../../../src/services/extensionSvc';
import markdownConversionSvc from '../../../src/services/markdownConversionSvc';
import utils from '../../../src/services/utils';

describe('legacy ABC extension properties', () => {
  it('ignores old music settings and keeps ABC fences as code', async () => {
    const properties = utils.computeProperties([
      'extensions:',
      '  preset: default',
      '  abc:',
      '    enabled: true',
    ].join('\n'));
    const options = extensionSvc.getOptions(properties);

    expect(properties.extensions.abc.enabled).toBe(true);
    expect(options.abc).toBeUndefined();
    expect(options.mermaid).toBe(true);
    expect(options.math).toBe(true);

    const converter = markdownConversionSvc.createConverter(options);
    const elt = document.createElement('div');
    elt.innerHTML = converter.render('```abc\nX: 1\nT: Legacy song\nCDEF|\n```');
    await extensionSvc.sectionPreview(elt, options, true);

    expect(elt.querySelector('.abc-notation-block')).toBeNull();
    expect(elt.querySelector('pre code.language-abc').textContent)
      .toBe('X: 1\nT: Legacy song\nCDEF|\n');
  });
});
