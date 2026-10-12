import utils from '../../../src/services/utils';
import workspaceSvc from '../../../src/services/workspaceSvc';
import store from '../../../src/store';

describe('local workspace startup selection', () => {
  it('opens Main when the address has no workspace selection', () => {
    expect(workspaceSvc.resolveInitialWorkspaceId({}, { main: { id: 'main' } }))
      .toBe('main');
  });

  it('opens an explicitly selected local workspace', () => {
    expect(workspaceSvc.resolveInitialWorkspaceId(
      { workspaceId: 'saved-workspace' },
      { main: { id: 'main' }, 'saved-workspace': { id: 'saved-workspace' } },
    )).toBe('saved-workspace');
  });

  it('maps a legacy provider workspace address to its existing local copy', () => {
    const workspaceParams = {
      providerId: 'githubWorkspace',
      owner: 'writer',
      repo: 'notebook',
      branch: 'main',
      path: 'notes/',
    };
    const id = utils.makeWorkspaceId(workspaceParams);

    expect(workspaceSvc.resolveInitialWorkspaceId({
      providerId: 'githubWorkspace',
      owner: 'writer',
      repo: 'notebook',
      branch: 'main',
      path: '/notes',
    }, {
      main: { id: 'main' },
      [id]: { id, ...workspaceParams },
    })).toBe(id);
  });

  it('does not select Main when the requested local copy is missing', () => {
    expect(workspaceSvc.resolveInitialWorkspaceId(
      { providerId: 'googleDriveWorkspace', folderId: 'missing-folder' },
      { main: { id: 'main' } },
    )).toBeNull();
  });
});

describe('legacy workspace Trash retention', () => {
  const fixtures = [
    [{ id: 'main' }, { google: { user: { isLogin: true } } }, true],
    [{ id: 'main' }, { google: { user: { isLogin: false } } }, false],
    [{ id: 'main' }, { github: { user: { isLogin: true } } }, false],
    [{ id: 'old-drive', providerId: 'googleDriveWorkspace', sub: 'user' },
      { google: { user: {} } }, true],
    [{ id: 'old-github', providerId: 'githubWorkspace', sub: 'user' },
      { github: { user: {} } }, true],
    [{ id: 'old-gitlab', providerId: 'gitlabWorkspace', sub: 'user' },
      { gitlab: { user: {} } }, true],
    [{ id: 'old-couchdb', providerId: 'couchdbWorkspace' },
      { couchdb: { 'old-couchdb': {} } }, true],
    [{ id: 'old-github', providerId: 'githubWorkspace', sub: 'user' },
      { google: { user: { isLogin: true } }, github: { otherUser: {} } }, false],
    [{ id: 'old-gitlab', providerId: 'gitlabWorkspace', sub: 'user' }, {}, false],
    [{ id: 'old-drive', providerId: 'googleDriveWorkspace', sub: 'user' }, {}, false],
    [{ id: 'old-couchdb', providerId: 'couchdbWorkspace' },
      { couchdb: { otherWorkspace: {} } }, false],
  ];

  it.each(fixtures)('preserves historical eligibility for %j with %j', async (workspace, tokens, expected) => {
    const previousWorkspaces = store.state.data.lsItemsById.workspaces;
    const previousTokens = store.state.data.lsItemsById.tokens;
    const previousId = store.state.workspace.currentWorkspaceId;
    try {
      store.commit('data/setItem', { id: 'workspaces', data: {
        main: { id: 'main' }, [workspace.id]: workspace,
      } });
      store.commit('data/setItem', { id: 'tokens', data: tokens });
      store.commit('workspace/setCurrentWorkspaceId', workspace.id);
      const storedTokens = JSON.stringify(store.state.data.lsItemsById.tokens);

      expect(store.getters['workspace/hasLegacyTrashExemption']).toBe(expected);
      expect(JSON.stringify(store.state.data.lsItemsById.tokens)).toBe(storedTokens);
      expect(store.getters['workspace/syncToken']).toBeUndefined();
    } finally {
      store.state.data.lsItemsById.workspaces = previousWorkspaces;
      store.state.data.lsItemsById.tokens = previousTokens;
      store.commit('workspace/setCurrentWorkspaceId', previousId);
    }
  });
});
