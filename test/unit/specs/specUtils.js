import { enableAutoUnmount, shallowMount } from '@vue/test-utils';
import store from '../../../src/store';
import utils from '../../../src/services/utils';
import '../../../src/icons';
import '../../../src/components/common/vueGlobals';

const clone = object => JSON.parse(JSON.stringify(object));

const deepAssign = (target, origin) => {
  Object.entries(origin).forEach(([key, value]) => {
    const type = Object.prototype.toString.call(value);
    if (type === '[object Object]' && Object.keys(value).length) {
      deepAssign(target[key], value);
    } else {
      target[key] = value;
    }
  });
};

const freshState = clone(store.state);

enableAutoUnmount(afterEach);

beforeEach(() => {
  // Restore store state before each test
  deepAssign(store.state, clone(freshState));
});

export default {
  async checkToggler(Component, toggler, checker) {
    const wrapper = this.shallowMount(Component);
    const valueBefore = checker();
    toggler(wrapper);
    const valueAfter = checker();
    expect(valueAfter).toEqual(!valueBefore);
    expect(store.state.data.lsItemsById.badgeCreations).toBeUndefined();
  },
  async resolveModal(type) {
    const config = store.getters['modal/config'];
    expect(config).toBeTruthy();
    expect(config.type).toEqual(type);
    config.resolve();
    await new Promise(resolve => setTimeout(resolve, 1));
  },
  getContextMenuItem(name) {
    return utils.someResult(store.state.contextMenu.items, item => item.name === name && item);
  },
  async resolveContextMenu(name) {
    const item = this.getContextMenuItem(name);
    expect(item).toBeTruthy();
    store.state.contextMenu.resolve(item);
    await new Promise(resolve => setTimeout(resolve, 1));
  },
  shallowMount(Component, options = {}) {
    const plugins = options.global && options.global.plugins || [];
    return shallowMount(Component, {
      ...options,
      global: {
        ...options.global,
        plugins: [...plugins, store],
      },
    });
  },
};
