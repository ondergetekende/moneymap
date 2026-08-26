<template>
  <div class="chart-container">
    <h3>Net Worth Projection</h3>
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from 'chart.js'
import type { AnnualSummary } from '@/models'
import { formatCurrency, adjustForInflation } from '@/utils/format'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

const props = defineProps<{
  annualSummaries: AnnualSummary[]
  calculationTime?: number | null
  showInflationAdjusted?: boolean
  inflationRate?: number
}>()

const adjust = (value: number, yearsFromNow: number) =>
  props.showInflationAdjusted ? adjustForInflation(value, yearsFromNow, props.inflationRate) : value

const chartData = computed(() => {
  const currentYear = props.annualSummaries[0]?.year ?? new Date().getFullYear()
  const labels = props.annualSummaries.map((summary) => `${summary.year} (age ${summary.age})`)
  const liquidData = props.annualSummaries.map((summary) => {
    const yearsFromNow = summary.year - currentYear
    return adjust(summary.endingLiquidAssets, yearsFromNow)
  })
  // Net fixed assets = fixed assets - debt
  const netFixedData = props.annualSummaries.map((summary) => {
    const yearsFromNow = summary.year - currentYear
    return adjust(summary.endingFixedAssets - summary.endingTotalDebt, yearsFromNow)
  })

  return {
    labels,
    datasets: [
      {
        label: 'Liquid Assets',
        data: liquidData,
        borderColor: '#42b983',
        backgroundColor: 'rgba(66, 185, 131, 0.6)',
        tension: 0.1,
        fill: true,
        stack: 'assets',
      },
      {
        label: 'Net Fixed Assets',
        data: netFixedData,
        borderColor: '#3498db',
        backgroundColor: 'rgba(52, 152, 219, 0.6)',
        tension: 0.1,
        fill: '-1', // Stack on top of previous dataset
        stack: 'assets',
      },
    ],
  }
})

const chartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: true,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: {
      display: true,
      position: 'top',
    },
    title: {
      display: false,
    },
    tooltip: {
      mode: 'index',
      callbacks: {
        label: function (context) {
          const value = context.parsed.y ?? 0
          const label = context.dataset.label || ''
          return `${label}: ${formatCurrency(value)}`
        },
        footer: function (tooltipItems) {
          // Calculate total net worth from both liquid and fixed assets
          const total = tooltipItems.reduce((sum, item) => sum + (item.parsed.y ?? 0), 0)
          return `Total Net Worth: ${formatCurrency(total)}`
        },
      },
    },
  },
  scales: {
    x: {
      title: {
        display: true,
        text: 'Year (Age)',
      },
      stacked: true,
    },
    y: {
      title: {
        display: true,
        text: 'Net Worth',
      },
      stacked: true,
      ticks: {
        callback: function (value) {
          return formatCurrency(Number(value))
        },
      },
    },
  },
}
</script>

<style scoped lang="scss">
.chart-container {
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
</style>
