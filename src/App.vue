<template>
  <div id="app">
    <header>
      <h1>Financial Planner</h1>
      <p class="subtitle">Plan your long-term financial goals</p>
    </header>

    <main>
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { usePlannerStore } from './stores/planner'

const store = usePlannerStore()

onMounted(() => {
  // Load saved data on startup
  store.loadFromStorage()
})

// Auto-save when data changes
watch(
  () => [store.capitalAccounts, store.cashFlows, store.birthDate, store.liquidAssetsInterestRate, store.inflationRate],
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
