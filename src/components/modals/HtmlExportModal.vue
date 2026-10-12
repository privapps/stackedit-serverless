<template>
  <modal-inner class="modal__inner-1--html-export" aria-label="Export to HTML">
    <div class="modal__content">
      <p>Export a fixed styled HTML document that includes its own styles and rendering assets.</p>
      <label class="html-export__toc">
        <input type="checkbox" v-model="includeToc" :disabled="isRendering">
        Include table of contents
      </label>
      <p v-if="errorMessage" class="modal__error" role="alert">{{ errorMessage }}</p>
    </div>
    <div class="modal__button-bar">
      <button
        class="button button--copy"
        v-clipboard="result"
        :disabled="isRendering || Boolean(errorMessage)"
        @click="info('HTML copied to clipboard!')"
      >Copy</button>
      <button class="button" @click="config.reject()">Cancel</button>
      <button
        class="button button--resolve"
        :disabled="isRendering || Boolean(errorMessage)"
        @click="resolve()"
      >Download HTML</button>
    </div>
  </modal-inner>
</template>

<script>
import { mapActions } from 'vuex';
import exportSvc from '../../services/exportSvc';
import modalTemplate from './common/modalTemplate';
import store from '../../store';

export default modalTemplate({
  data: () => ({
    result: '',
    includeToc: false,
    isRendering: true,
    errorMessage: null,
  }),
  watch: {
    includeToc() {
      this.renderCurrentFile();
    },
  },
  mounted() {
    this.renderCurrentFile();
  },
  methods: {
    ...mapActions('notification', {
      info: 'info',
      notifyError: 'error',
    }),
    async renderCurrentFile() {
      const currentFile = store.getters['file/current'];
      this.isRendering = true;
      this.errorMessage = null;
      try {
        this.result = await exportSvc.renderHtml(currentFile.id, {
          includeToc: this.includeToc,
        });
      } catch (error) {
        this.errorMessage = 'HTML export could not be prepared. Please try again.';
        this.notifyError(error);
      } finally {
        this.isRendering = false;
      }
    },
    async resolve() {
      const { config } = this;
      const currentFile = store.getters['file/current'];
      config.resolve();
      await exportSvc.exportHtmlToDisk(currentFile.id, this.includeToc);
    },
  },
});
</script>

<style lang="scss">
.html-export__toc {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.modal__inner-1.modal__inner-1--html-export {
  max-width: 600px;
}

@media (max-width: 540px) {
  .modal__inner-1--html-export .modal__inner-2 {
    margin: 24px 10px;
    padding-right: 20px;
    padding-left: 20px;
  }

  .modal__inner-1--html-export .modal__button-bar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .modal__inner-1--html-export .modal__button-bar > .button {
    flex: 0 0 auto;
  }

  .modal__inner-1--html-export .modal__button-bar > .button--resolve {
    margin-left: auto;
  }
}
</style>
