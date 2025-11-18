<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlannerStore } from '@/stores/planner'
import { getItemTypeById, getItemTypeButtonLabel } from '@/config/itemTypes'
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

// Scenario selection - what does the user know?
const willPayOff = ref<boolean>(true) // Will fully repay the debt?
const hasDelayedStart = ref<boolean>(false) // Will repayment start later?
const knowsEndDate = ref<boolean>(false) // Do they know when it ends?
const knowsPaymentAmount = ref<boolean>(false) // Do they know the payment amount?
const constantPayment = ref<boolean>(true) // Constant total payment vs constant principal

// Conditional fields based on scenario
const repaymentStartDate = ref<Month | undefined>(undefined)
const endDate = ref<Month | undefined>(undefined)
const monthlyPayment = ref<number>(0)
const monthlyPrincipal = ref<number>(0)

// Calculated/derived debt type based on scenario
const debtType = computed<'linear' | 'annualized' | 'interest-only'>(() => {
  if (!willPayOff.value) return 'interest-only'
  if (constantPayment.value) return 'annualized' // Fixed total payment
  return 'linear' // Fixed principal payment (variable total)
})

// Show/hide fields based on scenario choices
const showRepaymentStartDate = computed(() => hasDelayedStart.value)
const showEndDate = computed(() => willPayOff.value && knowsEndDate.value)
const showPaymentAmount = computed(() => {
  if (!willPayOff.value) return false
  if (!knowsPaymentAmount.value) return false
  return true
})
const showPrincipalAmount = computed(() => {
  if (!willPayOff.value) return false
  if (constantPayment.value) return false // Only for linear (non-constant payment)
  if (!knowsPaymentAmount.value) return false
  return true
})

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
  if (!willPayOff.value || knowsPaymentAmount.value) return null
  if (!constantPayment.value) return null // Only for annualized/constant payment

  if (knowsEndDate.value && endDate.value !== undefined && amount.value > 0) {
    // Calculate payment needed to pay off by end date (constant payment)
    const months = calculateMonthsUntil(endDate.value)
    if (months <= 0) return null

    const monthlyRate = annualInterestRate.value / 100 / 12
    if (monthlyRate === 0) return amount.value / months

    // Annuity formula: P = (r * PV) / (1 - (1 + r)^-n)
    const payment = (monthlyRate * amount.value) / (1 - Math.pow(1 + monthlyRate, -months))
    return payment
  }

  return null
})

const calculatedPrincipalPayment = computed(() => {
  if (!willPayOff.value || knowsPaymentAmount.value) return null
  if (constantPayment.value) return null // Only for linear/variable payment

  if (knowsEndDate.value && endDate.value !== undefined && amount.value > 0) {
    // Calculate principal payment for linear repayment
    const months = calculateMonthsUntil(endDate.value)
    if (months <= 0) return null

    // Simple: principal / months
    return amount.value / months
  }

  return null
})

const calculatedEndDate = computed((): Month | null => {
  if (!willPayOff.value || knowsEndDate.value) return null

  if (knowsPaymentAmount.value && amount.value > 0) {
    const monthlyRate = annualInterestRate.value / 100 / 12

    if (constantPayment.value && monthlyPayment.value > 0) {
      // Calculate payoff date for constant total payment (annualized)
      const minPayment = amount.value * monthlyRate

      if (monthlyPayment.value <= minPayment) return null // Never pays off

      if (monthlyRate === 0) {
        const months = Math.ceil(amount.value / monthlyPayment.value)
        return addMonthsToMonth(getStartMonth(), months)
      }

      // Calculate months: n = -log(1 - (r * PV / PMT)) / log(1 + r)
      const months = Math.ceil(-Math.log(1 - (monthlyRate * amount.value / monthlyPayment.value)) / Math.log(1 + monthlyRate))
      return addMonthsToMonth(getStartMonth(), months)
    } else if (!constantPayment.value && monthlyPrincipal.value > 0) {
      // Calculate payoff date for constant principal payment (linear)
      const months = Math.ceil(amount.value / monthlyPrincipal.value)
      return addMonthsToMonth(getStartMonth(), months)
    }
  }

  return null
})

// Validation warnings
const warnings = computed(() => {
  const warns: string[] = []

  if (willPayOff.value && knowsPaymentAmount.value) {
    const minPayment = (amount.value * annualInterestRate.value / 100 / 12)
    if (monthlyPayment.value <= minPayment) {
      warns.push(`Monthly payment (€${monthlyPayment.value.toFixed(2)}) must be greater than minimum interest (€${minPayment.toFixed(2)})`)
    }
  }

  if (knowsEndDate.value && endDate.value !== undefined) {
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

      // Determine scenario from existing debt
      const type = debt.getDebtType()
      willPayOff.value = type !== 'interest-only'
      hasDelayedStart.value = !!debt.repaymentStartDate && debt.repaymentStartDate !== debt.startDate

      if (hasDelayedStart.value) {
        repaymentStartDate.value = debt.repaymentStartDate
      }

      if (type === 'annualized') {
        constantPayment.value = true
        knowsPaymentAmount.value = true
        monthlyPayment.value = debt.monthlyPayment ?? 0
        if (debt.endDate !== undefined) {
          knowsEndDate.value = true
          endDate.value = debt.endDate
        }
      } else if (type === 'linear') {
        constantPayment.value = false
        knowsPaymentAmount.value = true
        monthlyPrincipal.value = debt.monthlyPrincipalPayment ?? 0
        if (debt.endDate !== undefined) {
          knowsEndDate.value = true
          endDate.value = debt.endDate
        }
      } else if (type === 'interest-only') {
        willPayOff.value = false
        if (debt.endDate !== undefined) {
          knowsEndDate.value = true
          endDate.value = debt.endDate
        }
      }
    } else {
      router.push({ name: 'dashboard' })
    }
  } else if (props.typeId) {
    // New debt with pre-selected type - load template values
    const itemTypeConfig = getItemTypeById(props.typeId)
    if (itemTypeConfig && itemTypeConfig.template) {
      const template = itemTypeConfig.template as any
      name.value = template.name || ''
      amount.value = template.amount || 0
      annualInterestRate.value = template.annualInterestRate || 0
      startDate.value = template.startDate

      // Set default scenario based on template
      const type = template.getDebtType()
      willPayOff.value = type !== 'interest-only'

      if (type === 'annualized') {
        knowsPaymentAmount.value = true
        monthlyPayment.value = template.monthlyPayment
      }

      if (template.endDate) {
        endDate.value = template.endDate
        knowsEndDate.value = true
      }
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

  if (knowsEndDate.value && !endDate.value) {
    if (willPayOff.value) {
      alert('Please specify the payoff date')
    } else {
      alert('Please specify the settlement date')
    }
    return
  }

  if (willPayOff.value && knowsPaymentAmount.value) {
    if (constantPayment.value && monthlyPayment.value <= 0) {
      alert('Please specify the monthly payment amount')
      return
    }
    if (!constantPayment.value && monthlyPrincipal.value <= 0) {
      alert('Please specify the monthly principal amount')
      return
    }
  }

  let debt
  const baseData = {
    id: props.id,
    name: name.value.trim(),
    amount: amount.value,
    annualInterestRate: annualInterestRate.value,
    startDate: startDate.value || undefined,
    repaymentStartDate: hasDelayedStart.value ? repaymentStartDate.value || undefined : undefined,
    endDate: knowsEndDate.value ? endDate.value || undefined : (calculatedEndDate.value || undefined),
  }

  // Determine which debt type to create based on scenario
  if (!willPayOff.value) {
    // Interest-only debt
    debt = new InterestOnlyDebt({
      ...baseData,
      finalBalance: 0, // Always pay off remaining at end
    })
  } else if (constantPayment.value) {
    // Constant total payment (annualized)
    if (knowsPaymentAmount.value && monthlyPayment.value > 0) {
      debt = new AnnualizedDebt({
        ...baseData,
        monthlyPayment: monthlyPayment.value,
      })
    } else if (knowsEndDate.value && calculatedMonthlyPayment.value) {
      debt = new AnnualizedDebt({
        ...baseData,
        monthlyPayment: calculatedMonthlyPayment.value,
      })
    } else {
      // Default annualized with reasonable payment
      const monthlyRate = annualInterestRate.value / 100 / 12
      const months = 360 // 30 years default
      const defaultPayment = (monthlyRate * amount.value) / (1 - Math.pow(1 + monthlyRate, -months))
      debt = new AnnualizedDebt({
        ...baseData,
        monthlyPayment: defaultPayment,
      })
    }
  } else {
    // Constant principal payment (linear)
    if (knowsPaymentAmount.value && monthlyPrincipal.value > 0) {
      debt = new LinearDebt({
        ...baseData,
        monthlyPrincipalPayment: monthlyPrincipal.value,
      })
    } else if (knowsEndDate.value && calculatedPrincipalPayment.value) {
      debt = new LinearDebt({
        ...baseData,
        monthlyPrincipalPayment: calculatedPrincipalPayment.value,
      })
    } else {
      // Default to linear with reasonable principal
      const defaultPrincipal = amount.value / 360 // 30 years default
      debt = new LinearDebt({
        ...baseData,
        monthlyPrincipalPayment: defaultPrincipal,
      })
    }
  }

  if (isEditMode.value && props.id) {
    store.updateDebt(props.id, debt as any)
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

      <!-- Scenario selection -->
      <div class="form-section">
        <h3>Repayment Plan</h3>

        <div class="form-group checkbox-group">
          <label>
            <input type="checkbox" v-model="willPayOff" />
            I will pay this debt off gradually
          </label>
          <p class="help-text">Uncheck if you'll only pay interest and settle the principal at the end (balloon payment)</p>
        </div>

        <div v-if="!willPayOff" class="form-group checkbox-group">
          <label>
            <input type="checkbox" v-model="knowsEndDate" />
            I know when I will settle this debt
          </label>
          <p class="help-text">When you'll pay off the remaining balance in full</p>
        </div>

        <div v-if="!willPayOff && knowsEndDate" class="form-group">
          <MonthEdit v-model="endDate" label="Settlement Month *" :required="true" :nullable="false" />
          <p class="help-text">Month of final balloon payment</p>
        </div>

        <div v-if="willPayOff" class="form-group checkbox-group">
          <label>
            <input type="checkbox" v-model="hasDelayedStart" />
            Repayment will start at a future date
          </label>
        </div>

        <div v-if="showRepaymentStartDate" class="form-group">
          <MonthEdit v-model="repaymentStartDate" label="Repayment Start Month *" :required="true" :nullable="false" />
        </div>

        <div v-if="willPayOff" class="form-group checkbox-group">
          <label>
            <input type="checkbox" v-model="knowsEndDate" />
            I know when this debt will be paid off
          </label>
        </div>

        <div v-if="showEndDate" class="form-group">
          <MonthEdit v-model="endDate" label="Payoff Month *" :required="true" :nullable="false" />
        </div>

        <div v-if="willPayOff" class="form-group checkbox-group">
          <label>
            <input type="checkbox" v-model="constantPayment" />
            My payment amount will stay constant (recommended for mortgages)
          </label>
          <p class="help-text">
            <template v-if="constantPayment">
              Total payment stays the same each month, principal portion increases over time
            </template>
            <template v-else>
              Principal payment stays constant, total payment decreases as interest drops
            </template>
          </p>
        </div>

        <div v-if="willPayOff" class="form-group checkbox-group">
          <label>
            <input type="checkbox" v-model="knowsPaymentAmount" />
            I know my {{ constantPayment ? 'monthly payment' : 'monthly principal' }} amount
          </label>
        </div>

        <div v-if="showPaymentAmount && constantPayment" class="form-group">
          <label for="monthly-payment">Monthly Payment (€) *</label>
          <input
            id="monthly-payment"
            v-model.number="monthlyPayment"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            required
          />
          <p class="help-text">Total payment (principal + interest) each month</p>
        </div>

        <div v-if="showPrincipalAmount && !constantPayment" class="form-group">
          <label for="monthly-principal">Monthly Principal Payment (€) *</label>
          <input
            id="monthly-principal"
            v-model.number="monthlyPrincipal"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            required
          />
          <p class="help-text">Principal paid each month (interest will be added on top)</p>
        </div>
      </div>

      <!-- Calculated values display -->
      <div v-if="calculatedMonthlyPayment || calculatedPrincipalPayment || calculatedEndDate" class="calculated-values">
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
