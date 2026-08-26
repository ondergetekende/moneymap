<script setup lang="ts">
import { computed } from 'vue'
import { usePlannerStore } from '@/stores/planner'
import { addMonths, getMonthNameShort, getCurrentMonth } from '@/types/month'

const store = usePlannerStore()

// Maximum selectable offset (last projected month).
const maxOffset = computed(() => Math.max(0, store.projectionMonthCount - 1))

// Clamp helper so the slider never exceeds the available range.
const offset = computed({
  get: () => Math.min(store.selectedMonthOffset, maxOffset.value),
  set: (value: number) => {
    store.selectedMonthOffset = Math.max(0, Math.min(value, maxOffset.value))
  },
})

// Resolve the selected offset to an absolute Month and the user's age there.
const selectedMonth = computed(() => addMonths(getCurrentMonth(), offset.value))
const selectedAge = computed(() => store.userProfile.getAgeAt(selectedMonth.value))

// Human-readable label for the selected point in time.
const dateLabel = computed(() => {
  const m = selectedMonth.value
  return `${getMonthNameShort(m)} ${Math.floor(m / 12) + 1900}`
})

const isToday = computed(() => offset.value === 0)

function stepBy(months: number) {
  offset.value = offset.value + months
}

function resetToToday() {
  store.selectedMonthOffset = 0
}
</script>

<template>
  <div v-if="maxOffset > 0" class="timeline-scrubber">
    <div class="scrubber-header">
      <h3>Timeline</h3>
      <span class="selected-label">
        <strong>{{ dateLabel }}</strong>
        <span class="age-tag">age {{ selectedAge }}</span>
      </span>
    </div>

    <div class="scrubber-controls">
      <button
        class="step-btn"
        type="button"
        :disabled="offset <= 0"
        title="One month earlier"
        @mousedown.prevent
        @click="stepBy(-1)"
      >
        -1m
      </button>
      <button
        class="step-btn"
        type="button"
        :disabled="offset <= 0"
        title="One year earlier"
        @mousedown.prevent
        @click="stepBy(-12)"
      >
        -1y
      </button>

      <input
        v-model.number="offset"
        class="scrubber-range"
        type="range"
        min="0"
        :max="maxOffset"
        step="1"
        aria-label="Select a month in the projection timeline"
      />

      <button
        class="step-btn"
        type="button"
        :disabled="offset >= maxOffset"
        title="One month later"
        @mousedown.prevent
        @click="stepBy(1)"
      >
        +1m
      </button>
      <button
        class="step-btn"
        type="button"
        :disabled="offset >= maxOffset"
        title="One year later"
        @mousedown.prevent
        @click="stepBy(12)"
      >
        +1y
      </button>

      <button
        class="today-btn"
        type="button"
        :disabled="isToday"
        title="Jump back to today"
        @mousedown.prevent
        @click="resetToToday"
      >
        Today
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.timeline-scrubber {
  padding: $spacing-xl;
  background-color: $bg-card;
  border-radius: $radius-lg;
  box-shadow: $shadow-sm;
  margin-bottom: $spacing-xl;
}

.scrubber-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: $spacing-base;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

h3 {
  margin: 0;
  color: $text-primary;
  font-size: $font-md;
}

.selected-label {
  font-size: $font-base;
  color: $text-secondary;
  display: inline-flex;
  align-items: baseline;
  gap: $spacing-sm;
}

.age-tag {
  color: $text-muted;
  font-size: $font-sm;
}

.scrubber-controls {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  flex-wrap: wrap;
}

.step-btn,
.today-btn {
  padding: $spacing-xs $spacing-sm;
  border: 1px solid $border-medium;
  border-radius: $radius-md;
  background: $bg-card;
  color: $text-secondary;
  font-size: $font-sm;
  font-weight: $font-semibold;
  cursor: pointer;
  transition: $transition-base;
  min-height: $touch-target-min - 8px;

  &:hover:not(:disabled) {
    border-color: $primary;
    color: $primary;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.today-btn {
  border-color: $primary;
  color: $primary;
}

.scrubber-range {
  flex: 1;
  min-width: 150px;
  min-height: $touch-target-min;
  accent-color: $primary;
  cursor: pointer;
}

@include mobile {
  .timeline-scrubber {
    padding: $spacing-base;
    margin-bottom: $spacing-base;
  }

  .scrubber-controls {
    gap: 0.375rem;
  }

  .step-btn,
  .today-btn {
    padding: $spacing-xs $spacing-xs;
    font-size: $font-xs;
  }

  .scrubber-range {
    order: -1;
    flex-basis: 100%;
    min-width: 100%;
  }
}

@include mobile-small {
  .timeline-scrubber {
    padding: $spacing-base;
  }
}
</style>
