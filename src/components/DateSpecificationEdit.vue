<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePlannerStore } from '@/stores/planner'
import type { Month, DateSpecification } from '@/types/month'
import type { LifeEvent } from '@/models'
import {
  getYear,
  getMonthIndex,
  fromYearMonth,
  getCurrentMonth,
  resolveDate,
  createAbsoluteDate,
  createAgeDate,
  createLifeEventDate,
  formatMonth,
} from '@/types/month'

interface Props {
  modelValue?: DateSpecification
  label?: string
  required?: boolean
  nullable?: boolean
  nullableText?: string
  maxMonth?: Month
  minMonth?: Month
  allowAgeEntry?: boolean
  allowEventEntry?: boolean
  showModeSelector?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  required: false,
  nullable: true,
  nullableText: 'no date',
  allowAgeEntry: true,
  allowEventEntry: true,
  showModeSelector: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: DateSpecification | undefined]
}>()

const store = usePlannerStore()

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

// Determine initial mode from modelValue
const getInitialMode = (): 'absolute' | 'age' | 'lifeEvent' | 'null' => {
  if (props.modelValue === undefined && props.nullable) return 'null'
  if (props.modelValue?.type === 'age') return 'age'
  if (props.modelValue?.type === 'lifeEvent') return 'lifeEvent'
  return 'absolute'
}

const mode = ref<'absolute' | 'age' | 'lifeEvent' | 'null'>(getInitialMode())

// Initialize absolute mode values
const currentMonth =
  props.modelValue?.type === 'absolute' ? props.modelValue.month : getCurrentMonth()
const yearString = ref<string>(String(getYear(currentMonth)))
const monthIndex = ref<number>(getMonthIndex(currentMonth))

// Initialize age mode value
const ageString = ref<string>(props.modelValue?.type === 'age' ? String(props.modelValue.age) : '')

// Initialize life event mode value
const selectedLifeEventId = ref<string>(
  props.modelValue?.type === 'lifeEvent' ? props.modelValue.eventId : '',
)

// Get available life events from store
const lifeEvents = computed(() => store.lifeEvents)

// Watch for external changes to modelValue
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue === undefined) {
      mode.value = props.nullable ? 'null' : 'absolute'
    } else if (newValue.type === 'absolute') {
      mode.value = 'absolute'
      yearString.value = String(getYear(newValue.month))
      monthIndex.value = getMonthIndex(newValue.month)
    } else if (newValue.type === 'age') {
      mode.value = 'age'
      ageString.value = String(newValue.age)
    } else if (newValue.type === 'lifeEvent') {
      mode.value = 'lifeEvent'
      selectedLifeEventId.value = newValue.eventId
    }
  },
)

// Parsed year value
const year = computed<number>(() => {
  const parsed = parseInt(yearString.value, 10)
  return isNaN(parsed) ? getYear(getCurrentMonth()) : parsed
})

// Parsed age value
const age = computed<number>(() => {
  const parsed = parseInt(ageString.value, 10)
  return isNaN(parsed) ? 0 : parsed
})

// Computed Month value (for absolute mode)
const absoluteMonthValue = computed<Month>(() => {
  return fromYearMonth(year.value, monthIndex.value)
})

// Resolved month preview (for age mode)
const resolvedAgePreview = computed<string | null>(() => {
  if (mode.value !== 'age') return null

  const birthDate = store.birthDate
  if (birthDate === undefined) {
    return 'Birth date not set'
  }

  const ageValue = age.value
  if (ageValue < 0 || ageValue > 120) {
    return 'Invalid age'
  }

  const ageSpec = createAgeDate(ageValue)
  const resolvedMonth = resolveDate(ageSpec, birthDate, store.lifeEvents)
  if (resolvedMonth === undefined) {
    return 'Cannot resolve'
  }

  return `${formatMonth(resolvedMonth, 'full')} (based on your birth date)`
})

// Resolved life event preview
const resolvedLifeEventPreview = computed<string | null>(() => {
  if (mode.value !== 'lifeEvent') return null

  if (!selectedLifeEventId.value) {
    return 'No life event selected'
  }

  const event = lifeEvents.value.find((e) => e.id === selectedLifeEventId.value)
  if (!event) {
    return 'Life event not found'
  }

  if (!event.date) {
    return 'Date not set for this event'
  }

  const resolvedMonth = resolveDate(event.date, store.birthDate, lifeEvents.value)
  if (resolvedMonth === undefined) {
    return 'Cannot resolve date'
  }

  // Show the resolved date with additional context
  if (event.date.type === 'age') {
    return `${formatMonth(resolvedMonth, 'full')} (Age ${event.date.age})`
  } else {
    return formatMonth(resolvedMonth, 'full')
  }
})

// Format life event option text for dropdown
function formatLifeEventOption(event: LifeEvent): string {
  if (!event.date) {
    return `${event.name} (date not set)`
  }

  const resolvedMonth = resolveDate(event.date, store.birthDate, lifeEvents.value)
  if (resolvedMonth === undefined) {
    return `${event.name} (cannot resolve)`
  }

  if (event.date.type === 'age') {
    return `${event.name} (${formatMonth(resolvedMonth, 'full')} - Age ${event.date.age})`
  } else {
    return `${event.name} (${formatMonth(resolvedMonth, 'full')})`
  }
}

// Emit changes when relevant fields change
watch([yearString, monthIndex, ageString, selectedLifeEventId, mode], () => {
  // If mode is null, emit undefined
  if (mode.value === 'null') {
    emit('update:modelValue', undefined)
    return
  }

  if (mode.value === 'absolute') {
    // Only emit if year is a valid number
    const yearNum = parseInt(yearString.value, 10)
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2200) {
      return
    }

    const newMonth = fromYearMonth(yearNum, monthIndex.value)

    // Validate against min/max if provided
    if (props.minMonth !== undefined && newMonth < props.minMonth) {
      return
    }
    if (props.maxMonth !== undefined && newMonth > props.maxMonth) {
      return
    }

    emit('update:modelValue', createAbsoluteDate(newMonth))
  } else if (mode.value === 'age') {
    const ageValue = age.value
    if (isNaN(ageValue) || ageValue < 0 || ageValue > 120) {
      return
    }

    emit('update:modelValue', createAgeDate(ageValue))
  } else if (mode.value === 'lifeEvent') {
    if (!selectedLifeEventId.value) {
      return
    }

    emit('update:modelValue', createLifeEventDate(selectedLifeEventId.value))
  }
})

// Validation state
const isValid = computed(() => {
  if (mode.value === 'absolute') {
    const month = absoluteMonthValue.value
    if (props.minMonth !== undefined && month < props.minMonth) return false
    if (props.maxMonth !== undefined && month > props.maxMonth) return false
  } else if (mode.value === 'age') {
    const ageValue = age.value
    if (ageValue < 0 || ageValue > 120) return false
  }
  return true
})
</script>

<template>
  <div class="date-spec-edit" :class="{ invalid: !isValid }">
    <label v-if="label" class="date-spec-label">
      {{ label }}
      <span v-if="required" class="required-indicator">*</span>
    </label>

    <div
      v-if="showModeSelector && (allowAgeEntry || allowEventEntry || nullable)"
      class="mode-selector"
    >
      <label v-if="nullable" class="mode-option">
        <input v-model="mode" type="radio" value="null" class="mode-radio" />
        <span class="mode-label">{{ nullableText }}</span>
      </label>
      <label class="mode-option">
        <input v-model="mode" type="radio" value="absolute" class="mode-radio" />
        <span class="mode-label">Month + Year</span>
      </label>
      <label v-if="allowAgeEntry" class="mode-option">
        <input v-model="mode" type="radio" value="age" class="mode-radio" />
        <span class="mode-label">Age</span>
      </label>
      <label v-if="allowEventEntry" class="mode-option">
        <input v-model="mode" type="radio" value="lifeEvent" class="mode-radio" />
        <span class="mode-label">Life Event</span>
      </label>
    </div>

    <div v-if="mode === 'absolute'" class="date-controls">
      <select v-model.number="monthIndex" class="month-select" :required="required">
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
        :required="required"
        placeholder="YYYY"
      />
    </div>

    <div v-else-if="mode === 'age'" class="age-controls">
      <label class="age-label">Age:</label>
      <input
        v-model="ageString"
        type="number"
        inputmode="numeric"
        min="0"
        max="120"
        class="age-input"
        :required="required"
        placeholder="67"
      />
      <div v-if="resolvedAgePreview" class="age-preview">
        {{ resolvedAgePreview }}
      </div>
    </div>

    <div v-else-if="mode === 'lifeEvent'" class="life-event-controls">
      <div v-if="lifeEvents.length === 0" class="no-life-events">
        No life events defined. Go to Basic Information to create one.
      </div>
      <select v-else v-model="selectedLifeEventId" class="life-event-select" :required="required">
        <option value="">Select a life event</option>
        <option v-for="event in lifeEvents" :key="event.id" :value="event.id">
          {{ formatLifeEventOption(event) }}
        </option>
      </select>
      <div v-if="resolvedLifeEventPreview" class="life-event-preview">
        {{ resolvedLifeEventPreview }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.date-spec-edit {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.date-spec-label {
  font-weight: 500;
  font-size: 0.95rem;
  color: #374151;
}

.required-indicator {
  color: #ef4444;
  margin-left: 0.25rem;
}

.mode-selector {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  cursor: pointer;
  user-select: none;
}

.mode-radio {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
}

.mode-label {
  font-size: 0.9rem;
  color: #374151;
}

.date-controls {
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

.age-controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.age-label {
  font-size: 0.9rem;
  color: #6b7280;
}

.age-input {
  width: 8rem;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.95rem;
}

.age-input:focus {
  outline: none;
  border-color: #3b82f6;
  ring: 2px;
  ring-color: rgba(59, 130, 246, 0.5);
}

.age-preview {
  font-size: 0.875rem;
  color: #6b7280;
  font-style: italic;
}

.life-event-controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.life-event-select {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: white;
  font-size: 0.95rem;
  cursor: pointer;
}

.life-event-select:focus {
  outline: none;
  border-color: #3b82f6;
  ring: 2px;
  ring-color: rgba(59, 130, 246, 0.5);
}

.life-event-preview {
  font-size: 0.875rem;
  color: #6b7280;
  font-style: italic;
}

.no-life-events {
  padding: 0.75rem;
  background-color: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #92400e;
}

.date-spec-edit.invalid .month-select,
.date-spec-edit.invalid .year-input,
.date-spec-edit.invalid .age-input,
.date-spec-edit.invalid .life-event-select {
  border-color: #ef4444;
}

/* Remove spinner buttons for number input */
.year-input::-webkit-inner-spin-button,
.year-input::-webkit-outer-spin-button,
.age-input::-webkit-inner-spin-button,
.age-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.year-input[type='number'],
.age-input[type='number'] {
  -moz-appearance: textfield;
}

@media (max-width: 480px) {
  .date-spec-label {
    font-size: 0.8125rem;
  }

  .month-select,
  .year-input,
  .age-input,
  .life-event-select {
    padding: 0.4rem;
    font-size: 0.8125rem;
  }

  .year-input {
    width: 5rem;
  }

  .age-input {
    width: 7rem;
  }

  .mode-selector {
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .mode-label {
    font-size: 0.8125rem;
  }

  .no-life-events {
    font-size: 0.8125rem;
    padding: 0.6rem;
  }
}
</style>
