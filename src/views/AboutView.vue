<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ref } from 'vue'
import StaticPage from '@/components/StaticPage.vue'
import NetWorthChart from '@/components/NetWorthChart.vue'
import NewPlanDialog from '@/components/NewPlanDialog.vue'
import { usePlannerStore } from '@/stores/planner'
import { createSampleProfile } from '@/services/sampleData'
import { calculateProjections } from '@/services/calculator'
import { resolveLifeEventNavs } from '@/utils/timeline'
import { getCurrentMonth } from '@/types/month'
import { formatCurrency, adjustForInflation } from '@/utils/format'

const router = useRouter()
const store = usePlannerStore()
const planError = ref('')

function openPlanner() {
  router.push('/app')
}

function openPlan(id: string) {
  planError.value = ''
  try {
    store.switchScenario(id)
    openPlanner()
  } catch (error) {
    planError.value = error instanceof Error ? error.message : 'Could not open the plan.'
  }
}

// Decorative compound-growth curve, in percent of the tallest bar.
const sample = createSampleProfile()
const projection = calculateProjections(sample)
const retirement = resolveLifeEventNavs(
  getCurrentMonth(),
  sample.birthDate,
  sample.lifeEvents,
  projection.monthlyProjections,
).find((e) => e.name === 'Retirement')
// Same default as the dashboard: values in today's money.
const retirementValue =
  retirement?.nav != null
    ? formatCurrency(
        adjustForInflation(retirement.nav, retirement.monthOffset / 12, sample.inflationRate),
      )
    : null

const bars = Array.from({ length: 12 }, (_, i) => Math.round(100 * Math.pow(1.17, i - 11)))
</script>

<template>
  <section class="hero">
    <div class="hero-text">
      <p class="hero-brand">MoneyMap</p>
      <h1 class="hero-title">See where your money takes you.</h1>
      <p class="hero-lead">
        Plan your financial future, one year at a time. Free, private, and no account needed.
      </p>
      <div class="hero-actions">
        <button
          v-if="store.scenarios.length === 1"
          class="button-primary hero-cta"
          type="button"
          @click="openPlanner"
        >
          Open your plan
        </button>
        <NewPlanDialog v-if="store.scenarios.length === 0" @created="openPlanner" />
      </div>
    </div>
    <div class="hero-bars" aria-hidden="true">
      <span v-for="(h, i) in bars" :key="i" :style="{ height: h + '%' }" />
    </div>
  </section>

  <section v-if="store.scenarios.length > 1" class="saved-plans">
    <h2>Your plans</h2>
    <p v-if="planError" role="alert">{{ planError }}</p>
    <ul>
      <li v-for="plan in store.scenarios" :key="plan.id">
        <button type="button" class="btn-secondary" @click="openPlan(plan.id)">
          {{ plan.name }}
        </button>
      </li>
    </ul>
  </section>

  <section v-if="retirementValue" class="example">
    <p class="example-label">Example plan</p>
    <h2 class="example-title">
      At 67, this plan reaches <span class="example-value">{{ retirementValue }}</span>
    </h2>
    <p class="example-detail">
      Age 30. Salary €2,500 and costs €1,500 per month. €10,000 in savings. 7% return, 3% inflation.
      Values in today's money.
    </p>
    <NetWorthChart
      :annual-summaries="projection.annualSummaries"
      :show-inflation-adjusted="true"
      :inflation-rate="sample.inflationRate"
    />
  </section>

  <section class="features">
    <div class="feature">
      <h2>Your whole picture</h2>
      <p>Enter your income, expenses, assets, and debts, with their interest rates.</p>
    </div>
    <div class="feature">
      <h2>Decades ahead</h2>
      <p>See your net worth year by year, until retirement and after. Adjusted for inflation.</p>
    </div>
    <div class="feature">
      <h2>Private by design</h2>
      <p>
        All data stays in your browser. No account, no tracking. See the
        <router-link to="/privacy">privacy policy</router-link>.
      </p>
    </div>
  </section>

  <StaticPage>
    <h2>What MoneyMap is not</h2>
    <ul>
      <li>It is not a portfolio manager. It does not track individual stocks.</li>
      <li>It is not investment advice. It gives projections, not recommendations.</li>
      <li>It is not a budget tracker for daily spending.</li>
    </ul>

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

    <div v-if="store.scenarios.length === 1" class="end-cta">
      <button class="button-primary hero-cta" type="button" @click="openPlanner">
        Open your plan
      </button>
    </div>
  </StaticPage>
</template>

<style lang="scss" scoped>
.saved-plans {
  max-width: 960px;
  margin: $spacing-4xl auto 0;

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-base;
    list-style: none;
    margin: $spacing-base 0;
  }
}

// Full-bleed band: cancel the padding of <main> per breakpoint.
.hero {
  display: flex;
  align-items: flex-end;
  gap: $spacing-4xl;
  margin: (-$spacing-3xl) (-$spacing-lg) 0;
  padding: 5rem calc(max(0px, (100% - 960px) / 2) + #{$spacing-lg}) 4rem;
  background: linear-gradient(160deg, $primary-light 0%, #d1fae5 100%);
  border-bottom: 1px solid $success-light;

  @include mobile {
    flex-direction: column;
    align-items: stretch;
    gap: $spacing-2xl;
    margin: (-$spacing-xl) (-$spacing-base) 0;
    padding: $spacing-4xl $spacing-xl $spacing-3xl;
  }

  @include mobile-small {
    margin: (-$spacing-lg) (-$spacing-sm) 0;
    padding: $spacing-3xl $spacing-lg $spacing-2xl;
  }
}

.hero-text {
  flex: 1 1 0;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $spacing-base;

  @include mobile {
    flex-direction: column;
    align-items: stretch;
  }
}

.hero-brand {
  font-size: $font-2xl;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: $success-dark;
  margin-bottom: $spacing-xl;

  @include mobile {
    font-size: $font-xl-2;
    margin-bottom: $spacing-base;
  }
}

.hero-title {
  font-size: 3rem;
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: $text-primary;
  margin: 0 0 $spacing-lg;

  @include mobile {
    font-size: 2.25rem;
  }

  @include mobile-small {
    font-size: 2rem;
  }
}

.hero-lead {
  font-size: $font-md;
  color: $text-tertiary;
  max-width: 32rem;
  margin-bottom: $spacing-3xl;

  @include mobile-small {
    font-size: $font-base-lg;
    margin-bottom: $spacing-2xl;
  }
}

.hero-cta,
.hero-actions > :deep(.btn-primary) {
  font-size: $font-md;
  padding: $spacing-lg $spacing-3xl;
  border-radius: $radius-lg;
  box-shadow: 0 6px 16px rgba(66, 185, 131, 0.35);

  @include mobile {
    width: 100%;
  }
}

.hero-bars {
  flex: 1 1 0;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 14rem;

  @include mobile {
    flex: none;
    height: 6rem;
    order: -1;
  }

  span {
    flex: 1;
    background: $primary;
    border-radius: $radius-base $radius-base 0 0;
    opacity: 0.85;
    transform-origin: bottom;
    animation: grow 0.8s ease-out both;
  }

  @for $i from 1 through 12 {
    span:nth-child(#{$i}) {
      animation-delay: #{$i * 0.04}s;
    }
  }
}

.example {
  max-width: 960px;
  margin: $spacing-4xl auto 0;

  @include mobile {
    margin-top: $spacing-2xl;
  }
}

.example-label {
  font-size: $font-sm;
  font-weight: $font-bold;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: $text-muted;
  margin-bottom: $spacing-xs;
}

.example-title {
  font-size: $font-3xl;
  line-height: $line-height-tight;
  font-weight: 800;
  color: $text-primary;
  margin-bottom: $spacing-sm;

  @include mobile {
    font-size: $font-xl-2;
  }
}

.example-value {
  color: $success-dark;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.example-detail {
  color: $text-muted;
  margin-bottom: $spacing-2xl;
}

.features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-2xl;
  max-width: 960px;
  margin: $spacing-4xl auto 0;

  @include mobile {
    grid-template-columns: 1fr;
    gap: $spacing-base;
    margin-top: $spacing-2xl;
  }
}

.feature {
  background: $bg-card;
  border-top: 4px solid $primary;
  border-radius: $radius-lg;
  box-shadow: $shadow-sm;
  padding: $spacing-2xl;

  h2 {
    font-size: $font-md;
    font-weight: $font-bold;
    color: $text-primary;
    margin-bottom: $spacing-sm;
  }

  p {
    color: $text-tertiary;
  }

  a {
    color: $success-dark;
    font-weight: $font-medium;
  }
}

.end-cta {
  margin-top: $spacing-3xl;
  text-align: center;
}

@keyframes grow {
  from {
    transform: scaleY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-bars span {
    animation: none;
  }
}
</style>
