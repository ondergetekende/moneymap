<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ITEM_TYPES, getItemTypeButtonLabel, type ItemTypeDefinition } from '@/config/itemTypes'

const router = useRouter()

function handleAddItem(typeId: string, category: ItemTypeDefinition['category']) {
  if (category === 'asset') {
    router.push({ name: 'new-asset', params: { typeId } })
  } else if (category === 'cashflow') {
    router.push({ name: 'new-cashflow', params: { typeId } })
  } else if (category === 'debt') {
    router.push({ name: 'new-debt', params: { typeId } })
  }
}
</script>

<template>
  <div class="action-buttons">
    <button
      v-for="itemType in ITEM_TYPES"
      :key="itemType.id"
      class="action-button"
      :style="{ borderLeftColor: itemType.color }"
      @click="handleAddItem(itemType.id, itemType.category)"
    >
      <span class="button-label">+ {{ getItemTypeButtonLabel(itemType) }}</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
.action-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.75rem;
  padding: 1rem 0;
}

// Neutral buttons; the type color shows only as a left border, like the item cards.
.action-button {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  background: $bg-card;
  color: $text-primary;
  border: 1px solid $border-light;
  border-left: 4px solid;
  border-radius: $radius-md;
  font-size: 0.9375rem;
  font-weight: $font-medium;
  cursor: pointer;
  transition: $transition-base;
}

.action-button:hover {
  border-color: $border-medium;
  box-shadow: $shadow-sm;
}

.button-label {
  white-space: nowrap;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .action-buttons {
    gap: 0.5rem;
    padding: 0.75rem 0;
    grid-template-columns: repeat(2, 1fr);
  }

  .action-button {
    padding: 0.875rem 0.75rem;
    min-height: 44px; /* Touch target */
  }
}

@media (max-width: 480px) {
  .action-buttons {
    gap: 0.5rem;
    padding: 0.5rem 0;
  }

  .action-button {
    padding: 0.875rem 0.625rem;
    font-size: 0.875rem;
  }

  .button-label {
    font-size: 0.8125rem;
  }
}
</style>
