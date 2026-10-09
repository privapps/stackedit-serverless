import { createStore } from 'vuex';
import modal from '../../../src/store/modal';

describe('modal state', () => {
  it('removes a resolved modal from its reactive stack', async () => {
    const store = createStore({
      modules: {
        modal,
      },
    });
    const pendingModal = store.dispatch('modal/open', 'htmlExport');

    store.getters['modal/config'].resolve('done');

    await expect(pendingModal).resolves.toBe('done');
    expect(store.state.modal.stack).toEqual([]);
    expect(store.getters['modal/config']).toBeFalsy();
  });
});
