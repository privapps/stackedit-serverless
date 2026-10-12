import moduleTemplate from './moduleTemplate';
import empty from '../data/empties/emptyContent';
import utils from '../services/utils';

const module = moduleTemplate(empty);

module.getters = {
  ...module.getters,
  current: ({ itemsById }, getters, rootState, rootGetters) =>
    itemsById[`${rootGetters['file/current'].id}/content`] || empty(),
  currentChangeTrigger: (state, getters) => {
    const { current } = getters;
    return utils.serializeObject([
      current.id,
      current.text,
      current.hash,
    ]);
  },
  currentProperties: (state, { current }) => utils.computeProperties(current.properties),
  isCurrentEditable: (state, { current }, rootState, rootGetters) =>
    current.id && rootGetters['layout/styles'].showEditor,
};

module.actions = {
  ...module.actions,
  patchCurrent({ getters, commit }, value) {
    const { id } = getters.current;
    if (id) {
      commit('patchItem', {
        ...value,
        id,
      });
    }
  },
};

export default module;
