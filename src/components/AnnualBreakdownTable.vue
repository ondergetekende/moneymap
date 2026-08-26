<template>
  <div class="table-container">
    <h3>Annual Breakdown</h3>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Age</th>
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
          <tr v-for="row in rows" :key="row.year" :class="{ negative: row.endingBalanceValue < 0 }">
            <td>{{ row.year }}</td>
            <td>{{ row.age }}</td>
            <td>{{ row.startingBalance }}</td>
            <td class="debt">{{ row.startingDebt }}</td>
            <td class="income">{{ row.totalIncome }}</td>
            <td class="expenses">{{ row.totalExpenses }}</td>
            <td class="tax">{{ row.incomeTax }}</td>
            <td class="tax">{{ row.wealthTax }}</td>
            <td class="tax">{{ row.capitalGainsTax }}</td>
            <td class="total-tax">{{ row.totalTax }}</td>
            <td class="debt-paid">{{ row.debtPaid }}</td>
            <td
              :class="{
                'net-positive': row.netPositive,
                'net-negative': row.netNegative,
              }"
            >
              {{ row.netChange }}
            </td>
            <td :class="{ 'balance-negative': row.endingBalanceValue < 0 }">
              {{ row.endingBalance }}
            </td>
            <td class="debt">{{ row.endingDebt }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AnnualSummary } from '@/models'
import { formatCurrency, adjustForInflation } from '@/utils/format'

const props = defineProps<{
  annualSummaries: AnnualSummary[]
  showInflationAdjusted?: boolean
  inflationRate?: number
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
