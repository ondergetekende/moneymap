import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import DashboardView from '@/views/DashboardView.vue'
import NetWorthChart from '@/components/NetWorthChart.vue'
import AnnualBreakdownTable from '@/components/AnnualBreakdownTable.vue'
import { usePlannerStore } from '@/stores/planner'
import { formatCurrency } from '@/utils/format'

vi.mock('vue-chartjs', () => ({
  Line: { name: 'Line', props: ['data', 'options', 'plugins'], template: '<div />' },
}))

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})

it('shows the selected plan as a separate, inflation-adjusted net worth line', async () => {
  const store = usePlannerStore()
  store.createScenario('Earlier', { type: 'empty' })
  store.setLiquidAssetsInterestRate(0)
  store.setInflationRate(10)
  store.addCapitalAccount({ type: 'liquid', name: 'Savings', amount: 1000 })
  store.addLifeEvent({ name: 'Long horizon', date: { type: 'age', age: 95 } })
  store.duplicateScenario('Current')
  store.setInflationRate(0)
  store.updateCapitalAccount(store.capitalAccounts[0]!.id, { amount: 2000 })
  store.removeLifeEvent(store.lifeEvents[0]!.id)

  const wrapper = mount(DashboardView, {
    global: {
      stubs: {
        BasicInfoSummary: true,
        BasicInfoWizard: true,
        FinancialListItem: true,
        ActionButtons: true,
        TimelineScrubber: true,
        LifeEventNavBoxes: true,
      },
    },
  })
  const line = () => wrapper.findComponent(NetWorthChart).findComponent({ name: 'Line' })
  expect(line().props('data').datasets).toHaveLength(2)
  const breakdown = wrapper.findComponent(AnnualBreakdownTable)
  const headings = () => breakdown.findAll('thead th').map((th) => th.text())
  const tableRows = () => breakdown.findAll('tbody tr')
  expect(breakdown.findAll('table')).toHaveLength(1)
  expect(headings().slice(0, 3)).toEqual(['Year', 'Age', 'Starting Balance'])
  const compareButton = (name: string) =>
    wrapper
      .find('[role="group"][aria-label="Compare with"]')
      .findAll('button')
      .find((button) => button.text() === name)!
  await compareButton('Earlier').trigger('click')
  expect(wrapper.find('.plans .comparison').exists()).toBe(false)
  expect(breakdown.findAll('table')).toHaveLength(1)
  expect(headings().slice(0, 6)).toEqual([
    'Year',
    'Age',
    'Net worth: Current',
    'Net worth: Earlier',
    'Net worth difference',
    'Starting Balance',
  ])
  expect(
    tableRows()[0]!
      .findAll('td')
      .slice(2, 5)
      .map((td) => td.text()),
  ).toEqual([formatCurrency(2000), formatCurrency(1000), formatCurrency(1000)])
  expect(tableRows()[1]!.findAll('td')[3]!.text()).toBe(formatCurrency(1000 / 1.1))
  const laterCells = tableRows().at(-1)!.findAll('td')
  expect(laterCells[1]!.text()).toBe('—')
  expect(laterCells[2]!.text()).toBe('—')
  expect(laterCells[3]!.text()).not.toBe('—')
  expect(laterCells[4]!.text()).toBe('—')
  expect(laterCells.slice(5).every((cell) => cell.text() === '—')).toBe(true)
  const data = line().props('data')
  expect(data.datasets).toHaveLength(3)
  expect(data.datasets[2].label).toBe('Comparison: Earlier')
  expect(data.datasets[2].stack).not.toBe(data.datasets[0].stack)
  expect(data.datasets[2].data[0]).toBeCloseTo(1000)
  expect(data.datasets[2].data[1]).toBeCloseTo(1000 / 1.1)
  expect(data.datasets[2].data.length).toBeGreaterThan(
    store.projectionResult!.annualSummaries.length,
  )
  expect(data.datasets[0].data.at(-1)).toBeNull()
  const options = line().props('options')
  expect(options.scales.x.title.text).toBe('Year (current plan age)')
  const footer = options.plugins.tooltip.callbacks.footer
  expect(
    footer([
      { datasetIndex: 0, parsed: { y: 2000 } },
      { datasetIndex: 1, parsed: { y: 0 } },
      { datasetIndex: 2, parsed: { y: 1000 } },
    ]),
  ).toBe(`Total Net Worth: ${formatCurrency(2000)}`)
  expect(footer([{ datasetIndex: 2, parsed: { y: 1000 } }])).toBe('')

  await wrapper.find('input.toggle-checkbox').setValue(false)
  expect(line().props('data').datasets[2].data[1]).toBeCloseTo(1000)
  expect(tableRows()[1]!.findAll('td')[3]!.text()).toBe(formatCurrency(1000))
  await compareButton('No comparison').trigger('click')
  await nextTick()
  expect(line().props('data').datasets).toHaveLength(2)
  expect(headings().slice(0, 3)).toEqual(['Year', 'Age', 'Starting Balance'])
  expect(tableRows()).toHaveLength(store.projectionResult!.annualSummaries.length)

  await wrapper
    .find('[role="group"][aria-label="Current plan"]')
    .findAll('button')
    .find((button) => button.text() === 'Earlier')!
    .trigger('click')
  await compareButton('Current').trigger('click')
  const currentOnlyCells = tableRows().at(-1)!.findAll('td')
  expect(currentOnlyCells[1]!.text()).not.toBe('—')
  expect(currentOnlyCells[2]!.text()).not.toBe('—')
  expect(currentOnlyCells[3]!.text()).toBe('—')
  expect(currentOnlyCells[4]!.text()).toBe('—')
  expect(currentOnlyCells[5]!.text()).not.toBe('—')
  await compareButton('No comparison').trigger('click')

  store.createScenario('Blank', { type: 'empty' })
  await nextTick()
  expect(wrapper.findComponent(NetWorthChart).exists()).toBe(false)
  await compareButton('Earlier').trigger('click')
  expect(wrapper.findComponent(NetWorthChart).exists()).toBe(true)
  expect(line().props('data').datasets[2].label).toBe('Comparison: Earlier')
})
