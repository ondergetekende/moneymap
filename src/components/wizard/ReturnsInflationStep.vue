<template>
  <div class="returns-inflation-step">
    <h3 class="step-title">Investment Assumptions</h3>
    <p class="step-description">
      Set your expected investment returns and inflation rate. These assumptions will be used to
      project your financial future. You can adjust these at any time.
    </p>

    <div class="form-section">
      <div class="form-field">
        <label for="liquid-assets-rate" class="field-label"> Expected Annual Returns (%) </label>
        <div class="field-description">
          The average annual return you expect on your liquid assets (savings, investments, stocks).
        </div>
        <input
          id="liquid-assets-rate"
          type="number"
          :value="liquidAssetsInterestRate"
          @input="handleLiquidAssetsRateChange"
          step="0.1"
          min="0"
          max="100"
          class="number-input"
        />
        <div class="field-hint">
          <div class="suggestion-chips">
            <button
              v-for="rate in suggestedReturns"
              :key="rate.value"
              @click="setLiquidAssetsRate(rate.value)"
              class="chip"
              :class="{ active: Math.abs(liquidAssetsInterestRate - rate.value) < 0.01 }"
              type="button"
            >
              {{ rate.label }}: {{ rate.value }}%
            </button>
          </div>
        </div>
      </div>

      <div class="form-field">
        <label for="inflation-rate" class="field-label"> Expected Annual Inflation (%) </label>
        <div class="field-description">
          The average annual inflation rate you expect over the long term.
        </div>
        <input
          id="inflation-rate"
          type="number"
          :value="inflationRate"
          @input="handleInflationRateChange"
          step="0.1"
          min="0"
          max="20"
          class="number-input"
        />
        <div class="field-hint">
          <div class="suggestion-chips">
            <button
              v-for="rate in suggestedInflation"
              :key="rate.value"
              @click="setInflationRate(rate.value)"
              class="chip"
              :class="{ active: Math.abs(inflationRate - rate.value) < 0.01 }"
              type="button"
            >
              {{ rate.label }}: {{ rate.value }}%
            </button>
          </div>
        </div>
      </div>

      <div class="real-return-display">
        <div class="real-return-info">
          <div class="real-return-label">Real Return (after inflation):</div>
          <div class="real-return-value">{{ realReturn.toFixed(1) }}%</div>
        </div>
      </div>
    </div>

    <div class="info-box">
      <div class="info-content">
        <strong>Tip:</strong> Historical stock market returns average around 7-10% annually, while
        bonds typically return 3-5%. Inflation has historically averaged 2-3% in developed
        economies. Be conservative with your estimates for more realistic projections.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  liquidAssetsInterestRate: number
  inflationRate: number
}>()

const emit = defineEmits<{
  'update:liquidAssetsInterestRate': [value: number]
  'update:inflationRate': [value: number]
}>()

const suggestedReturns = [
  { label: 'Conservative', value: 4.0 },
  { label: 'Moderate', value: 7.0 },
  { label: 'Aggressive', value: 10.0 },
]

const suggestedInflation = [
  { label: 'Low', value: 2.0 },
  { label: 'Moderate', value: 3.0 },
  { label: 'High', value: 4.0 },
]

const realReturn = computed(() => {
  // Calculate real return: (1 + nominal) / (1 + inflation) - 1
  return ((1 + props.liquidAssetsInterestRate / 100) / (1 + props.inflationRate / 100) - 1) * 100
})

function handleLiquidAssetsRateChange(event: Event) {
  const target = event.target as HTMLInputElement
  const value = parseFloat(target.value)
  if (!isNaN(value) && value >= 0 && value <= 100) {
    emit('update:liquidAssetsInterestRate', value)
  }
}

function handleInflationRateChange(event: Event) {
  const target = event.target as HTMLInputElement
  const value = parseFloat(target.value)
  if (!isNaN(value) && value >= 0 && value <= 20) {
    emit('update:inflationRate', value)
  }
}

function setLiquidAssetsRate(value: number) {
  emit('update:liquidAssetsInterestRate', value)
}

function setInflationRate(value: number) {
  emit('update:inflationRate', value)
}
</script>

<style scoped>
.returns-inflation-step {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.step-title {
  font-size: 1.5rem;
  color: #2c3e50;
  margin: 0;
  font-weight: 700;
}

.step-description {
  font-size: 1rem;
  color: #495057;
  line-height: 1.6;
  margin: 0;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-label {
  font-size: 1.05rem;
  color: #2c3e50;
  font-weight: 600;
}

.field-description {
  font-size: 0.9rem;
  color: #6c757d;
  line-height: 1.5;
}

.number-input {
  padding: 0.75rem;
  border: 2px solid #dee2e6;
  border-radius: 6px;
  font-size: 1.1rem;
  font-weight: 600;
  width: 150px;
  transition: border-color 0.2s;
  background-color: white;
}

.number-input:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 3px rgba(66, 185, 131, 0.1);
}

.field-hint {
  margin-top: 0.5rem;
}

.suggestion-chips {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.chip {
  padding: 0.5rem 1rem;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 20px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  font-weight: 500;
  color: #495057;
}

.chip:hover {
  background-color: #e9ecef;
  border-color: #adb5bd;
}

.chip.active {
  background-color: #42b983;
  border-color: #42b983;
  color: white;
  font-weight: 600;
}

.real-return-display {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 2px solid #42b983;
  border-radius: 8px;
  margin-top: 0.5rem;
}

.real-return-icon {
  font-size: 2rem;
  line-height: 1;
}

.real-return-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.real-return-label {
  font-size: 0.9rem;
  color: #6c757d;
  font-weight: 600;
}

.real-return-value {
  font-size: 1.5rem;
  color: #42b983;
  font-weight: 700;
}

.info-box {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background-color: #fff8e7;
  border-left: 4px solid #ffc107;
  border-radius: 4px;
}

.info-icon {
  font-size: 1.25rem;
  line-height: 1;
  flex-shrink: 0;
}

.info-content {
  font-size: 0.9rem;
  color: #856404;
  line-height: 1.5;
}

.info-content strong {
  font-weight: 700;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .step-title {
    font-size: 1.3rem;
  }

  .step-description {
    font-size: 0.95rem;
  }

  .field-label {
    font-size: 1rem;
  }

  .field-description {
    font-size: 0.85rem;
  }

  .number-input {
    padding: 0.65rem;
    font-size: 1rem;
    width: 130px;
  }

  .chip {
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
  }

  .real-return-display {
    padding: 0.875rem;
  }

  .real-return-icon {
    font-size: 1.75rem;
  }

  .real-return-value {
    font-size: 1.3rem;
  }

  .info-box {
    padding: 0.875rem;
  }

  .info-content {
    font-size: 0.85rem;
  }
}

@media (max-width: 480px) {
  .returns-inflation-step {
    gap: 1.25rem;
  }

  .step-title {
    font-size: 1.2rem;
  }

  .step-description {
    font-size: 0.9rem;
  }

  .form-section {
    gap: 1.25rem;
  }

  .field-label {
    font-size: 0.95rem;
  }

  .field-description {
    font-size: 0.8rem;
  }

  .number-input {
    padding: 0.6rem;
    font-size: 0.95rem;
    width: 120px;
  }

  .suggestion-chips {
    gap: 0.4rem;
  }

  .chip {
    padding: 0.35rem 0.7rem;
    font-size: 0.75rem;
  }

  .real-return-display {
    padding: 0.75rem;
    gap: 0.75rem;
  }

  .real-return-icon {
    font-size: 1.5rem;
  }

  .real-return-label {
    font-size: 0.8rem;
  }

  .real-return-value {
    font-size: 1.1rem;
  }

  .info-box {
    padding: 0.75rem;
    gap: 0.5rem;
  }

  .info-icon {
    font-size: 1.1rem;
  }

  .info-content {
    font-size: 0.8rem;
  }
}
</style>
