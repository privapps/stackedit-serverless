import utils from '../services/utils';

const defaultTimeout = 5000; // 5 sec
let nextItemId = 0;
const pendingPromises = new Map();

export default {
  namespaced: true,
  state: {
    items: [],
  },
  mutations: {
    setItems: (state, value) => {
      state.items = value;
    },
  },
  actions: {
    showItem({ state, commit }, item) {
      const existingItem = utils.someResult(
        state.items,
        other => other.type === item.type && other.content === item.content && item,
      );
      if (existingItem) {
        return pendingPromises.get(existingItem.id);
      }

      let resolvePromise;
      let rejectPromise;
      const promise = new Promise((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
      });

      const id = ++nextItemId;
      const removeItem = () => {
        commit('setItems', state.items.filter(otherItem => otherItem.id !== id));
        pendingPromises.delete(id);
      };
      const notificationItem = {
        ...item,
        id,
        resolve: (res) => {
          removeItem();
          resolvePromise(res);
        },
        reject: (err) => {
          removeItem();
          rejectPromise(err);
        },
      };
      pendingPromises.set(id, promise);
      commit('setItems', [...state.items, notificationItem]);
      setTimeout(removeItem, item.timeout || defaultTimeout);

      return promise;
    },
    info({ dispatch }, content) {
      return dispatch('showItem', {
        type: 'info',
        content,
      });
    },
    confirm({ dispatch }, content) {
      return dispatch('showItem', {
        type: 'confirm',
        content,
        timeout: 10000, // 10 sec
      });
    },
    error({ dispatch }, error) {
      const item = { type: 'error' };
      if (error) {
        if (error.message) {
          item.content = error.message;
        } else if (error.status) {
          item.content = `HTTP error ${error.status}.`;
        } else {
          item.content = `${error}`;
        }
      }
      if (!item.content || item.content === '[object Object]') {
        item.content = 'Unknown error.';
      }
      return dispatch('showItem', item);
    },
  },
};
