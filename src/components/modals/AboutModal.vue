<template>
  <modal-inner class="modal__inner-1--about-modal" aria-label="About">
    <div class="modal__content">
      <div class="logo-background"></div>
      StackEdit Serverless
      <br>
      <a target="_blank" rel="noopener noreferrer" href="https://privapps.github.io/stackedit-serverless/">Project site</a> — <a target="_blank" rel="noopener noreferrer" href="https://github.com/privapps/stackedit-serverless">Source code</a>
      <hr>
      <small>© 2013-2019 Dock5 Software Ltd.<br>v{{version}}</small>
      <h3>FAQ</h3>
      <div class="faq" v-html="faq"></div>
      <div class="modal__info">
        Read about <a target="_blank" rel="noopener noreferrer" href="https://github.com/privapps/stackedit-serverless#what-it-does">data storage</a>.
      </div>
      Licensed under an
      <a target="_blank" rel="noopener noreferrer" href="https://www.apache.org/licenses/LICENSE-2.0">Apache License</a>
    </div>
    <div class="modal__button-bar">
      <button class="button button--resolve" @click="config.resolve()">Close</button>
    </div>
  </modal-inner>
</template>

<script>
import { mapGetters } from 'vuex';
import ModalInner from './common/ModalInner';
import markdownConversionSvc from '../../services/markdownConversionSvc';
import faq from '../../data/faq.md';

export default {
  components: {
    ModalInner,
  },
  data: () => ({
    version: VERSION,
  }),
  computed: {
    ...mapGetters('modal', [
      'config',
    ]),
    faq() {
      return markdownConversionSvc.defaultConverter.render(faq);
    },
  },
};
</script>

<style lang="scss">
.modal__inner-1--about-modal {
  text-align: center;

  .logo-background {
    height: 75px;
    margin: 0.5em 0;
  }

  small {
    display: block;
  }

  hr {
    width: 160px;
    max-width: 100%;
    margin: 1.5em auto;
  }
}

.faq {
  font-size: 0.8em;
  line-height: 1.5;
}
</style>
