export default {
  namespaced: true,
  state: {
    currentWorkspaceId: null,
    lastFocus: 0,
  },
  mutations: {
    setCurrentWorkspaceId: (state, value) => {
      state.currentWorkspaceId = value;
    },
    setLastFocus: (state, value) => {
      state.lastFocus = value;
    },
  },
  getters: {
    workspacesById: (state, getters, rootState, rootGetters) => {
      const workspacesById = {};
      Object.entries(rootGetters['data/workspaces']).forEach(([id, workspace]) => {
        const sanitizedWorkspace = {
          id,
          ...workspace,
        };
        sanitizedWorkspace.url = `${window.location.origin}${window.location.pathname}` +
          `#workspaceId=${encodeURIComponent(id)}`;
        workspacesById[id] = sanitizedWorkspace;
      });
      return workspacesById;
    },
    mainWorkspace: (state, { workspacesById }) => workspacesById.main,
    currentWorkspace: ({ currentWorkspaceId }, { workspacesById, mainWorkspace }) =>
      workspacesById[currentWorkspaceId] || mainWorkspace,
    // Only inspect credential presence to preserve old Trash retention eligibility.
    // Never expose a token or reconnect the former provider.
    hasLegacyTrashExemption: (state, { currentWorkspace }, rootState) => {
      const tokens = rootState.data.lsItemsById.tokens?.data || {};
      switch (currentWorkspace.providerId) {
        case 'googleDriveWorkspace':
          return !!tokens.google?.[currentWorkspace.sub];
        case 'githubWorkspace':
          return !!tokens.github?.[currentWorkspace.sub];
        case 'gitlabWorkspace':
          return !!tokens.gitlab?.[currentWorkspace.sub];
        case 'couchdbWorkspace':
          return !!tokens.couchdb?.[currentWorkspace.id];
        default:
          return Object.values(tokens.google || {}).some(token => token?.isLogin);
      }
    },
    lastFocusKey: (state, { currentWorkspace }) => `${currentWorkspace.id}/lastWindowFocus`,
  },
  actions: {
    removeWorkspace: ({ commit, rootGetters }, id) => {
      const workspaces = {
        ...rootGetters['data/workspaces'],
      };
      delete workspaces[id];
      commit(
        'data/setItem',
        { id: 'workspaces', data: workspaces },
        { root: true },
      );
    },
    patchWorkspacesById: ({ commit, rootGetters }, workspaces) => {
      const sanitizedWorkspaces = {};
      Object
        .entries({
          ...rootGetters['data/workspaces'],
          ...workspaces,
        })
        .forEach(([id, workspace]) => {
          sanitizedWorkspaces[id] = {
            ...workspace,
            id,
            // Do not store urls
            url: undefined,
          };
        });

      commit(
        'data/setItem',
        { id: 'workspaces', data: sanitizedWorkspaces },
        { root: true },
      );
    },
    setCurrentWorkspaceId: ({ commit, getters }, value) => {
      commit('setCurrentWorkspaceId', value);
      const lastFocus = parseInt(localStorage.getItem(getters.lastFocusKey), 10) || 0;
      commit('setLastFocus', lastFocus);
    },
  },
};
