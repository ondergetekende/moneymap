<template>
  <div class="birth-date-input">
    <h3>Your Birth Date</h3>
    <div class="input-group">
      <div class="form-field">
        <MonthEdit
          :modelValue="modelValue"
          @update:modelValue="handleUpdate"
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MonthEdit from './MonthEdit.vue'
import type { Month } from '@/types/month'
import { getCurrentMonth } from '@/types/month'

const props = defineProps<{
  modelValue: Month
  currentAge: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Month]
}>()

const maxMonth = computed(() => {
  return getCurrentMonth()
})

function handleUpdate(value: Month | undefined) {
  if (value !== undefined) {
    emit('update:modelValue', value)
  }
}
</script>

<style scoped>
.birth-date-input {
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
}

.form-field {
  display: flex;
  flex-direction: column;
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
