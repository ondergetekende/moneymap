<script setup lang="ts">
  import { computed } from 'vue'
  import { usePlannerStore } from '@/stores/planner'
  import BirthDateInput from '@/components/BirthDateInput.vue'
  import FinancialListItem from '@/components/FinancialListItem.vue'
  import ActionButtons from '@/components/ActionButtons.vue'
  import NetWorthChart from '@/components/NetWorthChart.vue'
  import AnnualBreakdownTable from '@/components/AnnualBreakdownTable.vue'
  import type { Month } from '@/types/month'

  const store = usePlannerStore()

  const birthDate = computed({
    get: () => store.birthDate,
    set: (value: Month) => store.setBirthDate(value),
  })
</script>

<template>
  <div class="dashboard">
    <section class="birth-date-section">
      <BirthDateInput
        v-model="birthDate"
        :current-age="store.currentAge"
      />
    </section>

    <section class="items-section">
      <div class="section-header">
        <h2>Your financial situation</h2>
        <div
          v-if="store.allItems.length > 0"
          class="items-count"
        >
          {{ store.allItems.length }} item{{ store.allItems.length !== 1 ? 's' : '' }}
        </div>
      </div>

      <div
        v-if="store.allItems.length === 0"
        class="empty-state"
      >
        <p>No assets or cash flows yet. Add your first item below!</p>
      </div>

      <div
        v-else
        class="items-list"
      >
        <FinancialListItem
          v-for="item in store.allItems"
          :key="item.id"
          :item="item"
        />
      </div>

      <ActionButtons />
    </section>

    <section
      v-if="store.hasData"
      class="projections-section"
    >
      <h2>Financial Projections</h2>

      <div
        v-if="store.projectionResult"
        class="projections-content"
      >
        <div class="chart-container">
          <NetWorthChart
            :annual-summaries="store.projectionResult.annualSummaries"
            :calculation-time="store.projectionResult.calculationTimeMs"
          />
        </div>

        <div class="table-container">
          <AnnualBreakdownTable :annual-summaries="store.projectionResult.annualSummaries" />
        </div>
      </div>

      <div
        v-else
        class="no-projections"
      >
        <p>Add your birth date, assets, and cash flows to see projections.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
  .dashboard {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .dashboard-header {
    margin-bottom: 2rem;
  }

  .dashboard-header h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  .birth-date-section {
    margin-bottom: 2rem;
  }

  .items-section {
    margin-bottom: 3rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .section-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
  }

  .items-count {
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 500;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    background: #f9fafb;
    border: 2px dashed #d1d5db;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }

  .empty-state p {
    color: #6b7280;
    font-size: 1rem;
    margin: 0;
  }

  .items-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .projections-section {
    margin-top: 3rem;
  }

  .projections-section h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 1.5rem;
  }

  .projections-content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .chart-container,
  .table-container {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .no-projections {
    text-align: center;
    padding: 2rem;
    background: #f9fafb;
    border-radius: 8px;
  }

  .no-projections p {
    color: #6b7280;
    margin: 0;
  }

  /* Tablet and below */
  @media (max-width: 768px) {
    .dashboard {
      padding: 1rem;
      margin: 0 -1rem;
      /* Full width bleed */
    }

    .dashboard-header h1 {
      font-size: 1.5rem;
    }

    .section-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .section-header h2 {
      font-size: 1.25rem;
    }

    .items-list {
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 0.5rem;
    }

    .projections-section h2 {
      font-size: 1.25rem;
    }

    .chart-container,
    .table-container {
      padding: 1rem;
    }
  }

  /* Small mobile */
  @media (max-width: 480px) {
    .dashboard {
      padding: 0.75rem;
    }

    .dashboard-header {
      margin-bottom: 1.5rem;
    }

    .dashboard-header h1 {
      font-size: 1.375rem;
    }

    .section-header h2 {
      font-size: 1.125rem;
    }

    .items-list {
      grid-template-columns: 1fr;
    }

    .projections-section h2 {
      font-size: 1.125rem;
    }

    .empty-state {
      padding: 2rem 1rem;
    }

    .empty-state p {
      font-size: 0.9375rem;
    }
  }
</style>
