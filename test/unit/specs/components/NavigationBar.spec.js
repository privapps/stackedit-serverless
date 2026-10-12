import NavigationBar from '../../../../src/components/NavigationBar';
import store from '../../../../src/store';
import specUtils from '../specUtils';

describe('NavigationBar.vue', () => {
  it('should toggle the explorer', async () => specUtils.checkToggler(
    NavigationBar,
    wrapper => wrapper.find('.navigation-bar__button--explorer-toggler').trigger('click'),
    () => store.getters['data/layoutSettings'].showExplorer,
  ));

  it('should toggle the side bar', async () => specUtils.checkToggler(
    NavigationBar,
    wrapper => wrapper.find('.navigation-bar__button--menu').trigger('click'),
    () => store.getters['data/layoutSettings'].showSideBar,
  ));

  it('exposes an accessible workspace search button independently of the explorer', async () => {
    const wrapper = specUtils.shallowMount(NavigationBar);
    const button = wrapper.find('.navigation-bar__button--workspace-search');

    expect(button.attributes('aria-label')).toBe('Search workspace');
    await button.trigger('click');
    expect(wrapper.emitted('open-workspace-search')).toHaveLength(1);
  });
});
