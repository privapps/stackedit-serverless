import { flushPromises } from '@vue/test-utils';
import WorkspaceSearchPanel from '../../../../src/components/WorkspaceSearchPanel';
import editorSvc from '../../../../src/services/editorSvc';
import localDbSvc from '../../../../src/services/localDbSvc';
import workspaceSearchSvc from '../../../../src/services/workspaceSearchSvc';
import workspaceSvc from '../../../../src/services/workspaceSvc';
import store from '../../../../src/store';
import specUtils from '../specUtils';

const deferred = () => {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const makeResult = (fileId, name) => ({
  workspaceId: store.getters['workspace/currentWorkspace'].id,
  fileId,
  name,
  folderPath: '',
  nameMatch: null,
  contentMatch: null,
  snippet: null,
  query: name,
  caseSensitive: false,
});

const submit = async (wrapper, query) => {
  wrapper.vm.query = query;
  await wrapper.vm.submit();
  await flushPromises();
};

describe('WorkspaceSearchPanel.vue', () => {
  it('keeps empty searches initial and validates when both fields are disabled', async () => {
    const searchWorkspace = vi.spyOn(workspaceSearchSvc, 'searchWorkspace');
    const wrapper = specUtils.shallowMount(WorkspaceSearchPanel);

    await submit(wrapper, '');
    expect(wrapper.find('.workspace-search__status').text())
      .toContain('Search document names and content');
    expect(searchWorkspace).not.toHaveBeenCalled();

    wrapper.vm.searchName = false;
    wrapper.vm.searchContent = false;
    await submit(wrapper, 'needle');
    expect(wrapper.get('[role="alert"]').text()).toContain('Select Name or Content');
    expect(searchWorkspace).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('cancels obsolete scans so late results cannot replace the latest query', async () => {
    const olderScan = deferred();
    const newerScan = deferred();
    const cancelOlder = vi.fn();
    const searchWorkspace = vi.spyOn(workspaceSearchSvc, 'searchWorkspace')
      .mockReturnValueOnce({ promise: olderScan.promise, cancel: cancelOlder })
      .mockReturnValueOnce({ promise: newerScan.promise, cancel: vi.fn() });
    const wrapper = specUtils.shallowMount(WorkspaceSearchPanel);

    wrapper.vm.query = 'older query';
    const olderSubmission = wrapper.vm.submit();
    await flushPromises();
    wrapper.vm.query = 'newer query';
    const newerSubmission = wrapper.vm.submit();
    await flushPromises();
    expect(searchWorkspace).toHaveBeenCalledTimes(2);
    expect(cancelOlder).toHaveBeenCalledTimes(1);

    newerScan.resolve([makeResult('new-result', 'newer query')]);
    await newerSubmission;
    olderScan.resolve([makeResult('old-result', 'older query')]);
    await olderSubmission;

    expect(wrapper.findAll('.workspace-search__result-name').map(result => result.text()))
      .toEqual(['newer query']);
    wrapper.unmount();
  });

  it('abandons a pending result activation when a newer search is submitted', async () => {
    const previousFileId = store.state.file.currentId;
    const file = await workspaceSvc.createFile({
      name: 'pending-activation.md',
      text: 'needle in the document',
    }, true);
    const contentId = `${file.id}/content`;
    const contentRead = deferred();
    const loadItem = vi.spyOn(localDbSvc, 'loadItem').mockReturnValue(contentRead.promise);
    const searchWorkspace = vi.spyOn(workspaceSearchSvc, 'searchWorkspace').mockReturnValue({
      promise: Promise.resolve([]),
      cancel: vi.fn(),
    });
    const selectTextRange = vi.spyOn(editorSvc, 'selectTextRange').mockImplementation(() => {});
    const previousEditor = editorSvc.clEditor;
    const wrapper = specUtils.shallowMount(WorkspaceSearchPanel);

    try {
      store.commit('content/deleteItem', contentId);
      editorSvc.clEditor = { getContent: () => 'needle in the document\n' };
      const activation = wrapper.vm.activateResult({
        ...makeResult(file.id, 'needle'),
        contentMatch: { start: 0, end: 6 },
      });
      await flushPromises();

      wrapper.vm.query = 'new query';
      await wrapper.vm.submit();
      contentRead.resolve({ id: contentId, text: 'needle in the document' });
      await activation;

      expect(loadItem).toHaveBeenCalledWith(contentId);
      expect(searchWorkspace).toHaveBeenCalledTimes(1);
      expect(store.state.file.currentId).toBe(previousFileId);
    } finally {
      editorSvc.clEditor = previousEditor;
      wrapper.unmount();
      loadItem.mockRestore();
      searchWorkspace.mockRestore();
      selectTextRange.mockRestore();
      workspaceSvc.deleteFile(file.id);
    }
  });

  it('abandons a pending result activation when the workspace changes during content loading', async () => {
    const previousFileId = store.state.file.currentId;
    const currentWorkspace = store.getters['workspace/currentWorkspace'];
    const { id: currentWorkspaceId, ...workspaceSettings } = currentWorkspace;
    const otherWorkspaceId = `workspace-search-activation-${Date.now()}`;
    store.commit('data/setItem', {
      id: 'workspaces',
      data: {
        ...store.getters['data/workspaces'],
        [otherWorkspaceId]: workspaceSettings,
      },
    });
    const file = await workspaceSvc.createFile({
      name: 'workspace-change-activation.md',
      text: 'needle in the document',
    }, true);
    const contentId = `${file.id}/content`;
    const contentRead = deferred();
    const loadItem = vi.spyOn(localDbSvc, 'loadItem').mockReturnValue(contentRead.promise);
    const selectTextRange = vi.spyOn(editorSvc, 'selectTextRange').mockImplementation(() => {});
    const previousEditor = editorSvc.clEditor;
    const wrapper = specUtils.shallowMount(WorkspaceSearchPanel);

    try {
      store.commit('content/deleteItem', contentId);
      editorSvc.clEditor = { getContent: () => 'needle in the document\n' };
      const activation = wrapper.vm.activateResult({
        ...makeResult(file.id, 'needle'),
        contentMatch: { start: 0, end: 6 },
      });
      await flushPromises();

      store.commit('workspace/setCurrentWorkspaceId', otherWorkspaceId);
      await flushPromises();
      contentRead.resolve({ id: contentId, text: 'needle in the document' });
      await activation;

      expect(store.getters['workspace/currentWorkspace'].id).toBe(otherWorkspaceId);
      expect(store.state.file.currentId).toBe(previousFileId);
      expect(selectTextRange).not.toHaveBeenCalled();
      expect(wrapper.findAll('.workspace-search__result')).toHaveLength(0);
    } finally {
      store.commit('workspace/setCurrentWorkspaceId', currentWorkspaceId);
      const workspaces = { ...store.getters['data/workspaces'] };
      delete workspaces[otherWorkspaceId];
      store.commit('data/setItem', { id: 'workspaces', data: workspaces });
      editorSvc.clEditor = previousEditor;
      wrapper.unmount();
      loadItem.mockRestore();
      selectTextRange.mockRestore();
      workspaceSvc.deleteFile(file.id);
      if (store.state.file.currentId === file.id) {
        store.commit('file/setCurrentId', previousFileId);
      }
    }
  });

  it.each(['removed', 'moved to Trash', 'content changed'])(
    'reports a result stale when its document is %s during content loading',
    async (change) => {
      const previousFileId = store.state.file.currentId;
      const file = await workspaceSvc.createFile({
        name: 'stale-activation.md',
        text: 'needle in the document',
      }, true);
      const contentId = `${file.id}/content`;
      const contentRead = deferred();
      const loadItem = vi.spyOn(localDbSvc, 'loadItem').mockReturnValue(contentRead.promise);
      const selectTextRange = vi.spyOn(editorSvc, 'selectTextRange').mockImplementation(() => {});
      const previousEditor = editorSvc.clEditor;
      const wrapper = specUtils.shallowMount(WorkspaceSearchPanel);

      try {
        store.commit('content/deleteItem', contentId);
        editorSvc.clEditor = { getContent: () => 'needle in the document\n' };
        const activation = wrapper.vm.activateResult({
          ...makeResult(file.id, 'needle'),
          contentMatch: { start: 0, end: 6 },
        });
        await flushPromises();

        if (change === 'removed') {
          store.commit('file/deleteItem', file.id);
        } else if (change === 'moved to Trash') {
          store.commit('file/patchItem', { id: file.id, parentId: 'trash' });
        }
        contentRead.resolve({
          id: contentId,
          text: change === 'content changed'
            ? 'the searched text has been removed'
            : 'needle in the document',
        });
        await activation;

        expect(loadItem).toHaveBeenCalledWith(contentId);
        expect(store.state.file.currentId).toBe(previousFileId);
        expect(wrapper.get('[role="alert"]').text())
          .toContain('This result has changed');
        expect(selectTextRange).not.toHaveBeenCalled();
      } finally {
        editorSvc.clEditor = previousEditor;
        wrapper.unmount();
        loadItem.mockRestore();
        selectTextRange.mockRestore();
        workspaceSvc.deleteFile(file.id);
        if (store.state.file.currentId === file.id) {
          store.commit('file/setCurrentId', previousFileId);
        }
      }
    },
  );

  it('does not select a result moved to Trash while waiting for editor content', async () => {
    const file = await workspaceSvc.createFile({
      name: 'stale-editor-wait.md',
      text: 'needle in the document',
    }, true);
    const previousEditor = editorSvc.clEditor;
    const selectTextRange = vi.spyOn(editorSvc, 'selectTextRange').mockImplementation(() => {});
    const wrapper = specUtils.shallowMount(WorkspaceSearchPanel);
    const editorWait = deferred();
    const waitForEditorContent = vi.spyOn(wrapper.vm, 'waitForEditorContent')
      .mockReturnValue(editorWait.promise);

    try {
      const activation = wrapper.vm.activateResult({
        ...makeResult(file.id, 'needle'),
        contentMatch: { start: 0, end: 6 },
      });
      await flushPromises();
      expect(store.state.file.currentId).toBe(file.id);

      store.commit('file/patchItem', { id: file.id, parentId: 'trash' });
      editorWait.resolve(true);
      await activation;

      expect(selectTextRange).not.toHaveBeenCalled();
      expect(wrapper.get('[role="alert"]').text()).toContain('This result has changed');
    } finally {
      editorSvc.clEditor = previousEditor;
      wrapper.unmount();
      waitForEditorContent.mockRestore();
      selectTextRange.mockRestore();
      workspaceSvc.deleteFile(file.id);
    }
  });

  it.each([
    ['moves', 'prefix needle is still here', [7, 13]],
    ['removes', 'the searched text is gone', null],
  ])('revalidates a content result when its text %s while waiting for editor content', async (
    change,
    updatedText,
    expectedRange,
  ) => {
    const previousFileId = store.state.file.currentId;
    const file = await workspaceSvc.createFile({
      name: 'stale-editor-content.md',
      text: 'needle in the document',
    }, true);
    let editorText = 'needle in the document\n';
    const previousEditor = editorSvc.clEditor;
    const selectTextRange = vi.spyOn(editorSvc, 'selectTextRange').mockImplementation(() => {});
    const wrapper = specUtils.shallowMount(WorkspaceSearchPanel);
    const editorWait = deferred();
    const waitForEditorContent = vi.spyOn(wrapper.vm, 'waitForEditorContent')
      .mockReturnValue(editorWait.promise);

    try {
      editorSvc.clEditor = { getContent: () => editorText };
      const activation = wrapper.vm.activateResult({
        ...makeResult(file.id, 'needle'),
        contentMatch: { start: 0, end: 6 },
      });
      await flushPromises();
      expect(store.state.file.currentId).toBe(file.id);

      editorText = `${updatedText}\n`;
      editorWait.resolve(true);
      await activation;

      if (expectedRange) {
        expect(selectTextRange).toHaveBeenCalledWith(...expectedRange);
      } else {
        expect(selectTextRange).not.toHaveBeenCalled();
        expect(wrapper.get('[role="alert"]').text())
          .toContain('This result has changed');
      }
    } finally {
      editorSvc.clEditor = previousEditor;
      wrapper.unmount();
      waitForEditorContent.mockRestore();
      selectTextRange.mockRestore();
      workspaceSvc.deleteFile(file.id);
      if (store.state.file.currentId === file.id) {
        store.commit('file/setCurrentId', previousFileId);
      }
    }
  });

  it('reports the result stale when editor content does not become ready', async () => {
    const previousFileId = store.state.file.currentId;
    const file = await workspaceSvc.createFile({
      name: 'unready-editor-content.md',
      text: 'needle in the document',
    }, true);
    const previousEditor = editorSvc.clEditor;
    const selectTextRange = vi.spyOn(editorSvc, 'selectTextRange').mockImplementation(() => {});
    const wrapper = specUtils.shallowMount(WorkspaceSearchPanel);
    const waitForEditorContent = vi.spyOn(wrapper.vm, 'waitForEditorContent')
      .mockResolvedValue(false);

    try {
      editorSvc.clEditor = { getContent: () => 'needle in the document\n' };
      await wrapper.vm.activateResult({
        ...makeResult(file.id, 'needle'),
        contentMatch: { start: 0, end: 6 },
      });

      expect(selectTextRange).not.toHaveBeenCalled();
      expect(wrapper.get('[role="alert"]').text()).toContain('This result has changed');
    } finally {
      editorSvc.clEditor = previousEditor;
      wrapper.unmount();
      waitForEditorContent.mockRestore();
      selectTextRange.mockRestore();
      workspaceSvc.deleteFile(file.id);
      if (store.state.file.currentId === file.id) {
        store.commit('file/setCurrentId', previousFileId);
      }
    }
  });

  it('keeps the popup in place when selected results do not overlap it', () => {
    let selectionRect = { left: 100, right: 200, top: 700, bottom: 720, height: 20 };
    const selection = {
      rangeCount: 1,
      getRangeAt: () => ({ getBoundingClientRect: () => selectionRect }),
    };
    const getSelection = vi.spyOn(window, 'getSelection').mockReturnValue(selection);
    const wrapper = specUtils.shallowMount(WorkspaceSearchPanel);
    const popup = wrapper.find('.workspace-search').element;
    const getPopupRect = vi.spyOn(popup, 'getBoundingClientRect').mockReturnValue({
      left: 1000,
      right: 1360,
      top: 42,
      bottom: 432,
      height: 390,
    });

    try {
      wrapper.vm.placePanelAwayFromSelection();
      expect(wrapper.vm.panelPlacement).toBe('initial');

      selectionRect = { left: 100, right: 200, top: 58, bottom: 78, height: 20 };
      wrapper.vm.placePanelAwayFromSelection();
      expect(wrapper.vm.panelPlacement).toBe('initial');
    } finally {
      getPopupRect.mockRestore();
      getSelection.mockRestore();
      wrapper.unmount();
    }
  });

  it('constrains the popup when both placements would cover the selected match', async () => {
    const selection = {
      rangeCount: 1,
      getRangeAt: () => ({
        getBoundingClientRect: () => ({
          left: 850,
          right: 900,
          top: 430,
          bottom: 450,
          height: 20,
        }),
      }),
    };
    const getSelection = vi.spyOn(window, 'getSelection').mockReturnValue(selection);
    const innerWidth = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1200);
    const innerHeight = vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(905);
    const wrapper = specUtils.shallowMount(WorkspaceSearchPanel);
    const popup = wrapper.find('.workspace-search').element;
    const getPopupRect = vi.spyOn(popup, 'getBoundingClientRect').mockReturnValue({
      left: 800,
      right: 1160,
      top: 42,
      bottom: 527,
      height: 485,
    });

    try {
      wrapper.vm.placePanelAwayFromSelection();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.panelPlacement).toBe('bottom');
      expect(wrapper.vm.panelMaxHeight).toBe('443px');
      expect(popup.style.maxHeight).toBe('443px');
    } finally {
      getPopupRect.mockRestore();
      wrapper.unmount();
      innerHeight.mockRestore();
      innerWidth.mockRestore();
      getSelection.mockRestore();
    }
  });

  it('recalculates a constrained popup after the viewport shrinks', async () => {
    const selection = {
      rangeCount: 1,
      getRangeAt: () => ({
        getBoundingClientRect: () => {
          const isMobile = window.innerWidth <= 1059;
          return {
            left: isMobile ? 100 : 850,
            right: isMobile ? 200 : 900,
            top: isMobile ? 250 : 430,
            bottom: isMobile ? 270 : 450,
            height: 20,
          };
        },
      }),
    };
    const getSelection = vi.spyOn(window, 'getSelection').mockReturnValue(selection);
    const innerWidth = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1200);
    const innerHeight = vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(905);
    const wrapper = specUtils.shallowMount(WorkspaceSearchPanel);
    const popup = wrapper.find('.workspace-search').element;
    const getPopupRect = vi.spyOn(popup, 'getBoundingClientRect').mockImplementation(() => {
      const isMobile = window.innerWidth <= 1059;
      const topMargin = isMobile ? 8 : 42;
      const bottomMargin = isMobile ? 8 : 12;
      const maxHeight = Math.min(
        window.innerHeight * (isMobile ? 0.45 : 0.55) - 12,
        window.innerHeight - 24,
      );
      const height = popup.style.maxHeight ? parseFloat(popup.style.maxHeight) : maxHeight;
      const isTop = wrapper.vm.panelPlacement === 'top'
        || (wrapper.vm.panelPlacement === 'initial' && !isMobile);
      const top = isTop ? topMargin : window.innerHeight - bottomMargin - height;
      return {
        left: isMobile ? 8 : 800,
        right: isMobile ? 382 : 1160,
        top,
        bottom: top + height,
        height,
      };
    });

    try {
      wrapper.vm.placePanelAwayFromSelection();
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.panelMaxHeight).toBe('443px');

      innerWidth.mockReturnValue(390);
      innerHeight.mockReturnValue(390);
      window.dispatchEvent(new Event('resize'));
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();

      expect(popup.style.maxHeight).toBe('');
      expect(wrapper.vm.panelPlacement).toBe('top');
      const resizedPanel = popup.getBoundingClientRect();
      expect(resizedPanel.top).toBeGreaterThanOrEqual(0);
      expect(resizedPanel.bottom).toBeLessThanOrEqual(390);
      expect(resizedPanel.bottom).toBeLessThanOrEqual(250);
    } finally {
      getPopupRect.mockRestore();
      wrapper.unmount();
      innerHeight.mockRestore();
      innerWidth.mockRestore();
      getSelection.mockRestore();
    }
  });

  it('closes with Escape after result activation moves focus into the editor', async () => {
    const file = await workspaceSvc.createFile({
      name: 'escape-after-activation.md',
      text: 'needle in the document',
    }, true);
    const editor = document.createElement('textarea');
    document.body.appendChild(editor);
    const previousEditor = editorSvc.clEditor;
    const selectTextRange = vi.spyOn(editorSvc, 'selectTextRange').mockImplementation(() => {
      editor.focus();
    });
    editorSvc.clEditor = { getContent: () => 'needle in the document\n' };
    const wrapper = specUtils.shallowMount(WorkspaceSearchPanel);
    const result = {
      ...makeResult(file.id, 'needle'),
      contentMatch: { start: 0, end: 6 },
    };
    wrapper.vm.results = [result];

    try {
      await wrapper.vm.activateResult(result);
      expect(document.activeElement).toBe(editor);
      expect(wrapper.find('.workspace-search__result').attributes('aria-current')).toBe('true');

      editor.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }));

      expect(wrapper.vm.isOpen).toBe(false);
      expect(wrapper.emitted('close')).toHaveLength(1);
    } finally {
      editorSvc.clEditor = previousEditor;
      wrapper.unmount();
      selectTextRange.mockRestore();
      editor.remove();
      workspaceSvc.deleteFile(file.id);
    }
  });

  it('cancels a scan and clears results when closed or when the workspace changes', async () => {
    const closeScan = deferred();
    const cancelCloseScan = vi.fn();
    const searchWorkspace = vi.spyOn(workspaceSearchSvc, 'searchWorkspace')
      .mockReturnValueOnce({ promise: closeScan.promise, cancel: cancelCloseScan });
    const closeWrapper = specUtils.shallowMount(WorkspaceSearchPanel);

    closeWrapper.vm.query = 'close while searching';
    const closeSubmission = closeWrapper.vm.submit();
    await flushPromises();
    await closeWrapper.find('.workspace-search__actions button:nth-child(3)').trigger('click');
    expect(cancelCloseScan).toHaveBeenCalledTimes(1);
    expect(closeWrapper.emitted('close')).toHaveLength(1);
    closeScan.resolve([makeResult('late-close-result', 'late close result')]);
    await closeSubmission;
    expect(closeWrapper.findAll('.workspace-search__result')).toHaveLength(0);
    closeWrapper.unmount();

    const workspaceScan = deferred();
    const cancelWorkspaceScan = vi.fn();
    searchWorkspace.mockReturnValueOnce({
      promise: workspaceScan.promise,
      cancel: cancelWorkspaceScan,
    });
    const workspaceWrapper = specUtils.shallowMount(WorkspaceSearchPanel);
    workspaceWrapper.vm.query = 'workspace changes';
    const workspaceSubmission = workspaceWrapper.vm.submit();
    await flushPromises();

    const currentWorkspace = store.getters['workspace/currentWorkspace'];
    const { id: currentId, ...workspaceSettings } = currentWorkspace;
    const otherWorkspaceId = 'workspace-search-component-test';
    store.commit('data/setItem', {
      id: 'workspaces',
      data: {
        ...store.getters['data/workspaces'],
        [otherWorkspaceId]: workspaceSettings,
      },
    });
    store.commit('workspace/setCurrentWorkspaceId', otherWorkspaceId);
    await flushPromises();
    await workspaceWrapper.vm.$nextTick();

    expect(currentId).not.toBe(otherWorkspaceId);
    expect(cancelWorkspaceScan).toHaveBeenCalledTimes(1);
    expect(workspaceWrapper.find('.workspace-search__status').text())
      .toContain('Search document names and content');
    workspaceScan.resolve([makeResult('late-workspace-result', 'late workspace result')]);
    await workspaceSubmission;
    expect(workspaceWrapper.findAll('.workspace-search__result')).toHaveLength(0);
    workspaceWrapper.unmount();
  });

  it('shows database failures instead of reporting an empty result', async () => {
    vi.spyOn(workspaceSearchSvc, 'searchWorkspace').mockReturnValue({
      promise: Promise.reject(new Error('IndexedDB unavailable')),
      cancel: vi.fn(),
    });
    const wrapper = specUtils.shallowMount(WorkspaceSearchPanel);
    wrapper.vm.query = 'needle';

    await wrapper.vm.submit();

    expect(wrapper.get('[role="alert"]').text())
      .toContain('Workspace search failed: IndexedDB unavailable');
    expect(wrapper.findAll('.workspace-search__result')).toHaveLength(0);
    wrapper.unmount();
  });
});
