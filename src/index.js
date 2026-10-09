import 'regenerator-runtime/runtime';
import './libs/indexeddbShim';
import './vueCompat';
import Vue from 'vue';
import './extensions';
import './services/optional';
import './icons';
import App from './components/App';
import store from './store';

if (!indexedDB) {
  throw new Error('Your browser is not supported. Please upgrade to the latest version.');
}

if (NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch((error) => {
    console.error('Service worker registration failed:', error);
  });
}

if (localStorage.updated) {
  store.dispatch('notification/info', 'StackEdit has just updated itself!');
  setTimeout(() => localStorage.removeItem('updated'), 2000);
}

if (!localStorage.installPrompted) {
  window.addEventListener('beforeinstallprompt', async (promptEvent) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    promptEvent.preventDefault();

    try {
      await store.dispatch('notification/confirm', 'Add StackEdit to your home screen?');
      promptEvent.prompt();
      await promptEvent.userChoice;
    } catch (err) {
      // Cancel
    }
    localStorage.installPrompted = true;
  });
}

Vue.createApp(App)
  .use(store)
  .mount('#app');
