<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlannerStore } from '@/stores/planner'
import { getItemTypeById, getItemTypeButtonLabel } from '@/config/itemTypes'
import { LiquidAsset, FixedAsset } from '@/models'
import type { AssetType } from '@/models'
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
const amount = ref<number>(0)
const annualInterestRate = ref<number>(0)
const liquidationDate = ref<Month | undefined>(undefined)
const assetType = ref<AssetType>('liquid')

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

const showInterestRate = computed(() => assetType.value === 'fixed')

// Load existing asset for editing
onMounted(() => {
  if (isEditMode.value && props.id) {
    const asset = store.getCapitalAccountById(props.id)
    if (asset) {
      name.value = asset.name
      amount.value = asset.amount
      assetType.value = asset instanceof FixedAsset ? 'fixed' : 'liquid'
      if (asset instanceof FixedAsset) {
        annualInterestRate.value = asset.annualInterestRate
        liquidationDate.value = asset.liquidationDate
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
        liquidationDate.value = template.liquidationDate
      } else if (template instanceof LiquidAsset) {
        assetType.value = 'liquid'
        amount.value = template.amount
      }
    } else {
      assetType.value = props.typeId as AssetType
    }
  }
})

function handleSave() {
  if (!name.value.trim() || amount.value <= 0) {
    alert('Please fill in all required fields')
    return
  }

  if (isEditMode.value && props.id) {
    // Update existing asset
    const updates: any = {
      name: name.value.trim(),
      amount: amount.value,
    }
    if (assetType.value === 'fixed') {
      updates.annualInterestRate = annualInterestRate.value
      updates.liquidationDate = liquidationDate.value
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
      })
    } else {
      store.addCapitalAccount({
        type: 'liquid',
        name: name.value.trim(),
        amount: amount.value,
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
      <h1>{{ pageTitle }}</h1>
    </header>

    <form class="edit-form" @submit.prevent="handleSave">
      <div class="form-group">
        <label for="asset-type">Asset Type</label>
        <select id="asset-type" v-model="assetType" :disabled="isEditMode">
          <option value="liquid">Liquid Asset (Savings, Cash)</option>
          <option value="fixed">Fixed Asset (Property, House)</option>
        </select>
        <p v-if="isEditMode" class="help-text">Asset type cannot be changed</p>
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
        <p class="help-text">
          Annual appreciation or depreciation rate. Use positive for growth, negative for
          depreciation.
        </p>
      </div>

      <div v-if="showInterestRate" class="form-group">
        <MonthEdit v-model="liquidationDate" label="Liquidation Month (optional)" :nullable="true" />
        <p class="help-text">
          Optional: Month when this asset will be sold/liquidated. The asset value will be
          transferred to liquid assets.
        </p>
      </div>

      <div class="form-actions">
        <button type="button" class="button button-secondary" @click="handleCancel">
          Cancel
        </button>
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

<style scoped>
.edit-asset-view {
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
  .edit-asset-view {
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
  .edit-asset-view {
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
