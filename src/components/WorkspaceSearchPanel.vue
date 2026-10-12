<template>
  <div class="workspace-search-overlay">
    <section
      class="workspace-search"
      :class="`workspace-search--${panelPlacement}`"
      role="dialog"
      aria-label="Search workspace"
    >
      <header class="workspace-search__header flex flex--row flex--space-between flex--align-center">
        <h2>Search workspace</h2>
        <button class="workspace-search__close button" type="button" aria-label="Close search workspace" @click="close()">
          <icon-close></icon-close>
        </button>
      </header>
      <form class="workspace-search__form" @submit.prevent="submit()">
        <label class="workspace-search__query-label">
          <span>Query</span>
          <input
            ref="queryInput"
            v-model="query"
            class="text-input workspace-search__query"
            type="search"
            aria-label="Search workspace query"
            v-focus
          >
        </label>
        <fieldset class="workspace-search__options flex flex--row flex--wrap">
          <legend>Search in</legend>
          <label><input v-model="searchName" type="checkbox"> Name</label>
          <label><input v-model="searchContent" type="checkbox"> Content</label>
          <label><input v-model="caseSensitive" type="checkbox"> Case-sensitive</label>
        </fieldset>
        <div class="workspace-search__actions flex flex--row flex--end">
          <button class="button" type="submit">Search</button>
          <button class="button" type="button" @click="reset()">Reset</button>
          <button class="button" type="button" @click="close()">Close</button>
        </div>
      </form>

      <p v-if="status === 'initial'" class="workspace-search__status" role="status" aria-live="polite">
        Search document names and content in this workspace.
      </p>
      <p v-else-if="status === 'searching'" class="workspace-search__status" role="status" aria-live="polite">
        Searching workspace…
      </p>
      <p v-else-if="status === 'completed'" class="workspace-search__status" role="status" aria-live="polite">
        {{results.length}} {{results.length === 1 ? 'document' : 'documents'}} found.
      </p>
      <p v-else-if="status === 'no-results'" class="workspace-search__status" role="status" aria-live="polite">
        No documents found.
      </p>
      <p v-else-if="status === 'validation'" class="workspace-search__status workspace-search__status--error" role="alert">
        {{message}}
      </p>
      <p v-else-if="status === 'failure'" class="workspace-search__status workspace-search__status--error" role="alert">
        {{message}}
      </p>

      <ul v-if="results.length" class="workspace-search__results" aria-label="Search results">
        <li v-for="result in results" :key="result.fileId">
          <button class="workspace-search__result button" type="button" @click="activateResult(result)">
            <span class="workspace-search__result-name">
              <template v-if="result.nameMatch">
                {{result.name.slice(0, result.nameMatch.start)}}<mark>{{result.name.slice(result.nameMatch.start, result.nameMatch.end)}}</mark>{{result.name.slice(result.nameMatch.end)}}
              </template>
              <template v-else>{{result.name}}</template>
            </span>
            <span class="workspace-search__result-path">{{result.folderPath || 'Workspace root'}}</span>
            <span v-if="result.snippet" class="workspace-search__snippet">
              {{result.snippet.before}}<mark>{{result.snippet.match}}</mark>{{result.snippet.after}}
            </span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<script>
import Vue from 'vue';
import store from '../store';
import localDbSvc from '../services/localDbSvc';
import workspaceSearchSvc from '../services/workspaceSearchSvc';
import editorSvc from '../services/editorSvc';

const isExcluded = (file) => {
  let parentId = file.parentId;
  const seen = new Set();
  while (parentId && !seen.has(parentId)) {
    if (parentId === 'trash' || parentId === 'temp') {
      return true;
    }
    seen.add(parentId);
    const folder = store.state.folder.itemsById[parentId];
    if (!folder) {
      return false;
    }
    parentId = folder.parentId;
  }
  return false;
};

const expectedEditorText = text => (text.endsWith('\n') ? text : `${text}\n`);

export default {
  data: () => ({
    query: '',
    searchName: true,
    searchContent: true,
    caseSensitive: false,
    results: [],
    status: 'initial',
    message: '',
    requestId: 0,
    activationId: 0,
    activeScan: null,
    isOpen: true,
    panelPlacement: 'initial',
  }),
  computed: {
    workspaceId: () => store.getters['workspace/currentWorkspace'].id,
  },
  methods: {
    cancelSearch() {
      if (this.activeScan) {
        this.activeScan.cancel();
        this.activeScan = null;
      }
    },
    invalidateSearch() {
      this.requestId += 1;
      this.activationId += 1;
      this.cancelSearch();
    },
    async submit() {
      this.invalidateSearch();
      this.panelPlacement = 'initial';
      const requestId = this.requestId;
      const workspaceId = this.workspaceId;
      this.results = [];
      this.message = '';
      if (!this.query) {
        this.status = 'initial';
        return;
      }
      if (!this.searchName && !this.searchContent) {
        this.status = 'validation';
        this.message = 'Select Name or Content to search.';
        return;
      }

      this.status = 'searching';
      const scan = workspaceSearchSvc.searchWorkspace({
        workspaceId,
        query: this.query,
        searchName: this.searchName,
        searchContent: this.searchContent,
        caseSensitive: this.caseSensitive,
      });
      this.activeScan = scan;
      try {
        const results = await scan.promise;
        if (requestId !== this.requestId || workspaceId !== this.workspaceId || !this.isOpen) {
          return;
        }
        this.results = results;
        this.status = results.length ? 'completed' : 'no-results';
      } catch (error) {
        if (error.name === 'AbortError' || requestId !== this.requestId || !this.isOpen) {
          return;
        }
        this.status = 'failure';
        this.message = `Workspace search failed: ${error.message || error}`;
        store.dispatch('notification/error', error);
      } finally {
        if (this.activeScan === scan) {
          this.activeScan = null;
        }
      }
    },
    reset() {
      this.invalidateSearch();
      this.panelPlacement = 'initial';
      this.query = '';
      this.searchName = true;
      this.searchContent = true;
      this.caseSensitive = false;
      this.results = [];
      this.status = 'initial';
      this.message = '';
      this.$nextTick(() => this.$refs.queryInput && this.$refs.queryInput.focus());
    },
    close() {
      this.invalidateSearch();
      this.isOpen = false;
      window.removeEventListener('keydown', this.handleWindowKeydown, true);
      this.$emit('close');
    },
    handleWindowKeydown(event) {
      if (event.key === 'Escape' && this.isOpen) {
        event.preventDefault();
        event.stopPropagation();
        this.close();
      }
    },
    reportStaleResult() {
      this.status = 'validation';
      this.message = 'This result has changed. Search again to refresh it.';
    },
    placePanelAwayFromSelection() {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) {
        return;
      }
      const range = selection.getRangeAt(0);
      if (typeof range.getBoundingClientRect !== 'function') {
        return;
      }
      const match = range.getBoundingClientRect();
      this.panelPlacement = match.top + (match.height / 2) < window.innerHeight / 2
        ? 'bottom'
        : 'top';
    },
    async waitForEditorContent(fileId, text, activationId, workspaceId) {
      const targetText = expectedEditorText(text);
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        if (
          activationId !== this.activationId
          || workspaceId !== this.workspaceId
          || store.state.file.currentId !== fileId
        ) {
          return false;
        }
        await Vue.nextTick();
        if (editorSvc.clEditor && editorSvc.clEditor.getContent() === targetText) {
          return true;
        }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      return false;
    },
    async activateResult(result) {
      const activationId = ++this.activationId;
      const workspaceId = result.workspaceId;
      if (workspaceId !== this.workspaceId) {
        this.reportStaleResult();
        return;
      }
      let file = store.state.file.itemsById[result.fileId];
      if (!file || isExcluded(file)) {
        this.reportStaleResult();
        return;
      }

      let content = store.state.content.itemsById[`${file.id}/content`];
      if (!content) {
        try {
          content = await localDbSvc.loadItem(`${file.id}/content`);
        } catch (error) {
          if (activationId === this.activationId) {
            this.reportStaleResult();
          }
          return;
        }
      }
      if (activationId !== this.activationId || workspaceId !== this.workspaceId) {
        return;
      }
      file = store.state.file.itemsById[result.fileId];
      if (!file || isExcluded(file)) {
        this.reportStaleResult();
        return;
      }

      const actualText = content && typeof content.text === 'string' ? content.text : '';
      let currentMatch = null;
      if (result.contentMatch) {
        currentMatch = workspaceSearchSvc.findMatch(
          actualText,
          result.query,
          result.caseSensitive,
        );
        if (!currentMatch) {
          this.reportStaleResult();
          return;
        }
      } else if (result.nameMatch && !workspaceSearchSvc.findMatch(
        file.name || '',
        result.query,
        result.caseSensitive,
      )) {
        this.reportStaleResult();
        return;
      }

      store.commit('file/setCurrentId', file.id);
      const editorReady = await this.waitForEditorContent(
        file.id,
        actualText,
        activationId,
        workspaceId,
      );
      if (!editorReady) {
        if (activationId === this.activationId && workspaceId === this.workspaceId) {
          this.reportStaleResult();
        }
        return;
      }
      if (
        activationId !== this.activationId
        || workspaceId !== this.workspaceId
        || workspaceId !== store.getters['workspace/currentWorkspace'].id
        || store.state.file.currentId !== file.id
      ) {
        return;
      }
      const activeFile = store.state.file.itemsById[file.id];
      if (!activeFile || isExcluded(activeFile)) {
        this.reportStaleResult();
        return;
      }
      if (currentMatch) {
        const editorText = editorSvc.clEditor && editorSvc.clEditor.getContent();
        currentMatch = workspaceSearchSvc.findMatch(
          typeof editorText === 'string' ? editorText : '',
          result.query,
          result.caseSensitive,
        );
        if (!currentMatch) {
          this.reportStaleResult();
          return;
        }
        editorSvc.selectTextRange(currentMatch.start, currentMatch.end);
        await this.$nextTick();
        this.placePanelAwayFromSelection();
      } else if (result.nameMatch && !workspaceSearchSvc.findMatch(
        activeFile.name || '',
        result.query,
        result.caseSensitive,
      )) {
        this.reportStaleResult();
      }
    },
  },
  mounted() {
    window.addEventListener('keydown', this.handleWindowKeydown, true);
  },
  created() {
    this.$watch(
      () => store.getters['workspace/currentWorkspace'].id,
      () => {
        this.invalidateSearch();
        this.results = [];
        this.status = 'initial';
        this.message = '';
      },
    );
  },
  beforeDestroy() {
    this.isOpen = false;
    window.removeEventListener('keydown', this.handleWindowKeydown, true);
    this.activationId += 1;
    this.invalidateSearch();
  },
};
</script>

<style lang="scss">
@import '../styles/variables.scss';

.workspace-search-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  --workspace-search-sidebar-offset: 280px;
  pointer-events: none;
}

.workspace-search {
  display: flex;
  flex-direction: column;
  position: absolute;
  top: 42px;
  right: calc(var(--workspace-search-sidebar-offset) + 12px);
  width: 360px;
  max-width: calc(100vw - var(--workspace-search-sidebar-offset) - 24px);
  max-height: min(calc(45vh - 12px), calc(100vh - 24px));
  max-height: min(calc(45dvh - 12px), calc(100dvh - 24px));
  overflow: auto;
  padding: 12px 14px;
  border: 1px solid #686868;
  border-radius: $border-radius-base;
  background: #202124;
  color: #f5f5f5;
  box-shadow: 0 5px 22px rgb(0 0 0 / 24%);
  pointer-events: auto;
}

.workspace-search--bottom {
  top: auto;
  bottom: 12px;
}

.workspace-search--top {
  top: 42px;
  bottom: auto;
}

.app--light .workspace-search {
  background: #fff;
  border-color: #767676;
  color: #202124;
}

.app--dark .workspace-search {
  background: #202124;
  border-color: #686868;
  color: #f5f5f5;
}

.workspace-search .button {
  color: inherit;
  text-transform: none;
}

.workspace-search .button:active,
.workspace-search .button:hover {
  background: rgb(255 255 255 / 12%);
}

.app--light .workspace-search .button:active,
.app--light .workspace-search .button:hover {
  background: rgb(0 0 0 / 7%);
}

.workspace-search :focus-visible {
  outline: 3px solid #1281d4;
  outline-offset: 2px;
  position: relative;
  z-index: 1;
}

.app--dark .workspace-search :focus-visible {
  outline-color: #8bc7ff;
}

.workspace-search__header h2 {
  margin: 0;
  font-size: 1.05em;
  font-weight: 600;
}

.workspace-search__close {
  width: 28px;
  height: 28px;
  padding: 4px;
}

.workspace-search__query-label,
.workspace-search__query {
  display: block;
  width: 100%;
}

.workspace-search__query-label {
  margin-top: 10px;
  font-size: 0.85em;
}

.workspace-search__query {
  box-sizing: border-box;
  margin-top: 4px;
  padding: 7px 8px;
  border: 1px solid #767676;
  border-radius: $border-radius-base;
  background: #fff;
  color: #202124;
}

.app--dark .workspace-search__query {
  border-color: #8b8b8b;
  background: #303134;
  color: #fff;
}

.workspace-search__options {
  gap: 7px 14px;
  margin: 10px 0 0;
  padding: 8px 0 0;
  border: 0;
  font-size: 0.85em;
}

.workspace-search__options legend {
  padding: 0;
  font-weight: 600;
}

.workspace-search__options label {
  white-space: nowrap;
}

.workspace-search__actions {
  gap: 6px;
  margin-top: 10px;
}

.workspace-search__actions .button {
  padding: 5px 9px;
  border-radius: $border-radius-base;
}

.workspace-search__status {
  margin: 10px 0 0;
  font-size: 0.86em;
}

.workspace-search__status--error {
  color: #b42318;
}

.app--dark .workspace-search__status--error {
  color: #ffb4ab;
}

.workspace-search__results {
  flex: 1 1 auto;
  margin: 8px -5px 0;
  padding: 0;
  list-style: none;
  min-height: 80px;
  overflow-y: auto;
}

.workspace-search__results li + li {
  border-top: 1px solid rgb(127 127 127 / 35%);
}

.workspace-search .workspace-search__result {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  padding: 8px 5px;
  border-radius: 0;
  font-size: 0.9em;
  line-height: 1.4;
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
}

.workspace-search__result-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.workspace-search__result-path {
  opacity: 0.86;
  font-size: 0.82em;
  overflow-wrap: anywhere;
}

.workspace-search__snippet {
  margin-top: 4px;
  font-size: 0.88em;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.workspace-search mark {
  background: #ffdc69;
  color: #302400;
}

@media (max-width: 1059px) {
  .workspace-search {
    top: auto;
    right: 8px;
    bottom: 8px;
    left: 8px;
    width: auto;
    max-width: none;
  }

  .workspace-search--top {
    top: 8px;
    bottom: auto;
  }

  .workspace-search--bottom,
  .workspace-search--initial {
    top: auto;
    bottom: 8px;
  }
}
</style>
