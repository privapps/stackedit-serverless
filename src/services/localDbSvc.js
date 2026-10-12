import utils from './utils';
import store from '../store';
import welcomeFile from '../data/welcomeFile.md';
import workspaceSvc from './workspaceSvc';
import constants from '../data/constants';

const deleteMarkerMaxAge = 1000;
const dbVersion = 1;
const dbStoreName = 'objects';
const { silent } = utils.queryParams;
const resetApp = localStorage.getItem('resetStackEdit');
if (resetApp) {
  localStorage.removeItem('resetStackEdit');
}

class Connection {
  constructor(workspaceId = store.getters['workspace/currentWorkspace'].id) {
    this.getTxCbs = [];
    this.error = null;

    // Make the DB name
    this.dbName = utils.getDbName(workspaceId);

    // Init connection
    const request = indexedDB.open(this.dbName, dbVersion);

    request.onerror = () => {
      this.error = request.error || new Error("Can't connect to IndexedDB.");
      const callbacks = this.getTxCbs || [];
      this.getTxCbs = null;
      callbacks.forEach(({ onError }) => onError(this.error));
    };

    request.onsuccess = (event) => {
      this.db = event.target.result;
      this.db.onversionchange = () => window.location.reload();

      this.getTxCbs.forEach(({ onTx, onError }) => this.createTx(onTx, onError));
      this.getTxCbs = null;
    };

    request.onupgradeneeded = (event) => {
      const eventDb = event.target.result;
      const oldVersion = event.oldVersion || 0;

      // We don't use 'break' in this switch statement,
      // the fall-through behavior is what we want.
      /* eslint-disable no-fallthrough */
      switch (oldVersion) {
        case 0: {
          // Create store
          const dbStore = eventDb.createObjectStore(dbStoreName, {
            keyPath: 'id',
          });
          dbStore.createIndex('tx', 'tx', {
            unique: false,
          });
        }
        default:
      }
      /* eslint-enable no-fallthrough */
    };
  }

  /**
   * Create a transaction asynchronously.
   */
  createTx(onTx, onError) {
    if (this.error) {
      return onError(this.error);
    }
    // If DB is not ready, keep callbacks for later
    if (!this.db) {
      return this.getTxCbs.push({ onTx, onError });
    }

    try {
      // Open transaction in read/write will prevent conflict with other tabs
      const tx = this.db.transaction(Array.from(this.db.objectStoreNames), 'readwrite');
      tx.onabort = () => onError(tx.error || new Error('Local DB transaction aborted.'));
      return onTx(tx);
    } catch (error) {
      return onError(error);
    }
  }
}

const contentTypes = {
  content: true,
  contentState: true,
  syncedContent: true,
};

const hashMap = {};
constants.types.forEach((type) => {
  hashMap[type] = Object.create(null);
});
const lsHashMap = Object.create(null);

const localDbSvc = {
  lastTx: 0,
  hashMap,
  connection: null,
  syncPromise: null,
  changeVersion: 0,
  pendingSave: false,
  isApplyingRemoteChanges: false,

  /** Check for an existing workspace without creating a new IndexedDB database. */
  hasWorkspaceDatabase(workspaceId) {
    return new Promise((resolve, reject) => {
      let creationAborted = false;
      const request = indexedDB.open(utils.getDbName(workspaceId), dbVersion);
      request.onupgradeneeded = () => {
        creationAborted = true;
        request.transaction.abort();
      };
      request.onsuccess = () => {
        request.result.close();
        resolve(!creationAborted);
      };
      request.onerror = () => {
        if (creationAborted || request.error?.name === 'AbortError') {
          resolve(false);
        } else {
          reject(request.error || new Error("Can't inspect the local workspace."));
        }
      };
    });
  },

  markLocalChangesPending() {
    this.pendingSave = true;
    this.changeVersion += 1;
    if (store.state.localSaveStatus !== 'saving' || store.state.localSaveError) {
      store.commit('setLocalSaveStatus', {
        status: 'saving',
      });
    }
  },

  watchLocalChanges() {
    if (this.unsubscribeFromStore) {
      return;
    }
    this.unsubscribeFromStore = store.subscribe((mutation) => {
      const [type, operation] = mutation.type.split('/');
      if (!constants.types.includes(type) ||
        !['setItem', 'patchItem', 'deleteItem'].includes(operation) ||
        this.isApplyingRemoteChanges
      ) {
        return;
      }
      const id = operation === 'deleteItem' ? mutation.payload : mutation.payload.id;
      if (type === 'data' && constants.localStorageDataIds.includes(id)) {
        return;
      }
      this.markLocalChangesPending();
    });
  },

  /**
   * Sync data items stored in the localStorage.
   */
  syncLocalStorage() {
    constants.localStorageDataIds.forEach((id) => {
      const key = `data/${id}`;

      // Skip reloading the layoutSettings
      if (id !== 'layoutSettings' || !lsHashMap[id]) {
        try {
          // Try to parse the item from the localStorage
          const storedItem = JSON.parse(localStorage.getItem(key));
          if (storedItem.hash && lsHashMap[id] !== storedItem.hash) {
            // Item has changed, replace it in the store
            store.commit('data/setItem', storedItem);
            lsHashMap[id] = storedItem.hash;
          }
        } catch (e) {
          // Ignore parsing issue
        }
      }

      // Write item if different from stored one
      const item = store.state.data.lsItemsById[id];
      if (item && item.hash !== lsHashMap[id]) {
        localStorage.setItem(key, JSON.stringify(item));
        lsHashMap[id] = item.hash;
      }
    });
  },

  /**
   * Return a promise that will be resolved once the synchronization between the store and the
   * localDb will be finished. Effectively, open a transaction, then read and apply all changes
   * from the DB since the previous transaction, then write all the changes from the store.
   */
  sync() {
    if (this.syncPromise) {
      return this.syncPromise;
    }

    if (this.pendingSave && store.state.localSaveStatus !== 'saving') {
      store.commit('setLocalSaveStatus', {
        status: 'saving',
      });
    }

    const savedLastTx = this.lastTx;
    const savedHashMap = {};
    Object.keys(this.hashMap).forEach((type) => {
      savedHashMap[type] = { ...this.hashMap[type] };
    });
    const saveVersion = this.changeVersion;
    let settled = false;

    const promise = new Promise((resolve, reject) => {
      const finishError = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        this.lastTx = savedLastTx;
        Object.keys(savedHashMap).forEach((type) => {
          this.hashMap[type] = Object.assign(Object.create(null), savedHashMap[type]);
        });
        this.isApplyingRemoteChanges = false;
        const saveError = error instanceof Error
          ? error
          : new Error('Local DB access error.');
        store.commit('setLocalSaveStatus', {
          status: 'error',
          error: saveError.message,
        });
        reject(saveError);
      };

      try {
        this.connection.createTx((tx) => {
          tx.addEventListener('abort', () => {
            finishError(tx.error || new Error('Local DB transaction aborted.'));
          });
          tx.addEventListener('complete', () => {
            if (settled) {
              return;
            }
            settled = true;
            if (this.changeVersion === saveVersion) {
              this.pendingSave = false;
              if (store.state.localSaveStatus !== 'saved' || store.state.localSaveError) {
                store.commit('setLocalSaveStatus', {
                  status: 'saved',
                });
              }
            } else {
              store.commit('setLocalSaveStatus', {
                status: 'saving',
              });
            }
            resolve();
          });

          const { lastTx } = this;
          this.readAll(tx, (storeItemMap) => {
            this.isApplyingRemoteChanges = false;
            try {
              // Sanitize the workspace if changes have been applied
              if (lastTx !== this.lastTx) {
                workspaceSvc.sanitizeWorkspace();
              }

              // Persist all the store changes into the DB
              this.writeAll(storeItemMap, tx);
              // Sync the localStorage
              this.syncLocalStorage();
            } catch (error) {
              try {
                tx.abort();
              } catch {
                // The transaction may already have aborted.
              }
              finishError(error);
            }
          });
        }, finishError);
      } catch (error) {
        finishError(error);
      }
    });

    this.syncPromise = promise.finally(() => {
      this.syncPromise = null;
    });
    return this.syncPromise;
  },

  /**
   * Read and apply all changes from the DB since previous transaction.
   */
  readAll(tx, cb) {
    let { lastTx } = this;
    const dbStore = tx.objectStore(dbStoreName);
    const index = dbStore.index('tx');
    const range = IDBKeyRange.lowerBound(this.lastTx, true);
    const changes = [];
    index.openCursor(range).onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const item = cursor.value;
        if (item.tx > lastTx) {
          lastTx = item.tx;
          if (this.lastTx && item.tx - this.lastTx > deleteMarkerMaxAge) {
            // We may have missed some delete markers
            window.location.reload();
            return;
          }
        }
        // Collect change
        changes.push(item);
        cursor.continue();
        return;
      }

      // Read the collected changes
      const storeItemMap = { ...store.getters.allItemsById };
      changes.forEach((item) => {
        this.isApplyingRemoteChanges = true;
        try {
          this.readDbItem(item, storeItemMap);
        } finally {
          this.isApplyingRemoteChanges = false;
        }
        // If item is an old delete marker, remove it from the DB
        if (!item.hash && lastTx - item.tx > deleteMarkerMaxAge) {
          dbStore.delete(item.id);
        }
      });

      this.lastTx = lastTx;
      cb(storeItemMap);
    };
  },

  /**
   * Write all changes from the store since previous transaction.
   */
  writeAll(storeItemMap, tx) {
    if (silent) {
      // Skip writing to DB in silent mode
      return;
    }
    const dbStore = tx.objectStore(dbStoreName);
    const incrementedTx = this.lastTx + 1;

    // Remove deleted store items
    Object.keys(this.hashMap).forEach((type) => {
      // Remove this type only if file is deleted
      let checker = cb => id => !storeItemMap[id] && cb(id);
      if (contentTypes[type]) {
        // For content types, remove item only if file is deleted
        checker = cb => (id) => {
          if (!storeItemMap[id]) {
            const [fileId] = id.split('/');
            if (!store.state.file.itemsById[fileId]) {
              cb(id);
            }
          }
        };
      }
      Object.keys(this.hashMap[type]).forEach(checker((id) => {
        // Put a delete marker to notify other tabs
        dbStore.put({
          id,
          type,
          tx: incrementedTx,
        });
        delete this.hashMap[type][id];
        this.lastTx = incrementedTx;
      }));
    });

    // Put changes
    Object.entries(storeItemMap).forEach(([, storeItem]) => {
      // Store object has changed
      if (this.hashMap[storeItem.type][storeItem.id] !== storeItem.hash) {
        const item = {
          ...utils.deepCopy(storeItem),
          tx: incrementedTx,
        };
        dbStore.put(item);
        this.hashMap[item.type][item.id] = item.hash;
        this.lastTx = incrementedTx;
      }
    });
  },

  /**
   * Read and apply one DB change.
   */
  readDbItem(dbItem, storeItemMap) {
    const storeItem = storeItemMap[dbItem.id];
    if (!dbItem.hash) {
      // DB item is a delete marker
      delete this.hashMap[dbItem.type][dbItem.id];
      if (storeItem) {
        // Remove item from the store
        store.commit(`${storeItem.type}/deleteItem`, storeItem.id);
        delete storeItemMap[storeItem.id];
      }
    } else if (this.hashMap[dbItem.type][dbItem.id] !== dbItem.hash) {
      // DB item is different from the corresponding store item
      this.hashMap[dbItem.type][dbItem.id] = dbItem.hash;
      // Update content only if it exists in the store
      if (storeItem || !contentTypes[dbItem.type]) {
        // Put item in the store
        dbItem.tx = undefined;
        store.commit(`${dbItem.type}/setItem`, dbItem);
        storeItemMap[dbItem.id] = dbItem;
      }
    }
  },

  /**
   * Retrieve an item from the DB and put it in the store.
   */
  async loadItem(id) {
    // Check if item is in the store
    const itemInStore = store.getters.allItemsById[id];
    if (itemInStore) {
      // Use deepCopy to freeze item
      return Promise.resolve(itemInStore);
    }
    return new Promise((resolve, reject) => {
      // Get the item from DB
      const onError = () => reject(new Error('Data not available.'));
      this.connection.createTx((tx) => {
        const dbStore = tx.objectStore(dbStoreName);
        const request = dbStore.get(id);
        request.onsuccess = () => {
          const dbItem = request.result;
          if (!dbItem || !dbItem.hash) {
            onError();
          } else {
            this.hashMap[dbItem.type][dbItem.id] = dbItem.hash;
            // Put item in the store
            dbItem.tx = undefined;
            store.commit(`${dbItem.type}/setItem`, dbItem);
            resolve(dbItem);
          }
        };
      }, () => onError());
    });
  },

  /**
   * Unload from the store contents that haven't been opened recently
   */
  async unloadContents() {
    await this.sync();
    // Keep only last opened files in memory
    const lastOpenedFileIdSet = new Set(store.getters['data/lastOpenedIds']);
    Object.keys(contentTypes).forEach((type) => {
      store.getters[`${type}/items`].forEach((item) => {
        const [fileId] = item.id.split('/');
        if (!lastOpenedFileIdSet.has(fileId)) {
          // Remove item from the store
          store.commit(`${type}/deleteItem`, item.id);
        }
      });
    });
  },

  /**
   * Create the connection and start syncing.
   */
  async init() {
    // Reset the app if the reset flag was passed
    if (resetApp) {
      await Promise.all(Object.keys(store.getters['workspace/workspacesById'])
        .map(workspaceId => workspaceSvc.removeWorkspace(workspaceId)));
      constants.localStorageDataIds.forEach((id) => {
        // Clean data stored in localStorage
        localStorage.removeItem(`data/${id}`);
      });
      throw new Error('RELOAD');
    }

    // Create the connection
    this.connection = new Connection();

    // Load the DB
    await localDbSvc.sync();

    // Watch workspace deletions and persist them as soon as possible
    // to make the changes available to reloading workspace tabs.
    store.watch(
      () => store.getters['data/workspaces'],
      () => this.syncLocalStorage(),
    );

    // Save welcome file content hash if not done already
    const hash = utils.hash(welcomeFile);
    const { welcomeFileHashes } = store.getters['data/localSettings'];
    if (!welcomeFileHashes[hash]) {
      store.dispatch('data/patchLocalSettings', {
        welcomeFileHashes: {
          ...welcomeFileHashes,
          [hash]: 1,
        },
      });
    }

    // Preserve the historical Trash exemption of connected workspaces as inert metadata.
    if (!store.getters['workspace/hasLegacyTrashExemption'] &&
      store.state.workspace.lastFocus + constants.cleanTrashAfter < Date.now()
    ) {
      // Clean files
      store.getters['file/items']
        .filter(file => file.parentId === 'trash') // If file is in the trash
        .forEach(file => workspaceSvc.deleteFile(file.id));
    }

    const recordWindowFocus = () => {
      const lastFocus = Date.now();
      localStorage.setItem(store.getters['workspace/lastFocusKey'], lastFocus);
      store.commit('workspace/setLastFocus', lastFocus);
    };
    recordWindowFocus();
    window.addEventListener('focus', recordWindowFocus);

    // Sync local DB periodically
    localDbSvc.watchLocalChanges();
    utils.setInterval(() => localDbSvc.sync().catch(() => {}), 1000);

    // watch current file changing
    store.watch(
      () => store.getters['file/current'].id,
      async () => {
        // See if currentFile is real, ie it has an ID
        const currentFile = store.getters['file/current'];
        // If current file has no ID, get the most recent file
        if (!currentFile.id) {
          const recentFile = store.getters['file/lastOpened'];
          // Set it as the current file
          if (recentFile.id) {
            store.commit('file/setCurrentId', recentFile.id);
          } else {
            // If still no ID, create a new file
            const newFile = await workspaceSvc.createFile({
              name: 'Welcome file',
              text: welcomeFile,
            }, true);
            // Set it as the current file
            store.commit('file/setCurrentId', newFile.id);
          }
        } else {
          try {
            // Load contentState from DB
            await localDbSvc.loadContentState(currentFile.id);
            // Load content from DB
            try {
              await localDbSvc.loadItem(`${currentFile.id}/content`);
            } catch (err) {
              // Failure (content is not available), go back to previous file
              const lastOpenedFile = store.getters['file/lastOpened'];
              store.commit('file/setCurrentId', lastOpenedFile.id);
              throw err;
            }
            // Set last opened file
            store.dispatch('data/setLastOpenedId', currentFile.id);
          } catch (err) {
            console.error(err); // eslint-disable-line no-console
            store.dispatch('notification/error', err);
          }
        }
      },
      { immediate: true },
    );
  },

  getWorkspaceItems(workspaceId, onItem, onFinish = () => {}, onError = () => {}) {
    const connection = new Connection(workspaceId);
    let cancelled = false;
    let finished = false;
    const close = () => {
      if (connection.db) {
        connection.db.close();
      }
    };
    connection.createTx((tx) => {
      if (cancelled) {
        close();
        return;
      }
      const dbStore = tx.objectStore(dbStoreName);
      const index = dbStore.index('tx');
      const request = index.openCursor();
      request.onerror = () => {
        if (!cancelled && !finished) {
          finished = true;
          close();
          onError(request.error || new Error('Local DB access error.'));
        }
      };
      request.onsuccess = (event) => {
        if (cancelled || finished) {
          return;
        }
        const cursor = event.target.result;
        if (cursor) {
          try {
            onItem(cursor.value);
          } catch (error) {
            finished = true;
            close();
            onError(error);
            return;
          }
          if (cancelled) {
            return;
          }
          cursor.continue();
        } else {
          finished = true;
          close();
          onFinish();
        }
      };
    }, (error) => {
      if (!cancelled && !finished) {
        finished = true;
        close();
        onError(error || new Error('Local DB access error.'));
      }
    });

    // Return a cancel function
    return () => {
      if (!cancelled && !finished) {
        cancelled = true;
        close();
      }
    };
  },

  readWorkspaceItems(workspaceId, onItem = () => {}) {
    let cancelRead = () => {};
    let rejectRead;
    const promise = new Promise((resolve, reject) => {
      rejectRead = reject;
      cancelRead = this.getWorkspaceItems(
        workspaceId,
        onItem,
        resolve,
        reject,
      );
    });
    return {
      promise,
      cancel: () => {
        cancelRead();
        const error = new Error('Workspace database read was cancelled.');
        error.name = 'AbortError';
        rejectRead(error);
      },
    };
  },
};

const loader = type => fileId => localDbSvc.loadItem(`${fileId}/${type}`)
  // Item does not exist, create it
  .catch(() => store.commit(`${type}/setItem`, {
    id: `${fileId}/${type}`,
  }));
localDbSvc.loadContentState = loader('contentState');

export default localDbSvc;
