import Vue from 'vue';
import 'fake-indexeddb/auto';

Vue.configureCompat({ MODE: 2 });

await import('../../src/icons');
await import('../../src/components/common/vueGlobals');
await import('../../src/extensions');
