<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { CapitalAccount, CashFlow } from '@/models'
import { isAsset, isCashFlow, isLiquidAsset, isFixedAsset } from '@/models'
import { getItemTypeById, getItemTypeButtonLabel } from '@/config/itemTypes'

const props = defineProps<{
  item: CapitalAccount | CashFlow
}>()

const router = useRouter()

// Determine item type and metadata
const itemType = computed(() => {
  if (isAsset(props.item)) {
    return isLiquidAsset(props.item) ? getItemTypeById('liquid') : getItemTypeById('fixed')
  } else if (isCashFlow(props.item)) {
    return getItemTypeById(props.item.type)
  }
  return undefined
})

const formattedAmount = computed(() => {
  const formatter = new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })

  if (isAsset(props.item)) {
    // For assets, show total amount
    return formatter.format(props.item.amount)
  } else if (isCashFlow(props.item)) {
    // For cashflows, show annual amount
    const annualAmount = props.item.monthlyAmount * 12
    return `${formatter.format(annualAmount)}/y`
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
  if (isAsset(props.item)) {
    router.push({ name: 'edit-asset', params: { id: props.item.id } })
  } else if (isCashFlow(props.item)) {
    router.push({ name: 'edit-cashflow', params: { id: props.item.id } })
  }
}
</script>

<template>
  <div class="list-item" :style="itemStyles">
    <div class="item-header">
      <span class="item-name">{{ item.name }}</span>
      <span class="item-badge" :style="badgeStyles">{{ itemType ? getItemTypeButtonLabel(itemType) : '' }}</span>
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
