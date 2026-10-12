<template>
  <div class="preview">
    <div class="preview__inner-1" @click="onClick" @scroll="onScroll">
      <div class="preview__inner-2" :style="{padding: styles.previewPadding}">
      </div>
    </div>
    <div v-if="!styles.showEditor" class="preview__corner">
      <button class="preview__button button" @click="toggleEditor(true)" v-title="'Edit file'">
        <icon-pen></icon-pen>
      </button>
    </div>
  </div>
</template>


<script>
import { mapGetters, mapActions } from 'vuex';

const appUri = `${window.location.protocol}//${window.location.host}`;

export default {
  data: () => ({
    previewTop: true,
  }),
  computed: {
    ...mapGetters('layout', [
      'styles',
    ]),
  },
  methods: {
    ...mapActions('data', [
      'toggleEditor',
    ]),
    onClick(evt) {
      let elt = evt.target;
      while (elt !== this.$el) {
        if (elt.href && elt.href.match(/^https?:\/\//)
          && (!elt.hash || elt.href.slice(0, appUri.length) !== appUri)) {
          evt.preventDefault();
          const wnd = window.open(elt.href, '_blank');
          wnd.focus();
          return;
        }
        elt = elt.parentNode;
      }
    },
    onScroll(evt) {
      this.previewTop = evt.target.scrollTop < 10;
    },
  },
};
</script>

<style lang="scss">
@import '../styles/variables.scss';

.preview,
.preview__inner-1 {
  position: absolute;
  width: 100%;
  height: 100%;
}

.preview__inner-1 {
  overflow: auto;
}

.preview__inner-2 {
  margin: 0;
}

.preview__inner-2 > :first-child > :first-child {
  margin-top: 0;
}

$corner-size: 110px;

.preview__corner {
  position: absolute;
  top: 0;
  right: 0;

  &::before {
    content: '';
    position: absolute;
    right: 0;
    border-top: $corner-size solid rgb(0 0 0 / 7.5%);
    border-left: $corner-size solid transparent;
    pointer-events: none;

    .app--dark & {
      border-top-color: rgb(255 255 255 / 7.5%);
    }
  }
}

.preview__button {
  position: absolute;
  top: 15px;
  right: 15px;
  width: 40px;
  height: 40px;
  padding: 5px;
  color: rgb(0 0 0 / 25%);

  .app--dark & {
    color: rgb(255 255 255 / 25%);
  }

  &:active,
  &:focus,
  &:hover {
    color: rgb(0 0 0 / 33%);
    background-color: transparent;

    .app--dark & {
      color: rgb(255 255 255 / 33%);
    }
  }
}
</style>
