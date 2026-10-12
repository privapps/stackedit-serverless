<template>
  <modal-inner class="modal__inner-1--settings" aria-label="Settings">
    <div class="modal__content">
      <div class="tabs flex flex--row">
        <tab :active="tab === 'custom'" @click="tab = 'custom'">
          Custom settings
        </tab>
        <tab :active="tab === 'default'" @click="tab = 'default'">
          Default settings
        </tab>
      </div>
      <div class="form-entry" v-if="tab === 'custom'" role="tabpanel" aria-label="Custom settings">
        <label class="form-entry__label">YAML</label>
        <div class="form-entry__field form-entry__field--code-editor">
          <code-editor lang="yaml" :value="customSettings" key="custom-settings" @changed="setCustomSettings"></code-editor>
        </div>
      </div>
      <div class="form-entry" v-else-if="tab === 'default'" role="tabpanel" aria-label="Default settings">
        <label class="form-entry__label">YAML</label>
        <div class="form-entry__field form-entry__field--code-editor">
          <code-editor lang="yaml" :value="defaultSettings" key="default-settings" disabled="true"></code-editor>
        </div>
      </div>
      <div class="modal__error modal__error--settings" role="alert">{{error}}</div>
    </div>
    <div class="modal__button-bar">
      <button class="button" @click="config.reject()">Cancel</button>
      <button class="button button--resolve" :disabled="Boolean(error)" @click="resolve">Ok</button>
    </div>
  </modal-inner>
</template>

<script>
import yaml from 'js-yaml';
import { mapGetters } from 'vuex';
import ModalInner from './common/ModalInner';
import Tab from './common/Tab';
import CodeEditor from '../CodeEditor';
import defaultSettings from '../../data/defaults/defaultSettings.yml';
import store from '../../store';

const emptySettings = `# Add your custom settings here to override the
# default settings.
`;

export default {
  components: {
    ModalInner,
    Tab,
    CodeEditor,
  },
  data: () => ({
    tab: 'custom',
    defaultSettings,
    customSettings: null,
    error: null,
  }),
  computed: {
    ...mapGetters('modal', [
      'config',
    ]),
    strippedCustomSettings() {
      return this.customSettings === emptySettings ? '\n' : this.customSettings.replace(/\t/g, '  ');
    },
  },
  created() {
    const settings = store.getters['data/settings'];
    this.setCustomSettings(settings === '\n' ? emptySettings : settings);
  },
  methods: {
    setCustomSettings(value) {
      this.customSettings = value;
      try {
        yaml.load(this.strippedCustomSettings);
        this.error = null;
      } catch (e) {
        this.error = e.message;
      }
    },
    async resolve() {
      if (!this.error) {
        const settings = this.strippedCustomSettings;
        await store.dispatch('data/setSettings', settings);
        this.config.resolve(settings);
      }
    },
  },
};
</script>

<style lang="scss">
@import '../../styles/variables.scss';

.modal__inner-1.modal__inner-1--settings {
  max-width: 560px;
  min-width: 0;
}

.modal__inner-1--settings .modal__inner-2 {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 24px);
  max-height: calc(100dvh - 24px);
  margin: 12px 10px;
  padding: 44px 32px 24px;
}

.modal__inner-1--settings .modal__content {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.modal__inner-1--settings .tabs {
  position: sticky;
  z-index: 1;
  top: 0;
  background: #f8f8f8;
}

.modal__inner-1--settings .modal__button-bar {
  flex: 0 0 auto;
  margin-top: 1rem;
}

.modal__inner-1--settings :focus-visible {
  outline: 3px solid #1281d4;
  outline-offset: 2px;
}

.modal__error--settings {
  white-space: pre-wrap;
  font-family: $font-family-monospace;
  font-size: $font-size-monospace;
}

@media (max-width: 480px) {
  .modal__inner-1--settings .modal__inner-2 {
    padding: 44px 20px 20px;
  }
}
</style>
