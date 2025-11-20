<template>
  <div class="jurisdiction-step">
    <h3 class="step-title">Where do you pay taxes?</h3>
    <p class="step-description">
      Select your tax jurisdiction to enable accurate tax calculations for your financial
      projections. Different countries have different income tax, wealth tax, and capital gains tax
      structures. You can skip this step if you don't want to include taxes in your calculations.
    </p>

    <div class="form-section">
      <label class="form-label">Tax Country</label>

      <div class="country-options">
        <label class="country-option" :class="{ selected: taxCountry === undefined }">
          <input
            type="radio"
            name="tax-country"
            :value="undefined"
            :checked="taxCountry === undefined"
            @change="handleCountryChange(undefined)"
            class="country-radio"
          />
          <div class="country-card">
            <div class="country-info">
              <div class="country-name">No Country</div>
              <div class="country-description">Skip tax calculations</div>
            </div>
          </div>
        </label>

        <label
          v-for="country in availableCountries"
          :key="country.countryCode"
          class="country-option"
          :class="{ selected: taxCountry === country.countryCode }"
        >
          <input
            type="radio"
            name="tax-country"
            :value="country.countryCode"
            :checked="taxCountry === country.countryCode"
            @change="handleCountryChange(country.countryCode)"
            class="country-radio"
          />
          <div class="country-card">
            <div class="country-info">
              <div class="country-name">{{ country.countryName }}</div>
              <div class="country-description">{{ country.countryCode }}</div>
            </div>
          </div>
        </label>
      </div>
    </div>

    <div v-if="taxCountry" class="info-box">
      <div class="info-content">
        <strong>Tax calculations enabled</strong> for {{ selectedCountryName }}. You'll be able to
        configure specific tax options for your income, wealth, and capital gains later.
      </div>
    </div>

    <div v-else class="info-box neutral">
      <div class="info-content">
        <strong>No tax calculations:</strong> Your projections will not include any tax deductions.
        You can change this setting later.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TAX_CONFIGS } from '@/config/taxConfig'

const props = defineProps<{
  taxCountry?: string
}>()

const emit = defineEmits<{
  'update:taxCountry': [value: string | undefined]
}>()

const availableCountries = computed(() => {
  return Object.values(TAX_CONFIGS).sort((a, b) => a.countryName.localeCompare(b.countryName))
})

const selectedCountryName = computed(() => {
  if (!props.taxCountry) return ''
  const config = TAX_CONFIGS[props.taxCountry]
  return config ? config.countryName : props.taxCountry
})

function handleCountryChange(countryCode: string | undefined) {
  emit('update:taxCountry', countryCode)
}
</script>

<style scoped>
.jurisdiction-step {
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
  gap: 1rem;
}

.form-label {
  font-size: 1.1rem;
  color: #2c3e50;
  font-weight: 600;
}

.country-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.country-option {
  position: relative;
  cursor: pointer;
}

.country-radio {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.country-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background-color: white;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  transition: all 0.2s;
}

.country-option:hover .country-card {
  border-color: #42b983;
  box-shadow: 0 2px 8px rgba(66, 185, 131, 0.15);
}

.country-option.selected .country-card {
  border-color: #42b983;
  background-color: #f0fdf8;
  box-shadow: 0 2px 12px rgba(66, 185, 131, 0.2);
}

.country-flag {
  font-size: 2rem;
  line-height: 1;
  flex-shrink: 0;
}

.country-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.country-name {
  font-size: 1rem;
  font-weight: 600;
  color: #2c3e50;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.country-description {
  font-size: 0.85rem;
  color: #6c757d;
}

.info-box {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background-color: #e7f5f0;
  border-left: 4px solid #42b983;
  border-radius: 4px;
}

.info-box.neutral {
  background-color: #e7f3ff;
  border-left-color: #3b82f6;
}

.info-icon {
  font-size: 1.25rem;
  line-height: 1;
  flex-shrink: 0;
}

.info-content {
  font-size: 0.9rem;
  color: #1e3a5f;
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

  .country-options {
    grid-template-columns: 1fr;
  }

  .country-card {
    padding: 0.875rem;
  }

  .country-flag {
    font-size: 1.75rem;
  }

  .info-box {
    padding: 0.875rem;
  }

  .info-content {
    font-size: 0.85rem;
  }
}

@media (max-width: 480px) {
  .jurisdiction-step {
    gap: 1.25rem;
  }

  .step-title {
    font-size: 1.2rem;
  }

  .step-description {
    font-size: 0.9rem;
  }

  .form-label {
    font-size: 1rem;
  }

  .country-card {
    padding: 0.75rem;
    gap: 0.6rem;
  }

  .country-flag {
    font-size: 1.5rem;
  }

  .country-name {
    font-size: 0.9rem;
  }

  .country-description {
    font-size: 0.8rem;
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
