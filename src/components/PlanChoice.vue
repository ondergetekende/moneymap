<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  label: string
  modelValue: string
  options: { value: string; label: string }[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const container = ref<HTMLElement | null>(null)
const measure = ref<HTMLElement | null>(null)
const choices = ref<HTMLElement | null>(null)
const action = ref<HTMLElement | null>(null)
const overflow = ref(false)
let observer: ResizeObserver | undefined
let details: HTMLDetailsElement | null = null

function updateFit() {
  if (!container.value || !measure.value || container.value.clientWidth === 0) return
  const actionWidth = action.value?.getBoundingClientRect().width ?? 0
  const gap =
    action.value && choices.value
      ? Number.parseFloat(getComputedStyle(choices.value).columnGap) || 0
      : 0
  overflow.value =
    measure.value.getBoundingClientRect().width + actionWidth + gap > container.value.clientWidth
}

function selectOption(event: Event) {
  const select = event.target as HTMLSelectElement
  emit('update:modelValue', select.value)
  nextTick(() => {
    select.value = props.modelValue
  })
}

onMounted(() => {
  observer = new ResizeObserver(updateFit)
  if (container.value) observer.observe(container.value)
  if (measure.value) observer.observe(measure.value)
  if (action.value) observer.observe(action.value)
  details = container.value?.closest('details') ?? null
  details?.addEventListener('toggle', updateFit)
  window.addEventListener('resize', updateFit)
  document.addEventListener('visibilitychange', updateFit)
  updateFit()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  details?.removeEventListener('toggle', updateFit)
  window.removeEventListener('resize', updateFit)
  document.removeEventListener('visibilitychange', updateFit)
})
watch(
  () => props.options,
  () => nextTick(updateFit),
  { deep: true },
)
</script>

<template>
  <div ref="container" class="plan-choice">
    <span class="choice-label">{{ label }}</span>
    <div ref="choices" class="choice-buttons" role="group" :aria-label="label">
      <button
        v-for="option in overflow ? [] : options"
        :key="option.value"
        type="button"
        class="btn-secondary"
        :class="{ selected: option.value === modelValue }"
        :aria-pressed="option.value === modelValue"
        @click="emit('update:modelValue', option.value)"
      >
        {{ option.label }}
      </button>
      <select v-if="overflow" :aria-label="label" :value="modelValue" @change="selectOption">
        <option v-for="option in options" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <div v-if="$slots.action" ref="action" class="choice-action">
        <slot name="action" />
      </div>
    </div>
    <div ref="measure" class="choice-measure choice-buttons" aria-hidden="true">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="btn-secondary"
        tabindex="-1"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.plan-choice {
  position: relative;
  min-width: 0;
}
.choice-label {
  display: block;
}
.choice-buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.choice-buttons button {
  white-space: nowrap;
}
.choice-buttons .selected {
  background: $primary;
  color: white;
}
.choice-buttons .selected:hover {
  background: $primary-hover;
}
.choice-action {
  padding-inline-start: 1rem;
}
.choice-measure {
  position: absolute;
  top: 0;
  left: 0;
  width: max-content;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
}
select {
  flex: 1 1 8rem;
  min-width: 0;
  max-width: 100%;
}
</style>
