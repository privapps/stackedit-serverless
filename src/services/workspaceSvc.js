import store from '../store';
import utils from './utils';
import constants from '../data/constants';

const forbiddenFolderNameMatcher = /^\.stackedit-data$|^\.stackedit-trash$|\.md$/;

const getLegacyWorkspaceParams = (query) => {
  const normalizePath = (value) => {
    const path = (value || '').trim()
      .replace(/^\/*/, '')
      .replace(/\/*$/, '/');
    return path === '/' ? undefined : path;
  };

  switch (query.providerId) {
    case 'googleDriveAppData':
      return {};
    case 'googleDriveWorkspace':
      return query.folderId ? {
        providerId: query.providerId,
        folderId: query.folderId,
      } : null;
    case 'githubWorkspace':
      return {
        providerId: query.providerId,
        owner: query.owner,
        repo: query.repo,
        branch: query.branch || 'master',
        path: normalizePath(query.path),
      };
    case 'gitlabWorkspace':
      return {
        providerId: query.providerId,
        serverUrl: query.serverUrl,
        projectPath: (query.projectPath || '').trim()
          .replace(/^\/*/, '')
          .replace(/\/*$/, ''),
        branch: query.branch || 'master',
        path: normalizePath(query.path),
      };
    case 'couchdbWorkspace':
      return {
        providerId: query.providerId,
        dbUrl: (query.dbUrl || '').replace(/\/?$/, ''),
      };
    default:
      return null;
  }
};

export default {

  /**
   * Resolve the requested workspace only when its local record exists.
   * Legacy provider links are mapped by their historical workspace ID inputs.
   */
  resolveInitialWorkspaceId(query = {}, workspacesById = {}) {
    let workspaceId;
    if (query.workspaceId) {
      workspaceId = query.workspaceId;
    } else if (!query.providerId) {
      workspaceId = 'main';
    } else {
      const workspaceParams = getLegacyWorkspaceParams(query);
      if (workspaceParams == null) {
        return null;
      }
      workspaceId = Object.keys(workspaceParams).length
        ? utils.makeWorkspaceId(workspaceParams)
        : 'main';
    }

    return workspacesById[workspaceId] ? workspaceId : null;
  },

  /**
   * Create a file in the store with the specified fields.
   */
  async createFile({
    name,
    parentId,
    text,
    properties,
    discussions,
    comments,
    history,
  } = {}, background = false) {
    const id = utils.uid();
    const item = {
      id,
      name: utils.sanitizeFilename(name),
      parentId: parentId || null,
    };
    const content = {
      id: `${id}/content`,
      text: utils.sanitizeText(text || store.getters['data/computedSettings'].newFileContent),
      properties: utils
        .sanitizeText(properties || store.getters['data/computedSettings'].newFileProperties),
      discussions: discussions || {},
      comments: comments || {},
      history: history || [],
    };
    // Show warning dialogs
    if (!background) {
      // If name is being stripped
      if (item.name !== constants.defaultName && item.name !== name) {
        await store.dispatch('modal/open', {
          type: 'stripName',
          item,
        });
      }

    }

    // Save file and content in the store
    store.commit('content/setItem', content);
    store.commit('file/setItem', item);
    // Return the new file item
    return store.state.file.itemsById[id];
  },

  /**
   * Make sanity checks and then create/update the folder/file in the store.
   */
  async storeItem(item) {
    const id = item.id || utils.uid();
    const sanitizedName = utils.sanitizeFilename(item.name);

    if (item.type === 'folder' && forbiddenFolderNameMatcher.exec(sanitizedName)) {
      await store.dispatch('modal/open', {
        type: 'unauthorizedName',
        item,
      });
      throw new Error('Unauthorized name.');
    }

    // Show warning dialogs
    // If name has been stripped
    if (sanitizedName !== constants.defaultName && sanitizedName !== item.name) {
      await store.dispatch('modal/open', {
        type: 'stripName',
        item,
      });
    }

    return this.setOrPatchItem({
      ...item,
      id,
    });
  },

  /** Create or update a local file or folder. */
  setOrPatchItem(patch) {
    const item = {
      ...store.getters.allItemsById[patch.id] || patch,
    };
    if (!item.id) {
      return null;
    }

    if (patch.parentId !== undefined) {
      item.parentId = patch.parentId || null;
    }
    if (patch.name) {
      const sanitizedName = utils.sanitizeFilename(patch.name);
      if (item.type !== 'folder' || !forbiddenFolderNameMatcher.exec(sanitizedName)) {
        item.name = sanitizedName;
      }
    }

    // Save item in the store
    store.commit(`${item.type}/setItem`, item);

    // Remove circular reference
    this.removeCircularReference(item);

    return store.getters.allItemsById[item.id];
  },

  /**
   * Delete a file in the store and all its related items.
   */
  deleteFile(fileId) {
    // Delete the file
    store.commit('file/deleteItem', fileId);
    // Delete the content
    store.commit('content/deleteItem', `${fileId}/content`);
    // Delete the contentState
    store.commit('contentState/deleteItem', `${fileId}/contentState`);
  },

  /**
   * Sanitize the whole workspace.
   */
  sanitizeWorkspace() {
    // Detect and remove circular references for all folders.
    store.getters['folder/items'].forEach(folder => this.removeCircularReference(folder));

  },

  /**
   * Detect and remove circular reference for an item.
   */
  removeCircularReference(item) {
    const foldersById = store.state.folder.itemsById;
    for (
      let parentFolder = foldersById[item.parentId];
      parentFolder;
      parentFolder = foldersById[parentFolder.parentId]
    ) {
      if (parentFolder.id === item.id) {
        store.commit('folder/patchItem', {
          id: item.id,
          parentId: null,
        });
        break;
      }
    }
  },

  /**
   * Drop the database and clean the localStorage for the specified workspaceId.
   */
  async removeWorkspace(id) {
    // Remove from the store first as workspace tabs will reload.
    // Workspace deletion will be persisted as soon as possible
    // by the store.getters['data/workspaces'] watcher in localDbSvc.
    store.dispatch('workspace/removeWorkspace', id);

    // Drop the database
    await new Promise((resolve) => {
      const dbName = utils.getDbName(id);
      const request = indexedDB.deleteDatabase(dbName);
      request.onerror = resolve; // Ignore errors
      request.onsuccess = resolve;
    });

    // Clean the local storage
    localStorage.removeItem(`${id}/lastWindowFocus`);
  },
};
