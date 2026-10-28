<template>
  <div class="chart-container">
    <h3>Net Worth Projection</h3>
    <Line ref="chartRef" :data="chartData" :options="chartOptions" :plugins="cursorPlugins" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
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
  type ChartType,
  type Plugin,
} from 'chart.js'
import type { AnnualSummary } from '@/models'
import { formatCurrency, adjustForInflation } from '@/utils/format'
import { getCurrentMonth } from '@/types/month'
import { resolveYearIndex, resolveYearFraction } from '@/utils/timeline'

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
  selectedMonthOffset?: number
}>()

const adjust = (value: number, yearsFromNow: number) =>
  props.showInflationAdjusted ? adjustForInflation(value, yearsFromNow, props.inflationRate) : value

// --- Timeline cursor ---
// A reactive holder so the inline plugin always reads the latest position.
const cursorPos = shallowRef<{ index: number; fraction: number } | null>(null)
const chartRef = ref<{ chart: ChartJS<ChartType> | null } | null>(null)

function recomputeCursorPos() {
  if (props.selectedMonthOffset === undefined || props.annualSummaries.length === 0) {
    cursorPos.value = null
    return
  }
  const projectionStart = getCurrentMonth()
  const years = props.annualSummaries.map((s) => s.year)
  const index = resolveYearIndex(projectionStart, props.selectedMonthOffset, years)
  if (index === null) {
    cursorPos.value = null
    return
  }
  cursorPos.value = {
    index,
    fraction: resolveYearFraction(projectionStart, props.selectedMonthOffset),
  }
}

// Recompute the cursor position, then trigger a redraw so the line moves.
watch(
  () => [props.selectedMonthOffset, props.annualSummaries.length] as const,
  () => {
    recomputeCursorPos()
    chartRef.value?.chart?.update('none')
  },
  { immediate: true },
)

// Inline Chart.js plugin: draws a dashed vertical line at the selected month.
const cursorPlugins: Plugin<'line'>[] = [
  {
    id: 'timelineCursor',
    afterDraw(chart) {
      const pos = cursorPos.value
      if (!pos) return
      const area = chart.chartArea
      const labels = chart.data.labels
      if (!labels || labels.length === 0) return
      const band = area.width / labels.length
      const x = area.left + (pos.index + pos.fraction) * band
      if (x < area.left || x > area.right) return
      const ctx = chart.ctx
      ctx.save()
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.moveTo(x, area.top)
      ctx.lineTo(x, area.bottom)
      ctx.stroke()
      ctx.restore()
    },
  },
]

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
  // ponytail: read once at render; a resize across the breakpoint keeps the old ratio until reload.
  aspectRatio: window.matchMedia('(max-width: 768px)').matches ? 1.2 : 2,
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
