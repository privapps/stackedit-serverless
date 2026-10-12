import utils from '../../../src/services/utils';
import localDbSvc from '../../../src/services/localDbSvc';
import store from '../../../src/store';

const workspaceId = `legacy-${utils.uid()}`;
const databaseName = utils.getDbName(workspaceId);

const createWorkspaceDatabase = databaseId => new Promise((resolve, reject) => {
  const request = indexedDB.open(databaseId, 1);
  request.onerror = () => reject(request.error);
  request.onupgradeneeded = () => {
    const objectStore = request.result.createObjectStore('objects', {
      keyPath: 'id',
    });
    objectStore.createIndex('tx', 'tx', { unique: false });
  };
  request.onsuccess = () => resolve(request.result);
});

const createHashMap = () => ({
  contentState: Object.create(null),
  syncedContent: Object.create(null),
  content: Object.create(null),
  file: Object.create(null),
  folder: Object.create(null),
  syncLocation: Object.create(null),
  publishLocation: Object.create(null),
  data: Object.create(null),
});

const createConnection = (db, abortOnPut = false, onPut = () => {}) => {
  const connection = {
    transactionCommitted: false,
    createTx(onTx, onError) {
      const transaction = db.transaction('objects', 'readwrite');
      transaction.onabort = () => onError(transaction.error || new Error('Transaction aborted.'));
      transaction.addEventListener('complete', () => {
        connection.transactionCommitted = true;
      });
      const tx = new Proxy(transaction, {
        get(target, property) {
          if (property === 'objectStore') {
            return (name) => {
              const objectStore = target.objectStore(name);
              return new Proxy(objectStore, {
                get(storeTarget, storeProperty) {
                  if (storeProperty === 'put') {
                    return (...args) => {
                      const request = storeTarget.put(...args);
                      onPut(...args);
                      if (abortOnPut) {
                        target.abort();
                      }
                      return request;
                    };
                  }
                  const value = Reflect.get(storeTarget, storeProperty, storeTarget);
                  return typeof value === 'function' ? value.bind(storeTarget) : value;
                },
              });
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
        set(target, property, value) {
          return Reflect.set(target, property, value, target);
        },
      });
      onTx(tx);
    },
  };
  return connection;
};

const readPersistedItem = (db, id) => new Promise((resolve, reject) => {
  const request = db.transaction('objects', 'readonly').objectStore('objects').get(id);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const createLegacyWorkspace = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(databaseName, 1);
  request.onerror = () => reject(request.error);
  request.onupgradeneeded = () => {
    const objectStore = request.result.createObjectStore('objects', {
      keyPath: 'id',
    });
    objectStore.createIndex('tx', 'tx', { unique: false });
  };
  request.onsuccess = () => {
    const transaction = request.result.transaction('objects', 'readwrite');
    const objectStore = transaction.objectStore('objects');
    objectStore.put({
      id: 'legacy-file',
      type: 'file',
      name: 'Legacy.md',
      parentId: null,
      hash: 'legacy-file-hash',
      tx: 1,
    });
    objectStore.put({
      id: 'legacy-file/content',
      type: 'content',
      text: 'Saved before the Vue migration',
      properties: '\n',
      discussions: {},
      comments: {},
      hash: 'legacy-content-hash',
      tx: 2,
    });
    transaction.oncomplete = () => {
      request.result.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  };
});

describe('workspace persistence', () => {
  it('checks local workspace availability without creating a missing database', async () => {
    const missingWorkspaceId = `missing-${utils.uid()}`;
    const missingDatabaseName = utils.getDbName(missingWorkspaceId);

    await expect(localDbSvc.hasWorkspaceDatabase(missingWorkspaceId)).resolves.toBe(false);
    const databases = await indexedDB.databases();
    expect(databases.some(database => database.name === missingDatabaseName)).toBe(false);
  });

  it('recognizes an existing local workspace database', async () => {
    const existingWorkspaceId = `existing-${utils.uid()}`;
    const existingDatabaseName = utils.getDbName(existingWorkspaceId);
    const db = await createWorkspaceDatabase(existingDatabaseName);

    try {
      await expect(localDbSvc.hasWorkspaceDatabase(existingWorkspaceId)).resolves.toBe(true);
    } finally {
      db.close();
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(existingDatabaseName);
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
    }
  });

  it('can read documents from an existing workspace database', async () => {
    await createLegacyWorkspace();

    const items = [];
    await new Promise((resolve) => {
      localDbSvc.getWorkspaceItems(
        workspaceId,
        item => items.push(item),
        resolve,
      );
    });

    expect(items).toContainEqual(expect.objectContaining({
      id: 'legacy-file',
      type: 'file',
      name: 'Legacy.md',
    }));
    expect(items).toContainEqual(expect.objectContaining({
      id: 'legacy-file/content',
      type: 'content',
      text: 'Saved before the Vue migration',
    }));
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  });

  it('persists nested Vuex items to IndexedDB', async () => {
    const testWorkspaceId = `vuex-${utils.uid()}`;
    const testDatabaseName = utils.getDbName(testWorkspaceId);
    const fileId = utils.uid();
    const contentId = `${fileId}/content`;
    const previousLastTx = localDbSvc.lastTx;
    const previousContentHashes = localDbSvc.hashMap.content;
    let db;

    localDbSvc.lastTx = 0;
    localDbSvc.hashMap.content = Object.create(null);
    store.commit('content/setItem', {
      id: contentId,
      text: 'Nested Vuex content',
      properties: '\n',
      discussions: {
        discussion: { start: 0, end: 1 },
      },
      comments: {
        discussion: [{ text: 'A nested comment' }],
      },
    });

    try {
      db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(testDatabaseName, 1);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
          const objectStore = request.result.createObjectStore('objects', {
            keyPath: 'id',
          });
          objectStore.createIndex('tx', 'tx', { unique: false });
        };
        request.onsuccess = () => resolve(request.result);
      });

      const transaction = db.transaction('objects', 'readwrite');
      const transactionCompleted = new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });

      expect(() => localDbSvc.writeAll({
        [contentId]: store.getters.allItemsById[contentId],
      }, transaction)).not.toThrow();
      await transactionCompleted;

      const persistedItem = await new Promise((resolve, reject) => {
        const request = db.transaction('objects', 'readonly')
          .objectStore('objects').get(contentId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      expect(persistedItem).toEqual(expect.objectContaining({
        id: contentId,
        type: 'content',
        text: 'Nested Vuex content',
        discussions: {
          discussion: { start: 0, end: 1 },
        },
        comments: {
          discussion: [{ text: 'A nested comment' }],
        },
        tx: 1,
      }));
    } finally {
      store.commit('content/deleteItem', contentId);
      localDbSvc.lastTx = previousLastTx;
      localDbSvc.hashMap.content = previousContentHashes;
      db?.close();
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(testDatabaseName);
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
    }
  });

  it('acknowledges local saves after commit and retries edits after transaction failure', async () => {
    const testDatabaseName = utils.getDbName(`save-${utils.uid()}`);
    const fileId = utils.uid();
    const contentId = `${fileId}/content`;
    const previousConnection = localDbSvc.connection;
    const previousHashMap = localDbSvc.hashMap;
    const previousLastTx = localDbSvc.lastTx;
    let db;

    localDbSvc.hashMap = createHashMap();
    localDbSvc.lastTx = 0;
    store.commit('content/setItem', {
      id: contentId,
      text: 'Edit that must survive a failed save',
      properties: '\n',
      discussions: {},
      comments: {},
    });

    try {
      db = await createWorkspaceDatabase(testDatabaseName);
      localDbSvc.connection = createConnection(db, true);

      await expect(localDbSvc.sync()).rejects.toThrow();
      expect(store.getters.allItemsById[contentId].text)
        .toBe('Edit that must survive a failed save');
      expect(await readPersistedItem(db, contentId)).toBeUndefined();
      expect(store.state.localSaveStatus).toBe('error');

      const connection = createConnection(db);
      localDbSvc.connection = connection;
      await localDbSvc.sync();

      expect(connection.transactionCommitted).toBe(true);
      expect(store.state.localSaveStatus).toBe('saved');
      expect(await readPersistedItem(db, contentId)).toEqual(expect.objectContaining({
        id: contentId,
        text: 'Edit that must survive a failed save',
      }));
    } finally {
      store.commit('content/deleteItem', contentId);
      localDbSvc.connection = previousConnection;
      localDbSvc.hashMap = previousHashMap;
      localDbSvc.lastTx = previousLastTx;
      db?.close();
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(testDatabaseName);
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
    }
  });

  it('marks ordinary edits pending and does not acknowledge edits made during a transaction', async () => {
    const testDatabaseName = utils.getDbName(`pending-${utils.uid()}`);
    const fileId = utils.uid();
    const contentId = `${fileId}/content`;
    const previous = {
      connection: localDbSvc.connection,
      hashMap: localDbSvc.hashMap,
      lastTx: localDbSvc.lastTx,
      pendingSave: localDbSvc.pendingSave,
      changeVersion: localDbSvc.changeVersion,
      unsubscribeFromStore: localDbSvc.unsubscribeFromStore,
    };
    let db;

    try {
      localDbSvc.hashMap = createHashMap();
      localDbSvc.lastTx = 0;
      localDbSvc.pendingSave = false;
      localDbSvc.unsubscribeFromStore = null;
      store.commit('file/setItem', { id: fileId, name: 'Pending edits.md' });
      store.commit('file/setCurrentId', fileId);
      store.commit('content/setItem', { id: contentId, text: 'Original saved text' });
      db = await createWorkspaceDatabase(testDatabaseName);
      localDbSvc.connection = createConnection(db);
      await localDbSvc.sync();
      localDbSvc.watchLocalChanges();

      await store.dispatch('content/patchCurrent', { text: 'First ordinary edit' });
      expect(store.state.localSaveStatus).toBe('saving');
      expect(localDbSvc.pendingSave).toBe(true);
      expect(await readPersistedItem(db, contentId)).toEqual(expect.objectContaining({
        text: 'Original saved text',
      }));

      let editedDuringSave = false;
      localDbSvc.connection = createConnection(db, false, (item) => {
        if (item.id === contentId && !editedDuringSave) {
          editedDuringSave = true;
          store.dispatch('content/patchCurrent', { text: 'Edit made during save' });
        }
      });
      await localDbSvc.sync();
      expect(editedDuringSave).toBe(true);
      expect(store.state.localSaveStatus).toBe('saving');
      expect(localDbSvc.pendingSave).toBe(true);
      expect(await readPersistedItem(db, contentId)).toEqual(expect.objectContaining({
        text: 'First ordinary edit',
      }));

      localDbSvc.connection = createConnection(db);
      await localDbSvc.sync();
      expect(store.state.localSaveStatus).toBe('saved');
      expect(localDbSvc.pendingSave).toBe(false);
      expect(await readPersistedItem(db, contentId)).toEqual(expect.objectContaining({
        text: 'Edit made during save',
      }));

      store.commit('file/patchItem', { id: fileId, name: 'Renamed.md' });
      expect(store.state.localSaveStatus).toBe('saving');
      await localDbSvc.sync();
      store.commit('folder/setItem', { id: 'pending-folder', name: 'Folder' });
      await localDbSvc.sync();
      store.commit('folder/patchItem', { id: 'pending-folder', name: 'Renamed folder' });
      expect(store.state.localSaveStatus).toBe('saving');
      await localDbSvc.sync();
      const changeVersion = localDbSvc.changeVersion;
      store.commit('data/deleteItem', 'tokens');
      expect(localDbSvc.changeVersion).toBe(changeVersion);
    } finally {
      localDbSvc.unsubscribeFromStore?.();
      Object.assign(localDbSvc, previous);
      store.commit('content/deleteItem', contentId);
      store.commit('file/deleteItem', fileId);
      store.commit('folder/deleteItem', 'pending-folder');
      db?.close();
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(testDatabaseName);
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
    }
  });
});
