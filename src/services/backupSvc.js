import FileSaver from 'file-saver';
import store from '../store';
import workspaceSvc from './workspaceSvc';
import utils from './utils';
import localDbSvc from './localDbSvc';
import constants from '../data/constants';

const pad = value => `${value}`.padStart(2, '0');

export const formatWorkspaceBackupFilename = (date) => {
  const year = `${date.getFullYear()}`.padStart(4, '0');
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `StackEdit_Workspace_${year}${month}${day}-${hour}${minute}.json`;
};

export default {
  async exportWorkspace(workspaceId = store.getters['workspace/currentWorkspace'].id) {
    const startedAt = new Date();
    const filename = formatWorkspaceBackupFilename(startedAt);
    const inMemoryItemsById = store.getters['workspace/currentWorkspace'].id === workspaceId
      ? utils.deepCopy(store.getters.allItemsById)
      : {};
    const itemsById = {};

    try {
      await localDbSvc.readWorkspaceItems(workspaceId, (item) => {
        itemsById[item.id] = item;
      }).promise;

      Object.values(inMemoryItemsById).forEach((item) => {
        if (item.type === 'data' && constants.localStorageDataIds.includes(item.id)) {
          return;
        }
        const persistedItem = itemsById[item.id];
        itemsById[item.id] = {
          ...item,
          tx: item.tx === undefined && persistedItem ? persistedItem.tx : item.tx,
        };
      });

      const backup = JSON.stringify(itemsById);
      const blob = new Blob([backup], {
        type: 'text/plain;charset=utf-8',
      });
      FileSaver.saveAs(blob, filename);
      return true;
    } catch (error) {
      store.dispatch('notification/error', error);
      return false;
    }
  },

  async importBackup(jsonValue) {
    const fileNameMap = {};
    const folderNameMap = {};
    const parentIdMap = {};
    const textMap = {};
    const propertiesMap = {};
    const discussionsMap = {};
    const commentsMap = {};
    const folderIdMap = {
      trash: 'trash',
    };

    // Parse JSON value
    const parsedValue = JSON.parse(jsonValue.replace(/^\uFEFF/, ''));
    Object.entries(parsedValue).forEach(([id, value]) => {
      if (value) {
        const v4Match = id.match(/^file\.([^.]+)\.([^.]+)$/);
        if (v4Match) {
          // StackEdit v4 format
          const [, v4Id, type] = v4Match;
          if (type === 'title') {
            fileNameMap[v4Id] = value;
          } else if (type === 'content') {
            textMap[v4Id] = value;
          }
        } else if (value.type === 'folder') {
          // StackEdit v5 folder
          folderIdMap[id] = utils.uid();
          folderNameMap[id] = value.name;
          parentIdMap[id] = `${value.parentId || ''}`;
        } else if (value.type === 'file') {
          // StackEdit v5 file
          fileNameMap[id] = value.name;
          parentIdMap[id] = `${value.parentId || ''}`;
        } else if (value.type === 'content') {
          // StackEdit v5 content
          const [fileId] = id.split('/');
          if (fileId) {
            textMap[fileId] = value.text;
            propertiesMap[fileId] = value.properties;
            discussionsMap[fileId] = value.discussions;
            commentsMap[fileId] = value.comments;
          }
        }
      }
    });

    await utils.awaitSequence(
      Object.keys(folderNameMap),
      async externalId => workspaceSvc.setOrPatchItem({
        id: folderIdMap[externalId],
        type: 'folder',
        name: folderNameMap[externalId],
        parentId: folderIdMap[parentIdMap[externalId]],
      }),
    );

    await utils.awaitSequence(
      Object.keys(fileNameMap),
      async externalId => workspaceSvc.createFile({
        name: fileNameMap[externalId],
        parentId: folderIdMap[parentIdMap[externalId]],
        text: textMap[externalId],
        properties: propertiesMap[externalId],
        discussions: discussionsMap[externalId],
        comments: commentsMap[externalId],
      }, true),
    );
  },
};
