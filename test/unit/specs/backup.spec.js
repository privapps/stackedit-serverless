import backupSvc from '../../../src/services/backupSvc';
import store from '../../../src/store';

describe('workspace backup import', () => {
  it('imports a UTF-8 backup with a leading byte-order mark', async () => {
    const existingFileIds = new Set(store.getters['file/items'].map(file => file.id));
    let importedFile;
    const backup = {
      'source-file': {
        type: 'file',
        name: 'restored-from-backup.md',
      },
      'source-file/content': {
        type: 'content',
        text: 'BACKUP_BOM_MARKER',
        properties: '\n',
        discussions: {},
        comments: {},
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
    } finally {
      if (importedFile) {
        store.commit('content/deleteItem', `${importedFile.id}/content`);
        store.commit('file/deleteItem', importedFile.id);
      }
    }
  });
});
