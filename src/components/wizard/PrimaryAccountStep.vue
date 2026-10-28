<template>
  <div class="primary-account-step">
    <div class="step-description">
      <p>
        Select which liquid account should be used by default for your income, expenses, and debt
        payments.
      </p>
      <p class="hint">You can still override this for individual items.</p>
    </div>

    <div class="form-group">
      <label for="primary-account">Primary Liquid Account</label>
      <select id="primary-account" v-model="primaryAccountId">
        <option :value="undefined">Default (First liquid asset)</option>
        <option v-for="acc in liquidAccounts" :key="acc.id" :value="acc.id">
          {{ acc.name }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePlannerStore } from '@/stores/planner'
import { LiquidAsset } from '@/models'

const store = usePlannerStore()

const liquidAccounts = computed(() => {
  return store.capitalAccounts.filter((acc) => acc instanceof LiquidAsset)
})

const primaryAccountId = computed({
  get: () => store.primaryAccountId,
  set: (val) => store.setPrimaryAccountId(val),
})
</script>

<style scoped lang="scss">
.primary-account-step {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  .step-description {
    p {
      margin: 0 0 0.5rem 0;
      color: $text-primary;
      font-size: 1rem;
      line-height: 1.5;
    }
    .hint {
      color: $text-light;
      font-size: 0.875rem;
    }
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    label {
      font-weight: $font-semibold;
      color: $text-primary;
      font-size: 0.95rem;
    }

    select {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid $border-light;
      border-radius: $radius-md;
      font-size: 1rem;
      color: $text-primary;
      background-color: white;
      cursor: pointer;
      transition: border-color 0.2s;

      &:focus {
        outline: none;
        border-color: $primary;
      }
    }
  }
}
</style>
