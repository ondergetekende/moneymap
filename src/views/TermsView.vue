<script setup lang="ts">
import StaticPage from '@/components/StaticPage.vue'
</script>

<template>
  <StaticPage title="Terms and Disclaimer" subtitle="Please read before use.">
    <h2>MoneyMap is planning software</h2>
    <p>
      MoneyMap gives projections, not predictions. A projection is an estimate based on the inputs
      you give. Real results will differ. Markets, taxes, and your life will change in ways the tool
      cannot know.
    </p>

    <h2>Not financial advice</h2>
    <p>
      MoneyMap is not a financial advisor. It does not give advice. It does not tell you what to do
      with your money. The numbers it shows are a starting point for your own thinking, not a
      recommendation.
    </p>

    <h2>Your responsibility</h2>
    <p>
      You are responsible for your own financial decisions. If you want advice, speak to a qualified
      professional. Do not make decisions based only on the projections from this tool.
    </p>

    <h2>No warranty</h2>
    <p>
      MoneyMap is a hobby project. It is provided "as is", without warranty of any kind. There is no
      promise that the tool is correct, complete, or fit for any purpose. The author and
      Ondergetekende B.V. are not liable for any loss or damage from use of the tool.
    </p>

    <h2>Your data</h2>
    <p>
      You control your data. See the
      <router-link to="/privacy">privacy policy</router-link> for how data is stored and used.
    </p>
  </StaticPage>
</template>
