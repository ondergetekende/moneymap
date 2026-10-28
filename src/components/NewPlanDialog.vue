<script setup lang="ts">
import { ref } from 'vue'
import { usePlannerStore, type ScenarioSource } from '@/stores/planner'

const emit = defineEmits<{ created: [] }>()
const store = usePlannerStore()
const dialog = ref<HTMLDialogElement | null>(null)
const name = ref('New plan')
const source = ref('template')
const error = ref('')

function open() {
  name.value = 'New plan'
  source.value = 'template'
  error.value = ''
  dialog.value?.showModal()
}

function create() {
  error.value = ''
  try {
    let selected: ScenarioSource
    if (source.value === 'template' || source.value === 'empty') {
      selected = { type: source.value }
    } else if (typeof source.value === 'string' && source.value.startsWith('plan:')) {
      selected = { type: 'existing', id: source.value.slice(5) }
    } else {
      throw new Error('Choose a valid plan source.')
    }
    store.createScenario(name.value, selected)
    dialog.value?.close()
    emit('created')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not create the plan.'
  }
}
</script>

<template>
  <button type="button" class="btn-primary" @click="open">New plan</button>
  <dialog ref="dialog" aria-labelledby="new-plan-title">
    <form @submit.prevent="create">
      <h2 id="new-plan-title">New plan</h2>
      <p v-if="error" role="alert">{{ error }}</p>
      <label>
        Plan name
        <input v-model="name" type="text" required maxlength="100" autofocus />
      </label>
      <label>
        Start from
        <select v-model="source">
          <option value="template">Example template</option>
          <option value="empty">Empty plan</option>
          <optgroup v-if="store.scenarios.length" label="Existing plans">
            <option v-for="plan in store.scenarios" :key="plan.id" :value="`plan:${plan.id}`">
              {{ plan.name }}
            </option>
          </optgroup>
        </select>
      </label>
      <p v-if="source === 'template'">
        The example has savings, income, expenses, and retirement events. Change these to match your
        situation.
      </p>
      <p v-else-if="source === 'empty'">
        Start without assets, income, expenses, debts, or life events.
      </p>
      <p v-else>The selected plan will be copied.</p>
      <div class="actions">
        <button type="button" class="btn-secondary" @click="dialog?.close()">Cancel</button>
        <button type="submit" class="btn-primary">Create plan</button>
      </div>
    </form>
  </dialog>
</template>

<style scoped lang="scss">
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
form,
label {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
form {
  gap: 1rem;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
