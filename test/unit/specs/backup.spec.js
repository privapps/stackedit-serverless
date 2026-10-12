import FileSaver from 'file-saver';
import backupSvc, { formatWorkspaceBackupFilename } from '../../../src/services/backupSvc';
import localDbSvc from '../../../src/services/localDbSvc';
import store from '../../../src/store';
import workspaceSvc from '../../../src/services/workspaceSvc';

describe('workspace backup import', () => {
  it('imports a BOM-prefixed v5 backup with nested folders and document metadata', async () => {
    const existingFileIds = new Set(store.getters['file/items'].map(file => file.id));
    const existingFolderIds = new Set(store.getters['folder/items'].map(folder => folder.id));
    let importedFile;
    const backup = {
      'source-file/content': {
        type: 'content',
        text: 'BACKUP_BOM_MARKER',
        properties: 'title: Imported note\n',
        discussions: {
          archivedThread: { start: 0, end: 17 },
        },
        comments: {
          archivedComment: { text: 'Archived from the backup.' },
        },
      },
      'nested-folder': {
        type: 'folder',
        name: 'Nested backup folder',
        parentId: 'parent-folder',
      },
      'source-file': {
        type: 'file',
        name: 'restored-from-backup.md',
        parentId: 'nested-folder',
      },
      'parent-folder': {
        type: 'folder',
        name: 'Parent backup folder',
        parentId: null,
      },
    };

    try {
      await backupSvc.importBackup(`\uFEFF${JSON.stringify(backup)}`);
      importedFile = store.getters['file/items'].find(file => (
        !existingFileIds.has(file.id) && file.name === 'restored-from-backup.md'
      ));

      expect(importedFile).toBeDefined();
      expect(store.state.content.itemsById[`${importedFile.id}/content`].text)
        .toBe('BACKUP_BOM_MARKER\n');
      expect(store.state.content.itemsById[`${importedFile.id}/content`]).toMatchObject({
        properties: 'title: Imported note\n',
        discussions: {
          archivedThread: { start: 0, end: 17 },
        },
        comments: {
          archivedComment: { text: 'Archived from the backup.' },
        },
      });
      const nestedFolder = store.getters['folder/items'].find(folder => (
        !existingFolderIds.has(folder.id) && folder.name === 'Nested backup folder'
      ));
      const parentFolder = store.getters['folder/items'].find(folder => (
        !existingFolderIds.has(folder.id) && folder.name === 'Parent backup folder'
      ));
      expect(nestedFolder.parentId).toBe(parentFolder.id);
      expect(importedFile.parentId).toBe(nestedFolder.id);
    } finally {
      store.getters['file/items']
        .filter(file => !existingFileIds.has(file.id))
        .forEach(file => workspaceSvc.deleteFile(file.id));
      store.getters['folder/items']
        .filter(folder => !existingFolderIds.has(folder.id))
        .forEach(folder => store.commit('folder/deleteItem', folder.id));
    }
  });

  it('imports a BOM-prefixed StackEdit v4 backup', async () => {
    const existingFileIds = new Set(store.getters['file/items'].map(file => file.id));
    let importedFile;

    try {
      await backupSvc.importBackup(`\uFEFF${JSON.stringify({
        'file.legacy.title': 'restored-v4.md',
        'file.legacy.content': 'LEGACY_BACKUP_MARKER',
      })}`);
      importedFile = store.getters['file/items'].find(file => (
        !existingFileIds.has(file.id) && file.name === 'restored-v4.md'
      ));

      expect(importedFile).toBeDefined();
      expect(store.state.content.itemsById[`${importedFile.id}/content`].text)
        .toBe('LEGACY_BACKUP_MARKER\n');
    } finally {
      if (importedFile) {
        store.commit('content/deleteItem', `${importedFile.id}/content`);
        store.commit('file/deleteItem', importedFile.id);
      }
    }
  });
});

describe('workspace backup filename', () => {
  it('uses zero-padded browser-local date and time through minute precision', () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'America/Vancouver';
    try {
      expect(formatWorkspaceBackupFilename(new Date('2026-10-09T06:01:59.123Z')))
        .toBe('StackEdit_Workspace_20261008-2301.json');
      expect(formatWorkspaceBackupFilename(new Date('2026-10-08T07:03:59.999Z')))
        .toBe('StackEdit_Workspace_20261008-0003.json');
    } finally {
      process.env.TZ = previousTimezone;
    }
  });
});

describe('workspace backup export', () => {
  it('keeps the initiating workspace and in-memory edit while the database read is pending', async () => {
    let resolveRead;
    const pendingRead = new Promise((resolve) => {
      resolveRead = resolve;
    });
    const workspaceId = store.getters['workspace/currentWorkspace'].id;
    const previousWorkspaces = store.getters['data/workspaces'];
    const workspaceSettings = { ...store.getters['workspace/currentWorkspace'] };
    delete workspaceSettings.id;
    const otherWorkspaceId = `backup-export-${Date.now()}`;
    const file = await workspaceSvc.createFile({
      name: 'backup-export-snapshot.md',
      text: 'EDITED_AT_EXPORT_START',
      history: [{ text: 'OLDER_VERSION_MARKER' }],
    }, true);
    const contentId = `${file.id}/content`;
    const archivedWorkspaceItems = [
      {
        id: 'legacy-sync-location',
        type: 'syncLocation',
        providerId: 'old-provider',
        url: 'https://example.test/legacy-sync',
        hash: 6,
        tx: 6,
      },
      {
        id: 'legacy-publish-location',
        type: 'publishLocation',
        providerId: 'old-provider',
        templateId: 'archived-template',
        hash: 7,
        tx: 7,
      },
      {
        id: `${file.id}/syncedContent`,
        type: 'syncedContent',
        historyData: { priorRevision: 'ARCHIVED_SYNC_MARKER' },
        syncHistory: { priorRevision: { tx: 12 } },
        v: 2,
        hash: 8,
        tx: 8,
      },
      {
        id: 'templates',
        type: 'data',
        data: { archivedOffline: { helpers: 'INERT_TEMPLATE_MARKER' } },
        hash: 9,
        tx: 9,
      },
    ];
    const readWorkspaceItems = vi.spyOn(localDbSvc, 'readWorkspaceItems')
      .mockImplementation((requestedWorkspaceId, onItem) => {
        expect(requestedWorkspaceId).toBe(workspaceId);
        onItem({
          id: file.id,
          type: 'file',
          name: file.name,
          parentId: null,
          tx: 4,
        });
        onItem({
          id: contentId,
          type: 'content',
          text: 'STALE_PERSISTED_CONTENT',
          tx: 5,
        });
        archivedWorkspaceItems.forEach(onItem);
        return { promise: pendingRead, cancel: vi.fn() };
      });
    const saveAs = vi.spyOn(FileSaver, 'saveAs').mockImplementation(() => {});
    let exportPromise;

    try {
      exportPromise = backupSvc.exportWorkspace();
      expect(readWorkspaceItems).toHaveBeenCalledWith(workspaceId, expect.any(Function));

      store.commit('content/patchItem', {
        id: contentId,
        text: 'EDITED_AFTER_EXPORT_START',
      });
      store.commit('data/setItem', {
        id: 'workspaces',
        data: {
          ...previousWorkspaces,
          [otherWorkspaceId]: workspaceSettings,
        },
      });
      store.commit('workspace/setCurrentWorkspaceId', otherWorkspaceId);
      store.commit('content/setItem', {
        id: 'other-workspace-only/content',
        text: 'OTHER_WORKSPACE_MARKER',
      });
      resolveRead();

      expect(await exportPromise).toBe(true);
      expect(saveAs).toHaveBeenCalledTimes(1);
      const [blob] = saveAs.mock.calls[0];
      const jsonText = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });
      const backup = JSON.parse(jsonText);

      expect(backup[contentId].text).toBe('EDITED_AT_EXPORT_START\n');
      expect(backup[contentId].tx).toBe(5);
      expect(backup[contentId].history).toEqual([{ text: 'OLDER_VERSION_MARKER' }]);
      archivedWorkspaceItems.forEach((item) => {
        expect(backup[item.id]).toEqual(item);
      });
      expect(backup['other-workspace-only/content']).toBeUndefined();
    } finally {
      if (store.getters['workspace/currentWorkspace'].id !== workspaceId) {
        store.commit('workspace/setCurrentWorkspaceId', workspaceId);
      }
      store.commit('data/setItem', { id: 'workspaces', data: previousWorkspaces });
      store.commit('content/deleteItem', 'other-workspace-only/content');
      readWorkspaceItems.mockRestore();
      saveAs.mockRestore();
      workspaceSvc.deleteFile(file.id);
    }
  });

  it('reports local database failures without producing a backup download', async () => {
    const error = new Error('Workspace database is unavailable.');
    const readWorkspaceItems = vi.spyOn(localDbSvc, 'readWorkspaceItems').mockReturnValue({
      promise: Promise.reject(error),
      cancel: vi.fn(),
    });
    const saveAs = vi.spyOn(FileSaver, 'saveAs').mockImplementation(() => {});
    const dispatch = vi.spyOn(store, 'dispatch').mockResolvedValue();

    await expect(backupSvc.exportWorkspace()).resolves.toBe(false);

    expect(saveAs).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith('notification/error', error);
    readWorkspaceItems.mockRestore();
    saveAs.mockRestore();
    dispatch.mockRestore();
  });

  it('reports download failures instead of reporting a successful backup', async () => {
    const error = new Error('Browser download is unavailable.');
    const readWorkspaceItems = vi.spyOn(localDbSvc, 'readWorkspaceItems').mockReturnValue({
      promise: Promise.resolve(),
      cancel: vi.fn(),
    });
    const saveAs = vi.spyOn(FileSaver, 'saveAs').mockImplementation(() => {
      throw error;
    });
    const dispatch = vi.spyOn(store, 'dispatch').mockResolvedValue();

    await expect(backupSvc.exportWorkspace()).resolves.toBe(false);

    expect(dispatch).toHaveBeenCalledWith('notification/error', error);
    readWorkspaceItems.mockRestore();
    saveAs.mockRestore();
    dispatch.mockRestore();
  });
});
