<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlannerStore } from '@/stores/planner'
import { getItemTypeById } from '@/config/itemTypes'
import { LinearDebt, AnnualizedDebt, InterestOnlyDebt } from '@/models'
import type { Month } from '@/types/month'
import { getCurrentMonth, addMonths, monthDiff } from '@/types/month'
import MonthEdit from '@/components/MonthEdit.vue'

const props = defineProps<{
  id?: string
  typeId?: string
}>()

const router = useRouter()
const store = usePlannerStore()

// Form state
const name = ref('')
const amount = ref<number>(0)
const annualInterestRate = ref<number>(0)
const startDate = ref<Month | undefined>(undefined)

// Form state - single repayment type selection
const repaymentType = ref<'annuity' | 'linear' | 'balloon' | 'perpetual'>('annuity')
const hasDelayedStart = ref<boolean>(false)

// Optional fields - user can leave empty to calculate
const repaymentStartDate = ref<Month | undefined>(undefined)
const endDate = ref<Month | undefined>(undefined)
const monthlyPayment = ref<number | undefined>(undefined)
const monthlyPrincipal = ref<number | undefined>(undefined)

// Show/hide fields based on repayment type
const showRepaymentStartDate = computed(() => hasDelayedStart.value)
const showDelayedStart = computed(() => repaymentType.value !== 'perpetual')
const showEndDate = computed(() => repaymentType.value !== 'perpetual')
const showMonthlyPayment = computed(() => repaymentType.value === 'annuity')
const showMonthlyPrincipal = computed(() => repaymentType.value === 'linear')

// UI state
const isEditMode = computed(() => !!props.id)
const pageTitle = computed(() => {
  const typeName = 'Debt'
  if (isEditMode.value) {
    return `Edit ${typeName}`
  }
  return `New ${typeName}`
})

// Helper functions
function getStartMonth(): Month {
  return startDate.value ?? getCurrentMonth()
}

function calculateMonthsUntil(month: Month): number {
  return monthDiff(month, getStartMonth())
}

function addMonthsToMonth(month: Month, monthsToAdd: number): Month {
  return addMonths(month, monthsToAdd)
}

// Calculated fields (read-only display)
const calculatedMonthlyPayment = computed(() => {
  if (repaymentType.value !== 'annuity') return null
  if (monthlyPayment.value !== undefined && monthlyPayment.value > 0) return null
  if (endDate.value === undefined || amount.value <= 0) return null

  const months = calculateMonthsUntil(endDate.value)
  if (months <= 0) return null

  const monthlyRate = annualInterestRate.value / 100 / 12
  if (monthlyRate === 0) return amount.value / months

  // Annuity formula: P = (r * PV) / (1 - (1 + r)^-n)
  return (monthlyRate * amount.value) / (1 - Math.pow(1 + monthlyRate, -months))
})

const calculatedPrincipalPayment = computed(() => {
  if (repaymentType.value !== 'linear') return null
  if (monthlyPrincipal.value !== undefined && monthlyPrincipal.value > 0) return null
  if (endDate.value === undefined || amount.value <= 0) return null

  const months = calculateMonthsUntil(endDate.value)
  if (months <= 0) return null

  return amount.value / months
})

const calculatedEndDate = computed((): Month | null => {
  if (endDate.value !== undefined) return null
  if (repaymentType.value === 'balloon' || repaymentType.value === 'perpetual') return null
  if (amount.value <= 0) return null

  const monthlyRate = annualInterestRate.value / 100 / 12

  if (repaymentType.value === 'annuity' && monthlyPayment.value && monthlyPayment.value > 0) {
    const minPayment = amount.value * monthlyRate
    if (monthlyPayment.value <= minPayment) return null

    if (monthlyRate === 0) {
      const months = Math.ceil(amount.value / monthlyPayment.value)
      return addMonthsToMonth(getStartMonth(), months)
    }

    const months = Math.ceil(
      -Math.log(1 - (monthlyRate * amount.value) / monthlyPayment.value) /
        Math.log(1 + monthlyRate),
    )
    return addMonthsToMonth(getStartMonth(), months)
  } else if (
    repaymentType.value === 'linear' &&
    monthlyPrincipal.value &&
    monthlyPrincipal.value > 0
  ) {
    const months = Math.ceil(amount.value / monthlyPrincipal.value)
    return addMonthsToMonth(getStartMonth(), months)
  }

  return null
})

// Validation warnings
const warnings = computed(() => {
  const warns: string[] = []

  if (repaymentType.value === 'annuity' && monthlyPayment.value) {
    const minPayment = (amount.value * annualInterestRate.value) / 100 / 12
    if (monthlyPayment.value <= minPayment) {
      warns.push(
        `Monthly payment (€${monthlyPayment.value.toFixed(2)}) must be greater than minimum interest (€${minPayment.toFixed(2)})`,
      )
    }
  }

  if (endDate.value !== undefined) {
    const months = calculateMonthsUntil(endDate.value)
    if (months <= 0) {
      warns.push('End month must be in the future')
    }
  }

  return warns
})

// Load existing debt for editing
onMounted(() => {
  if (isEditMode.value && props.id) {
    const debt = store.getDebtById(props.id)
    if (debt) {
      name.value = debt.name
      amount.value = debt.amount
      annualInterestRate.value = debt.annualInterestRate
      startDate.value = debt.startDate

      // Determine repayment type from existing debt
      const type = debt.getDebtType()
      if (type === 'annualized') {
        repaymentType.value = 'annuity'
        monthlyPayment.value = debt.monthlyPayment ?? undefined
      } else if (type === 'linear') {
        repaymentType.value = 'linear'
        monthlyPrincipal.value = debt.monthlyPrincipalPayment ?? undefined
      } else if (type === 'interest-only') {
        // Check if there's an end date (balloon) or not (perpetual)
        repaymentType.value = debt.endDate !== undefined ? 'balloon' : 'perpetual'
      }

      endDate.value = debt.endDate
      hasDelayedStart.value =
        !!debt.repaymentStartDate && debt.repaymentStartDate !== debt.startDate

      if (hasDelayedStart.value) {
        repaymentStartDate.value = debt.repaymentStartDate
      }
    } else {
      router.push({ name: 'dashboard' })
    }
  } else if (props.typeId) {
    // New debt with pre-selected type - load template values
    const itemTypeConfig = getItemTypeById(props.typeId)
    if (itemTypeConfig && itemTypeConfig.template) {
      const template = itemTypeConfig.template as InstanceType<typeof AnnualizedDebt>
      name.value = template.name || ''
      amount.value = template.amount || 0
      annualInterestRate.value = template.annualInterestRate || 0
      startDate.value = template.startDate

      // Set repayment type based on template
      const type = template.getDebtType()
      if (type === 'annualized') {
        repaymentType.value = 'annuity'
        monthlyPayment.value = template.monthlyPayment || undefined
      } else if (type === 'linear') {
        repaymentType.value = 'linear'
      } else if (type === 'interest-only') {
        repaymentType.value = template.endDate ? 'balloon' : 'perpetual'
      }

      endDate.value = template.endDate
    }
  }
})

function handleSave() {
  if (!name.value.trim() || amount.value <= 0 || annualInterestRate.value < 0) {
    alert('Please fill in all required fields')
    return
  }

  // Validate conditional required fields
  if (hasDelayedStart.value && !repaymentStartDate.value) {
    alert('Please specify when repayments will start')
    return
  }

  let debt
  const baseData = {
    id: props.id,
    name: name.value.trim(),
    amount: amount.value,
    annualInterestRate: annualInterestRate.value,
    startDate: startDate.value || undefined,
    repaymentStartDate: hasDelayedStart.value ? repaymentStartDate.value || undefined : undefined,
    endDate: endDate.value || calculatedEndDate.value || undefined,
  }

  // Determine which debt type to create based on repayment type
  if (repaymentType.value === 'balloon' || repaymentType.value === 'perpetual') {
    // Interest-only debt (balloon payment or perpetual)
    debt = new InterestOnlyDebt({
      ...baseData,
      finalBalance: 0, // Always pay off remaining at end
    })
  } else if (repaymentType.value === 'annuity') {
    // Constant total payment (annuity)
    const payment =
      monthlyPayment.value && monthlyPayment.value > 0
        ? monthlyPayment.value
        : calculatedMonthlyPayment.value ||
          (() => {
            // Default annuity with reasonable payment (30 years)
            const monthlyRate = annualInterestRate.value / 100 / 12
            const months = 360
            return (monthlyRate * amount.value) / (1 - Math.pow(1 + monthlyRate, -months))
          })()

    debt = new AnnualizedDebt({
      ...baseData,
      monthlyPayment: payment,
    })
  } else {
    // Constant principal payment (linear)
    const principal =
      monthlyPrincipal.value && monthlyPrincipal.value > 0
        ? monthlyPrincipal.value
        : calculatedPrincipalPayment.value || amount.value / 360 // Default 30 years

    debt = new LinearDebt({
      ...baseData,
      monthlyPrincipalPayment: principal,
    })
  }

  if (isEditMode.value && props.id) {
    store.updateDebt(props.id, debt)
  } else {
    store.addDebt(debt)
  }

  store.saveToStorage()
  router.push({ name: 'dashboard' })
}

function handleCancel() {
  router.push({ name: 'dashboard' })
}

function handleDelete() {
  if (isEditMode.value && props.id) {
    if (confirm(`Are you sure you want to delete "${name.value}"?`)) {
      store.removeDebt(props.id)
      store.saveToStorage()
      router.push({ name: 'dashboard' })
    }
  }
}
</script>

<template>
  <div class="edit-debt-view">
    <header class="view-header">
      <button class="back-button" @click="handleCancel">&larr; Back</button>
      <h1>{{ pageTitle }}</h1>
    </header>

    <form class="edit-form" @submit.prevent="handleSave">
      <!-- Basic fields -->
      <div class="form-group">
        <label for="name">Name *</label>
        <input
          id="name"
          v-model="name"
          type="text"
          placeholder="e.g., Mortgage, Car Loan, Student Loan"
          required
        />
      </div>

      <div class="form-group">
        <label for="amount">Principal Amount (€) *</label>
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

      <div class="form-group">
        <label for="interest-rate">Annual Interest Rate (%) *</label>
        <input
          id="interest-rate"
          v-model.number="annualInterestRate"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          required
        />
      </div>

      <div class="form-group">
        <MonthEdit v-model="startDate" label="Start Month" :nullable="false" />
        <p class="help-text">When the debt begins (defaults to current month)</p>
      </div>

      <!-- Repayment Type -->
      <div class="form-group">
        <label>Repayment Type</label>
        <div class="radio-group">
          <label class="radio-label">
            <input type="radio" v-model="repaymentType" value="annuity" />
            Constant payment (annuity)
          </label>
          <label class="radio-label">
            <input type="radio" v-model="repaymentType" value="linear" />
            Constant principal (linear)
          </label>
          <label class="radio-label">
            <input type="radio" v-model="repaymentType" value="balloon" />
            Balloon payment
          </label>
          <label class="radio-label">
            <input type="radio" v-model="repaymentType" value="perpetual" />
            Perpetual (interest only)
          </label>
        </div>
      </div>

      <!-- Delayed start checkbox -->
      <div v-if="showDelayedStart" class="form-group checkbox-group">
        <label>
          <input type="checkbox" v-model="hasDelayedStart" />
          Repayment will start at a future date
        </label>
      </div>

      <div v-if="showRepaymentStartDate" class="form-group">
        <MonthEdit
          v-model="repaymentStartDate"
          label="Repayment Start Month"
          :required="true"
          :nullable="false"
        />
      </div>

      <!-- Optional end date -->
      <div v-if="showEndDate" class="form-group">
        <MonthEdit v-model="endDate" label="Payoff Date (optional)" :nullable="true" />
        <p class="help-text">Leave empty to calculate from payment amount</p>
      </div>

      <!-- Monthly payment for annuity -->
      <div v-if="showMonthlyPayment" class="form-group">
        <label for="monthly-payment">Monthly Payment (€, optional)</label>
        <input
          id="monthly-payment"
          v-model.number="monthlyPayment"
          type="number"
          min="0"
          step="0.01"
          placeholder="Leave empty to calculate"
        />
        <p class="help-text">Total payment (principal + interest) each month</p>
      </div>

      <!-- Monthly principal for linear -->
      <div v-if="showMonthlyPrincipal" class="form-group">
        <label for="monthly-principal">Monthly Principal Payment (€, optional)</label>
        <input
          id="monthly-principal"
          v-model.number="monthlyPrincipal"
          type="number"
          min="0"
          step="0.01"
          placeholder="Leave empty to calculate"
        />
        <p class="help-text">Principal paid each month (interest will be added on top)</p>
      </div>

      <!-- Calculated values display -->
      <div
        v-if="calculatedMonthlyPayment || calculatedPrincipalPayment || calculatedEndDate"
        class="calculated-values"
      >
        <h3>Calculated Values</h3>
        <div v-if="calculatedMonthlyPayment" class="calculated-field">
          <span class="label">Required Monthly Payment:</span>
          <span class="value">€{{ calculatedMonthlyPayment.toFixed(2) }}</span>
          <p class="help-text">Total payment (principal + interest) each month</p>
        </div>
        <div v-if="calculatedPrincipalPayment" class="calculated-field">
          <span class="label">Required Monthly Principal:</span>
          <span class="value">€{{ calculatedPrincipalPayment.toFixed(2) }}</span>
          <p class="help-text">Principal paid each month (total payment will vary with interest)</p>
        </div>
        <div v-if="calculatedEndDate" class="calculated-field">
          <span class="label">Estimated Payoff Date:</span>
          <span class="value">{{ calculatedEndDate }}</span>
        </div>
      </div>

      <!-- Validation warnings -->
      <div v-if="warnings.length > 0" class="warnings">
        <p v-for="(warning, index) in warnings" :key="index" class="warning-text">
          ⚠️ {{ warning }}
        </p>
      </div>

      <div class="form-actions">
        <button type="button" class="button button-secondary" @click="handleCancel">Cancel</button>
        <button v-if="isEditMode" type="button" class="button button-danger" @click="handleDelete">
          Delete
        </button>
        <button type="submit" class="button button-primary">
          {{ isEditMode ? 'Save Changes' : 'Create Debt' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.edit-debt-view {
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

/* Reduce spacing when form-group follows checkbox-group */
.checkbox-group + .form-group {
  margin-top: 0.25rem;
}

.form-section {
  margin: 2rem 0;
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 6px;
}

.form-section h3 {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
}

.checkbox-group {
  margin-bottom: 0.5rem;
}

.checkbox-group label {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-weight: 500;
  cursor: pointer;
}

.checkbox-group input[type='checkbox'] {
  margin-top: 0.25rem;
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.radio-label:hover {
  border-color: #42b983;
  background: #f9fafb;
}

.radio-label input[type='radio'] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.radio-label:has(input[type='radio']:checked) {
  border-color: #42b983;
  background: #ecfdf5;
}

.calculated-values {
  background: #ecfdf5;
  border: 1px solid #10b981;
  border-radius: 6px;
  padding: 1.5rem;
  margin: 1.5rem 0;
}

.calculated-values h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #065f46;
}

.calculated-field {
  padding: 0.75rem 0;
  border-bottom: 1px solid #d1fae5;
}

.calculated-field:last-child {
  border-bottom: none;
}

.calculated-field .label {
  font-weight: 500;
  color: #065f46;
  display: block;
  margin-bottom: 0.25rem;
}

.calculated-field .value {
  font-weight: 700;
  font-size: 1.25rem;
  color: #047857;
  display: block;
  margin-bottom: 0.25rem;
}

.calculated-field .help-text {
  margin: 0.25rem 0 0 0;
  font-size: 0.8125rem;
  color: #059669;
  font-weight: normal;
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

.warnings {
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.warning-text {
  margin: 0;
  font-size: 0.875rem;
  color: #92400e;
}

.warning-text + .warning-text {
  margin-top: 0.5rem;
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
  .edit-debt-view {
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
  .edit-debt-view {
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
