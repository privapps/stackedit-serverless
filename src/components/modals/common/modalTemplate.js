import ModalInner from './ModalInner';
import FormEntry from './FormEntry';
import store from '../../../store';

export default (desc) => {
  const component = {
    ...desc,
    data: () => ({
      ...desc.data ? desc.data() : {},
      errorTimeouts: {},
    }),
    components: {
      ...desc.components || {},
      ModalInner,
      FormEntry,
    },
    computed: {
      ...desc.computed || {},
      config() {
        return store.getters['modal/config'];
      },
      currentFileName() {
        return store.getters['file/current'].name;
      },
    },
    methods: {
      ...desc.methods || {},
      openFileProperties: () => store.dispatch('modal/open', 'fileProperties'),
      setError(name) {
        clearTimeout(this.errorTimeouts[name]);
        const formEntry = this.$el.querySelector(`.form-entry[error=${name}]`);
        if (formEntry) {
          formEntry.classList.add('form-entry--error');
          this.errorTimeouts[name] = setTimeout(() => {
            formEntry.classList.remove('form-entry--error');
          }, 1000);
        }
      },
    },
  };
  return component;
};
