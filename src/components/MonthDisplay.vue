<script setup lang="ts">
import { computed } from 'vue'
import type { Month } from '@/types/month'
import { formatMonth } from '@/types/month'

interface Props {
  month?: Month | null
  format?: 'YYYY-MM' | 'YYYY-MM-DD' | 'full' | 'short'
  emptyText?: string
}

const props = withDefaults(defineProps<Props>(), {
  format: 'full',
  emptyText: 'Not set',
})

const displayText = computed(() => {
  if (props.month === undefined || props.month === null) {
    return props.emptyText
  }
  return formatMonth(props.month, props.format)
})
</script>

<template>
  <span class="month-display">{{ displayText }}</span>
</template>

<style scoped>
.month-display {
  display: inline;
}
</style>
