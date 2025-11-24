<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { usePlannerStore } from '@/stores/planner'
import BasicInfoSummary from '@/components/BasicInfoSummary.vue'
import BasicInfoWizard from '@/components/BasicInfoWizard.vue'
import FinancialListItem from '@/components/FinancialListItem.vue'
import ActionButtons from '@/components/ActionButtons.vue'
import NetWorthChart from '@/components/NetWorthChart.vue'
import AnnualBreakdownTable from '@/components/AnnualBreakdownTable.vue'

const store = usePlannerStore()

// Toggle for showing inflation-adjusted values (persisted in localStorage)
const showInflationAdjusted = useLocalStorage('showInflationAdjusted', true)

// Track which step to open the wizard to
const wizardInitialStep = ref<number | undefined>(undefined)

// Auto-open wizard on first visit
onMounted(() => {
  // If user hasn't completed the wizard yet, open it automatically
  if (!store.wizardCompleted) {
    store.openWizard()
  }
})

function handleEditStep(step: number) {
  wizardInitialStep.value = step
  store.openWizard()
}

function handleWizardClose() {
  wizardInitialStep.value = undefined
  store.closeWizard()
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}
</script>

<template>
  <div class="dashboard">
    <section class="birth-date-section">
      <BasicInfoSummary
        :current-age="store.currentAge"
        :tax-country="store.taxCountry"
        :liquid-assets-interest-rate="store.liquidAssetsInterestRate"
        :inflation-rate="store.inflationRate"
        @edit-step="handleEditStep"
      />

      <BasicInfoWizard
        :is-open="store.showWizard"
        :initial-step="wizardInitialStep"
        @close="handleWizardClose"
      />
    </section>

    <section class="items-section">
      <div class="section-header">
        <h2>Your financial situation</h2>
      </div>
      <div v-if="store.allItems.length > 0" class="summary-stats">
        <span class="stat">Total Assets: {{ formatCurrency(store.totalAssets) }}</span>
        <span class="stat-separator">|</span>
        <span class="stat"
          >Net Cashflow:
          {{ formatCurrency((store.totalIncome - store.totalExpenses) / 12) }}/month</span
        >
        <span v-if="store.totalDebt > 0" class="stat-separator">|</span>
        <span v-if="store.totalDebt > 0" class="stat"
          >Total Debt: {{ formatCurrency(store.totalDebt) }}</span
        >
      </div>

      <div v-if="store.allItems.length === 0" class="empty-state">
        <p>No assets or cash flows yet. Add your first item below!</p>
      </div>

      <div v-else class="items-list">
        <FinancialListItem v-for="item in store.allItems" :key="item.id" :item="item" />
      </div>

      <ActionButtons />
    </section>

    <section v-if="store.hasData" class="projections-section">
      <div class="projections-header">
        <h2>Financial Projections</h2>
        <div class="inflation-toggle">
          <label class="toggle-label">
            <input v-model="showInflationAdjusted" type="checkbox" class="toggle-checkbox" />
            <span>Show in today's purchasing power</span>
          </label>
          <p class="toggle-hint">
            When enabled, future values are adjusted to show their equivalent value in today's money
          </p>
        </div>
      </div>

      <div v-if="store.projectionResult" class="projections-content">
        <div class="chart-container">
          <NetWorthChart
            :annual-summaries="store.projectionResult.annualSummaries"
            :calculation-time="store.projectionResult.calculationTimeMs"
            :show-inflation-adjusted="showInflationAdjusted"
            :inflation-rate="store.inflationRate"
          />
        </div>

        <div class="table-container">
          <AnnualBreakdownTable
            :annual-summaries="store.projectionResult.annualSummaries"
            :show-inflation-adjusted="showInflationAdjusted"
            :inflation-rate="store.inflationRate"
          />
        </div>
      </div>

      <div v-else class="no-projections">
        <p>Add your birth date, assets, and cash flows to see projections.</p>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
// Most styles now come from _layout.scss - only component-specific overrides here

// Section header responsive adjustment
.section-header {
  @include mobile {
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-sm;
  }
}

// Dashboard header responsive adjustment
.dashboard-header {
  @include mobile-small {
    margin-bottom: $spacing-2xl;
  }
}

// Summary statistics
.summary-stats {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #4b5563;
  flex-wrap: wrap;

  .stat {
    font-weight: 500;
  }

  .stat-separator {
    color: #d1d5db;
  }

  @include mobile {
    font-size: 0.8125rem;
    gap: 0.5rem;
    padding: 0.625rem;
  }

  @include mobile-small {
    font-size: 0.75rem;
    gap: 0.375rem;
    padding: 0.5rem;
  }
}
</style>
