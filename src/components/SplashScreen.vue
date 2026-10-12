<template>
  <div class="splash-screen">
    <div class="splash-screen__inner logo-background"></div>
    <p class="splash-screen__error" role="alert" v-if="error">{{error}}</p>
  </div>
</template>

<script>
export default {
  props: {
    error: {
      type: String,
      default: '',
    },
  },
};
</script>

<style lang="scss">
.splash-screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  padding: 25px;
}

.splash-screen__inner {
  margin: 0 auto;
  max-width: 600px;
  height: 100%;
}

.splash-screen__error {
  position: absolute;
  bottom: 25px;
  left: 25px;
  right: 25px;
  text-align: center;
}
</style>
