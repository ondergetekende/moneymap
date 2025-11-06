<template>
  <div id="app">
    <header>
      <h1>Financial Planner</h1>
      <p class="subtitle">Plan your long-term financial goals</p>
    </header>

    <main>
      <div class="container">
        <div class="input-section">
          <BirthDateInput
            v-model="store.birthDate"
            :current-age="store.currentAge"
            @update:model-value="handleBirthDateChange"
          />
          <CapitalAccountsManager
            :accounts="store.capitalAccounts"
            :liquid-assets-interest-rate="store.liquidAssetsInterestRate"
            @add="store.addCapitalAccount"
            @update="store.updateCapitalAccount"
            @remove="store.removeCapitalAccount"
            @update-liquid-rate="store.setLiquidAssetsInterestRate"
          />
          <CashFlowManager
            :cash-flows="store.cashFlows"
            @add="store.addCashFlow"
            @update="store.updateCashFlow"
            @remove="store.removeCashFlow"
          />
        </div>

        <div v-if="store.projectionResult" class="results-section">
          <NetWorthChart
            :annual-summaries="store.projectionResult.annualSummaries"
            :calculation-time="store.projectionResult.calculationTimeMs"
          />
          <AnnualBreakdownTable :annual-summaries="store.projectionResult.annualSummaries" />
        </div>

        <div v-else-if="store.hasData" class="no-results">
          <p>Enter your data above to see your financial projections.</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { usePlannerStore } from './stores/planner'
import BirthDateInput from './components/BirthDateInput.vue'
import CapitalAccountsManager from './components/CapitalAccountsManager.vue'
import CashFlowManager from './components/CashFlowManager.vue'
import NetWorthChart from './components/NetWorthChart.vue'
import AnnualBreakdownTable from './components/AnnualBreakdownTable.vue'

const store = usePlannerStore()

onMounted(() => {
  // Load saved data on startup
  store.loadFromStorage()
})

function handleBirthDateChange(date: string) {
  store.setBirthDate(date)
  store.saveToStorage()
}

// Auto-save when data changes
watch(
  () => [store.capitalAccounts, store.cashFlows, store.birthDate, store.liquidAssetsInterestRate],
  () => {
    store.saveToStorage()
  },
  { deep: true },
)
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background-color: #f5f5f5;
  color: #2c3e50;
  line-height: 1.6;
}

#app {
  min-height: 100vh;
}

header {
  background-color: #42b983;
  color: white;
  padding: 2rem 0;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.subtitle {
  font-size: 1.1rem;
  opacity: 0.9;
}

main {
  padding: 2rem 1rem;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.input-section {
  background-color: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.results-section {
  margin-top: 2rem;
}

.no-results {
  text-align: center;
  padding: 3rem;
  background-color: white;
  border-radius: 8px;
  color: #666;
}
</style>
