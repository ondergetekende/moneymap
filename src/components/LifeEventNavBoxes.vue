<script setup lang="ts">
import { computed } from 'vue'
import { usePlannerStore } from '@/stores/planner'
import { formatCurrency, adjustForInflation } from '@/utils/format'
import { getCurrentMonth, formatMonth } from '@/types/month'
import { resolveLifeEventNavs, type LifeEventNav } from '@/utils/timeline'

const props = defineProps<{
  showInflationAdjusted?: boolean
}>()

const store = usePlannerStore()

// Resolve each life event to its month offset and NAV at that point.
const eventNavs = computed<LifeEventNav[]>(() => {
  const result = store.projectionResult
  if (!result) return []
  return resolveLifeEventNavs(
    getCurrentMonth(),
    store.birthDate,
    store.lifeEvents,
    result.monthlyProjections,
  )
})

// Apply the inflation toggle consistently with the chart and table.
function adjustNav(event: LifeEventNav): number | null {
  if (event.nav === null) return null
  const yearsFromNow = event.monthOffset / 12
  return props.showInflationAdjusted
    ? adjustForInflation(event.nav, yearsFromNow, store.inflationRate)
    : event.nav
}

// A life event is "active" when the scrubber points at its exact month.
function isActive(event: LifeEventNav): boolean {
  return store.selectedMonthOffset === event.monthOffset
}

// Jump the scrubber to this life event's month when a box is clicked.
function selectEvent(event: LifeEventNav) {
  if (event.monthOffset < 0) return
  const max = Math.max(0, store.projectionMonthCount - 1)
  store.selectedMonthOffset = Math.min(event.monthOffset, max)
}
</script>

<template>
  <div v-if="eventNavs.length > 0" class="life-event-navs">
    <div class="navs-header">
      <h2>Your net worth at</h2>
      <span class="navs-hint">{{
        showInflationAdjusted ? "In today's money" : 'In future money'
      }}</span>
    </div>
    <div class="nav-boxes">
      <button
        v-for="event in eventNavs"
        :key="event.eventId"
        type="button"
        class="nav-box"
        :class="{ active: isActive(event), future: event.monthOffset > 0 }"
        :disabled="event.monthOffset < 0"
        :title="event.monthOffset < 0 ? 'Before the projection start' : 'Jump to this life event'"
        @mousedown.prevent
        @click="selectEvent(event)"
      >
        <span class="nav-name">{{ event.name }}</span>
        <span class="nav-date">{{ formatMonth(event.month, 'short') }} (age {{ event.age }})</span>
        <span
          class="nav-value"
          :class="{
            'nav-null': adjustNav(event) === null,
            negative: adjustNav(event) !== null && adjustNav(event)! < 0,
          }"
        >
          {{ adjustNav(event) === null ? 'n/a' : formatCurrency(adjustNav(event) as number) }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.life-event-navs {
  margin-bottom: $spacing-3xl;
}

.navs-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: $spacing-base;
  margin-bottom: $spacing-base;

  h2 {
    margin: 0;
    font-size: $font-lg;
    color: $text-primary;
    white-space: nowrap;
  }
}

.navs-hint {
  font-size: $font-sm;
  color: $text-muted;
}

.nav-boxes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: $spacing-base;
}

.nav-box {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: $spacing-lg $spacing-xl;
  border: 1px solid $border-light;
  border-left: 4px solid $primary;
  border-radius: $radius-md;
  background: $bg-card;
  text-align: left;
  cursor: pointer;
  transition: $transition-base;
  min-width: 140px;
  min-height: $touch-target-min - 8px;

  &:hover:not(:disabled) {
    box-shadow: $shadow-sm;
    border-color: $border-medium;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    border-left-color: $border-dark;
  }

  &.active {
    border-color: $primary;
    border-left-width: 4px;
    box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.25);
  }

  &.future .nav-value {
    color: $success-dark;
  }

  // Negative NAV must win over the green future color (same specificity, later).
  &.future .nav-value.negative {
    color: $danger;
  }
}

.nav-name {
  font-weight: $font-semibold;
  font-size: $font-base;
  color: $text-primary;
}

.nav-date {
  font-size: $font-sm;
  color: $text-muted;
}

.nav-value {
  font-weight: 800;
  font-size: $font-3xl;
  line-height: $line-height-tight;
  font-variant-numeric: tabular-nums;
  color: $text-primary;
  margin-top: $spacing-xs;
}

.nav-value.nav-null {
  color: $text-muted;
  font-weight: $font-normal;
  font-size: $font-base;
}

.nav-value.negative {
  color: $danger;
}
@include mobile {
  .nav-boxes {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: $spacing-sm;
  }

  .nav-box {
    min-width: 0;
    padding: $spacing-base;
  }

  .nav-value {
    font-size: $font-xl-2;
  }
}
</style>
