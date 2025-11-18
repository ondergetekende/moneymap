<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlannerStore } from '@/stores/planner'
import { getItemTypeById, getItemTypeButtonLabel } from '@/config/itemTypes'
import type { CashFlowType } from '@/models'
import type { Month } from '@/types/month'
import MonthEdit from '@/components/MonthEdit.vue'

const props = defineProps<{
  id?: string
  typeId?: string
}>()

const router = useRouter()
const store = usePlannerStore()

// Form state
const name = ref('')
const monthlyAmount = ref<number>(0)
const startDate = ref<Month | undefined>(undefined)
const endDate = ref<Month | undefined>(undefined)
const cashFlowType = ref<CashFlowType>('income')
const followsInflation = ref<boolean>(false)
const isOneTime = ref<boolean>(false)

// UI state
const isEditMode = computed(() => !!props.id)
const itemType = computed(() => getItemTypeById(cashFlowType.value))
const pageTitle = computed(() => {
  const typeName = itemType.value ? getItemTypeButtonLabel(itemType.value) : 'Cash Flow'
  if (isEditMode.value) {
    return `Edit ${typeName}`
  }
  return `New ${typeName}`
})

// Dynamic labels based on frequency
const amountLabel = computed(() => isOneTime.value ? 'Amount (€) *' : 'Monthly Amount (€) *')
const startDateLabel = computed(() => isOneTime.value ? 'Date *' : 'Start Month (optional)')
const startDateHelpText = computed(() => isOneTime.value ? 'When this transaction occurs' : 'Leave empty to start from current month')

// Load existing cashflow for editing
onMounted(() => {
  if (isEditMode.value && props.id) {
    const cashFlow = store.getCashFlowById(props.id)
    if (cashFlow) {
      name.value = cashFlow.name
      monthlyAmount.value = cashFlow.monthlyAmount
      startDate.value = cashFlow.startDate
      endDate.value = cashFlow.endDate
      cashFlowType.value = cashFlow.type
      followsInflation.value = cashFlow.followsInflation
      isOneTime.value = cashFlow.isOneTime
    } else {
      // CashFlow not found, redirect to dashboard
      router.push({ name: 'dashboard' })
    }
  } else if (props.typeId) {
    // New cashflow with pre-selected type - load template values
    const itemTypeConfig = getItemTypeById(props.typeId)
    if (itemTypeConfig && itemTypeConfig.template) {
      const template = itemTypeConfig.template as any
      name.value = template.name || ''
      monthlyAmount.value = template.monthlyAmount || 0
      cashFlowType.value = template.type || 'income'
      startDate.value = template.startDate
      endDate.value = template.endDate
      followsInflation.value = template.followsInflation ?? false
      isOneTime.value = template.isOneTime ?? false
    } else {
      cashFlowType.value = props.typeId as CashFlowType
    }
  }
})

function handleSave() {
  if (!name.value.trim() || monthlyAmount.value <= 0) {
    alert('Please fill in all required fields')
    return
  }

  // Validation: one-time transactions must have a start date
  if (isOneTime.value && !startDate.value) {
    alert('One-time transactions must have a date')
    return
  }

  if (isEditMode.value && props.id) {
    // Update existing cashflow
    const cashFlowData = {
      name: name.value.trim(),
      monthlyAmount: monthlyAmount.value,
      startDate: startDate.value,
      endDate: endDate.value,
      type: cashFlowType.value,
      followsInflation: followsInflation.value,
      isOneTime: isOneTime.value,
    }
    store.updateCashFlow(props.id, cashFlowData)
  } else {
    // Create new cashflow using template
    const itemTypeConfig = itemType.value
    if (itemTypeConfig && itemTypeConfig.template) {
      const template = itemTypeConfig.template as any
      store.addCashFlow({
        ...template,
        name: name.value.trim(),
        monthlyAmount: monthlyAmount.value,
        startDate: startDate.value,
        endDate: endDate.value,
        followsInflation: followsInflation.value,
        isOneTime: isOneTime.value,
      })
    }
  }

  router.push({ name: 'dashboard' })
}

function handleCancel() {
  router.push({ name: 'dashboard' })
}

function handleDelete() {
  if (isEditMode.value && props.id) {
    if (confirm(`Are you sure you want to delete "${name.value}"?`)) {
      store.removeCashFlow(props.id)
      router.push({ name: 'dashboard' })
    }
  }
}
</script>

<template>
  <div class="edit-cashflow-view">
    <header class="view-header">
      <button class="back-button" @click="handleCancel">&larr; Back</button>
      <h1>{{ pageTitle }}</h1>
    </header>

    <form class="edit-form" @submit.prevent="handleSave">
      <div class="form-group">
        <label for="cashflow-type">Type</label>
        <select id="cashflow-type" v-model="cashFlowType" :disabled="isEditMode">
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <p v-if="isEditMode" class="help-text">Cash flow type cannot be changed</p>
      </div>

      <div class="form-group">
        <label>Frequency</label>
        <div class="radio-group">
          <label class="radio-label">
            <input
              type="radio"
              :value="false"
              v-model="isOneTime"
              name="frequency"
            />
            <span>Recurring (monthly)</span>
          </label>
          <label class="radio-label">
            <input
              type="radio"
              :value="true"
              v-model="isOneTime"
              name="frequency"
            />
            <span>One-time</span>
          </label>
        </div>
      </div>

      <div class="form-group">
        <label for="name">Name *</label>
        <input
          id="name"
          v-model="name"
          type="text"
          placeholder="e.g., Salary, Rent, Groceries"
          required
        />
      </div>

      <div class="form-group">
        <label for="monthly-amount">{{ amountLabel }}</label>
        <input
          id="monthly-amount"
          v-model.number="monthlyAmount"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          required
        />
      </div>

      <div class="form-group checkbox-group">
        <label class="checkbox-label">
          <input
            id="follows-inflation"
            v-model="followsInflation"
            type="checkbox"
          />
          <span>Adjust for inflation</span>
        </label>
        <p class="help-text">If enabled, this amount will increase annually based on the inflation rate</p>
      </div>

      <div class="form-group">
        <MonthEdit v-model="startDate" :label="startDateLabel" :nullable="!isOneTime" />
        <p class="help-text">{{ startDateHelpText }}</p>
      </div>

      <div v-if="!isOneTime" class="form-group">
        <MonthEdit v-model="endDate" label="End Month (optional)" :nullable="true" />
        <p class="help-text">Leave empty to continue indefinitely</p>
      </div>

      <div class="form-actions">
        <button type="button" class="button button-secondary" @click="handleCancel">
          Cancel
        </button>
        <button
          v-if="isEditMode"
          type="button"
          class="button button-danger"
          @click="handleDelete"
        >
          Delete
        </button>
        <button type="submit" class="button button-primary">
          {{ isEditMode ? 'Save Changes' : 'Create Cash Flow' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.edit-cashflow-view {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
}

.view-header {
  margin-bottom: 2rem;
}

.back-button {
  background: none;
  border: none;
  color: #42b983;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0.5rem 0;
  margin-bottom: 0.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.back-button:hover {
  text-decoration: underline;
}

.view-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.edit-form {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 2rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group:last-of-type {
  margin-bottom: 2rem;
}

label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #374151;
  font-size: 0.9375rem;
}

input[type='text'],
input[type='number'],
input[type='date'],
select {
  width: 100%;
  padding: 0.625rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
  transition: all 0.2s ease;
}

input:focus,
select:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 3px rgba(66, 185, 131, 0.1);
}

select:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}

.help-text {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.radio-group {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 0;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: 400;
  color: #111827;
  margin-bottom: 0;
}

.radio-label input[type='radio'] {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
  margin: 0;
}

.radio-label span {
  user-select: none;
}

.checkbox-group {
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  font-weight: 500;
  color: #111827;
  margin-bottom: 0;
}

.checkbox-label input[type='checkbox'] {
  width: 1.125rem;
  height: 1.125rem;
  cursor: pointer;
  margin: 0;
}

.checkbox-label span {
  user-select: none;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.button {
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.button-primary {
  background: #42b983;
  color: white;
}

.button-primary:hover {
  background: #3aa876;
}

.button-secondary {
  background: #f3f4f6;
  color: #374151;
}

.button-secondary:hover {
  background: #e5e7eb;
}

.button-danger {
  background: #ef4444;
  color: white;
}

.button-danger:hover {
  background: #dc2626;
}

.button:active {
  transform: scale(0.98);
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .edit-cashflow-view {
    padding: 1rem;
  }

  .view-header h1 {
    font-size: 1.5rem;
  }

  .edit-form {
    padding: 1.5rem;
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .button {
    width: 100%;
    padding: 0.875rem;
    min-height: 44px; /* Touch target */
  }
}

@media (max-width: 480px) {
  .edit-cashflow-view {
    padding: 0.75rem;
  }

  .view-header h1 {
    font-size: 1.375rem;
  }

  .edit-form {
    padding: 1.25rem;
  }
}
</style>
