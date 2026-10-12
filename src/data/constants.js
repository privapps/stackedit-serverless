export default {
  cleanTrashAfter: 7 * 24 * 60 * 60 * 1000, // 7 days
  types: [
    'contentState',
    'syncedContent',
    'content',
    'file',
    'folder',
    'syncLocation',
    'publishLocation',
    'data',
  ],
  localStorageDataIds: [
    'workspaces',
    'settings',
    'layoutSettings',
    'tokens',
    'serverConf',
  ],
  textMaxLength: 250000,
  defaultName: 'Untitled',
};
