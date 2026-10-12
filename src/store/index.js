import { createLogger, createStore } from 'vuex';
import content from './content';
import contentState from './contentState';
import contextMenu from './contextMenu';
import data from './data';
import explorer from './explorer';
import file from './file';
import findReplace from './findReplace';
import folder from './folder';
import layout from './layout';
import modal from './modal';
import notification from './notification';
import workspace from './workspace';
import moduleTemplate from './moduleTemplate';
import emptyPublishLocation from '../data/empties/emptyPublishLocation';
import emptySyncLocation from '../data/empties/emptySyncLocation';
import emptySyncedContent from '../data/empties/emptySyncedContent';
import constants from '../data/constants';

const debug = NODE_ENV !== 'production';

const store = createStore({
  modules: {
    content,
    contentState,
    contextMenu,
    data,
    explorer,
    file,
    findReplace,
    folder,
    layout,
    modal,
    notification,
    // Keep the old record types readable in workspace snapshots without activating them.
    publishLocation: moduleTemplate(emptyPublishLocation, true),
    syncedContent: moduleTemplate(emptySyncedContent, true),
    syncLocation: moduleTemplate(emptySyncLocation, true),
    workspace,
  },
  state: {
    light: false,
    timeCounter: 0,
    localSaveStatus: 'saved',
    localSaveError: '',
  },
  mutations: {
    setLight: (state, value) => {
      state.light = value;
    },
    setLocalSaveStatus: (state, { status, error = '' }) => {
      state.localSaveStatus = status;
      state.localSaveError = error;
    },
    updateTimeCounter: (state) => {
      state.timeCounter += 1;
    },
  },
  getters: {
    allItemsById: (state) => {
      const result = {};
      constants.types.forEach(type => Object.assign(result, state[type].itemsById));
      return result;
    },
  },
  strict: debug,
  plugins: debug ? [createLogger()] : [],
});

setInterval(() => {
  store.commit('updateTimeCounter');
}, 30 * 1000);

export default store;
