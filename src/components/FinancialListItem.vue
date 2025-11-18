<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { CapitalAccount, CashFlow, AllDebtTypes } from '@/models'
import { isAsset, isCashFlow, isLiquidAsset, isFixedAsset, Debt } from '@/models'
import { getItemTypeById, getItemTypeButtonLabel } from '@/config/itemTypes'

const props = defineProps<{
  item: CapitalAccount | CashFlow | AllDebtTypes
}>()

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
    // For cashflows, show amount based on frequency
    if (item.isOneTime) {
      // One-time transactions: show amount as-is
      return `${formatter.format(item.monthlyAmount)} (one-time)`
    } else {
      // Recurring transactions: show annual amount
      const annualAmount = item.monthlyAmount * 12
      return `${formatter.format(annualAmount)}/y`
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
</script>

<template>
  <div class="list-item" :style="itemStyles">
    <div class="item-header">
      <span class="item-name">{{ item.name }}</span>
      <span class="item-badge" :style="badgeStyles">{{ itemType?.template?.name || (item instanceof Debt ? 'Debt' : '') }}</span>
    </div>
    <div class="item-footer">
      <span class="item-amount">{{ formattedAmount }}</span>
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

  .item-amount {
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

  .item-amount {
    font-size: 0.9375rem;
  }
}
</style>
