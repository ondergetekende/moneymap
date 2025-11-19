<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePlannerStore } from '@/stores/planner'
import type { CapitalAccount, CashFlow, AllDebtTypes } from '@/models'
import { isAsset, isCashFlow, isLiquidAsset, isFixedAsset, Debt } from '@/models'
import { getItemTypeById, getItemTypeButtonLabel } from '@/config/itemTypes'

const props = defineProps<{
  item: CapitalAccount | CashFlow | AllDebtTypes
}>()

const store = usePlannerStore()
const isEditingAmount = ref(false)
const editAmount = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const router = useRouter()

// Determine item type and metadata
const itemType = computed(() => {
  const item = props.item as any
  if (isAsset(item)) {
    return isLiquidAsset(item) ? getItemTypeById('liquid') : getItemTypeById('fixed')
  } else if (isCashFlow(item)) {
    // For one-time cashflows, use specific templates
    if (item.isOneTime) {
      return item.type === 'income' ? getItemTypeById('windfall') : getItemTypeById('one-time-expense')
    }
    return getItemTypeById(item.type)
  } else if (item instanceof Debt) {
    // Return a generic debt type definition
    return {
      id: 'debt',
      category: 'debt' as const,
      color: '#f97316',
      template: item
    }
  }
  return undefined
})

// Get the numeric value to edit based on item type
const editableValue = computed(() => {
  const item = props.item as any
  if (isAsset(item)) {
    return item.amount
  } else if (isCashFlow(item)) {
    return item.amount
  } else if (item instanceof Debt) {
    return item.amount
  }
  return 0
})

const formattedAmount = computed(() => {
  const item = props.item as any
  const formatter = new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })

  if (isAsset(item)) {
    // For assets, show total amount
    return formatter.format(item.amount)
  } else if (isCashFlow(item)) {
    // For cashflows, show amount based on user's chosen frequency
    if (item.isOneTime) {
      // One-time transactions: show amount as-is
      return `${formatter.format(item.amount)} (one-time)`
    } else {
      // Recurring transactions: show in user's preferred frequency
      switch (item.frequency) {
        case 'weekly':
          return `${formatter.format(item.weeklyAmount)}/w`
        case 'monthly':
          return `${formatter.format(item.monthlyAmount)}/m`
        case 'annual':
          return `${formatter.format(item.annualAmount)}/y`
        default:
          return `${formatter.format(item.monthlyAmount)}/m`
      }
    }
  } else if (item instanceof Debt) {
    // For debts, show principal balance
    return formatter.format(item.amount)
  }
  return ''
})

const itemStyles = computed(() => {
  const color = itemType.value?.color || '#666'
  return {
    borderLeftColor: color,
  }
})

const badgeStyles = computed(() => {
  const color = itemType.value?.color || '#666'
  return {
    backgroundColor: `${color}20`, // 20% opacity
    color: color,
  }
})

function handleEdit() {
  const item = props.item as any
  if (isAsset(item)) {
    router.push({ name: 'edit-asset', params: { id: item.id } })
  } else if (isCashFlow(item)) {
    router.push({ name: 'edit-cashflow', params: { id: item.id } })
  } else if (item instanceof Debt) {
    router.push({ name: 'edit-debt', params: { id: item.id } })
  }
}

function startEditing() {
  editAmount.value = editableValue.value.toString()
  isEditingAmount.value = true
  // Focus the input on next tick
  setTimeout(() => {
    inputRef.value?.select()
  }, 0)
}

function cancelEditing() {
  isEditingAmount.value = false
  editAmount.value = ''
}

function saveAmount() {
  const newValue = parseFloat(editAmount.value.replace(/[^0-9.-]/g, ''))

  // Validate the input
  if (isNaN(newValue) || newValue <= 0) {
    // Invalid input, cancel editing
    cancelEditing()
    return
  }

  // Update based on item type
  const item = props.item as any
  if (isAsset(item)) {
    store.updateCapitalAccount(item.id, { amount: newValue })
  } else if (isCashFlow(item)) {
    store.updateCashFlow(item.id, { amount: newValue })
  } else if (item instanceof Debt) {
    store.updateDebt(item.id, { amount: newValue })
  }

  isEditingAmount.value = false
  editAmount.value = ''
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    saveAmount()
  } else if (event.key === 'Escape') {
    cancelEditing()
  }
}
</script>

<template>
  <div class="list-item" :style="itemStyles">
    <div class="item-header">
      <span class="item-name">{{ item.name }}</span>
      <span class="item-badge" :style="badgeStyles">{{ itemType?.template?.name || (item instanceof Debt ? 'Debt' : '') }}</span>
    </div>
    <div class="item-footer">
      <input
        v-if="isEditingAmount"
        ref="inputRef"
        v-model="editAmount"
        type="text"
        class="item-amount-input"
        @blur="saveAmount"
        @keydown="handleKeydown"
      />
      <span
        v-else
        class="item-amount"
        @click="startEditing"
        title="Click to edit"
      >
        {{ formattedAmount }}
      </span>
      <button class="edit-button" @click="handleEdit">Edit</button>
    </div>
  </div>
</template>

<style scoped>
.list-item {
  background: white;
  border: 1px solid #e5e7eb;
  border-left: 4px solid;
  border-radius: 6px;
  padding: 0.75rem;
  transition: all 0.2s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.list-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.item-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.item-name {
  font-weight: 600;
  font-size: 0.9375rem;
  color: #1f2937;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-badge {
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-size: 0.6875rem;
  font-weight: 500;
  flex-shrink: 0;
}

.item-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.item-amount {
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.item-amount:hover {
  background-color: #f3f4f6;
}

.item-amount-input {
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
  border: 2px solid #3b82f6;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  background: white;
  outline: none;
  min-width: 120px;
  flex: 1;
}

.edit-button {
  padding: 0.25rem 0.625rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  color: #374151;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.edit-button:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.edit-button:active {
  transform: scale(0.98);
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .list-item {
    padding: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .item-name {
    font-size: 0.9375rem;
  }

  .item-amount,
  .item-amount-input {
    font-size: 1rem;
  }

  .edit-button {
    padding: 0.5rem 1rem;
    min-height: 44px; /* Touch target */
  }
}

@media (max-width: 480px) {
  .list-item {
    padding: 0.625rem;
  }

  .item-icon {
    font-size: 1.125rem;
  }

  .item-name {
    font-size: 0.875rem;
  }

  .item-amount,
  .item-amount-input {
    font-size: 0.9375rem;
  }
}
</style>
