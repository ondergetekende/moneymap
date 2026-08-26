<script setup lang="ts">
import StaticPage from '@/components/StaticPage.vue'
</script>

<template>
  <StaticPage title="Privacy Policy" subtitle="How MoneyMap handles your data.">
    <h2>What we store</h2>
    <p>
      All financial data you enter is stored in your browser only, in its LocalStorage. This
      includes your income, expenses, assets, debts, and settings. No account is needed to use
      MoneyMap. The data never leaves your device unless you choose a feature that sends it.
    </p>

    <h2>What leaves your device</h2>
    <p>
      By default, nothing leaves your device. MoneyMap does not send your data to any server in
      normal use.
    </p>

    <h2>Hosting</h2>
    <p>
      Any server feature runs on infrastructure in the European Union. This keeps your data under EU
      data protection rules.
    </p>

    <h2>Cookies</h2>
    <p>MoneyMap does not set cookies. The app works without any cookie or tracking technology.</p>

    <h2>Your choices</h2>
    <ul>
      <li>Use the app without an account, with all data in your browser.</li>
      <li>Export your data at any time.</li>
    </ul>

    <h2>Contact</h2>
    <p>
      Questions about this policy? See the
      <router-link to="/contact">contact page</router-link>.
    </p>
  </StaticPage>
</template>
