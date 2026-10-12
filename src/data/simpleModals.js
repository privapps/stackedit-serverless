const simpleModal = (contentHtml, rejectText, resolveText) => ({
  contentHtml: typeof contentHtml === 'function' ? contentHtml : () => contentHtml,
  rejectText,
  resolveText,
});

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '"': '&quot;',
  '&': '&amp;',
  "'": '&#39;',
  '<': '&lt;',
  '>': '&gt;',
}[character]));

/* eslint sort-keys: "error" */
export default {
  folderDeletion: simpleModal(
    config => `<p>You are about to delete the folder <b>${escapeHtml(config.item.name)}</b>. Its files will be moved to Trash. Are you sure?</p>`,
    'No',
    'Yes, delete',
  ),
  removeWorkspace: simpleModal(
    '<p>You are about to remove a workspace locally. Are you sure?</p>',
    'No',
    'Yes, remove',
  ),
  reset: simpleModal(
    '<p>This will clean all your workspaces locally. Are you sure?</p>',
    'No',
    'Yes, clean',
  ),
  stripName: simpleModal(
    config => `<p><b>${escapeHtml(config.item.name)}</b> contains illegal characters. Do you want to strip them?</p>`,
    'No',
    'Yes, strip',
  ),
  tempFileDeletion: simpleModal(
    config => `<p>You are about to permanently delete the temporary file <b>${escapeHtml(config.item.name)}</b>. Are you sure?</p>`,
    'No',
    'Yes, delete',
  ),
  tempFolderDeletion: simpleModal(
    '<p>You are about to permanently delete all the temporary files. Are you sure?</p>',
    'No',
    'Yes, delete all',
  ),
  trashDeletion: simpleModal(
    '<p>Files in the trash are automatically deleted after 7 days of inactivity.</p>',
    'Ok',
  ),
  unauthorizedName: simpleModal(
    config => `<p><b>${escapeHtml(config.item.name)}</b> is an unauthorized name.</p>`,
    'Ok',
  ),
};
