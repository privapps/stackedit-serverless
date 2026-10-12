import Vue from 'vue';
import yaml from 'js-yaml';
import utils from '../services/utils';
import defaultWorkspaces from '../data/defaults/defaultWorkspaces';
import defaultSettings from '../data/defaults/defaultSettings.yml';
import defaultLocalSettings from '../data/defaults/defaultLocalSettings';
import defaultLayoutSettings from '../data/defaults/defaultLayoutSettings';
import constants from '../data/constants';

const itemTemplate = (id, data = {}) => ({
  id,
  type: 'data',
  data,
  hash: 0,
});

const empty = (id) => {
  switch (id) {
    case 'workspaces':
      return itemTemplate(id, defaultWorkspaces());
    case 'settings':
      return itemTemplate(id, '\n');
    case 'localSettings':
      return itemTemplate(id, defaultLocalSettings());
    case 'layoutSettings':
      return itemTemplate(id, defaultLayoutSettings());
    default:
      return itemTemplate(id);
  }
};

// Item IDs that will be stored in the localStorage
const localStorageIdSet = new Set(constants.localStorageDataIds);

// Getter/setter/patcher factories
const getter = id => (state) => {
  const itemsById = localStorageIdSet.has(id)
    ? state.lsItemsById
    : state.itemsById;
  if (itemsById[id]) {
    return itemsById[id].data;
  }
  return empty(id).data;
};
const setter = id => ({ commit }, data) => commit('setItem', itemTemplate(id, data));
const patcher = id => ({ state, commit }, data) => {
  const itemsById = localStorageIdSet.has(id)
    ? state.lsItemsById
    : state.itemsById;
  const item = Object.assign(empty(id), itemsById[id]);
  commit('setItem', {
    ...empty(id),
    data: typeof data === 'object' ? {
      ...item.data,
      ...data,
    } : data,
  });
};

// For layoutSettings
const toggleLayoutSetting = (name, value, getters, dispatch) => {
  const currentValue = getters.layoutSettings[name];
  const patch = {
    [name]: value === undefined ? !currentValue : !!value,
  };
  if (patch[name] !== currentValue) {
    dispatch('patchLayoutSettings', patch);
  }
};

const layoutSettingsToggler = propertyName => ({ getters, dispatch }, value) =>
  toggleLayoutSetting(propertyName, value, getters, dispatch);

const notEnoughSpace = layoutConstants =>
  document.body.clientWidth < layoutConstants.editorMinWidth +
    layoutConstants.explorerWidth +
    layoutConstants.sideBarWidth +
    layoutConstants.buttonBarWidth;

export default {
  namespaced: true,
  state: {
    // Data items stored in the DB
    itemsById: {},
    // Data items stored in the localStorage
    lsItemsById: {},
  },
  mutations: {
    setItem: ({ itemsById, lsItemsById }, value) => {
      // Create an empty item and override its data field
      const emptyItem = empty(value.id);
      const data = typeof value.data === 'object'
        ? Object.assign(emptyItem.data, value.data)
        : value.data;

      // Make item with hash
      const item = utils.addItemHash({
        ...emptyItem,
        data,
      });

      // Store item in itemsById or lsItemsById if its stored in the localStorage
      Vue.set(localStorageIdSet.has(item.id) ? lsItemsById : itemsById, item.id, item);
    },
    deleteItem({ itemsById }, id) {
      // Only used by localDbSvc to clean itemsById from object moved to localStorage
      Vue.delete(itemsById, id);
    },
  },
  getters: {
    workspaces: getter('workspaces'), // Not to be used, prefer workspace/workspacesById
    settings: getter('settings'),
    computedSettings: (state, { settings }) => {
      const customSettings = yaml.load(settings);
      const parsedSettings = yaml.load(defaultSettings);
      const override = (obj, opt) => {
        const objType = Object.prototype.toString.call(obj);
        const optType = Object.prototype.toString.call(opt);
        if (objType !== optType) {
          return obj;
        } else if (objType !== '[object Object]') {
          return opt;
        }
        Object.keys(obj).forEach((key) => {
          if (key === 'shortcuts') {
            obj[key] = Object.assign(obj[key], opt[key]);
          } else {
            obj[key] = override(obj[key], opt[key]);
          }
        });
        return obj;
      };
      return override(parsedSettings, customSettings);
    },
    localSettings: getter('localSettings'),
    layoutSettings: getter('layoutSettings'),
    lastCreated: getter('lastCreated'),
    lastOpened: getter('lastOpened'),
    lastOpenedIds: (state, { lastOpened }, rootState) => {
      const result = {
        ...lastOpened,
      };
      const currentFileId = rootState.file.currentId;
      if (currentFileId && !result[currentFileId]) {
        result[currentFileId] = Date.now();
      }
      return Object.keys(result)
        .filter(id => rootState.file.itemsById[id])
        .sort((id1, id2) => result[id2] - result[id1])
        .slice(0, 20);
    },
  },
  actions: {
    setSettings: setter('settings'),
    patchLocalSettings: patcher('localSettings'),
    patchLayoutSettings: patcher('layoutSettings'),
    toggleNavigationBar: layoutSettingsToggler('showNavigationBar'),
    toggleEditor: layoutSettingsToggler('showEditor'),
    toggleSidePreview: layoutSettingsToggler('showSidePreview'),
    toggleStatusBar: layoutSettingsToggler('showStatusBar'),
    toggleScrollSync: layoutSettingsToggler('scrollSync'),
    toggleFocusMode: layoutSettingsToggler('focusMode'),
    toggleSideBar: ({ getters, dispatch, rootGetters }, value) => {
      // Reset side bar
      dispatch('setSideBarPanel');

      // Toggle it
      toggleLayoutSetting('showSideBar', value, getters, dispatch);

      // Close explorer if not enough space
      if (getters.layoutSettings.showSideBar &&
        notEnoughSpace(rootGetters['layout/constants'])
      ) {
        dispatch('patchLayoutSettings', {
          showExplorer: false,
        });
      }
    },
    toggleExplorer: ({ getters, dispatch, rootGetters }, value) => {
      // Toggle explorer
      toggleLayoutSetting('showExplorer', value, getters, dispatch);

      // Close side bar if not enough space
      if (getters.layoutSettings.showExplorer &&
        notEnoughSpace(rootGetters['layout/constants'])
      ) {
        dispatch('patchLayoutSettings', {
          showSideBar: false,
        });
      }
    },
    setSideBarPanel: ({ dispatch }, value) => dispatch('patchLayoutSettings', {
      sideBarPanel: value === undefined ? 'menu' : value,
    }),
    setLastCreated: setter('lastCreated'),
    setLastOpenedId: ({ getters, commit, rootState }, fileId) => {
      const lastOpened = { ...getters.lastOpened };
      lastOpened[fileId] = Date.now();
      // Remove entries that don't exist anymore
      const cleanedLastOpened = {};
      Object.entries(lastOpened).forEach(([id, value]) => {
        if (rootState.file.itemsById[id]) {
          cleanedLastOpened[id] = value;
        }
      });
      commit('setItem', itemTemplate('lastOpened', cleanedLastOpened));
    },
  },
};
