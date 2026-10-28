<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { UserProfile, type AnnualSummary } from '@/models'
import NewPlanDialog from '@/components/NewPlanDialog.vue'
import PlanChoice from '@/components/PlanChoice.vue'
import { calculateProjections } from '@/services/calculator'
import { usePlannerStore } from '@/stores/planner'

const emit = defineEmits<{
  comparisonChange: [
    comparison: { name: string; annualSummaries: AnnualSummary[]; inflationRate: number } | null,
  ]
}>()
const store = usePlannerStore()
const name = ref('')
const renameDialog = ref<HTMLDialogElement | null>(null)
const renameError = ref('')
const compareId = ref('')
const error = ref('')
const activeName = computed(
  () => store.scenarios.find((plan) => plan.id === store.activeScenarioId)?.name ?? 'Current plan',
)
const planOptions = computed(() =>
  store.scenarios.length
    ? store.scenarios.map((plan) => ({ value: plan.id, label: plan.name }))
    : [{ value: store.activeScenarioId, label: 'Current plan' }],
)
const compareOptions = computed(() => [
  { value: '', label: 'No comparison' },
  ...store.scenarios
    .filter((plan) => plan.id !== store.activeScenarioId)
    .map((plan) => ({ value: plan.id, label: plan.name })),
])
const comparison = computed(() => store.scenarios.find((plan) => plan.id === compareId.value))
const comparisonProfile = computed(() =>
  comparison.value ? UserProfile.fromJSON(comparison.value.profile) : null,
)
const comparisonProjection = computed(() => {
  if (!comparison.value || !comparisonProfile.value) return null
  return {
    name: comparison.value.name,
    annualSummaries: calculateProjections(comparisonProfile.value).annualSummaries,
    inflationRate: comparisonProfile.value.inflationRate,
  }
})
watch(comparisonProjection, (value) => emit('comparisonChange', value), { immediate: true })

watch(
  () => store.activeScenarioId,
  (id) => {
    if (compareId.value === id) compareId.value = ''
  },
)

function run(action: () => void) {
  error.value = ''
  try {
    action()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not change plans.'
  }
}

function switchPlan(id: string) {
  run(() => store.switchScenario(id))
}

function openRename() {
  name.value = activeName.value
  renameError.value = ''
  renameDialog.value?.showModal()
}

function renamePlan() {
  renameError.value = ''
  try {
    store.renameScenario(name.value)
    renameDialog.value?.close()
  } catch (cause) {
    renameError.value = cause instanceof Error ? cause.message : 'Could not rename the plan.'
  }
}

function deleteCurrentPlan() {
  if (!window.confirm(`Delete current plan "${activeName.value}"? This cannot be undone.`)) return
  run(() => {
    store.deleteScenario(store.activeScenarioId)
  })
}
</script>

<template>
  <section class="plans">
    <details>
      <summary>
        Plans: {{ activeName }}<span v-if="comparison">; comparing with {{ comparison.name }}</span>
      </summary>
      <p>Create a plan to explore changes. Select another plan to compare net worth.</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <div class="controls">
        <PlanChoice
          label="Current plan"
          :model-value="store.activeScenarioId"
          :options="planOptions"
          @update:model-value="switchPlan"
        >
          <template #action><NewPlanDialog /></template>
        </PlanChoice>
        <button type="button" class="btn-secondary" @click="openRename">Rename current plan</button>
        <button
          type="button"
          class="btn-danger"
          :disabled="store.scenarios.length <= 1"
          :title="store.scenarios.length <= 1 ? 'Keep at least one plan.' : undefined"
          @click="deleteCurrentPlan"
        >
          Delete {{ activeName }}
        </button>
        <dialog ref="renameDialog" aria-labelledby="rename-plan-title">
          <form @submit.prevent="renamePlan">
            <h2 id="rename-plan-title">Rename current plan</h2>
            <p v-if="renameError" role="alert">{{ renameError }}</p>
            <label>
              Plan name
              <input v-model="name" type="text" required maxlength="100" autofocus />
            </label>
            <div class="dialog-actions">
              <button type="button" class="btn-secondary" @click="renameDialog?.close()">
                Cancel
              </button>
              <button type="submit" class="btn-primary">Rename plan</button>
            </div>
          </form>
        </dialog>
        <PlanChoice v-model="compareId" label="Compare with" :options="compareOptions" />
      </div>
    </details>
  </section>
</template>

<style scoped lang="scss">
.plans {
  margin-bottom: 1rem;
}
summary {
  cursor: pointer;
  font-weight: 600;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.75rem;
  margin: 0.75rem 0;
}
.plan-choice {
  flex: 1 1 100%;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
dialog {
  margin: auto;
  width: min(32rem, calc(100% - 2rem));
  max-height: calc(100% - 2rem);
  overflow: auto;
  border: 0;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: $shadow-lg;
}
dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
}
.dialog-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
