<template>
  <div class="basic-information-input">
    <h3>Basic Information</h3>
    <div class="input-group">
      <div class="form-field">
        <MonthEdit
          :modelValue="birthDate"
          @update:modelValue="handleBirthDateUpdate"
          label="Birth Month"
          :maxMonth="maxMonth"
          :nullable="false"
        />
      </div>
      <div v-if="currentAge !== null" class="age-display">
        <span class="age-label">Current Age:</span>
        <span class="age-value">{{ currentAge }} years old</span>
      </div>
    </div>
    <div class="form-field inflation-field">
      <label for="inflation-rate">Annual Inflation Rate (%)</label>
      <input
        id="inflation-rate"
        type="number"
        :value="inflationRate"
        @input="handleInflationUpdate"
        step="0.1"
        min="0"
        max="20"
        class="number-input"
      />
      <span class="hint">Default: 2.5%</span>
    </div>
    <div class="form-field inflation-field">
      <label for="liquid-assets-interest-rate">Liquid Assets Interest Rate (%)</label>
      <input
        id="liquid-assets-interest-rate"
        type="number"
        :value="liquidAssetsInterestRate"
        @input="handleLiquidAssetsInterestRateUpdate"
        step="0.1"
        min="0"
        max="100"
        class="number-input"
      />
      <span class="hint">Default: 5%</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MonthEdit from './MonthEdit.vue'
import type { Month } from '@/types/month'
import { getCurrentMonth } from '@/types/month'

const props = defineProps<{
  birthDate: Month
  inflationRate: number
  liquidAssetsInterestRate: number
  currentAge: number | null
}>()

const emit = defineEmits<{
  'update:birthDate': [value: Month]
  'update:inflationRate': [value: number]
  'update:liquidAssetsInterestRate': [value: number]
}>()

const maxMonth = computed(() => {
  return getCurrentMonth()
})

function handleBirthDateUpdate(value: Month | undefined) {
  if (value !== undefined) {
    emit('update:birthDate', value)
  }
}

function handleInflationUpdate(event: Event) {
  const target = event.target as HTMLInputElement
  const value = parseFloat(target.value)
  if (!isNaN(value)) {
    emit('update:inflationRate', value)
  }
}

function handleLiquidAssetsInterestRateUpdate(event: Event) {
  const target = event.target as HTMLInputElement
  const value = parseFloat(target.value)
  if (!isNaN(value)) {
    emit('update:liquidAssetsInterestRate', value)
  }
}
</script>

<style scoped>
.basic-information-input {
  margin-bottom: 2rem;
}

h3 {
  margin-bottom: 1rem;
  color: #2c3e50;
}

.input-group {
  display: flex;
  gap: 2rem;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.form-field {
  display: flex;
  flex-direction: column;
}

.inflation-field {
  margin-top: 1rem;
}

.inflation-field label {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #2c3e50;
  font-size: 0.95rem;
}

.number-input {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  width: 200px;
  transition: border-color 0.2s;
}

.number-input:focus {
  outline: none;
  border-color: #42b983;
}

.hint {
  font-size: 0.85rem;
  color: #666;
  margin-top: 0.25rem;
}

.age-display {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background-color: #f8f9fa;
  border-radius: 4px;
  font-size: 1rem;
}

.age-label {
  font-weight: 600;
  color: #2c3e50;
}

.age-value {
  color: #42b983;
  font-weight: 700;
}
</style>
