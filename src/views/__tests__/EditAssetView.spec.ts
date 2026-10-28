import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FixedAsset, LiquidAsset } from '@/models'
import { usePlannerStore } from '@/stores/planner'
import EditAssetView from '../EditAssetView.vue'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe('EditAssetView', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('saves and clears a zero percent liquid rate without showing liquidation', async () => {
    const store = usePlannerStore()
    store.capitalAccounts = [new LiquidAsset('savings', 'Savings', 1000, undefined, undefined, 3)]
    const wrapper = mount(EditAssetView, {
      props: { id: 'savings' },
      global: { stubs: ['DateSpecificationEdit'] },
    })

    expect(wrapper.findComponent({ name: 'DateSpecificationEdit' }).exists()).toBe(false)
    await wrapper.get('#interest-rate').setValue('0')
    await wrapper.get('form').trigger('submit')
    expect((store.capitalAccounts[0] as LiquidAsset).annualInterestRate).toBe(0)

    await wrapper.get('#interest-rate').setValue('')
    await wrapper.get('form').trigger('submit')
    expect((store.capitalAccounts[0] as LiquidAsset).annualInterestRate).toBeUndefined()
  })

  it('saves a zero percent fixed asset rate', async () => {
    const store = usePlannerStore()
    store.capitalAccounts = [new FixedAsset('house', 'House', 1000, 3)]
    const wrapper = mount(EditAssetView, {
      props: { id: 'house' },
      global: { stubs: ['DateSpecificationEdit'] },
    })

    await wrapper.get('#interest-rate').setValue('0')
    await wrapper.get('form').trigger('submit')
    expect((store.capitalAccounts[0] as FixedAsset).annualInterestRate).toBe(0)
  })
})
