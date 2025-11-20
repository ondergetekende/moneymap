<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlannerStore } from '@/stores/planner'
import { getItemTypeById } from '@/config/itemTypes'
import { LinearDebt, AnnualizedDebt, InterestOnlyDebt } from '@/models'
import type { Month, DateSpecification } from '@/types/month'
import { getCurrentMonth, addMonths, monthDiff, resolveDate, formatMonth } from '@/types/month'
import DateSpecificationEdit from '@/components/DateSpecificationEdit.vue'

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
const startDate = ref<DateSpecification | undefined>(undefined)

// Form state - single repayment type selection
const repaymentType = ref<'annuity' | 'linear' | 'balloon' | 'perpetual'>('annuity')
const hasDelayedStart = ref<boolean>(false)

// Input mode selection - what the user wants to specify
const paymentInputMode = ref<'payment' | 'endDate'>('endDate')
const principalInputMode = ref<'principal' | 'endDate'>('endDate')

// Optional fields - user can leave empty to calculate
const repaymentStartDate = ref<DateSpecification | undefined>(undefined)
const endDate = ref<DateSpecification | undefined>(undefined)
const monthlyPayment = ref<number | undefined>(undefined)
const monthlyPrincipal = ref<number | undefined>(undefined)

// Show/hide fields based on repayment type
const showRepaymentStartDate = computed(() => hasDelayedStart.value)
const showDelayedStart = computed(() => repaymentType.value !== 'perpetual')
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
  if (startDate.value) {
    const resolved = resolveDate(startDate.value, store.birthDate)
    if (resolved !== undefined) return resolved
  }
  return getCurrentMonth()
}

function calculateMonthsUntil(dateSpec: DateSpecification): number {
  const month = resolveDate(dateSpec, store.birthDate)
  if (month === undefined) return 0
  return monthDiff(month, getStartMonth())
}

function addMonthsToMonth(month: Month, monthsToAdd: number): Month {
  return addMonths(month, monthsToAdd)
}

// Calculated fields (read-only display)
const calculatedMonthlyPayment = computed(() => {
  if (repaymentType.value !== 'annuity') return null
  if (paymentInputMode.value !== 'endDate') return null
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
  if (principalInputMode.value !== 'endDate') return null
  if (endDate.value === undefined || amount.value <= 0) return null

  const months = calculateMonthsUntil(endDate.value)
  if (months <= 0) return null

  return amount.value / months
})

const calculatedEndDate = computed((): Month | null => {
  if (amount.value <= 0) return null

  const monthlyRate = annualInterestRate.value / 100 / 12

  if (
    repaymentType.value === 'annuity' &&
    paymentInputMode.value === 'payment' &&
    monthlyPayment.value &&
    monthlyPayment.value > 0
  ) {
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
    principalInputMode.value === 'principal' &&
    monthlyPrincipal.value &&
    monthlyPrincipal.value > 0
  ) {
    const months = Math.ceil(amount.value / monthlyPrincipal.value)
    return addMonthsToMonth(getStartMonth(), months)
  }

  return null
})

// Monthly payment displays for each debt type
const monthlyPaymentDisplay = computed(() => {
  if (amount.value <= 0) return null

  const monthlyRate = annualInterestRate.value / 100 / 12
  const monthlyInterest = amount.value * monthlyRate

  if (repaymentType.value === 'annuity') {
    // Fixed payment debt
    const payment = monthlyPayment.value || calculatedMonthlyPayment.value
    if (!payment) return null
    return {
      type: 'fixed' as const,
      payment: payment,
      description: `Fixed monthly payment of €${payment.toFixed(2)}`,
    }
  } else if (repaymentType.value === 'linear') {
    // Fixed principal debt
    const principal = monthlyPrincipal.value || calculatedPrincipalPayment.value
    if (!principal) return null
    const initialPayment = principal + monthlyInterest
    const finalPayment = principal + principal * monthlyRate
    return {
      type: 'declining' as const,
      initialPayment: initialPayment,
      finalPayment: finalPayment,
      description: `Initial: €${initialPayment.toFixed(2)}/month → Final: €${finalPayment.toFixed(2)}/month`,
    }
  } else if (repaymentType.value === 'balloon' || repaymentType.value === 'perpetual') {
    // Interest-only debt
    return {
      type: 'interest-only' as const,
      payment: monthlyInterest,
      description: `Interest only: €${monthlyInterest.toFixed(2)}/month`,
    }
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
        // Set input mode based on what was saved
        paymentInputMode.value = monthlyPayment.value ? 'payment' : 'endDate'
      } else if (type === 'linear') {
        repaymentType.value = 'linear'
        monthlyPrincipal.value = debt.monthlyPrincipalPayment ?? undefined
        // Set input mode based on what was saved
        principalInputMode.value = monthlyPrincipal.value ? 'principal' : 'endDate'
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

  // Resolve calculatedEndDate to DateSpecification if needed
  const finalEndDate =
    endDate.value !== undefined
      ? endDate.value
      : calculatedEndDate.value !== null
        ? { type: 'absolute' as const, month: calculatedEndDate.value }
        : undefined

  const baseData = {
    id: props.id,
    name: name.value.trim(),
    amount: amount.value,
    annualInterestRate: annualInterestRate.value,
    startDate: startDate.value,
    repaymentStartDate: hasDelayedStart.value ? repaymentStartDate.value : undefined,
    endDate: finalEndDate,
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
        <label for="amount">Loan Amount (€) *</label>
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
        <DateSpecificationEdit
          v-model="startDate"
          label="Start Month"
          :nullable="false"
          :allow-age-entry="true"
          :show-mode-selector="true"
        />
        <p class="help-text" title="When the debt begins (defaults to current month)">
          Loan start date
        </p>
      </div>

      <!-- Repayment Type -->
      <div class="form-group">
        <label>Repayment Type</label>
        <div class="radio-group">
          <label class="radio-label">
            <input type="radio" v-model="repaymentType" value="annuity" />
            <div class="radio-content">
              <span class="radio-title">Constant payment</span>
              <span class="radio-description">Same monthly payment throughout</span>
            </div>
          </label>
          <label class="radio-label">
            <input type="radio" v-model="repaymentType" value="linear" />
            <div class="radio-content">
              <span class="radio-title">Constant principal</span>
              <span class="radio-description">Decreasing payments over time</span>
            </div>
          </label>
          <label class="radio-label">
            <input type="radio" v-model="repaymentType" value="balloon" />
            <div class="radio-content">
              <span class="radio-title">Balloon payment</span>
              <span class="radio-description">Pay interest only, repay loan at end</span>
            </div>
          </label>
          <label class="radio-label">
            <input type="radio" v-model="repaymentType" value="perpetual" />
            <div class="radio-content">
              <span class="radio-title">Perpetual</span>
              <span class="radio-description">Interest only, never repay principal</span>
            </div>
          </label>
        </div>
      </div>

      <!-- Delayed start checkbox -->
      <div v-if="showDelayedStart" class="form-group checkbox-group">
        <label>
          <input type="checkbox" v-model="hasDelayedStart" />
          Delay payoff start
        </label>
      </div>

      <div v-if="showRepaymentStartDate" class="form-group">
        <DateSpecificationEdit
          v-model="repaymentStartDate"
          label="Repayment Start Month"
          :required="true"
          :nullable="false"
          :allow-age-entry="true"
          :show-mode-selector="true"
        />
      </div>

      <!-- Annuity payment specification -->
      <div v-if="showMonthlyPayment" class="form-group">
        <label>Payment Specification</label>
        <div class="radio-group-inline">
          <label class="radio-label-inline">
            <input type="radio" v-model="paymentInputMode" value="endDate" />
            Enter end date
          </label>
          <label class="radio-label-inline">
            <input type="radio" v-model="paymentInputMode" value="payment" />
            Enter monthly payment
          </label>
        </div>

        <div v-if="paymentInputMode === 'endDate'" class="input-field">
          <DateSpecificationEdit
            v-model="endDate"
            label="Payoff Date"
            :nullable="false"
            :allow-age-entry="true"
            :show-mode-selector="true"
          />
          <p class="help-text">When you'll pay off the loan in full</p>
        </div>

        <div v-else class="input-field">
          <label for="monthly-payment">Monthly Payment (€)</label>
          <input
            id="monthly-payment"
            v-model.number="monthlyPayment"
            type="number"
            min="0"
            step="0.01"
            required
          />
          <p class="help-text">Total payment including principal and interest</p>
        </div>
      </div>

      <!-- Linear payment specification -->
      <div v-if="showMonthlyPrincipal" class="form-group">
        <label>Payment Specification</label>
        <div class="radio-group-inline">
          <label class="radio-label-inline">
            <input type="radio" v-model="principalInputMode" value="endDate" />
            Enter end date
          </label>
          <label class="radio-label-inline">
            <input type="radio" v-model="principalInputMode" value="principal" />
            Enter monthly principal
          </label>
        </div>

        <div v-if="principalInputMode === 'endDate'" class="input-field">
          <DateSpecificationEdit
            v-model="endDate"
            label="Payoff Date"
            :nullable="false"
            :allow-age-entry="true"
            :show-mode-selector="true"
          />
          <p class="help-text">When you'll pay off the loan in full</p>
        </div>

        <div v-else class="input-field">
          <label for="monthly-principal">Monthly Principal Payment (€)</label>
          <input
            id="monthly-principal"
            v-model.number="monthlyPrincipal"
            type="number"
            min="0"
            step="0.01"
            required
          />
          <p class="help-text">Principal paid each month (interest added on top)</p>
        </div>
      </div>

      <!-- End date for balloon payment -->
      <div v-if="repaymentType === 'balloon'" class="form-group">
        <DateSpecificationEdit
          v-model="endDate"
          label="Balloon Payment Date"
          :nullable="false"
          :allow-age-entry="true"
          :show-mode-selector="true"
        />
        <p class="help-text">When you'll pay off the remaining balance</p>
      </div>

      <!-- Payment Summary -->
      <div v-if="monthlyPaymentDisplay || calculatedEndDate" class="payment-summary">
        <h3>Payment Summary</h3>

        <!-- Monthly payment info -->
        <div v-if="monthlyPaymentDisplay" class="payment-info">
          <div v-if="monthlyPaymentDisplay.type === 'fixed'" class="payment-display">
            <div class="payment-amount">€{{ monthlyPaymentDisplay.payment.toFixed(2) }}/month</div>
            <p class="help-text">Fixed payment throughout the loan term</p>
          </div>
          <div v-else-if="monthlyPaymentDisplay.type === 'declining'" class="payment-display">
            <div class="payment-range">
              <div class="payment-initial">
                <span class="label">Initial:</span>
                <span class="amount"
                  >€{{ monthlyPaymentDisplay.initialPayment.toFixed(2) }}/month</span
                >
              </div>
              <div class="payment-arrow">→</div>
              <div class="payment-final">
                <span class="label">Final:</span>
                <span class="amount"
                  >€{{ monthlyPaymentDisplay.finalPayment.toFixed(2) }}/month</span
                >
              </div>
            </div>
            <p class="help-text">Payments decrease as principal is paid down</p>
          </div>
          <div v-else-if="monthlyPaymentDisplay.type === 'interest-only'" class="payment-display">
            <div class="payment-amount">€{{ monthlyPaymentDisplay.payment.toFixed(2) }}/month</div>
            <p class="help-text">Interest only - principal due at end</p>
          </div>
        </div>

        <!-- Calculated end date -->
        <div v-if="calculatedEndDate" class="calculated-field">
          <span class="label">Estimated Payoff Date:</span>
          <span class="value">{{ formatMonth(calculatedEndDate, 'full') }}</span>
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

<style scoped lang="scss">
// Component-specific styles only - shared styles come from _buttons.scss, _forms.scss, _layout.scss

// Edit view uses shared styles, only need responsive adjustments
.edit-debt-view {
  @include mobile {
    padding: $spacing-lg;
  }

  @include mobile-small {
    padding: $spacing-base;
  }
}

// Inline radio group styles
.radio-group-inline {
  display: flex;
  gap: 1.5rem;
  margin: 0.75rem 0;
  flex-wrap: wrap;

  .radio-label-inline {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.95rem;

    input[type='radio'] {
      cursor: pointer;
    }
  }
}

.input-field {
  margin-top: 1rem;
}

// Payment summary specific styles
.payment-summary {
  margin: 1.5rem 0;
  padding: 1rem;
  background: #f8f9fa;
  border: 2px solid #007bff;
  border-radius: 4px;

  h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: #2c3e50;
  }

  .payment-info {
    margin-bottom: 1rem;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .payment-display {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .payment-amount {
    font-size: 1.5rem;
    font-weight: 600;
    color: #007bff;
  }

  .payment-range {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;

    .payment-initial,
    .payment-final {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;

      .label {
        font-size: 0.85rem;
        color: #666;
      }

      .amount {
        font-size: 1.25rem;
        font-weight: 600;
        color: #007bff;
      }
    }

    .payment-arrow {
      font-size: 1.5rem;
      color: #666;
    }
  }

  .calculated-field {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding-top: 1rem;
    margin-top: 1rem;
    border-top: 1px solid #dee2e6;

    .label {
      font-size: 0.95rem;
      color: #666;
      font-weight: 500;
    }

    .value {
      font-size: 1.1rem;
      color: #2c3e50;
      font-weight: 600;
    }
  }

  .help-text {
    margin: 0;
    font-size: 0.9rem;
    color: #666;
  }

  @include mobile-small {
    .payment-range {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;

      .payment-arrow {
        display: none;
      }
    }

    .payment-amount {
      font-size: 1.25rem;
    }

    .calculated-field {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
  }
}
</style>
