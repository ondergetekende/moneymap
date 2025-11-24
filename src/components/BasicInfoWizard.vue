<template>
  <teleport to="body">
    <div v-if="isOpen" class="wizard-overlay" @click.self="handleCancel">
      <div class="wizard-container">
        <div class="wizard-header">
          <h2>Basic Information Setup</h2>
          <button @click="handleCancel" class="close-button" aria-label="Close">&times;</button>
        </div>

        <div class="wizard-progress">
          <button
            v-for="step in totalSteps"
            :key="step"
            class="progress-step"
            :class="{
              active: step === currentStep,
              completed: step < currentStep,
            }"
            @click="goToStep(step)"
            type="button"
          >
            <div class="progress-circle">{{ step }}</div>
            <div class="progress-label">{{ getStepLabel(step) }}</div>
          </button>
        </div>

        <div class="wizard-content">
          <BirthDateStep
            v-if="currentStep === 1"
            :birthDate="store.birthDate"
            :currentAge="currentAge"
            @update:birthDate="store.setBirthDate($event)"
          />
          <JurisdictionStep
            v-if="currentStep === 2"
            :taxCountry="store.taxCountry"
            @update:taxCountry="store.setTaxCountry($event)"
          />
          <ReturnsInflationStep
            v-if="currentStep === 3"
            :liquidAssetsInterestRate="store.liquidAssetsInterestRate"
            :inflationRate="store.inflationRate"
            @update:liquidAssetsInterestRate="store.setLiquidAssetsInterestRate($event)"
            @update:inflationRate="store.setInflationRate($event)"
          />
          <LifeEventsStep v-if="currentStep === 4" />
        </div>

        <div class="wizard-footer">
          <button v-if="currentStep > 1" @click="goBack" class="wizard-button secondary">
            Back
          </button>
          <div class="spacer"></div>
          <button
            v-if="currentStep < totalSteps"
            @click="goNext"
            class="wizard-button primary"
            :disabled="!canProceed"
          >
            Next
          </button>
          <button
            v-if="currentStep === totalSteps"
            @click="finish"
            class="wizard-button primary"
            :disabled="!canProceed"
          >
            Finish
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { getAgeInYears } from '@/types/month'
import { usePlannerStore } from '@/stores/planner'
import BirthDateStep from './wizard/BirthDateStep.vue'
import JurisdictionStep from './wizard/JurisdictionStep.vue'
import ReturnsInflationStep from './wizard/ReturnsInflationStep.vue'
import LifeEventsStep from './wizard/LifeEventsStep.vue'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const store = usePlannerStore()

const currentStep = ref(1)
const totalSteps = 4

// Watch for wizard opening to reset to first step
watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      currentStep.value = 1
    }
  },
)

const currentAge = computed(() => {
  return store.birthDate ? getAgeInYears(store.birthDate) : null
})

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 1:
      return store.birthDate !== undefined && store.birthDate !== null
    case 2:
      return true // Tax country is optional
    case 3:
      return (
        store.liquidAssetsInterestRate >= 0 &&
        store.liquidAssetsInterestRate <= 100 &&
        store.inflationRate >= 0 &&
        store.inflationRate <= 20
      )
    case 4:
      return true // Life events are optional
    default:
      return false
  }
})

function getStepLabel(step: number): string {
  switch (step) {
    case 1:
      return 'Birth Date'
    case 2:
      return 'Jurisdiction'
    case 3:
      return 'Returns & Inflation'
    case 4:
      return 'Life Events'
    default:
      return ''
  }
}

function goToStep(step: number) {
  if (step >= 1 && step <= totalSteps) {
    currentStep.value = step
  }
}

function goNext() {
  if (currentStep.value < totalSteps && canProceed.value) {
    currentStep.value++
  }
}

function goBack() {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

function finish() {
  if (canProceed.value) {
    store.completeWizardWithDefaults()
    emit('close')
  }
}

function handleCancel() {
  emit('close')
}
</script>

<style scoped>
.wizard-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.wizard-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.wizard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #dee2e6;
}

.wizard-header h2 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.5rem;
}

.close-button {
  background: none;
  border: none;
  font-size: 2rem;
  color: #6c757d;
  cursor: pointer;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: color 0.2s;
}

.close-button:hover {
  color: #2c3e50;
}

.wizard-progress {
  display: flex;
  justify-content: space-between;
  padding: 2rem 1.5rem 1.5rem;
  position: relative;
}

.wizard-progress::before {
  content: '';
  position: absolute;
  top: 2.75rem;
  left: 20%;
  right: 20%;
  height: 2px;
  background-color: #dee2e6;
  z-index: 0;
}

.progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  position: relative;
  z-index: 1;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: transform 0.2s;
}

.progress-step:hover {
  transform: translateY(-2px);
}

.progress-step:active {
  transform: translateY(0);
}

.progress-circle {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background-color: #e9ecef;
  color: #6c757d;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  transition: all 0.3s;
}

.progress-step:hover .progress-circle {
  background-color: #dee2e6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.progress-step.active .progress-circle {
  background-color: #42b983;
  color: white;
  transform: scale(1.1);
}

.progress-step.completed .progress-circle {
  background-color: #42b983;
  color: white;
}

.progress-label {
  font-size: 0.85rem;
  color: #6c757d;
  text-align: center;
  font-weight: 600;
}

.progress-step.active .progress-label {
  color: #2c3e50;
}

.wizard-content {
  padding: 2rem 1.5rem;
  flex: 1;
  overflow-y: auto;
}

.wizard-footer {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid #dee2e6;
}

.spacer {
  flex: 1;
}

.wizard-button {
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.wizard-button.primary {
  background-color: #42b983;
  color: white;
}

.wizard-button.primary:hover:not(:disabled) {
  background-color: #359268;
}

.wizard-button.primary:disabled {
  background-color: #cbd5e0;
  cursor: not-allowed;
  opacity: 0.6;
}

.wizard-button.secondary {
  background-color: #e9ecef;
  color: #2c3e50;
}

.wizard-button.secondary:hover {
  background-color: #dee2e6;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .wizard-overlay {
    padding: 0.5rem;
  }

  .wizard-header {
    padding: 1rem;
  }

  .wizard-header h2 {
    font-size: 1.25rem;
  }

  .wizard-progress {
    padding: 1.5rem 1rem 1rem;
  }

  .progress-circle {
    width: 2rem;
    height: 2rem;
    font-size: 0.9rem;
  }

  .progress-label {
    font-size: 0.75rem;
  }

  .wizard-content {
    padding: 1.5rem 1rem;
  }

  .wizard-footer {
    padding: 1rem;
  }

  .wizard-button {
    padding: 0.6rem 1.2rem;
    font-size: 0.9rem;
  }
}

@media (max-width: 480px) {
  .wizard-header h2 {
    font-size: 1.1rem;
  }

  .close-button {
    font-size: 1.5rem;
    width: 1.5rem;
    height: 1.5rem;
  }

  .wizard-progress {
    padding: 1rem 0.5rem 0.75rem;
  }

  .progress-circle {
    width: 1.75rem;
    height: 1.75rem;
    font-size: 0.8rem;
  }

  .progress-label {
    font-size: 0.7rem;
  }

  .wizard-content {
    padding: 1rem 0.75rem;
  }

  .wizard-footer {
    padding: 0.75rem;
    gap: 0.5rem;
  }

  .wizard-button {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
  }
}
</style>
