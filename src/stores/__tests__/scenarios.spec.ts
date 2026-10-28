import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import AboutView from '@/views/AboutView.vue'
import NewPlanDialog from '@/components/NewPlanDialog.vue'
import ScenarioPlans from '@/components/ScenarioPlans.vue'
import { LiquidAsset, UserProfile } from '@/models'
import { storageService } from '@/services/storage'
import { usePlannerStore } from '../planner'

describe('Plans', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
  })

  it('shows landing actions for zero, one, and multiple plans', async () => {
    const store = usePlannerStore()
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: AboutView },
        { path: '/app', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    await router.isReady()
    const landing = mount(AboutView, {
      global: { plugins: [router], stubs: { NetWorthChart: true, RouterLink: true } },
    })
    const actions = () => landing.findAll('.hero-cta').map((button) => button.text())
    expect(actions()).toEqual([])
    expect(landing.find('.saved-plans').exists()).toBe(false)
    const newPlan = landing.findComponent(NewPlanDialog)
    expect(newPlan.exists()).toBe(true)
    const dialog = newPlan.find('dialog').element
    dialog.showModal = vi.fn()
    dialog.close = vi.fn()
    await newPlan.find('button').trigger('click')
    await newPlan.find('input').setValue('First')
    await newPlan.find('select').setValue('empty')
    await newPlan.find('form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/app')

    await router.push('/')
    await nextTick()
    expect(actions()).toEqual(['Open your plan', 'Open your plan'])
    expect(landing.find('.saved-plans').exists()).toBe(false)
    expect(landing.findComponent(NewPlanDialog).exists()).toBe(false)
    await landing.find('.hero-cta').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/app')

    await router.push('/')
    store.createScenario('Second', { type: 'empty' })
    await nextTick()
    expect(actions()).toEqual([])
    expect(landing.find('.saved-plans h2').text()).toBe('Your plans')
    expect(landing.findAll('.saved-plans li button').map((button) => button.text())).toEqual([
      'First',
      'Second',
    ])
    expect(landing.findComponent(NewPlanDialog).exists()).toBe(false)
  })

  it('creates independent plans from empty, template, and an existing plan', async () => {
    const store = usePlannerStore()
    store.createScenario('Blank', { type: 'empty' })
    const blankId = store.activeScenarioId
    expect(store.scenarios).toHaveLength(1)
    expect(store.allItems).toHaveLength(0)
    expect(store.showWizard).toBe(false)

    store.createScenario('Example', { type: 'template' })
    const exampleId = store.activeScenarioId
    expect(store.allItems.length).toBeGreaterThan(0)
    expect(store.showWizard).toBe(false)
    store.addLifeEvent({ name: 'Test event' })
    store.createScenario('Example copy', { type: 'existing', id: exampleId })
    store.addLifeEvent({ name: 'Copy event' })
    store.switchScenario(exampleId)
    expect(store.lifeEvents.map((event) => event.name)).not.toContain('Copy event')
    store.createScenario('From blank', { type: 'existing', id: blankId })
    expect(store.allItems).toHaveLength(0)
    store.switchScenario(exampleId)
    expect(store.allItems.length).toBeGreaterThan(0)
    await nextTick()

    setActivePinia(createPinia())
    const restored = usePlannerStore()
    restored.loadFromStorage()
    expect(restored.scenarios.map((scenario) => scenario.name)).toEqual([
      'Blank',
      'Example',
      'Example copy',
      'From blank',
    ])
    restored.switchScenario(blankId)
    expect(restored.allItems).toHaveLength(0)
  })

  it('creates a plan with the shared dialog and opens saved plans from the landing page', async () => {
    const store = usePlannerStore()
    store.createScenario('First', { type: 'empty' })
    const firstId = store.activeScenarioId
    store.createScenario('Second', { type: 'template' })
    const wrapper = mount(NewPlanDialog)
    const dialog = wrapper.find('dialog').element
    dialog.showModal = vi.fn()
    dialog.close = vi.fn()
    await wrapper.find('button').trigger('click')
    await wrapper.find('input').setValue('Copied first')
    expect(wrapper.findAll('select')).toHaveLength(1)
    expect(wrapper.findAll('select option').map((option) => option.attributes('value'))).toContain(
      `plan:${firstId}`,
    )
    await wrapper.find('select').setValue(`plan:${firstId}`)
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('created')).toHaveLength(1)
    expect(store.allItems).toHaveLength(0)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: AboutView },
        { path: '/app', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    await router.isReady()
    const landing = mount(AboutView, {
      global: { plugins: [router], stubs: { NetWorthChart: true, RouterLink: true } },
    })
    const plans = landing.findAll('.saved-plans li button')
    expect(plans.map((button) => button.text())).toEqual(['First', 'Second', 'Copied first'])
    await plans[0]!.trigger('click')
    await flushPromises()
    expect(store.activeScenarioId).toBe(firstId)
    expect(router.currentRoute.value.path).toBe('/app')
  })

  it('switches and compares plans with buttons without losing state on a save error', async () => {
    const store = usePlannerStore()
    store.createScenario('First', { type: 'empty' })
    const firstId = store.activeScenarioId
    store.createScenario('Second', { type: 'template' })
    const secondId = store.activeScenarioId
    const wrapper = mount(ScenarioPlans)
    const buttons = (label: string) =>
      wrapper.find(`[role="group"][aria-label="${label}"]`).findAll('button')
    await buttons('Compare with')
      .find((button) => button.text() === 'First')!
      .trigger('click')
    expect(wrapper.emitted('comparisonChange')!.at(-1)![0]).toMatchObject({ name: 'First' })
    await buttons('Current plan')
      .find((button) => button.text() === 'First')!
      .trigger('click')
    expect(store.activeScenarioId).toBe(firstId)
    await nextTick()
    expect(wrapper.emitted('comparisonChange')!.at(-1)![0]).toBeNull()

    const save = vi.spyOn(storageService, 'savePlans').mockImplementation(() => {
      throw new Error('Storage full')
    })
    await buttons('Current plan')
      .find((button) => button.text() === 'Second')!
      .trigger('click')
    expect(store.activeScenarioId).toBe(firstId)
    expect(store.activeScenarioId).not.toBe(secondId)
    expect(wrapper.find('[role="alert"]').text()).toBe('Storage full')
    save.mockRestore()
  })

  it('places new plan beside the choices and renames a plan in a dialog', async () => {
    const store = usePlannerStore()
    store.createScenario('First', { type: 'empty' })
    const wrapper = mount(ScenarioPlans)
    expect(
      wrapper
        .find('[role="group"][aria-label="Current plan"]')
        .findComponent(NewPlanDialog)
        .exists(),
    ).toBe(true)
    expect(wrapper.find('.controls > form').exists()).toBe(false)
    const dialog = wrapper.find<HTMLDialogElement>('dialog[aria-labelledby="rename-plan-title"]')
    const element = dialog.element
    element.showModal = vi.fn()
    element.close = vi.fn()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Rename current plan')!
      .trigger('click')
    expect(element.showModal).toHaveBeenCalledOnce()
    expect((dialog.find('input').element as HTMLInputElement).value).toBe('First')
    await dialog.find('input').setValue('Updated')
    await dialog.find('form').trigger('submit')
    expect(store.scenarios[0]!.name).toBe('Updated')
    expect(element.close).toHaveBeenCalledOnce()

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Rename current plan')!
      .trigger('click')
    const save = vi.spyOn(storageService, 'savePlans').mockImplementation(() => {
      throw new Error('Storage full')
    })
    await dialog.find('input').setValue('Not saved')
    await dialog.find('form').trigger('submit')
    expect(dialog.find('[role="alert"]').text()).toBe('Storage full')
    expect(store.scenarios[0]!.name).toBe('Updated')
    expect(element.close).toHaveBeenCalledOnce()
    save.mockRestore()
    await dialog
      .findAll('button')
      .find((button) => button.text() === 'Cancel')!
      .trigger('click')
    expect(element.close).toHaveBeenCalledTimes(2)
  })

  it('deletes only the current plan and keeps the last plan', async () => {
    const store = usePlannerStore()
    store.createScenario('First', { type: 'empty' })
    const firstId = store.activeScenarioId
    store.addCapitalAccount({ type: 'liquid', name: 'Savings', amount: 1234 })
    store.createScenario('Second', { type: 'template' })
    const secondId = store.activeScenarioId
    const wrapper = mount(ScenarioPlans)
    const controls = wrapper.find('.controls')
    const actions = controls.findAll(':scope > button')
    expect(actions.map((button) => button.text())).toEqual(['Rename current plan', 'Delete Second'])
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    await actions[1]!.trigger('click')
    expect(store.activeScenarioId).toBe(secondId)
    expect(store.scenarios).toHaveLength(2)

    const save = vi.spyOn(storageService, 'savePlans').mockImplementation(() => {
      throw new Error('Storage full')
    })
    await actions[1]!.trigger('click')
    expect(store.activeScenarioId).toBe(secondId)
    expect(store.scenarios).toHaveLength(2)
    expect(wrapper.find('[role="alert"]').text()).toBe('Storage full')
    save.mockRestore()
    await actions[1]!.trigger('click')
    await nextTick()
    expect(store.activeScenarioId).toBe(firstId)
    expect(store.capitalAccounts[0]!.amount).toBe(1234)
    expect(storageService.loadPlans()!.scenarios.map((plan) => plan.name)).toEqual(['First'])
    const deleteLast = controls.findAll(':scope > button')[1]!
    expect(deleteLast.text()).toBe('Delete First')
    expect(deleteLast.attributes('disabled')).toBeDefined()
    expect(() => store.deleteScenario(firstId)).toThrow('Keep at least one plan.')
    confirm.mockRestore()
  })

  it('migrates a legacy plan, copies it, compares changes, and restores both plans', async () => {
    const profile = new UserProfile(1200, [new LiquidAsset('savings', 'Savings', 1000)], [], 0)
    storageService.saveProfile(profile)
    storageService.saveWizardCompleted(true)
    const store = usePlannerStore()
    expect(store.loadFromStorage()).toBe(true)
    const originalId = store.activeScenarioId
    store.renameScenario('Original')
    store.duplicateScenario('Higher savings')
    const copyId = store.activeScenarioId
    store.updateCapitalAccount('savings', { amount: 2000 })
    await nextTick()
    expect(storageService.hasProfile()).toBe(false)

    const wrapper = mount(ScenarioPlans)
    const compare = wrapper.find('[role="group"][aria-label="Compare with"]')
    await compare
      .findAll('button')
      .find((button) => button.text() === 'Original')!
      .trigger('click')
    expect(wrapper.find('dialog button[type="submit"]').classes()).toContain('btn-primary')
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text() === 'Rename current plan')!
        .classes(),
    ).toContain('btn-secondary')
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text() === 'Delete Higher savings')!
        .classes(),
    ).toContain('btn-danger')
    const original = storageService.loadPlans()!.scenarios.find((plan) => plan.id === originalId)!
    expect(original.name).toBe('Original')
    expect(original.profile.capitalAccounts).toEqual([
      expect.objectContaining({ id: 'savings', amount: 1000 }),
    ])
    expect(wrapper.emitted('comparisonChange')!.at(-1)![0]).toMatchObject({ name: 'Original' })

    setActivePinia(createPinia())
    const restored = usePlannerStore()
    expect(restored.loadFromStorage()).toBe(true)
    expect(restored.activeScenarioId).toBe(copyId)
    expect(restored.capitalAccounts[0]!.amount).toBe(2000)
    restored.switchScenario(originalId)
    expect(restored.capitalAccounts[0]).toBeInstanceOf(LiquidAsset)
    expect(restored.capitalAccounts[0]!.amount).toBe(1000)
    expect(restored.wizardCompleted).toBe(true)
    restored.deleteScenario(copyId)
    expect(storageService.loadPlans()!.scenarios).toHaveLength(1)
  })

  it('does not replace corrupt saved plans or switch if saving fails', async () => {
    localStorage.setItem('moneymap-scenarios', '{bad')
    const store = usePlannerStore()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => store.loadFromStorage()).toThrow('Failed to load saved plans')
    store.setInflationRate(4)
    await nextTick()
    expect(localStorage.getItem('moneymap-scenarios')).toBe('{bad')
    log.mockRestore()

    localStorage.clear()
    setActivePinia(createPinia())
    const fresh = usePlannerStore()
    const id = fresh.activeScenarioId
    const save = vi.spyOn(storageService, 'savePlans').mockImplementation(() => {
      throw new Error('Storage full')
    })
    expect(() => fresh.duplicateScenario('Copy')).toThrow('Storage full')
    expect(fresh.activeScenarioId).toBe(id)
    expect(fresh.scenarios).toHaveLength(0)
    save.mockRestore()
  })
})
