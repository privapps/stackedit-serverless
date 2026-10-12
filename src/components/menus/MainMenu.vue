<template>
  <div class="side-bar__panel side-bar__panel--menu">
    <div class="side-bar__info">
      <div class="menu-entry menu-entry--info flex flex--row flex--align-center">
        <div class="menu-entry__icon">
          <icon-database></icon-database>
        </div>
        <span><b>{{currentWorkspace.name}}</b> is stored in this browser.</span>
      </div>
    </div>
    <menu-entry @click.native="setPanel('workspaces')">
      <template #icon><icon-database></icon-database></template>
      <div>Workspaces</div>
      <span>Switch between local workspaces.</span>
    </menu-entry>
    <hr>
    <menu-entry @click.native="setPanel('toc')">
      <template #icon><icon-toc></icon-toc></template>
      Table of contents
    </menu-entry>
    <menu-entry @click.native="setPanel('help')">
      <template #icon><icon-help-circle></icon-help-circle></template>
      Markdown cheat sheet
    </menu-entry>
    <hr>
    <menu-entry @click.native="setPanel('importExport')">
      <template #icon><icon-content-save></icon-content-save></template>
      Import/export
    </menu-entry>
    <menu-entry @click.native="print">
      <template #icon><icon-printer></icon-printer></template>
      Print
    </menu-entry>
    <menu-entry @click.native="settings">
      <template #icon><icon-settings></icon-settings></template>
      <div>Settings</div>
      <span>Adjust the writing experience and shortcuts.</span>
    </menu-entry>
    <hr>
    <menu-entry @click.native="setPanel('workspaceBackups')">
      <template #icon><icon-content-save></icon-content-save></template>
      Workspace backups
    </menu-entry>
    <menu-entry @click.native="reset">
      <template #icon><icon-logout></icon-logout></template>
      Reset application
    </menu-entry>
    <menu-entry @click.native="about">
      <template #icon><icon-help-circle></icon-help-circle></template>
      About StackEdit
    </menu-entry>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';
import MenuEntry from './common/MenuEntry';
import store from '../../store';

export default {
  components: {
    MenuEntry,
  },
  computed: {
    ...mapGetters('workspace', [
      'currentWorkspace',
    ]),
  },
  methods: {
    ...mapActions('data', {
      setPanel: 'setSideBarPanel',
    }),
    print() {
      window.print();
    },
    async settings() {
      try {
        await store.dispatch('modal/open', 'settings');
      } catch (e) { /* Cancel */ }
    },
    async reset() {
      try {
        await store.dispatch('modal/open', 'reset');
        localStorage.setItem('resetStackEdit', '1');
        window.location.reload();
      } catch (e) { /* Cancel */ }
    },
    about() {
      store.dispatch('modal/open', 'about');
    },
  },
};
</script>
