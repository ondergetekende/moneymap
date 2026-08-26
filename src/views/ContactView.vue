<script setup lang="ts">
import StaticPage from '@/components/StaticPage.vue'

// TODO: replace placeholder with the real support address when known.
const supportEmail = 'moneymap@ondergetekende.nl'
const issueTrackerUrl = 'https://github.com/ondergetekende/moneymap/issues'
</script>

<template>
  <StaticPage title="Contact and Support" subtitle="How to get help or report a problem.">
    <p>
      MoneyMap is a hobby project, so support is best effort. There is no service-level promise, but
      your report or question is welcome and will be read.
    </p>

    <h2>Report a bug</h2>
    <p>
      Found something that does not work? Please report it on the
      <a :href="issueTrackerUrl" rel="noopener">issue tracker</a>. Add a short description of what
      you did and what happened.
    </p>

    <h2>Ask a question</h2>
    <p>
      For questions about how MoneyMap works, write to
      <a :href="`mailto:${supportEmail}`">{{ supportEmail }}</a
      >. Answers come as soon as spare time allows.
    </p>

    <h2>Request a feature</h2>
    <p>
      Have an idea for a new feature? Add it to the
      <a :href="issueTrackerUrl" rel="noopener">issue tracker</a> with a short description of what
      you want and why.
    </p>

    <h2>A note on privacy</h2>
    <p>
      Do not send us your financial data. We do not need it to help you. Keep your numbers, names,
      and dates out of any message you send. See the
      <router-link to="/privacy">privacy policy</router-link> for more.
    </p>
  </StaticPage>
</template>
