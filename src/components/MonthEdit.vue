<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Month } from '@/types/month'
import { getYear, getMonthIndex, fromYearMonth, getCurrentMonth } from '@/types/month'

interface Props {
  modelValue?: Month
  label?: string
  required?: boolean
  nullable?: boolean
  maxMonth?: Month
  minMonth?: Month
}

const props = withDefaults(defineProps<Props>(), {
  required: false,
  nullable: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: Month | undefined]
}>()

// Month names for the dropdown
const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

// Track whether the value is set (for nullable mode)
const isSet = ref<boolean>(props.modelValue !== undefined)

// Initialize year and month from modelValue
const currentMonth = props.modelValue !== undefined ? props.modelValue : getCurrentMonth()
const yearString = ref<string>(String(getYear(currentMonth)))
const monthIndex = ref<number>(getMonthIndex(currentMonth))

// Watch for external changes to modelValue
watch(
  () => props.modelValue,
  (newValue) => {
    isSet.value = newValue !== undefined
    if (newValue !== undefined) {
      yearString.value = String(getYear(newValue))
      monthIndex.value = getMonthIndex(newValue)
    }
  }
)

// Parsed year value
const year = computed<number>(() => {
  const parsed = parseInt(yearString.value, 10)
  return isNaN(parsed) ? getYear(getCurrentMonth()) : parsed
})

// Computed Month value
const monthValue = computed<Month>(() => {
  return fromYearMonth(year.value, monthIndex.value)
})

// Emit changes when year, month, or isSet changes
watch([yearString, monthIndex, isSet], () => {
  // If not set and nullable, emit undefined
  if (!isSet.value && props.nullable) {
    emit('update:modelValue', undefined)
    return
  }

  // Only emit if year is a valid number
  const yearNum = parseInt(yearString.value, 10)
  if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2200) {
    return
  }

  const newMonth = fromYearMonth(yearNum, monthIndex.value)

  // Validate against min/max if provided
  if (props.minMonth !== undefined && newMonth < props.minMonth) {
    // Don't emit invalid values
    return
  }
  if (props.maxMonth !== undefined && newMonth > props.maxMonth) {
    // Don't emit invalid values
    return
  }

  emit('update:modelValue', newMonth)
})

// Validation state
const isValid = computed(() => {
  const month = monthValue.value
  if (props.minMonth !== undefined && month < props.minMonth) return false
  if (props.maxMonth !== undefined && month > props.maxMonth) return false
  return true
})
</script>

<template>
  <div class="month-edit" :class="{ invalid: !isValid }">
    <label v-if="label" class="month-edit-label">
      {{ label }}
      <span v-if="required" class="required-indicator">*</span>
    </label>

    <div v-if="nullable" class="checkbox-container">
      <label class="checkbox-label">
        <input v-model="isSet" type="checkbox" class="checkbox-input" />
        <span class="checkbox-text">Set value</span>
      </label>
    </div>

    <div class="month-edit-controls">
      <select
        v-model.number="monthIndex"
        class="month-select"
        :required="required && isSet"
        :disabled="!isSet && nullable"
      >
        <option v-for="(name, index) in monthNames" :key="index" :value="index">
          {{ name }}
        </option>
      </select>
      <input
        v-model="yearString"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        class="year-input"
        :required="required && isSet"
        :disabled="!isSet && nullable"
        placeholder="YYYY"
      />
    </div>
  </div>
</template>

<style scoped>
.month-edit {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.month-edit-label {
  font-weight: 500;
  font-size: 0.95rem;
  color: #374151;
}

.required-indicator {
  color: #ef4444;
  margin-left: 0.25rem;
}

.month-edit-controls {
  display: flex;
  gap: 0.5rem;
}

.month-select {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: white;
  font-size: 0.95rem;
  cursor: pointer;
}

.month-select:focus {
  outline: none;
  border-color: #3b82f6;
  ring: 2px;
  ring-color: rgba(59, 130, 246, 0.5);
}

.year-input {
  width: 6rem;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.95rem;
  text-align: center;
}

.year-input:focus {
  outline: none;
  border-color: #3b82f6;
  ring: 2px;
  ring-color: rgba(59, 130, 246, 0.5);
}

.checkbox-container {
  margin-bottom: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.checkbox-input {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
}

.checkbox-text {
  font-size: 0.9rem;
  color: #6b7280;
}

.month-select:disabled,
.year-input:disabled {
  background-color: #f3f4f6;
  color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
}

.month-edit.invalid .month-select,
.month-edit.invalid .year-input {
  border-color: #ef4444;
}

/* Remove spinner buttons for number input */
.year-input::-webkit-inner-spin-button,
.year-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.year-input[type='number'] {
  -moz-appearance: textfield;
}

@media (max-width: 480px) {
  .month-edit-label {
    font-size: 0.8125rem;
  }

  .month-select,
  .year-input {
    padding: 0.4rem;
    font-size: 0.8125rem;
  }

  .year-input {
    width: 5rem;
  }
}
</style>
