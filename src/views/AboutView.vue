<script setup lang="ts">
import { useRouter } from 'vue-router'
import StaticPage from '@/components/StaticPage.vue'

const router = useRouter()

function openPlanner() {
  router.push('/app')
}
</script>

<template>
  <StaticPage title="MoneyMap" subtitle="Plan your financial future, one year at a time.">
    <p>
      MoneyMap is a tool for long-term financial planning. You enter your income, expenses, assets,
      and debts. MoneyMap projects your financial situation over time. It shows how your money grows
      or shrinks year by year.
    </p>

    <div class="about-cta">
      <button class="button-primary" type="button" @click="openPlanner">Open the planner</button>
    </div>

    <h2>What you can do</h2>
    <ul>
      <li>Enter your monthly income and expenses.</li>
      <li>Add your assets and debts with interest rates.</li>
      <li>See your net worth projected over many years.</li>
      <li>Adjust the results for inflation.</li>
      <li>Keep all your data in your own browser. No account is needed.</li>
    </ul>

    <h2>What MoneyMap is not</h2>
    <ul>
      <li>It is not a portfolio manager. It does not track individual stocks.</li>
      <li>It is not investment advice. It gives projections, not recommendations.</li>
      <li>It is not a budget tracker for daily spending.</li>
    </ul>

    <h2>Your data stays yours</h2>
    <p>
      MoneyMap works offline. All your input is stored in your browser only. No data leaves your
      device. See the
      <router-link to="/privacy">privacy policy</router-link> for the details.
    </p>

    <h2>A hobby project</h2>
    <p>
      MoneyMap is built by one person, in spare time, and backed by Ondergetekende B.V. Development
      moves at the speed of a hobby, not a startup. Want to know more? See
      <router-link to="/who">who is behind this</router-link>.
    </p>

    <p>
      If you find it useful, consider supporting my work:
      <a
        href="https://www.buymeacoffee.com/ondergetekende"
        target="_blank"
        rel="noopener noreferrer"
      >
        Buy me a coffee
      </a>
    </p>
  </StaticPage>
</template>

<style lang="scss" scoped>
.about-cta {
  margin-top: $spacing-3xl;
  text-align: center;
}
</style>
