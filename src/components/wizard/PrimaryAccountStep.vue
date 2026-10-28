<template>
  <div class="primary-account-step">
    <h3 class="step-title">Primary account</h3>
    <p class="step-description">
      Income, expenses, and debt payments use this account. You can change it for each item.
    </p>

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
