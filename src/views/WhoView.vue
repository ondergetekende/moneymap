<script setup lang="ts">
import StaticPage from '@/components/StaticPage.vue'
</script>

<template>
  <StaticPage title="Who Is Behind MoneyMap" subtitle="A small project, made with care.">
    <p>
      MoneyMap is a hobby project. It is built by one person, in spare time, for the love of clear
      and private financial planning. There is no team, no investor, and no plan to sell your data.
      That is the point.
    </p>

    <h2>Why it exists</h2>
    <p>
      The project started from a simple need: to see how income, expenses, assets, and debts play
      out over the years, without giving your numbers to a third party. Most tools send your data to
      a server. MoneyMap keeps it in your browser instead.
    </p>

    <h2>Who backs it</h2>
    <p>
      MoneyMap is backed by
      <strong>Ondergetekende B.V.</strong>, a small Dutch company. The company provides the legal
      home and the infrastructure. The project itself stays small and personal.
    </p>

    <h2>What this means for you</h2>
    <ul>
      <li>The tool is free to use and works offline.</li>
      <li>There is no support promise beyond best effort.</li>
      <li>Development moves at the speed of a hobby, not a startup.</li>
      <li>
        Your data stays yours. See the <router-link to="/privacy">privacy policy</router-link>.
      </li>
    </ul>

    <h2>Get in touch</h2>
    <p>
      Want to share an idea or report a problem? See the
      <router-link to="/contact">contact page</router-link>.
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
