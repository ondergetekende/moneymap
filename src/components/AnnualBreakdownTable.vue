<template>
  <div class="table-container">
    <h3>Annual Breakdown</h3>
    <p v-if="comparison" class="comparison-hint">
      Net worth is a year-end value. Difference is {{ currentPlanName ?? 'Current plan' }} minus
      {{ comparison.name }}.
      {{
        showInflationAdjusted
          ? 'Each plan uses its own inflation rate.'
          : 'Values are not adjusted for inflation.'
      }}
    </p>
    <div ref="tableWrapper" class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Age</th>
            <template v-if="comparison">
              <th>Net worth: {{ currentPlanName ?? 'Current plan' }}</th>
              <th>Net worth: {{ comparison.name }}</th>
              <th>Net worth difference</th>
            </template>
            <th>Starting Balance</th>
            <th>Starting Debt</th>
            <th>Total Income</th>
            <th>Total Expenses</th>
            <th>Income Tax</th>
            <th>Wealth Tax</th>
            <th>Cap. Gains Tax</th>
            <th>Total Tax</th>
            <th>Debt Paid</th>
            <th>Net Change</th>
            <th>Ending Balance</th>
            <th>Ending Debt</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in displayRows"
            :key="row.year"
            :ref="(el) => setRowRef(el as HTMLTableRowElement | null, row.year)"
            :class="{
              negative: (row.current?.endingBalanceValue ?? 0) < 0,
              selected: selectedYear === row.year,
            }"
          >
            <td>{{ row.year }}</td>
            <td>{{ row.current?.age ?? '—' }}</td>
            <template v-if="comparison">
              <td>
                {{ row.currentNetWorth === undefined ? '—' : formatCurrency(row.currentNetWorth) }}
              </td>
              <td>
                {{ row.otherNetWorth === undefined ? '—' : formatCurrency(row.otherNetWorth) }}
              </td>
              <td>{{ row.difference === undefined ? '—' : formatCurrency(row.difference) }}</td>
            </template>
            <td>{{ row.current?.startingBalance ?? '—' }}</td>
            <td class="debt">{{ row.current?.startingDebt ?? '—' }}</td>
            <td class="income">{{ row.current?.totalIncome ?? '—' }}</td>
            <td class="expenses">{{ row.current?.totalExpenses ?? '—' }}</td>
            <td class="tax">{{ row.current?.incomeTax ?? '—' }}</td>
            <td class="tax">{{ row.current?.wealthTax ?? '—' }}</td>
            <td class="tax">{{ row.current?.capitalGainsTax ?? '—' }}</td>
            <td class="total-tax">{{ row.current?.totalTax ?? '—' }}</td>
            <td class="debt-paid">{{ row.current?.debtPaid ?? '—' }}</td>
            <td
              :class="{
                'net-positive': row.current?.netPositive,
                'net-negative': row.current?.netNegative,
              }"
            >
              {{ row.current?.netChange ?? '—' }}
            </td>
            <td :class="{ 'balance-negative': (row.current?.endingBalanceValue ?? 0) < 0 }">
              {{ row.current?.endingBalance ?? '—' }}
            </td>
            <td class="debt">{{ row.current?.endingDebt ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { AnnualSummary } from '@/models'
import { formatCurrency, adjustForInflation } from '@/utils/format'
import { getCurrentMonth } from '@/types/month'
import { resolveSelectedYear } from '@/utils/timeline'

const props = defineProps<{
  annualSummaries: AnnualSummary[]
  showInflationAdjusted?: boolean
  inflationRate?: number
  selectedMonthOffset?: number
  currentPlanName?: string
  comparison?: { name: string; annualSummaries: AnnualSummary[]; inflationRate: number } | null
}>()

interface AnnualRow {
  year: number
  age: number
  startingBalance: string
  startingDebt: string
  totalIncome: string
  totalExpenses: string
  incomeTax: string
  wealthTax: string
  capitalGainsTax: string
  totalTax: string
  debtPaid: string
  netChange: string
  endingBalance: string
  endingBalanceValue: number
  endingDebt: string
  netNegative: boolean
  netPositive: boolean
}

// One inflation-adjusted row per annual summary, with formatted currency values.
const rows = computed<AnnualRow[]>(() => {
  const currentYear = props.annualSummaries[0]?.year ?? new Date().getFullYear()
  const adjust = (value: number, year: number) =>
    props.showInflationAdjusted
      ? adjustForInflation(value, year - currentYear, props.inflationRate)
      : value
  const fmt = (value: number, year: number) => formatCurrency(adjust(value, year))

  return props.annualSummaries.map((summary) => {
    const debtPayments = summary.totalDebtPrincipalPaid + summary.totalDebtInterestPaid
    const netChangeValue =
      adjust(summary.totalIncome, summary.year) -
      adjust(summary.totalExpenses, summary.year) -
      adjust(debtPayments, summary.year) -
      adjust(summary.totalTaxPaid, summary.year)

    return {
      year: summary.year,
      age: summary.age,
      startingBalance: fmt(summary.startingBalance, summary.year),
      startingDebt: fmt(summary.startingTotalDebt, summary.year),
      totalIncome: fmt(summary.totalIncome, summary.year),
      totalExpenses: fmt(summary.totalExpenses, summary.year),
      incomeTax: fmt(summary.totalIncomeTaxPaid, summary.year),
      wealthTax: fmt(summary.totalWealthTaxPaid, summary.year),
      capitalGainsTax: fmt(summary.totalCapitalGainsTaxPaid, summary.year),
      totalTax: fmt(summary.totalTaxPaid, summary.year),
      debtPaid: fmt(debtPayments, summary.year),
      netChange: formatCurrency(netChangeValue),
      endingBalance: fmt(summary.endingBalance, summary.year),
      endingBalanceValue: adjust(summary.endingBalance, summary.year),
      endingDebt: fmt(summary.endingTotalDebt, summary.year),
      netNegative: netChangeValue < 0,
      netPositive: netChangeValue > 0,
    }
  })
})

const displayRows = computed(() => {
  const currentRows = new Map(rows.value.map((row) => [row.year, row]))
  const currentSummaries = new Map(props.annualSummaries.map((row) => [row.year, row]))
  const otherSummaries = new Map(
    (props.comparison?.annualSummaries ?? []).map((row) => [row.year, row]),
  )
  const years = [...new Set([...currentRows.keys(), ...otherSummaries.keys()])]
  if (props.comparison) years.sort((a, b) => a - b)
  const startYear = new Date().getFullYear()
  function netWorth(summary: AnnualSummary | undefined, inflationRate?: number) {
    if (!summary) return undefined
    const value = summary.endingLiquidAssets + summary.endingFixedAssets - summary.endingTotalDebt
    return props.showInflationAdjusted
      ? adjustForInflation(value, summary.year - startYear, inflationRate)
      : value
  }
  return years.map((year) => {
    const currentNetWorth = netWorth(currentSummaries.get(year), props.inflationRate)
    const otherNetWorth = netWorth(otherSummaries.get(year), props.comparison?.inflationRate)
    return {
      year,
      current: currentRows.get(year),
      currentNetWorth,
      otherNetWorth,
      difference:
        currentNetWorth === undefined || otherNetWorth === undefined
          ? undefined
          : currentNetWorth - otherNetWorth,
    }
  })
})

// The calendar year the scrubber points at, or null when not active.
const selectedYear = computed<number | null>(() => {
  if (props.selectedMonthOffset === undefined || props.annualSummaries.length === 0) return null
  return resolveSelectedYear(getCurrentMonth(), props.selectedMonthOffset)
})

// --- Auto-scroll the selected year row into view, inside the table only ---
// The wrapper scrolls; the page never moves. This keeps the feature usable on
// small screens where scrollIntoView would otherwise jump the whole viewport.
// We use bounding rects (viewport-relative) instead of offsetTop, because a
// table row's offsetTop is reported relative to its <table>, not the wrapper.
const tableWrapper = ref<HTMLDivElement | null>(null)
const rowRefs = new Map<number, HTMLTableRowElement>()

function setRowRef(el: HTMLTableRowElement | null, year: number) {
  if (el) rowRefs.set(year, el)
  else rowRefs.delete(year)
}

watch(selectedYear, (year) => {
  if (year === null) return
  nextTick(() => {
    const wrapper = tableWrapper.value
    const row = rowRefs.get(year)
    if (!wrapper || !row) return

    // Distance from the top of the wrapper's viewport to the row's top.
    const rowRect = row.getBoundingClientRect()
    const wrapperRect = wrapper.getBoundingClientRect()
    const rowTopInWrapper = rowRect.top - wrapperRect.top + wrapper.scrollTop
    const rowBottomInWrapper = rowTopInWrapper + rowRect.height
    const viewTop = wrapper.scrollTop
    const viewBottom = viewTop + wrapper.clientHeight

    if (rowTopInWrapper < viewTop) {
      wrapper.scrollTop = rowTopInWrapper
    } else if (rowBottomInWrapper > viewBottom) {
      wrapper.scrollTop = rowBottomInWrapper - wrapper.clientHeight
    }
  })
})
</script>

<style scoped lang="scss">
.table-container {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background-color: $bg-card;
  border-radius: $radius-lg;
  box-shadow: $shadow-sm;
}

h3 {
  margin-bottom: 1rem;
  color: $text-primary;
}

.comparison-hint {
  margin-bottom: 1rem;
}

.table-wrapper {
  overflow-x: auto;
  max-height: 500px;
  overflow-y: auto;
  position: relative;
  /* Add scroll shadows to indicate scrollable content */
  background:
    linear-gradient(90deg, $bg-card 30%, rgba(255, 255, 255, 0)),
    linear-gradient(90deg, rgba(255, 255, 255, 0), $bg-card 70%) 100% 0,
    radial-gradient(farthest-side at 0 50%, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0)),
    radial-gradient(farthest-side at 100% 50%, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0)) 100% 0;
  background-repeat: no-repeat;
  background-color: $bg-card;
  background-size:
    40px 100%,
    40px 100%,
    14px 100%,
    14px 100%;
  background-attachment: local, local, scroll, scroll;
  -webkit-overflow-scrolling: touch;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

thead {
  position: sticky;
  top: 0;
  background-color: $bg-alt-2;
  z-index: 2;
}

th {
  padding: 0.75rem;
  text-align: right;
  font-weight: 600;
  border-bottom: 2px solid $border-light;
  color: $text-primary;
  white-space: nowrap;
}

th:first-child,
th:nth-child(2) {
  text-align: left;
  position: sticky;
  background-color: $bg-alt-2;
  z-index: 3;
}

th:first-child {
  left: 0;
}

th:nth-child(2) {
  left: 60px;
}

td {
  padding: 0.75rem;
  text-align: right;
  border-bottom: 1px solid $border-light;
  white-space: nowrap;
}

td:first-child,
td:nth-child(2) {
  text-align: left;
  font-weight: 500;
  position: sticky;
  background-color: $bg-card;
  z-index: 1;
}

td:first-child {
  left: 0;
}

td:nth-child(2) {
  left: 60px;
}

tbody tr:hover td {
  background-color: $bg-alt-2;
}

tbody tr:hover td:first-child,
tbody tr:hover td:nth-child(2) {
  background-color: $bg-alt-2;
}

tbody tr.negative td {
  background-color: #fff5f5;
}

tbody tr.negative td:first-child,
tbody tr.negative td:nth-child(2) {
  background-color: #fff5f5;
}

/* Timeline scrubber cursor: highlight the selected year's row. */
tbody tr.selected td {
  background-color: $primary-light;
  box-shadow: inset 3px 0 0 $primary;
}

tbody tr.selected td:first-child,
tbody tr.selected td:nth-child(2) {
  background-color: $primary-light;
}

tbody tr.selected.negative td {
  background-color: #ffe8e8;
}

tbody tr.selected.negative td:first-child,
tbody tr.selected.negative td:nth-child(2) {
  background-color: #ffe8e8;
}

.income {
  color: #22c55e;
  font-weight: 500;
}

.expenses {
  color: $danger;
  font-weight: 500;
}

.tax {
  color: #f97316;
  font-weight: 500;
}

.total-tax {
  color: $danger-hover;
  font-weight: 600;
}

.debt {
  color: #9333ea;
  font-weight: 500;
}

.debt-paid {
  color: #9333ea;
  font-weight: 500;
}

.net-positive {
  color: #22c55e;
  font-weight: 600;
}

.net-negative {
  color: $danger;
  font-weight: 600;
}

.balance-negative {
  color: $danger;
  font-weight: 600;
}

/* Mobile-specific improvements */
@media (max-width: $breakpoint-mobile) {
  .table-container {
    padding: 1rem;
    margin-left: -1rem;
    margin-right: -1rem;
    border-radius: 0;
  }

  h3 {
    font-size: 1.25rem;
    padding-left: 0.5rem;
  }

  table {
    font-size: 0.875rem;
  }

  th,
  td {
    padding: 0.5rem;
  }

  th:first-child {
    min-width: 60px;
  }

  th:nth-child(2) {
    min-width: 50px;
  }

  td:first-child {
    min-width: 60px;
  }

  td:nth-child(2) {
    min-width: 50px;
  }
}

@media (max-width: $breakpoint-mobile-small) {
  .table-container {
    padding: 0.75rem;
  }

  h3 {
    font-size: 1.125rem;
  }

  table {
    font-size: 0.8125rem;
  }

  th,
  td {
    padding: 0.4rem;
  }

  th:first-child {
    min-width: 50px;
    left: 0;
  }

  th:nth-child(2) {
    min-width: 45px;
    left: 50px;
  }

  td:first-child {
    min-width: 50px;
    left: 0;
  }

  td:nth-child(2) {
    min-width: 45px;
    left: 50px;
  }
}
</style>
