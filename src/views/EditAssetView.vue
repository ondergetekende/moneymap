<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePlannerStore } from '@/stores/planner'
import { getItemTypeById, getItemTypeButtonLabel } from '@/config/itemTypes'
import { LiquidAsset, FixedAsset } from '@/models'
import type { AssetType } from '@/models'
import type { Month, DateSpecification } from '@/types/month'
import { createAbsoluteDate } from '@/types/month'
import MonthEdit from '@/components/MonthEdit.vue'
import { getTaxOptions, getTaxConfig } from '@/config/taxConfig'

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
const liquidationDate = ref<Month | undefined>(undefined)
const assetType = ref<AssetType>('liquid')
const wealthTaxId = ref<string | undefined>(undefined)
const capitalGainsTaxId = ref<string | undefined>(undefined)

// UI state
const isEditMode = computed(() => !!props.id)
const itemType = computed(() => getItemTypeById(assetType.value))
const pageTitle = computed(() => {
  const typeName = itemType.value ? getItemTypeButtonLabel(itemType.value) : 'Asset'
  if (isEditMode.value) {
    return `Edit ${typeName}`
  }
  return `New ${typeName}`
})
const assetTypeName = computed(() => {
  return assetType.value === 'liquid'
    ? 'Liquid Asset (Savings, Cash)'
    : 'Fixed Asset (Property, House)'
})

const showInterestRate = computed(() => assetType.value === 'fixed')

// Tax-related computed properties
const taxCountry = computed(() => store.taxCountry)
const countryName = computed(() => {
  if (!taxCountry.value) return ''
  const config = getTaxConfig(taxCountry.value)
  return config?.countryName || ''
})
const wealthTaxOptions = computed(() => {
  if (!taxCountry.value) return []
  return getTaxOptions(taxCountry.value, 'wealth')
})
const capitalGainsTaxOptions = computed(() => {
  if (!taxCountry.value) return []
  return getTaxOptions(taxCountry.value, 'capital_gains')
})

// Set default taxes when country is selected and no taxes are set
function setDefaultTaxesIfNeeded() {
  if (taxCountry.value) {
    if (!wealthTaxId.value) {
      wealthTaxId.value = 'default'
    }
    if (!capitalGainsTaxId.value) {
      capitalGainsTaxId.value = 'default'
    }
  }
}

// Load existing asset for editing
onMounted(() => {
  if (isEditMode.value && props.id) {
    const asset = store.getCapitalAccountById(props.id)
    if (asset) {
      name.value = asset.name
      amount.value = asset.amount
      assetType.value = asset instanceof FixedAsset ? 'fixed' : 'liquid'
      wealthTaxId.value = asset.wealthTaxId
      capitalGainsTaxId.value = asset.capitalGainsTaxId
      if (asset instanceof FixedAsset) {
        annualInterestRate.value = asset.annualInterestRate
        liquidationDate.value = dateSpecToMonth(asset.liquidationDate)
      }
    } else {
      // Asset not found, redirect to dashboard
      router.push({ name: 'dashboard' })
    }
  } else if (props.typeId) {
    // New asset with pre-selected type - load template values
    const itemTypeConfig = getItemTypeById(props.typeId)
    if (itemTypeConfig && itemTypeConfig.template) {
      const template = itemTypeConfig.template
      name.value = template.name

      // Only load asset templates (skip cash flows)
      if (template instanceof FixedAsset) {
        assetType.value = 'fixed'
        amount.value = template.amount
        annualInterestRate.value = template.annualInterestRate
        liquidationDate.value = dateSpecToMonth(template.liquidationDate)
        wealthTaxId.value = template.wealthTaxId
        capitalGainsTaxId.value = template.capitalGainsTaxId
      } else if (template instanceof LiquidAsset) {
        assetType.value = 'liquid'
        amount.value = template.amount
        wealthTaxId.value = template.wealthTaxId
        capitalGainsTaxId.value = template.capitalGainsTaxId
      }
    } else {
      assetType.value = props.typeId as AssetType
    }
  }

  // Set default taxes for new items
  setDefaultTaxesIfNeeded()
})

// Watch for tax country changes to set defaults
watch(taxCountry, () => {
  setDefaultTaxesIfNeeded()
})

function handleSave() {
  if (!name.value.trim() || amount.value <= 0) {
    alert('Please fill in all required fields')
    return
  }

  if (isEditMode.value && props.id) {
    // Update existing asset
    const updates: Record<string, unknown> = {
      name: name.value.trim(),
      amount: amount.value,
      wealthTaxId: wealthTaxId.value,
      capitalGainsTaxId: capitalGainsTaxId.value,
    }
    if (assetType.value === 'fixed') {
      updates.annualInterestRate = annualInterestRate.value
      updates.liquidationDate =
        liquidationDate.value !== undefined ? createAbsoluteDate(liquidationDate.value) : undefined
    }
    store.updateCapitalAccount(props.id, updates)
  } else {
    // Create new asset - build object for store
    if (assetType.value === 'fixed') {
      store.addCapitalAccount({
        type: 'fixed',
        name: name.value.trim(),
        amount: amount.value,
        annualInterestRate: annualInterestRate.value,
        liquidationDate: liquidationDate.value,
        wealthTaxId: wealthTaxId.value,
        capitalGainsTaxId: capitalGainsTaxId.value,
      })
    } else {
      store.addCapitalAccount({
        type: 'liquid',
        name: name.value.trim(),
        amount: amount.value,
        wealthTaxId: wealthTaxId.value,
        capitalGainsTaxId: capitalGainsTaxId.value,
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
      store.removeCapitalAccount(props.id)
      router.push({ name: 'dashboard' })
    }
  }
}
</script>

<template>
  <div class="edit-asset-view">
    <header class="view-header">
      <button class="back-button" @click="handleCancel">&larr; Back</button>
      <h1 class="page-title">{{ pageTitle }}</h1>
    </header>

    <form class="edit-form" @submit.prevent="handleSave">
      <div class="form-group">
        <p class="field-label">Asset Type</p>
        <p class="field-value">{{ assetTypeName }}</p>
      </div>

      <div class="form-group">
        <label for="name">Name *</label>
        <input
          id="name"
          v-model="name"
          type="text"
          placeholder="e.g., Savings Account, House"
          required
        />
      </div>

      <div class="form-group">
        <label for="amount">Amount (€) *</label>
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

      <div v-if="showInterestRate" class="form-group">
        <label for="interest-rate">Annual Interest Rate (%) *</label>
        <input
          id="interest-rate"
          v-model.number="annualInterestRate"
          type="number"
          step="0.01"
          placeholder="e.g., 3.5 for 3.5%"
          required
        />
        <p class="help-text">Growth rate (positive) or depreciation (negative)</p>
      </div>

      <div v-if="showInterestRate" class="form-group">
        <MonthEdit
          v-model="liquidationDate"
          label="Liquidation Month (optional)"
          :nullable="true"
        />
        <p class="help-text">When will you sell this asset?</p>
      </div>

      <div v-if="taxCountry" class="form-group">
        <label for="wealth-tax">Wealth Tax</label>
        <select id="wealth-tax" v-model="wealthTaxId">
          <option value="default">Default for {{ countryName }}</option>
          <option value="none">None</option>
          <option disabled>─────────</option>
          <option v-for="tax in wealthTaxOptions" :key="tax.id" :value="tax.id">
            {{ tax.name }}
          </option>
        </select>
        <p class="help-text">Wealth tax applies to asset value</p>
      </div>

      <div v-if="taxCountry" class="form-group">
        <label for="capital-gains-tax">Capital Gains Tax</label>
        <select id="capital-gains-tax" v-model="capitalGainsTaxId">
          <option value="default">Default for {{ countryName }}</option>
          <option value="none">None</option>
          <option disabled>─────────</option>
          <option v-for="tax in capitalGainsTaxOptions" :key="tax.id" :value="tax.id">
            {{ tax.name }}
          </option>
        </select>
        <p class="help-text">Capital gains tax applies to interest/appreciation</p>
      </div>

      <div class="form-actions">
        <button type="button" class="button button-secondary" @click="handleCancel">Cancel</button>
        <button v-if="isEditMode" type="button" class="button button-danger" @click="handleDelete">
          Delete
        </button>
        <button type="submit" class="button button-primary">
          {{ isEditMode ? 'Save Changes' : 'Create Asset' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped lang="scss">
// Component-specific styles only - shared styles come from _buttons.scss, _forms.scss, _layout.scss

.field-label {
  font-weight: $font-semibold;
  color: $text-secondary;
  margin: 0 0 $spacing-xs 0;
  font-size: $font-sm;
}

.field-value {
  color: $text-primary;
  margin: 0;
  padding: $spacing-sm 0;
  font-size: $font-base;
}

.view-header {
  display: flex;
  align-items: center;
  gap: $spacing-lg;
  margin-bottom: $spacing-3xl;
}

.page-title {
  font-size: $font-2xl;
  font-weight: $font-bold;
  color: $text-primary;
  margin: 0;

  @include mobile {
    font-size: $font-xl-2;
  }

  @include mobile-small {
    font-size: $font-xl;
  }
}

.edit-asset-view {
  @include mobile {
    padding: $spacing-lg;
  }

  @include mobile-small {
    padding: $spacing-base;
  }
}
</style>
