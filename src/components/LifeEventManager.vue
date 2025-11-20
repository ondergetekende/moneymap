<template>
  <div class="life-event-manager">
    <div class="section-header">
      <h3>Life Events</h3>
      <button @click="startAdding" class="btn-add">Add Life Event</button>
    </div>

    <div v-if="lifeEvents.length === 0 && !isAdding" class="empty-state">
      No life events defined. Add one to reference it when setting dates.
    </div>

    <div v-if="lifeEvents.length > 0" class="life-events-list">
      <div v-for="event in lifeEvents" :key="event.id" class="life-event-card">
        <div v-if="editingId !== event.id" class="life-event-view">
          <div class="life-event-header">
            <strong>{{ event.name }}</strong>
            <div class="life-event-actions">
              <button @click="startEditing(event)" class="btn-edit">Edit</button>
              <button @click="handleDelete(event.id)" class="btn-delete">Delete</button>
            </div>
          </div>

          <div v-if="event.date" class="life-event-date">
            {{ formatDateSpec(event.date) }}
          </div>
          <div v-else class="life-event-date unset">Date not set</div>

          <div v-if="event.description" class="life-event-description">
            {{ event.description }}
          </div>

          <div class="life-event-references">
            {{ getReferenceCount(event.id) }}
          </div>
        </div>

        <div v-else class="life-event-edit">
          <div class="form-group">
            <label>Name</label>
            <input v-model="editForm.name" type="text" required />
          </div>

          <div class="form-group">
            <label>Date</label>
            <DateSpecificationEdit
              v-model="editForm.date"
              :nullable="false"
              :allow-age-entry="true"
              :allow-event-entry="false"
              :show-mode-selector="true"
            />
          </div>

          <div class="form-group">
            <label>Description (optional)</label>
            <textarea v-model="editForm.description" rows="2"></textarea>
          </div>

          <div class="form-actions">
            <button @click="saveEdit" class="btn-save">Save</button>
            <button @click="cancelEdit" class="btn-cancel">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isAdding" class="life-event-card life-event-add">
      <h4>Add Life Event</h4>

      <div class="form-group">
        <label>Name</label>
        <input v-model="addForm.name" type="text" required />
      </div>

      <div class="form-group">
        <label>Date</label>
        <DateSpecificationEdit
          v-model="addForm.date"
          :nullable="false"
          :allow-age-entry="true"
          :allow-event-entry="false"
          :show-mode-selector="true"
        />
      </div>

      <div class="form-group">
        <label>Description (optional)</label>
        <textarea v-model="addForm.description" rows="2"></textarea>
      </div>

      <div class="form-actions">
        <button @click="saveAdd" class="btn-save">Add</button>
        <button @click="cancelAdd" class="btn-cancel">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePlannerStore } from '@/stores/planner'
import type { LifeEvent } from '@/models'
import type { DateSpecification } from '@/types/month'
import { formatMonth, resolveDate, getCurrentMonth, createAbsoluteDate } from '@/types/month'
import DateSpecificationEdit from './DateSpecificationEdit.vue'

const store = usePlannerStore()

const lifeEvents = computed(() => store.lifeEvents)

const isAdding = ref(false)
const editingId = ref<string | null>(null)

const addForm = ref<{
  name: string
  date: DateSpecification
  description?: string
}>({
  name: '',
  date: createAbsoluteDate(getCurrentMonth()),
  description: '',
})

const editForm = ref<{
  name: string
  date: DateSpecification
  description?: string
}>({
  name: '',
  date: createAbsoluteDate(getCurrentMonth()),
  description: '',
})

function startAdding() {
  isAdding.value = true
  addForm.value = {
    name: '',
    date: createAbsoluteDate(getCurrentMonth()),
    description: '',
  }
}

function cancelAdd() {
  isAdding.value = false
  addForm.value = {
    name: '',
    date: createAbsoluteDate(getCurrentMonth()),
    description: '',
  }
}

function saveAdd() {
  if (!addForm.value.name.trim()) {
    alert('Please enter a name for the life event')
    return
  }

  store.addLifeEvent({
    name: addForm.value.name,
    date: addForm.value.date,
    description: addForm.value.description,
  })

  cancelAdd()
}

function startEditing(event: LifeEvent) {
  editingId.value = event.id
  editForm.value = {
    name: event.name,
    date: event.date || createAbsoluteDate(getCurrentMonth()),
    description: event.description,
  }
}

function cancelEdit() {
  editingId.value = null
  editForm.value = {
    name: '',
    date: createAbsoluteDate(getCurrentMonth()),
    description: '',
  }
}

function saveEdit() {
  if (!editForm.value.name.trim()) {
    alert('Please enter a name for the life event')
    return
  }

  if (editingId.value) {
    store.updateLifeEvent(editingId.value, {
      name: editForm.value.name,
      date: editForm.value.date,
      description: editForm.value.description,
    })
  }

  cancelEdit()
}

function handleDelete(eventId: string) {
  const references = store.findItemsReferencingLifeEvent(eventId)
  const totalReferences =
    references.cashFlows.length + references.debts.length + references.assets.length

  if (totalReferences > 0) {
    const event = lifeEvents.value.find((e) => e.id === eventId)
    const eventName = event?.name || 'this life event'

    let message = `Cannot delete "${eventName}" because ${totalReferences} item(s) still reference it:\n\n`

    if (references.cashFlows.length > 0) {
      message += `Cash Flows (${references.cashFlows.length}):\n`
      references.cashFlows.forEach((cf) => {
        message += `  - ${cf.name}\n`
      })
    }

    if (references.debts.length > 0) {
      message += `Debts (${references.debts.length}):\n`
      references.debts.forEach((d) => {
        message += `  - ${d.name}\n`
      })
    }

    if (references.assets.length > 0) {
      message += `Assets (${references.assets.length}):\n`
      references.assets.forEach((a) => {
        message += `  - ${a.name}\n`
      })
    }

    message += '\nPlease update those items first before deleting this life event.'

    alert(message)
    return
  }

  const event = lifeEvents.value.find((e) => e.id === eventId)
  const eventName = event?.name || 'this life event'

  if (confirm(`Delete "${eventName}"?`)) {
    store.removeLifeEvent(eventId)
  }
}

function getReferenceCount(eventId: string): string {
  const references = store.findItemsReferencingLifeEvent(eventId)
  const totalReferences =
    references.cashFlows.length + references.debts.length + references.assets.length

  if (totalReferences === 0) {
    return 'Not referenced by any items'
  } else if (totalReferences === 1) {
    return 'Referenced by 1 item'
  } else {
    return `Referenced by ${totalReferences} items`
  }
}

function formatDateSpec(dateSpec: DateSpecification): string {
  if (dateSpec.type === 'absolute') {
    return formatMonth(dateSpec.month, 'full')
  } else if (dateSpec.type === 'age') {
    const resolved = resolveDate(dateSpec, store.birthDate)
    if (resolved !== undefined) {
      return `Age ${dateSpec.age} (${formatMonth(resolved, 'full')})`
    }
    return `Age ${dateSpec.age}`
  } else if (dateSpec.type === 'lifeEvent') {
    // This shouldn't happen (life event referencing another life event)
    // but handle it gracefully
    return 'References another life event'
  }
  return 'Unknown date type'
}
</script>

<style scoped>
.life-event-manager {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.section-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.empty-state {
  padding: 1.5rem;
  text-align: center;
  color: #666;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 0.9rem;
}

.life-events-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.life-event-card {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
}

.life-event-view {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.life-event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.life-event-actions {
  display: flex;
  gap: 0.5rem;
}

.life-event-date {
  font-size: 0.9rem;
  color: #555;
}

.life-event-date.unset {
  color: #999;
  font-style: italic;
}

.life-event-description {
  font-size: 0.85rem;
  color: #666;
}

.life-event-references {
  font-size: 0.8rem;
  color: #888;
  font-style: italic;
}

.life-event-edit,
.life-event-add {
  background: #f9f9f9;
}

.life-event-add h4 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 500;
}

.form-group input,
.form-group textarea {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.9rem;
}

.form-group textarea {
  resize: vertical;
  font-family: inherit;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

button {
  padding: 0.4rem 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

button:hover {
  background: #f5f5f5;
}

.btn-add,
.btn-save {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.btn-add:hover,
.btn-save:hover {
  background: #0056b3;
  border-color: #0056b3;
}

.btn-delete {
  color: #dc3545;
  border-color: #dc3545;
}

.btn-delete:hover {
  background: #dc3545;
  color: white;
}

.btn-cancel {
  background: #6c757d;
  color: white;
  border-color: #6c757d;
}

.btn-cancel:hover {
  background: #545b62;
  border-color: #545b62;
}

/* Mobile optimization */
@media (max-width: 480px) {
  .section-header h3 {
    font-size: 1rem;
  }

  button {
    padding: 0.35rem 0.6rem;
    font-size: 0.8rem;
  }

  .life-event-card {
    padding: 0.6rem;
  }
}
</style>
