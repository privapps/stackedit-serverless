<template>
  <div class="app" :class="classes" @keydown.esc="close">
    <splash-screen v-if="!ready" :error="startupError"></splash-screen>
    <layout v-else></layout>
    <modal></modal>
    <notification></notification>
    <context-menu></context-menu>
  </div>
</template>

<script>
import '../styles';
import '../styles/markdownHighlighting.scss';
import '../styles/app.scss';
import Layout from './Layout';
import Modal from './Modal';
import Notification from './Notification';
import ContextMenu from './ContextMenu';
import SplashScreen from './SplashScreen';
import tempFileSvc from '../services/tempFileSvc';
import localDbSvc from '../services/localDbSvc';
import workspaceSvc from '../services/workspaceSvc';
import utils from '../services/utils';
import store from '../store';
import './common/vueGlobals';

const themeClasses = {
  light: ['app--light'],
  dark: ['app--dark'],
};

export default {
  components: {
    Layout,
    Modal,
    Notification,
    ContextMenu,
    SplashScreen,
  },
  data: () => ({
    ready: false,
    startupError: '',
  }),
  computed: {
    classes() {
      const result = themeClasses[store.getters['data/computedSettings'].colorTheme];
      return Array.isArray(result) ? result : themeClasses.light;
    },
  },
  methods: {
    close() {
      tempFileSvc.close();
    },
  },
  async created() {
    try {
      localDbSvc.syncLocalStorage();
      const workspaceId = workspaceSvc.resolveInitialWorkspaceId(
        utils.queryParams,
        store.getters['data/workspaces'],
      );
      if (!workspaceId) {
        throw new Error('This workspace is not available in this browser. Open a locally stored workspace.');
      }
      if (workspaceId !== 'main' && !await localDbSvc.hasWorkspaceDatabase(workspaceId)) {
        throw new Error('This workspace is not available in this browser. Open a locally stored workspace.');
      }
      await store.dispatch('workspace/setCurrentWorkspaceId', workspaceId);
      await localDbSvc.init();
      await tempFileSvc.init();
      this.ready = true;
      tempFileSvc.setReady();
    } catch (err) {
      if (err && err.message === 'RELOAD') {
        window.location.reload();
      } else if (err && err.message !== 'RELOAD') {
        console.error(err); // eslint-disable-line no-console
        this.startupError = err.message || 'Could not open the local notebook.';
      }
    }
  },
};
</script>
