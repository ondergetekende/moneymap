<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { usePlannerStore } from '@/stores/planner'
import { getItemTypeById, getItemTypeButtonLabel } from '@/config/itemTypes'
import { CashFlow, type CashFlowType, type CashFlowFrequency } from '@/models'
import type { DateSpecification } from '@/types/month'
import DateSpecificationEdit from '@/components/DateSpecificationEdit.vue'
import { getTaxOptions, getTaxConfig } from '@/config/taxConfig'

const props = defineProps<{
  id?: string
  typeId?: string
}>()

const router = useRouter()
const store = usePlannerStore()

// Form state
const name = ref('')
const amount = ref<number>(0)
const startDate = ref<DateSpecification | undefined>(undefined)
const endDate = ref<DateSpecification | undefined>(undefined)
const cashFlowType = ref<CashFlowType>('income')
const followsInflation = ref<boolean>(false)
const isOneTime = ref<boolean>(false)
const incomeTaxId = ref<string | undefined>(undefined)
const frequency = ref<CashFlowFrequency>('monthly')
const isInitialLoad = ref<boolean>(true)

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
const amountLabel = computed(() => {
  if (isOneTime.value) {
    return 'Amount (€) *'
  }
  switch (frequency.value) {
    case 'weekly':
      return 'Weekly Amount (€) *'
    case 'annual':
      return 'Annual Amount (€) *'
    case 'monthly':
    default:
      return 'Monthly Amount (€) *'
  }
})
const startDateLabel = computed(() => (isOneTime.value ? 'Date *' : 'Start Month (optional)'))
const startDateHelpText = computed(() =>
  isOneTime.value ? 'When this transaction occurs' : 'Leave empty to start from current month',
)

// Tax-related computed properties
const taxCountry = computed(() => store.taxCountry)
const countryName = computed(() => {
  if (!taxCountry.value) return ''
  const config = getTaxConfig(taxCountry.value)
  return config?.countryName || ''
})
const incomeTaxOptions = computed(() => {
  if (!taxCountry.value) return []
  return getTaxOptions(taxCountry.value, 'income')
})

// Set default tax when country is selected and no tax is set
function setDefaultTaxIfNeeded() {
  if (taxCountry.value && cashFlowType.value === 'income' && !incomeTaxId.value) {
    incomeTaxId.value = 'default'
  }
}

// Load existing cashflow for editing
onMounted(() => {
  if (isEditMode.value && props.id) {
    const cashFlow = store.getCashFlowById(props.id)
    if (cashFlow) {
      name.value = cashFlow.name
      startDate.value = cashFlow.startDate
      endDate.value = cashFlow.endDate
      cashFlowType.value = cashFlow.type
      followsInflation.value = cashFlow.followsInflation
      isOneTime.value = cashFlow.isOneTime
      incomeTaxId.value = cashFlow.incomeTaxId
      amount.value = cashFlow.amount
      frequency.value = cashFlow.frequency
    } else {
      // CashFlow not found, redirect to dashboard
      router.push({ name: 'dashboard' })
    }
  } else if (props.typeId) {
    // New cashflow with pre-selected type - load template values
    const itemTypeConfig = getItemTypeById(props.typeId)
    if (itemTypeConfig && itemTypeConfig.template) {
      const template = itemTypeConfig.template as CashFlow
      name.value = template.name || ''
      amount.value = template.amount || 0
      cashFlowType.value = template.type || 'income'
      startDate.value = template.startDate
      endDate.value = template.endDate
      followsInflation.value = template.followsInflation ?? false
      isOneTime.value = template.isOneTime ?? false
      incomeTaxId.value = template.incomeTaxId
      frequency.value = template.frequency ?? 'monthly'
    } else {
      cashFlowType.value = props.typeId as CashFlowType
    }
  }

  // Set default tax for new items
  setDefaultTaxIfNeeded()

  // Mark initial load as complete after Vue finishes all reactive updates
  // This ensures the frequency watcher doesn't run during the initial load
  nextTick(() => {
    isInitialLoad.value = false
  })
})

// Watch for changes that should trigger default tax setting
watch([cashFlowType, taxCountry], () => {
  setDefaultTaxIfNeeded()
})

// Watch for frequency changes and convert the amount
watch(frequency, (newFrequency, oldFrequency) => {
  // Skip conversion during initial load
  if (isInitialLoad.value) {
    return
  }

  // Only convert if we have both old and new frequencies and an amount to convert
  if (!oldFrequency || newFrequency === oldFrequency || amount.value <= 0) {
    return
  }

  // Convert: old frequency -> annual -> new frequency
  let annualAmount: number

  // Step 1: Convert current amount to annual based on OLD frequency
  switch (oldFrequency) {
    case 'weekly':
      annualAmount = amount.value * 52
      break
    case 'monthly':
      annualAmount = amount.value * 12
      break
    case 'annual':
      annualAmount = amount.value
      break
  }

  // Step 2: Convert annual to NEW frequency
  switch (newFrequency) {
    case 'weekly':
      amount.value = Math.round((annualAmount / 52) * 100) / 100
      break
    case 'monthly':
      amount.value = Math.round((annualAmount / 12) * 100) / 100
      break
    case 'annual':
      amount.value = Math.round(annualAmount * 100) / 100
      break
  }
})

function handleSave() {
  if (!name.value.trim() || amount.value <= 0) {
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
      amount: amount.value,
      startDate: startDate.value,
      endDate: endDate.value,
      type: cashFlowType.value,
      followsInflation: followsInflation.value,
      isOneTime: isOneTime.value,
      incomeTaxId: incomeTaxId.value,
      frequency: frequency.value,
    }
    store.updateCashFlow(props.id, cashFlowData)
  } else {
    // Create new cashflow using template
    const itemTypeConfig = itemType.value
    if (itemTypeConfig && itemTypeConfig.template) {
      const template = itemTypeConfig.template as CashFlow
      store.addCashFlow({
        name: name.value.trim(),
        amount: amount.value,
        type: template.type,
        startDate: startDate.value,
        endDate: endDate.value,
        followsInflation: followsInflation.value,
        isOneTime: isOneTime.value,
        incomeTaxId: incomeTaxId.value,
        frequency: frequency.value,
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

      <div v-if="cashFlowType === 'income' && taxCountry" class="form-group">
        <label for="income-tax">Income Tax</label>
        <select id="income-tax" v-model="incomeTaxId">
          <option value="default">Default for {{ countryName }}</option>
          <option value="after-tax">After Tax (Net Income)</option>
          <option disabled>─────────</option>
          <option v-for="tax in incomeTaxOptions" :key="tax.id" :value="tax.id">
            {{ tax.name }}
          </option>
        </select>
        <p class="help-text">Select "After Tax" if amount is already net of taxes</p>
      </div>

      <div class="form-group">
        <label>Frequency</label>
        <div class="radio-group">
          <label class="radio-label">
            <input type="radio" :value="false" v-model="isOneTime" name="frequency" />
            <span>Recurring</span>
          </label>
          <label class="radio-label">
            <input type="radio" :value="true" v-model="isOneTime" name="frequency" />
            <span>One-time</span>
          </label>
        </div>
      </div>

      <div v-if="!isOneTime" class="form-group">
        <label>Amount Entry</label>
        <div class="radio-group">
          <label class="radio-label">
            <input type="radio" value="weekly" v-model="frequency" name="amount-frequency" />
            <span>Per Week</span>
          </label>
          <label class="radio-label">
            <input type="radio" value="monthly" v-model="frequency" name="amount-frequency" />
            <span>Per Month</span>
          </label>
          <label class="radio-label">
            <input type="radio" value="annual" v-model="frequency" name="amount-frequency" />
            <span>Per Year</span>
          </label>
        </div>
        <p class="help-text">Choose how often you want to enter the amount</p>
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
        <label for="amount">{{ amountLabel }}</label>
        <input
          id="amount"
          v-model.number="amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          required
        />
      </div>

      <div class="form-group checkbox-group">
        <label class="checkbox-label">
          <input id="follows-inflation" v-model="followsInflation" type="checkbox" />
          <span>Adjust for inflation</span>
        </label>
        <p class="help-text">
          If enabled, this amount will increase annually based on the inflation rate
        </p>
      </div>

      <div class="form-group">
        <DateSpecificationEdit
          v-model="startDate"
          :label="startDateLabel"
          :nullable="!isOneTime"
          :allow-age-entry="true"
          :show-mode-selector="true"
        />
        <p class="help-text">{{ startDateHelpText }}</p>
      </div>

      <div v-if="!isOneTime" class="form-group">
        <DateSpecificationEdit
          v-model="endDate"
          label="End Month (optional)"
          :nullable="true"
          :allow-age-entry="true"
          :show-mode-selector="true"
        />
        <p class="help-text">Leave empty to continue indefinitely</p>
      </div>

      <div class="form-actions">
        <button type="button" class="button button-secondary" @click="handleCancel">Cancel</button>
        <button v-if="isEditMode" type="button" class="button button-danger" @click="handleDelete">
          Delete
        </button>
        <button type="submit" class="button button-primary">
          {{ isEditMode ? 'Save Changes' : 'Create Cash Flow' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped lang="scss">
// Component-specific styles only - shared styles come from _buttons.scss, _forms.scss, _layout.scss

.view-header {
  display: flex;
  align-items: center;
  gap: $spacing-lg;
  margin-bottom: $spacing-3xl;
  background: transparent;
  padding: 0;
  box-shadow: none;
}

// Custom radio group layout (horizontal layout different from shared vertical radio-group)
.radio-group {
  display: flex;
  gap: $spacing-lg;
  padding: $spacing-sm 0;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  cursor: pointer;
  font-weight: $font-normal;
  color: $text-primary;
  margin-bottom: 0;

  input[type='radio'] {
    width: 1rem;
    height: 1rem;
    cursor: pointer;
    margin: 0;
  }

  span {
    user-select: none;
  }
}

// Custom checkbox group styling (different from shared checkbox-group)
.checkbox-group {
  padding: $spacing-base;
  background: $bg-alt-3;
  border-radius: $radius-md;
  border: 1px solid $border-light;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: $spacing-base;
  cursor: pointer;
  font-weight: $font-medium;
  color: $text-primary;
  margin-bottom: 0;

  input[type='checkbox'] {
    width: 1.125rem;
    height: 1.125rem;
    cursor: pointer;
    margin: 0;
  }

  span {
    user-select: none;
  }
}

.edit-cashflow-view {
  @include mobile {
    padding: $spacing-lg;
  }

  @include mobile-small {
    padding: $spacing-base;
  }
}
</style>
