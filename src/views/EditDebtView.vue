<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlannerStore } from '@/stores/planner'
import { getItemTypeById } from '@/config/itemTypes'
import { LinearDebt, AnnualizedDebt, InterestOnlyDebt } from '@/models'
import type { Month, DateSpecification } from '@/types/month'
import { getCurrentMonth, addMonths, monthDiff, createAbsoluteDate } from '@/types/month'
import MonthEdit from '@/components/MonthEdit.vue'

// Helper to extract Month from DateSpecification (temporary until Task 4)
function dateSpecToMonth(spec: DateSpecification | undefined): Month | undefined {
  if (!spec) return undefined
  if (spec.type === 'absolute') return spec.month
  // For now, only handle absolute dates in the UI
  return undefined
}

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
      startDate.value = dateSpecToMonth(debt.startDate)

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

      endDate.value = dateSpecToMonth(debt.endDate)
      hasDelayedStart.value =
        !!debt.repaymentStartDate && debt.repaymentStartDate !== debt.startDate

      if (hasDelayedStart.value) {
        repaymentStartDate.value = dateSpecToMonth(debt.repaymentStartDate)
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
      startDate.value = dateSpecToMonth(template.startDate)

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

      endDate.value = dateSpecToMonth(template.endDate)
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
    startDate: startDate.value !== undefined ? createAbsoluteDate(startDate.value) : undefined,
    repaymentStartDate:
      hasDelayedStart.value && repaymentStartDate.value !== undefined
        ? createAbsoluteDate(repaymentStartDate.value)
        : undefined,
    endDate:
      endDate.value !== undefined
        ? createAbsoluteDate(endDate.value)
        : calculatedEndDate.value !== null
          ? createAbsoluteDate(calculatedEndDate.value)
          : undefined,
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
        <MonthEdit v-model="startDate" label="Start Month" :nullable="false" />
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
        <p
          class="help-text"
          title="When you'll pay off the remaining balance in full. Leave empty to calculate from payment amount"
        >
          Final payment date
        </p>
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
        <p
          class="help-text"
          title="Total payment stays the same each month, principal portion increases over time"
        >
          Includes principal and interest
        </p>
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
        <p class="help-text" title="Principal paid each month (interest will be added on top)">
          Interest added on top
        </p>
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
          <p
            class="help-text"
            title="Total payment stays the same each month, principal portion increases over time"
          >
            Includes principal and interest
          </p>
        </div>
        <div v-if="calculatedPrincipalPayment" class="calculated-field">
          <span class="label">Required Monthly Principal:</span>
          <span class="value">€{{ calculatedPrincipalPayment.toFixed(2) }}</span>
          <p
            class="help-text"
            title="Principal paid each month (total payment will vary with interest)"
          >
            Total payment varies monthly
          </p>
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
</style>
