<template>
  <div class="life-events-step">
    <h3>Life Events (Optional)</h3>
    <p class="step-description">
      Define life events like "Retirement" or "House Purchase" to reference them when setting dates.
      This makes planning easier and automatically updates related items when you change event
      dates.
    </p>

    <LifeEventManager />

    <div class="step-hint">
      <strong>Tip:</strong> You can skip this step and add life events later. They're useful for
      linking multiple financial items to the same milestone.
    </div>
  </div>
</template>

<script setup lang="ts">
import LifeEventManager from '../LifeEventManager.vue'
</script>

<style scoped>
.life-events-step {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.5rem;
  font-weight: 600;
}

.step-description {
  margin: 0;
  color: #555;
  font-size: 1rem;
  line-height: 1.6;
}

.step-hint {
  padding: 1rem;
  background-color: #e3f2fd;
  border-left: 4px solid #2196f3;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #1565c0;
}

.step-hint strong {
  font-weight: 600;
}

@media (max-width: 768px) {
  h3 {
    font-size: 1.25rem;
  }

  .step-description {
    font-size: 0.9rem;
  }

  .step-hint {
    padding: 0.75rem;
    font-size: 0.85rem;
  }
}
</style>
