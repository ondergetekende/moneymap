<template>
  <div class="life-events-step">
    <h3 class="step-title">Life events</h3>
    <p class="step-description">
      Optional. Name milestones, such as retirement, and link items to them.
    </p>

    <LifeEventManager />
  </div>
</template>

<script setup lang="ts">
import LifeEventManager from '../LifeEventManager.vue'
</script>

<style scoped lang="scss">
.life-events-step {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
</style>
