<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { usePlannerStore } from '@/stores/planner'
import BasicInfoSummary from '@/components/BasicInfoSummary.vue'
import BasicInfoWizard from '@/components/BasicInfoWizard.vue'
import FinancialListItem from '@/components/FinancialListItem.vue'
import ActionButtons from '@/components/ActionButtons.vue'
import NetWorthChart from '@/components/NetWorthChart.vue'
import AnnualBreakdownTable from '@/components/AnnualBreakdownTable.vue'
import type { Month } from '@/types/month'

const store = usePlannerStore()

// Toggle for showing inflation-adjusted values
const showInflationAdjusted = ref(false)

// Auto-open wizard on first visit
onMounted(() => {
  // If user hasn't completed the wizard yet, open it automatically
  if (!store.wizardCompleted) {
    store.openWizard()
  }
})

function handleEditBasicInfo() {
  store.openWizard()
}

function handleWizardSave(data: {
  birthDate: Month
  taxCountry?: string
  liquidAssetsInterestRate: number
  inflationRate: number
}) {
  store.saveBasicInfo(data)
}

function handleWizardClose() {
  store.closeWizard()
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
        @edit="handleEditBasicInfo"
      />

      <BasicInfoWizard
        :is-open="store.showWizard"
        :birth-date="store.birthDate"
        :tax-country="store.taxCountry"
        :liquid-assets-interest-rate="store.liquidAssetsInterestRate"
        :inflation-rate="store.inflationRate"
        @close="handleWizardClose"
        @save="handleWizardSave"
      />
    </section>

    <section class="items-section">
      <div class="section-header">
        <h2>Your financial situation</h2>
        <div v-if="store.allItems.length > 0" class="items-count">
          {{ store.allItems.length }} item{{ store.allItems.length !== 1 ? 's' : '' }}
        </div>
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
</style>
