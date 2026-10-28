import { mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import PlanChoice from '../PlanChoice.vue'

afterEach(() => vi.unstubAllGlobals())

it('uses buttons when plans fit and a dropdown when they do not', async () => {
  let trigger: () => void
  class TestObserver implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      trigger = () => callback([], this)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', TestObserver)
  const wrapper = mount(PlanChoice, {
    props: {
      label: 'Current plan',
      modelValue: 'a',
      options: [
        { value: 'a', label: 'First' },
        { value: 'b', label: 'Second' },
      ],
    },
  })

  const container = wrapper.element as HTMLElement
  const measure = wrapper.find('.choice-measure').element
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: 250 })
  const rect = measure.getBoundingClientRect()
  vi.spyOn(measure, 'getBoundingClientRect').mockReturnValue({ ...rect, width: 200 })
  trigger!()
  await nextTick()
  const buttons = wrapper.findAll('[role="group"] button')
  expect(buttons.map((button) => button.text())).toEqual(['First', 'Second'])
  expect(buttons[0]!.attributes('aria-pressed')).toBe('true')
  await buttons[1]!.trigger('click')
  expect(wrapper.emitted('update:modelValue')![0]).toEqual(['b'])
  expect(wrapper.find('select').exists()).toBe(false)

  vi.spyOn(measure, 'getBoundingClientRect').mockReturnValue({ ...rect, width: 300 })
  trigger!()
  await nextTick()
  expect(wrapper.findAll('[role="group"] button')).toHaveLength(0)
  const select = wrapper.find('select')
  expect(select.exists()).toBe(true)
  await select.setValue('b')
  expect(wrapper.emitted('update:modelValue')![1]).toEqual(['b'])

  vi.spyOn(measure, 'getBoundingClientRect').mockReturnValue({ ...rect, width: 200 })
  window.dispatchEvent(new Event('resize'))
  await nextTick()
  expect(wrapper.findAll('[role="group"] button')).toHaveLength(2)

  vi.spyOn(measure, 'getBoundingClientRect').mockReturnValue({ ...rect, width: 300 })
  document.dispatchEvent(new Event('visibilitychange'))
  await nextTick()
  expect(wrapper.find('select').exists()).toBe(true)
})

it('keeps the action beside the plan choices and accounts for its width', async () => {
  let trigger: () => void
  class TestObserver implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      trigger = () => callback([], this)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', TestObserver)
  const wrapper = mount(PlanChoice, {
    props: {
      label: 'Current plan',
      modelValue: 'a',
      options: [{ value: 'a', label: 'First' }],
    },
    slots: { action: '<button type="button">New plan</button>' },
  })
  expect(wrapper.find('[role="group"]').text()).toContain('New plan')
  const actionButton = wrapper.find('.choice-action button').element
  const container = wrapper.element as HTMLElement
  const measure = wrapper.find('.choice-measure').element
  const action = wrapper.find('.choice-action').element
  const choices = wrapper.find('[role="group"]').element as HTMLElement
  choices.style.columnGap = '8px'
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: 250 })
  vi.spyOn(measure, 'getBoundingClientRect').mockReturnValue({
    ...measure.getBoundingClientRect(),
    width: 200,
  })
  vi.spyOn(action, 'getBoundingClientRect').mockReturnValue({
    ...action.getBoundingClientRect(),
    width: 50,
  })
  trigger!()
  await nextTick()
  expect(wrapper.find('select').exists()).toBe(true)
  expect(wrapper.find('[role="group"]').text()).toContain('New plan')
  expect(wrapper.find('.choice-action button').element).toBe(actionButton)
})
