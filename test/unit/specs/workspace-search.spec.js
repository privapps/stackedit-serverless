import utils from '../../../src/services/utils';
import workspaceSearchSvc from '../../../src/services/workspaceSearchSvc';
import localDbSvc from '../../../src/services/localDbSvc';
import store from '../../../src/store';
import workspaceSvc from '../../../src/services/workspaceSvc';

const seedWorkspace = (workspaceId, items) => new Promise((resolve, reject) => {
  const databaseName = utils.getDbName(workspaceId);
  const request = indexedDB.open(databaseName, 1);
  request.onerror = () => reject(request.error);
  request.onupgradeneeded = () => {
    const objectStore = request.result.createObjectStore('objects', { keyPath: 'id' });
    objectStore.createIndex('tx', 'tx', { unique: false });
  };
  request.onsuccess = () => {
    const db = request.result;
    const transaction = db.transaction('objects', 'readwrite');
    const objectStore = transaction.objectStore('objects');
    items.forEach((item, index) => objectStore.put({
      ...item,
      hash: `hash-${item.id}`,
      tx: index + 1,
    }));
    transaction.oncomplete = () => {
      db.close();
      resolve(databaseName);
    };
    transaction.onerror = () => reject(transaction.error);
  };
});

const removeWorkspace = databaseName => new Promise((resolve, reject) => {
  const request = indexedDB.deleteDatabase(databaseName);
  request.onsuccess = resolve;
  request.onerror = () => reject(request.error);
});

describe('workspace search', () => {
  it('finds unopened local content once per document and excludes Trash and Temp', async () => {
    const workspaceId = `search-${utils.uid()}`;
    const otherWorkspaceId = `other-${utils.uid()}`;
    const items = [
      { id: 'folder-projects', type: 'folder', name: 'Projects', parentId: null },
      { id: 'folder-archive', type: 'folder', name: 'Archive', parentId: 'folder-projects' },
      { id: 'folder-trash', type: 'folder', name: 'Removed', parentId: 'trash' },
      { id: 'folder-temp', type: 'folder', name: 'Drafts', parentId: 'temp' },
      { id: 'file-root', type: 'file', name: 'same.md', parentId: null },
      { id: 'file-name', type: 'file', name: 'needle-guide.md', parentId: 'folder-archive' },
      { id: 'file-both', type: 'file', name: 'needle-reference.md', parentId: 'folder-archive' },
      { id: 'file-content', type: 'file', name: 'same.md', parentId: 'folder-archive' },
      { id: 'file-trash', type: 'file', name: 'trash.md', parentId: 'folder-trash' },
      { id: 'file-temp', type: 'file', name: 'temp.md', parentId: 'folder-temp' },
      {
        id: 'file-root/content',
        type: 'content',
        text: 'needle appears twice: needle.',
      },
      {
        id: 'file-name/content',
        type: 'content',
        text: 'There is no matching source text.',
      },
      {
        id: 'file-both/content',
        type: 'content',
        text: 'needle appears in both the name and the Markdown body.',
      },
      {
        id: 'file-content/content',
        type: 'content',
        text: 'Read this first 🔥\nneedle in a nested file,\nthen needle again.',
      },
      { id: 'file-trash/content', type: 'content', text: 'needle is in Trash.' },
      { id: 'file-temp/content', type: 'content', text: 'needle is in Temp.' },
    ];
    const databaseNames = await Promise.all([
      seedWorkspace(workspaceId, items),
      seedWorkspace(otherWorkspaceId, [
        { id: 'other-file', type: 'file', name: 'other.md', parentId: null },
        { id: 'other-file/content', type: 'content', text: 'needle in another workspace.' },
      ]),
    ]);

    try {
      const scan = workspaceSearchSvc.searchWorkspace({
        workspaceId,
        query: 'NEEDLE',
      });
      const results = await scan.promise;

      expect(results.map(result => result.fileId)).toEqual([
        'file-root',
        'file-name',
        'file-both',
        'file-content',
      ]);
      expect(results.map(result => result.folderPath)).toEqual([
        '',
        'Projects / Archive',
        'Projects / Archive',
        'Projects / Archive',
      ]);
      expect(results[0].contentMatch).toMatchObject({
        start: 0,
        end: 6,
      });
      expect(results[0].snippet.match).toBe('needle');
      expect(results[0].contentMatch.start)
        .toBe(items.find(item => item.id === 'file-root/content').text.indexOf('needle'));
      expect(results[1].nameMatch).toBeTruthy();
      expect(results[1].contentMatch).toBeNull();
      expect(results[1].snippet).toBeNull();
      expect(results[2].nameMatch).toBeTruthy();
      expect(results[2].contentMatch).toBeTruthy();
      expect(results.filter(result => result.fileId === 'file-both')).toHaveLength(1);
      expect(results[2].contentMatch.start)
        .toBe(items.find(item => item.id === 'file-both/content').text.indexOf('needle'));
      expect(results[3].contentMatch.start)
        .toBe(items.find(item => item.id === 'file-content/content').text.indexOf('needle'));
      expect(results[3].snippet.before).toContain('🔥');
      expect(results).toHaveLength(4);
    } finally {
      await Promise.all(databaseNames.map(removeWorkspace));
    }
  });

  it('orders results by folder path, name, and identity instead of database insertion order', async () => {
    const workspaceId = `ordered-search-${utils.uid()}`;
    const databaseName = await seedWorkspace(workspaceId, [
      { id: 'file-zulu', type: 'file', name: 'zeta.md', parentId: 'folder-zulu' },
      { id: 'folder-zulu', type: 'folder', name: 'Zulu', parentId: null },
      { id: 'file-same-z', type: 'file', name: 'same.md', parentId: 'folder-alpha' },
      { id: 'file-alpha', type: 'file', name: 'alpha.md', parentId: 'folder-alpha' },
      { id: 'folder-alpha', type: 'folder', name: 'Alpha', parentId: null },
      { id: 'file-root-z', type: 'file', name: 'zeta.md', parentId: null },
      { id: 'file-same-a', type: 'file', name: 'same.md', parentId: 'folder-alpha' },
      { id: 'file-root-a', type: 'file', name: 'alpha.md', parentId: null },
      ...[
        'file-zulu',
        'file-same-z',
        'file-alpha',
        'file-root-z',
        'file-same-a',
        'file-root-a',
      ].map(id => ({
        id: `${id}/content`,
        type: 'content',
        text: 'ORDERING_MARKER',
      })),
    ]);

    try {
      const results = await workspaceSearchSvc.searchWorkspace({
        workspaceId,
        query: 'ORDERING_MARKER',
        searchName: false,
      }).promise;

      expect(results.map(result => result.fileId)).toEqual([
        'file-root-a',
        'file-root-z',
        'file-alpha',
        'file-same-a',
        'file-same-z',
        'file-zulu',
      ]);
      expect(results.map(result => result.folderPath)).toEqual([
        '',
        '',
        'Alpha',
        'Alpha',
        'Alpha',
        'Zulu',
      ]);
    } finally {
      await removeWorkspace(databaseName);
    }
  });

  it('matches literal punctuation and respects case-sensitive content search', async () => {
    const workspaceId = `search-${utils.uid()}`;
    const databaseName = await seedWorkspace(workspaceId, [
      { id: 'literal', type: 'file', name: 'literal.md', parentId: null },
      { id: 'literal/content', type: 'content', text: 'Keep [a-z].* as Markdown text.' },
      { id: 'case', type: 'file', name: 'case.md', parentId: null },
      { id: 'case/content', type: 'content', text: 'Needle and needle.' },
    ]);

    try {
      const literal = await workspaceSearchSvc.searchWorkspace({
        workspaceId,
        query: '[a-z].*',
        searchName: false,
      }).promise;
      const caseSensitive = await workspaceSearchSvc.searchWorkspace({
        workspaceId,
        query: 'needle',
        searchName: false,
        caseSensitive: true,
      }).promise;

      expect(literal.map(result => result.fileId)).toEqual(['literal']);
      expect(literal[0].contentMatch.start).toBe(5);
      expect(caseSensitive.map(result => result.fileId)).toEqual(['case']);
      expect(caseSensitive[0].contentMatch.start).toBe(11);
    } finally {
      await removeWorkspace(databaseName);
    }
  });

  it('preserves case-insensitive source offsets for Unicode multiline matches across scan chunks', async () => {
    const workspaceId = `unicode-search-${utils.uid()}`;
    const text = `${'a'.repeat(4095)}\u0130\nMATCHED text`;
    const databaseName = await seedWorkspace(workspaceId, [
      { id: 'unicode-file', type: 'file', name: 'unicode.md', parentId: null },
      { id: 'unicode-file/content', type: 'content', text },
    ]);

    try {
      const results = await workspaceSearchSvc.searchWorkspace({
        workspaceId,
        query: 'i\u0307\nmatched',
        searchName: false,
      }).promise;

      expect(results).toHaveLength(1);
      expect(results[0].contentMatch).toEqual({ start: 4095, end: 4104 });
      expect(text.slice(results[0].contentMatch.start, results[0].contentMatch.end))
        .toBe('\u0130\nMATCHED');
    } finally {
      await removeWorkspace(databaseName);
    }
  });

  it('matches Greek final sigma and keeps the first case-insensitive content occurrence', async () => {
    const workspaceId = `greek-search-${utils.uid()}`;
    const text = 'ΟΣ Greek first literal; ος Greek second literal.';
    const databaseName = await seedWorkspace(workspaceId, [
      { id: 'greek-file', type: 'file', name: 'ος.md', parentId: null },
      { id: 'greek-file/content', type: 'content', text },
    ]);

    try {
      expect(workspaceSearchSvc.findMatch('ΟΣ', 'ΟΣ', false)).toEqual({ start: 0, end: 2 });

      const results = await workspaceSearchSvc.searchWorkspace({
        workspaceId,
        query: 'ΟΣ',
      }).promise;

      expect(results).toHaveLength(1);
      expect(results[0].nameMatch).toEqual({ start: 0, end: 2 });
      expect(results[0].contentMatch).toEqual({ start: 0, end: 2 });
      expect(results[0].snippet.match).toBe('ΟΣ');
      expect(text.slice(results[0].contentMatch.start, results[0].contentMatch.end)).toBe('ΟΣ');
    } finally {
      await removeWorkspace(databaseName);
    }
  });

  it('includes latest in-memory edits without changing the open document or history', async () => {
    const currentFileId = store.state.file.currentId;
    const lastOpenedIds = [...store.getters['data/lastOpenedIds']];
    const file = await workspaceSvc.createFile({
      name: 'unsaved-search.md',
      text: 'EDITED_BEFORE_PERIODIC_SAVE',
    }, true);

    try {
      const results = await workspaceSearchSvc.searchWorkspace({
        workspaceId: store.getters['workspace/currentWorkspace'].id,
        query: 'EDITED_BEFORE_PERIODIC_SAVE',
        searchName: false,
      }).promise;

      expect(results.map(result => result.fileId)).toContain(file.id);
      expect(store.state.file.currentId).toBe(currentFileId);
      expect(store.getters['data/lastOpenedIds']).toEqual(lastOpenedIds);
    } finally {
      workspaceSvc.deleteFile(file.id);
    }
  });

  it('reports database failures and supports interrupting a pending scan', async () => {
    const blockedWorkspaceId = `blocked-${utils.uid()}`;
    const blockedDatabaseName = utils.getDbName(blockedWorkspaceId);
    const request = indexedDB.open(blockedDatabaseName, 2);
    await new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        const objectStore = request.result.createObjectStore('objects', { keyPath: 'id' });
        objectStore.createIndex('tx', 'tx', { unique: false });
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
    });

    await expect(workspaceSearchSvc.searchWorkspace({
      workspaceId: blockedWorkspaceId,
      query: 'anything',
    }).promise).rejects.toMatchObject({ name: 'VersionError' });
    await removeWorkspace(blockedDatabaseName);

    const cancelledWorkspaceId = `cancelled-${utils.uid()}`;
    const scan = workspaceSearchSvc.searchWorkspace({
      workspaceId: cancelledWorkspaceId,
      query: 'anything',
    });
    const rejected = expect(scan.promise).rejects.toMatchObject({ name: 'AbortError' });
    scan.cancel();
    await rejected;
    await new Promise(resolve => setTimeout(resolve, 0));
    await removeWorkspace(utils.getDbName(cancelledWorkspaceId));
  });

  it('can cancel while processing records after the IndexedDB read completes', async () => {
    const workspaceId = `cancel-processing-${utils.uid()}`;
    const records = Array.from({ length: 128 }, (_, index) => ([
      {
        id: `file-${index}`,
        type: 'file',
        name: `file-${index}.md`,
        parentId: null,
        hash: `hash-file-${index}`,
      },
      {
        id: `file-${index}/content`,
        type: 'content',
        text: `Searchable text for file ${index}.`,
        hash: `hash-content-${index}`,
      },
    ])).flat();
    const cancelRead = vi.fn();
    vi.spyOn(localDbSvc, 'readWorkspaceItems').mockImplementation((id, onItem) => {
      records.forEach(onItem);
      return {
        promise: Promise.resolve(),
        cancel: cancelRead,
      };
    });

    const scan = workspaceSearchSvc.searchWorkspace({ workspaceId, query: 'needle' });
    setTimeout(() => scan.cancel(), 0);

    await expect(scan.promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancelRead).toHaveBeenCalledTimes(1);
  });

  it('can cancel while matching a large document after the IndexedDB read completes', async () => {
    const workspaceId = `cancel-large-content-${utils.uid()}`;
    const cancelRead = vi.fn();
    vi.spyOn(localDbSvc, 'readWorkspaceItems').mockImplementation((id, onItem) => {
      onItem({
        id: 'large-file',
        type: 'file',
        name: 'large-file.md',
        parentId: null,
        hash: 'hash-large-file',
      });
      onItem({
        id: 'large-file/content',
        type: 'content',
        text: 'a'.repeat(1024 * 1024),
        hash: 'hash-large-content',
      });
      return {
        promise: Promise.resolve(),
        cancel: cancelRead,
      };
    });

    const scan = workspaceSearchSvc.searchWorkspace({ workspaceId, query: 'needle' });
    setTimeout(() => scan.cancel(), 0);

    await expect(scan.promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancelRead).toHaveBeenCalledTimes(1);
  });

  it('returns every matching document without imposing a result cap', async () => {
    const workspaceId = `uncapped-search-${utils.uid()}`;
    const records = Array.from({ length: 1100 }, (_, index) => ({
      id: `file-${index}`,
      type: 'file',
      name: `needle-${index}.md`,
      parentId: null,
      hash: `hash-file-${index}`,
    }));
    vi.spyOn(localDbSvc, 'readWorkspaceItems').mockImplementation((id, onItem) => {
      records.forEach(onItem);
      return {
        promise: Promise.resolve(),
        cancel: vi.fn(),
      };
    });

    const results = await workspaceSearchSvc.searchWorkspace({ workspaceId, query: 'needle' }).promise;

    expect(results).toHaveLength(1100);
  });
});
