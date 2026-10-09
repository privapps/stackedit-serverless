import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import Editor from '../../../src/components/Editor';
import Preview from '../../../src/components/Preview';
import editorSvc from '../../../src/services/editorSvc';
import markdownConversionSvc from '../../../src/services/markdownConversionSvc';
import store from '../../../src/store';
import workspaceSvc from '../../../src/services/workspaceSvc';

describe('editor workflows', () => {
  it('updates the preview when a workspace document is edited', async () => {
    const file = await workspaceSvc.createFile({
      name: 'Draft.md',
      text: '**Before**\n\n<iframe src="https://attacker.invalid/embed/video"></iframe>',
    }, true);
    store.commit('file/setCurrentId', file.id);

    markdownConversionSvc.init();
    const editor = mount(Editor, {
      global: {
        plugins: [store],
      },
    });
    const preview = mount(Preview, {
      global: {
        plugins: [store],
      },
    });
    const toc = document.createElement('div');
    editorSvc.init(
      editor.find('.editor__inner').element,
      preview.find('.preview__inner-2').element,
      toc,
    );

    await nextTick();
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(preview.find('.preview__inner-2 strong').text()).toBe('Before');
    expect(preview.find('.preview__inner-2 iframe').exists()).toBe(false);

    const editorElement = editor.find('.editor__inner').element;
    editorElement.textContent = '**After**\n';
    editorElement.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
    }));
    await new Promise(resolve => setTimeout(resolve, 80));

    expect(store.getters['content/current'].text).toBe('**After**\n');
    expect(preview.find('.preview__inner-2 strong').text()).toBe('After');
    editor.unmount();
    preview.unmount();
  });
});
