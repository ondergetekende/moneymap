<script setup lang="ts">
import { onMounted, watch, computed } from 'vue'
import { usePlannerStore } from './stores/planner'
import { useRoute } from 'vue-router'

const store = usePlannerStore()
const route = useRoute()

// Hide the header on static information pages
const showHeader = computed(() => {
  const staticRoutes = ['about', 'privacy', 'terms', 'who', 'contact']
  return !staticRoutes.includes(route.name as string)
})

onMounted(() => {
  // Load saved data on startup
  store.loadFromStorage()
})

// Auto-save when data changes
watch(
  () => [
    store.capitalAccounts,
    store.cashFlows,
    store.birthDate,
    store.liquidAssetsInterestRate,
    store.inflationRate,
  ],
  () => {
    store.saveToStorage()
  },
  { deep: true },
)
</script>

<template>
  <div id="app">
    <header v-if="showHeader">
      <router-link to="/" class="header-brand">
        <h1>MoneyMap</h1>
      </router-link>
      <p class="subtitle">Navigate your financial future</p>
    </header>

    <main>
      <router-view />
    </main>

    <footer>
      <nav class="footer-nav">
        <router-link to="/">About</router-link>
        <router-link to="/app">Planner</router-link>
        <router-link to="/privacy">Privacy</router-link>
        <router-link to="/terms">Terms</router-link>
        <router-link to="/who">Who</router-link>
        <router-link to="/contact">Contact</router-link>
      </nav>
    </footer>
  </div>
</template>

<style lang="scss">
// Import shared styles globally (buttons, forms, layout)
@use '@/styles/buttons';
@use '@/styles/forms';
@use '@/styles/layout';

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: $font-family;
  background-color: $bg-body;
  color: $text-secondary;
  line-height: $line-height-base;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header-brand {
  text-decoration: none;
  color: inherit;
  display: block;
}

header {
  background-color: $bg-card;
  color: $text-primary;
  padding: $spacing-sm 0;
  text-align: center;
  border-bottom: 1px solid $border-light;
  box-shadow: $shadow-sm;

  @include mobile {
    padding: $spacing-xs 0;
  }

  @include mobile-small {
    padding: 0;
  }
}

h1 {
  font-size: $font-base-lg;
  margin: 0;
  font-weight: $font-bold;

  @include mobile {
    font-size: $font-base;
  }
}

.subtitle {
  display: none;
}

main {
  padding: $spacing-3xl $spacing-lg;
  flex: 1;

  @include mobile {
    padding: $spacing-xl $spacing-base;
  }

  @include mobile-small {
    padding: $spacing-lg $spacing-sm;
  }
}

footer {
  background-color: $bg-alt-3;
  padding: $spacing-3xl $spacing-lg;
  text-align: center;
  border-top: 1px solid $border-light;

  @include mobile {
    padding: $spacing-2xl $spacing-base;
  }

  @include mobile-small {
    padding: $spacing-xl $spacing-sm;
  }
}

.footer-nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: $spacing-xl;

  a {
    color: $text-secondary;
    text-decoration: none;
    font-size: $font-sm;
    font-weight: $font-medium;

    &:hover {
      color: $primary;
    }

    @include mobile-small {
      font-size: $font-xs;
    }
  }
}

.container {
  max-width: $container-max-width;
  margin: 0 auto;
}

.input-section {
  background-color: $bg-card;
  padding: $spacing-3xl;
  border-radius: $radius-lg;
  box-shadow: $shadow-sm;
  margin-bottom: $spacing-3xl;
}

.results-section {
  margin-top: $spacing-3xl;
}

.no-results {
  text-align: center;
  padding: $spacing-4xl;
  background-color: $bg-card;
  border-radius: $radius-lg;
  color: $text-light;
}
</style>
