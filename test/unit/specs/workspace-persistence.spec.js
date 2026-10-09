import utils from '../../../src/services/utils';
import localDbSvc from '../../../src/services/localDbSvc';
import store from '../../../src/store';

const workspaceId = `legacy-${utils.uid()}`;
const databaseName = utils.getDbName(workspaceId);

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
});
