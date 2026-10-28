<template>
  <div class="birth-date-step">
    <h3 class="step-title">When were you born?</h3>
    <p class="step-description">We use it to show your age at each point of your plan.</p>

    <div class="form-section">
      <DateSpecificationEdit
        :modelValue="birthDateSpec"
        @update:modelValue="handleBirthDateUpdate"
        label="Birth Month and Year"
        :maxMonth="maxMonth"
        :nullable="false"
        :allowAgeEntry="false"
        :showModeSelector="false"
      />

      <div v-if="currentAge !== null" class="age-display">
        <div class="age-info">
          <span class="age-label">Your current age:</span>
          <span class="age-value">{{ currentAge }} years old</span>
        </div>
      </div>
    </div>

    <div class="info-box">
      <div class="info-content">
        <strong>Privacy note:</strong> Your birth date is stored locally on your device and is never
        transmitted to any server.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DateSpecificationEdit from '../DateSpecificationEdit.vue'
import type { Month, DateSpecification } from '@/types/month'
import { getCurrentMonth, createAbsoluteDate } from '@/types/month'

const props = defineProps<{
  birthDate: Month
  currentAge: number | null
}>()

const emit = defineEmits<{
  'update:birthDate': [value: Month]
}>()

const maxMonth = computed(() => {
  return getCurrentMonth()
})

// Convert Month to DateSpecification for the component
const birthDateSpec = computed((): DateSpecification => {
  return createAbsoluteDate(props.birthDate)
})

// Handle updates from DateSpecificationEdit
function handleBirthDateUpdate(value: DateSpecification | undefined) {
  if (value && value.type === 'absolute') {
    emit('update:birthDate', value.month)
  }
}
</script>

<style scoped lang="scss">
.birth-date-step {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.age-display {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 2px solid $primary;
  border-radius: 8px;
}

.age-icon {
  font-size: 2rem;
  line-height: 1;
}

.age-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.age-label {
  font-size: 0.9rem;
  color: $text-light;
  font-weight: 600;
}

.age-value {
  font-size: 1.5rem;
  color: $primary;
  font-weight: 700;
}

.info-box {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background-color: #e7f3ff;
  border-left: 4px solid #3b82f6;
  border-radius: 4px;
}

.info-icon {
  font-size: 1.25rem;
  line-height: 1;
  flex-shrink: 0;
}

.info-content {
  font-size: 0.9rem;
  color: #1e3a5f;
  line-height: 1.5;
}

.info-content strong {
  font-weight: 700;
}

/* Mobile responsive */
@media (max-width: $breakpoint-mobile) {
  .age-display {
    padding: 0.875rem;
  }

  .age-icon {
    font-size: 1.75rem;
  }

  .age-value {
    font-size: 1.3rem;
  }

  .info-box {
    padding: 0.875rem;
  }

  .info-content {
    font-size: 0.85rem;
  }
}

@media (max-width: 480px) {
  .birth-date-step {
    gap: 1.25rem;
  }

  .age-display {
    padding: 0.75rem;
    gap: 0.75rem;
  }

  .age-icon {
    font-size: 1.5rem;
  }

  .age-label {
    font-size: 0.8rem;
  }

  .age-value {
    font-size: 1.1rem;
  }

  .info-box {
    padding: 0.75rem;
    gap: 0.5rem;
  }

  .info-icon {
    font-size: 1.1rem;
  }

  .info-content {
    font-size: 0.8rem;
  }
}
</style>
