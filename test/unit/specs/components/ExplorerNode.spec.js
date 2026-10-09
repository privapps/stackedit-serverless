import { nextTick } from 'vue';
import ExplorerNode from '../../../../src/components/ExplorerNode';
import store from '../../../../src/store';
import workspaceSvc from '../../../../src/services/workspaceSvc';
import explorerSvc from '../../../../src/services/explorerSvc';
import specUtils from '../specUtils';

const makeFileNode = async () => {
  const file = await workspaceSvc.createFile({}, true);
  const node = store.getters['explorer/nodeMap'][file.id];
  expect(node.item.id).toEqual(file.id);
  return node;
};

const makeFolderNode = async () => {
  const folder = await workspaceSvc.storeItem({ type: 'folder' });
  const node = store.getters['explorer/nodeMap'][folder.id];
  expect(node.item.id).toEqual(folder.id);
  return node;
};

const mount = node => specUtils.shallowMount(ExplorerNode, {
  props: { node, depth: 1 },
});
const mountAndSelect = async (node) => {
  const wrapper = mount(node);
  await wrapper.find('.explorer-node__item').trigger('click');
  await nextTick();
  expect(store.getters['explorer/selectedNode'].item.id).toEqual(node.item.id);
  expect(wrapper.classes()).toContain('explorer-node--selected');
  return wrapper;
};

const dragAndDrop = async (sourceItem, targetItem) => {
  const sourceNode = store.getters['explorer/nodeMap'][sourceItem.id];
  const sourceWrapper = await mountAndSelect(sourceNode);
  await sourceWrapper.find('.explorer-node__item').trigger('dragstart', {
    dataTransfer: { setData: () => {} },
  });
  expect(store.state.explorer.dragSourceId).toEqual(sourceItem.id);
  const targetNode = store.getters['explorer/nodeMap'][targetItem.id];
  const wrapper = mount(targetNode);
  await wrapper.trigger('dragenter');
  expect(store.state.explorer.dragTargetId).toEqual(targetItem.id);
  await wrapper.trigger('drop');
  const expectedParentId = targetItem.type === 'file' ? targetItem.parentId : targetItem.id;
  expect(store.getters['explorer/selectedNode'].item.parentId).toEqual(expectedParentId);
};

describe('ExplorerNode.vue', () => {
  const modifiedName = 'Name';

  it('should open file on select after a timeout', async () => {
    const node = await makeFileNode();
    await mountAndSelect(node);
    expect(store.getters['file/current'].id).not.toEqual(node.item.id);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(store.getters['file/current'].id).toEqual(node.item.id);
    await specUtils.expectBadge('switchFile');
  });

  it('should not open already open file', async () => {
    const node = await makeFileNode();
    store.commit('file/setCurrentId', node.item.id);
    await mountAndSelect(node);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(store.getters['file/current'].id).toEqual(node.item.id);
    await specUtils.expectBadge('switchFile', false);
  });

  it('should open folder on select after a timeout', async () => {
    const node = await makeFolderNode();
    const wrapper = await mountAndSelect(node);
    expect(wrapper.classes()).not.toContain('explorer-node--open');
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(wrapper.classes()).toContain('explorer-node--open');
  });

  it('should open folder on new child', async () => {
    const node = await makeFolderNode();
    const wrapper = await mountAndSelect(node);
    // Close the folder
    await wrapper.find('.explorer-node__item').trigger('click');
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(wrapper.classes()).not.toContain('explorer-node--open');
    explorerSvc.newItem();
    await nextTick();
    expect(wrapper.classes()).toContain('explorer-node--open');
  });

  it('should create new file in a folder', async () => {
    const node = await makeFolderNode();
    const wrapper = mount(node);
    await wrapper.trigger('contextmenu');
    await specUtils.resolveContextMenu('New file');
    await nextTick();
    expect(wrapper.find('.explorer-node__new-child').exists()).toBe(true);
    store.commit('explorer/setNewItemName', modifiedName);
    await wrapper.find('.explorer-node__new-child .text-input').trigger('blur');
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(store.getters['explorer/selectedNode'].item).toMatchObject({
      name: modifiedName,
      type: 'file',
      parentId: node.item.id,
    });
    expect(wrapper.find('.explorer-node__new-child').exists()).toBe(false);
    await specUtils.expectBadge('createFile');
  });

  it('should cancel file creation on escape', async () => {
    const node = await makeFolderNode();
    const wrapper = mount(node);
    await wrapper.trigger('contextmenu');
    await specUtils.resolveContextMenu('New file');
    await nextTick();
    expect(wrapper.find('.explorer-node__new-child').exists()).toBe(true);
    store.commit('explorer/setNewItemName', modifiedName);
    await wrapper.find('.explorer-node__new-child .text-input').trigger('keydown', {
      key: 'Escape',
    });
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(store.getters['explorer/selectedNode'].item).not.toMatchObject({
      name: 'modifiedName',
      type: 'file',
      parentId: node.item.id,
    });
    expect(wrapper.find('.explorer-node__new-child').exists()).toBe(false);
    await specUtils.expectBadge('createFile', false);
  });

  it('should not create new file in a file', async () => {
    const node = await makeFileNode();
    await mount(node).trigger('contextmenu');
    expect(specUtils.getContextMenuItem('New file').disabled).toBe(true);
  });

  it('should not create new file in the trash folder', async () => {
    const node = store.getters['explorer/nodeMap'].trash;
    await mount(node).trigger('contextmenu');
    expect(specUtils.getContextMenuItem('New file').disabled).toBe(true);
  });

  it('should create new folder in folder', async () => {
    const node = await makeFolderNode();
    const wrapper = mount(node);
    await wrapper.trigger('contextmenu');
    await specUtils.resolveContextMenu('New folder');
    await nextTick();
    expect(wrapper.find('.explorer-node__new-child--folder').exists()).toBe(true);
    store.commit('explorer/setNewItemName', modifiedName);
    await wrapper.find('.explorer-node__new-child--folder .text-input').trigger('blur');
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(store.getters['explorer/selectedNode'].item).toMatchObject({
      name: modifiedName,
      type: 'folder',
      parentId: node.item.id,
    });
    expect(wrapper.find('.explorer-node__new-child--folder').exists()).toBe(false);
    await specUtils.expectBadge('createFolder');
  });

  it('should cancel folder creation on escape', async () => {
    const node = await makeFolderNode();
    const wrapper = mount(node);
    await wrapper.trigger('contextmenu');
    await specUtils.resolveContextMenu('New folder');
    await nextTick();
    expect(wrapper.find('.explorer-node__new-child--folder').exists()).toBe(true);
    store.commit('explorer/setNewItemName', modifiedName);
    await wrapper.find('.explorer-node__new-child--folder .text-input').trigger('keydown', {
      key: 'Escape',
    });
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(store.getters['explorer/selectedNode'].item).not.toMatchObject({
      name: modifiedName,
      type: 'folder',
      parentId: node.item.id,
    });
    expect(wrapper.find('.explorer-node__new-child--folder').exists()).toBe(false);
    await specUtils.expectBadge('createFolder', false);
  });

  it('should not create new folder in a file', async () => {
    const node = await makeFileNode();
    await mount(node).trigger('contextmenu');
    expect(specUtils.getContextMenuItem('New folder').disabled).toBe(true);
  });

  it('should not create new folder in the trash folder', async () => {
    const node = store.getters['explorer/nodeMap'].trash;
    await mount(node).trigger('contextmenu');
    expect(specUtils.getContextMenuItem('New folder').disabled).toBe(true);
  });

  it('should not create new folder in the temp folder', async () => {
    const node = store.getters['explorer/nodeMap'].temp;
    await mount(node).trigger('contextmenu');
    expect(specUtils.getContextMenuItem('New folder').disabled).toBe(true);
  });

  it('should rename file', async () => {
    const node = await makeFileNode();
    const wrapper = mount(node);
    await wrapper.trigger('contextmenu');
    await specUtils.resolveContextMenu('Rename');
    await nextTick();
    expect(wrapper.find('.explorer-node__item-editor').exists()).toBe(true);
    await wrapper.setData({ editingValue: modifiedName });
    await wrapper.find('.explorer-node__item-editor .text-input').trigger('blur');
    expect(store.getters['explorer/selectedNode'].item.name).toEqual(modifiedName);
    await specUtils.expectBadge('renameFile');
  });

  it('should cancel rename file on escape', async () => {
    const node = await makeFileNode();
    const wrapper = mount(node);
    await wrapper.trigger('contextmenu');
    await specUtils.resolveContextMenu('Rename');
    await nextTick();
    expect(wrapper.find('.explorer-node__item-editor').exists()).toBe(true);
    await wrapper.setData({ editingValue: modifiedName });
    await wrapper.find('.explorer-node__item-editor .text-input').trigger('keydown', {
      key: 'Escape',
    });
    expect(store.getters['explorer/selectedNode'].item.name).not.toEqual(modifiedName);
    await specUtils.expectBadge('renameFile', false);
  });

  it('should rename folder', async () => {
    const node = await makeFolderNode();
    const wrapper = mount(node);
    await wrapper.trigger('contextmenu');
    await specUtils.resolveContextMenu('Rename');
    await nextTick();
    expect(wrapper.find('.explorer-node__item-editor').exists()).toBe(true);
    await wrapper.setData({ editingValue: modifiedName });
    await wrapper.find('.explorer-node__item-editor .text-input').trigger('blur');
    expect(store.getters['explorer/selectedNode'].item.name).toEqual(modifiedName);
    await specUtils.expectBadge('renameFolder');
  });

  it('should cancel rename folder on escape', async () => {
    const node = await makeFolderNode();
    const wrapper = mount(node);
    await wrapper.trigger('contextmenu');
    await specUtils.resolveContextMenu('Rename');
    await nextTick();
    expect(wrapper.find('.explorer-node__item-editor').exists()).toBe(true);
    await wrapper.setData({ editingValue: modifiedName });
    await wrapper.find('.explorer-node__item-editor .text-input').trigger('keydown', {
      key: 'Escape',
    });
    expect(store.getters['explorer/selectedNode'].item.name).not.toEqual(modifiedName);
    await specUtils.expectBadge('renameFolder', false);
  });

  it('should not rename the trash folder', async () => {
    const node = store.getters['explorer/nodeMap'].trash;
    await mount(node).trigger('contextmenu');
    expect(specUtils.getContextMenuItem('Rename').disabled).toBe(true);
  });

  it('should not rename the temp folder', async () => {
    const node = store.getters['explorer/nodeMap'].temp;
    await mount(node).trigger('contextmenu');
    expect(specUtils.getContextMenuItem('Rename').disabled).toBe(true);
  });

  it('should move file into a folder', async () => {
    const sourceItem = await workspaceSvc.createFile({}, true);
    const targetItem = await workspaceSvc.storeItem({ type: 'folder' });
    await dragAndDrop(sourceItem, targetItem);
    await specUtils.expectBadge('moveFile');
  });

  it('should move folder into a folder', async () => {
    const sourceItem = await workspaceSvc.storeItem({ type: 'folder' });
    const targetItem = await workspaceSvc.storeItem({ type: 'folder' });
    await dragAndDrop(sourceItem, targetItem);
    await specUtils.expectBadge('moveFolder');
  });

  it('should move file into a file parent folder', async () => {
    const targetItem = await workspaceSvc.storeItem({ type: 'folder' });
    const file = await workspaceSvc.createFile({ parentId: targetItem.id }, true);
    const sourceItem = await workspaceSvc.createFile({}, true);
    await dragAndDrop(sourceItem, file);
    await specUtils.expectBadge('moveFile');
  });

  it('should not move the trash folder', async () => {
    const sourceNode = store.getters['explorer/nodeMap'].trash;
    const wrapper = await mountAndSelect(sourceNode);
    await wrapper.find('.explorer-node__item').trigger('dragstart');
    expect(store.state.explorer.dragSourceId).not.toEqual('trash');
  });

  it('should not move the temp folder', async () => {
    const sourceNode = store.getters['explorer/nodeMap'].temp;
    const wrapper = await mountAndSelect(sourceNode);
    await wrapper.find('.explorer-node__item').trigger('dragstart');
    expect(store.state.explorer.dragSourceId).not.toEqual('temp');
  });

  it('should not move file to the temp folder', async () => {
    const targetNode = store.getters['explorer/nodeMap'].temp;
    const wrapper = mount(targetNode);
    await wrapper.trigger('dragenter');
    expect(store.state.explorer.dragTargetId).not.toEqual('temp');
  });

  it('should not move file to a file in the temp folder', async () => {
    const file = await workspaceSvc.createFile({ parentId: 'temp' }, true);
    const targetNode = store.getters['explorer/nodeMap'][file.id];
    const wrapper = mount(targetNode);
    await wrapper.trigger('dragenter');
    expect(store.state.explorer.dragTargetId).not.toEqual(file.id);
  });
});
