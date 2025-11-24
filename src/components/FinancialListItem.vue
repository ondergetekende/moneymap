<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { CapitalAccount, CashFlow, AllDebtTypes } from '@/models'
import { isAsset, isCashFlow, isLiquidAsset, Debt } from '@/models'
import { getItemTypeById } from '@/config/itemTypes'

const props = defineProps<{
  item: CapitalAccount | CashFlow | AllDebtTypes
}>()

const router = useRouter()

// Determine item type and metadata
const itemType = computed(() => {
  const item = props.item as CapitalAccount | CashFlow | AllDebtTypes
  if (isAsset(item)) {
    return isLiquidAsset(item) ? getItemTypeById('liquid') : getItemTypeById('fixed')
  } else if (isCashFlow(item)) {
    // For one-time cashflows, use specific templates
    if (item.isOneTime) {
      return item.type === 'income'
        ? getItemTypeById('windfall')
        : getItemTypeById('one-time-expense')
    }
    return getItemTypeById(item.type)
  } else if (item instanceof Debt) {
    // Return a generic debt type definition
    return {
      id: 'debt',
      category: 'debt' as const,
      color: '#f97316',
      template: item,
    }
  }
  return undefined
})

const formattedAmount = computed(() => {
  const item = props.item as CapitalAccount | CashFlow | AllDebtTypes
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

function handleEdit() {
  const item = props.item as CapitalAccount | CashFlow | AllDebtTypes
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
  <div class="list-item" :style="itemStyles" @click="handleEdit">
    <div class="item-header">
      <span class="item-name">{{ item.name }}</span>
    </div>
    <div class="item-footer">
      <span class="item-amount">{{ formattedAmount }}</span>
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
  cursor: pointer;
}

.list-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
  border-color: #d1d5db;
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

.item-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.item-amount {
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
}

@media (max-width: 480px) {
  .list-item {
    padding: 0.625rem;
  }

  .item-name {
    font-size: 0.875rem;
  }

  .item-amount {
    font-size: 0.9375rem;
  }
}
</style>
