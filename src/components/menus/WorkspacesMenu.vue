<template>
  <div class="side-bar__panel side-bar__panel--menu">
    <menu-entry @click.native="manageWorkspaces">
      <template #icon><icon-database></icon-database></template>
      <div><div class="menu-entry__label menu-entry__label--count">{{workspaceCount}}</div> Manage workspaces</div>
      <span>List, rename, or remove local workspaces.</span>
    </menu-entry>
    <hr>
    <div class="workspace" v-for="(workspace, id) in workspacesById" :key="id">
      <menu-entry :href="workspace.url" target="_blank">
        <template #icon><icon-database></icon-database></template>
        <div class="workspace__name"><div class="menu-entry__label" v-if="currentWorkspace.id === id">current</div>{{workspace.name}}</div>
      </menu-entry>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import MenuEntry from './common/MenuEntry';
import store from '../../store';

export default {
  components: {
    MenuEntry,
  },
  computed: {
    ...mapGetters('workspace', [
      'workspacesById',
      'currentWorkspace',
    ]),
    workspaceCount() {
      return Object.keys(this.workspacesById).length;
    },
  },
  methods: {
    manageWorkspaces() {
      try {
        store.dispatch('modal/open', 'workspaceManagement');
      } catch (e) { /* Cancel */ }
    },
  },
};
</script>

<style lang="scss">
@import '../../styles/variables.scss';

.workspace .menu-entry {
  padding-top: 12px;
  padding-bottom: 12px;
}

.workspace__name {
  font-weight: bold;
  line-height: 1.2;
}
</style>
