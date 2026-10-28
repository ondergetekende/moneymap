<template>
  <teleport to="body">
    <div v-if="isOpen" class="wizard-overlay" @click.self="handleCancel">
      <div class="wizard-container">
        <div class="wizard-header">
          <h2>Set up your plan</h2>
          <button @click="handleCancel" class="close-button" aria-label="Close">&times;</button>
        </div>

        <div class="wizard-progress">
          <p class="progress-text">
            Step {{ currentStep }} of {{ totalSteps }}:
            <strong>{{ getStepLabel(currentStep) }}</strong>
          </p>
          <div class="progress-bar">
            <button
              v-for="step in totalSteps"
              :key="step"
              class="progress-segment"
              :class="{ done: step <= currentStep }"
              :aria-label="`Go to step ${step}: ${getStepLabel(step)}`"
              :aria-current="step === currentStep ? 'step' : undefined"
              @click="goToStep(step)"
              type="button"
            />
          </div>
        </div>

        <div ref="contentEl" class="wizard-content">
          <Transition name="step-fade" mode="out-in" @enter="onStepEnter">
            <div :key="currentStep">
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
              <PrimaryAccountStep v-if="currentStep === 5" />
            </div>
          </Transition>
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
import PrimaryAccountStep from './wizard/PrimaryAccountStep.vue'

const props = defineProps<{
  isOpen: boolean
  initialStep?: number
}>()

const emit = defineEmits<{
  close: []
}>()

const store = usePlannerStore()

const currentStep = ref(1)
const contentEl = ref<HTMLElement | null>(null)

// A new step starts at the top, or at its selected option when it has one.
function onStepEnter(el: Element) {
  if (contentEl.value) contentEl.value.scrollTop = 0
  el.querySelector('.selected')?.scrollIntoView({ block: 'center' })
}
const totalSteps = 5

// Watch for wizard opening to set initial step
watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      currentStep.value = props.initialStep ?? 1
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
    case 5:
      return true // Primary account is optional
    default:
      return false
  }
})

function getStepLabel(step: number): string {
  switch (step) {
    case 1:
      return 'Birth date'
    case 2:
      return 'Tax country'
    case 3:
      return 'Returns and inflation'
    case 4:
      return 'Life events'
    case 5:
      return 'Primary account'
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

<style scoped lang="scss">
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
  z-index: $z-index-overlay;
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
  padding: 1.25rem 1.5rem 0;
}

.wizard-header h2 {
  margin: 0;
  color: $text-primary;
  font-size: 1.25rem;
}

.close-button {
  background: none;
  border: none;
  font-size: 2rem;
  color: $text-light;
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
  color: $text-primary;
}

.wizard-progress {
  padding: 1rem 1.5rem 0;
}

.progress-text {
  font-size: 0.85rem;
  color: $text-muted;
  margin-bottom: 0.5rem;

  strong {
    color: $text-primary;
  }
}

.progress-bar {
  display: flex;
  gap: 4px;
}

.progress-segment {
  flex: 1;
  height: 6px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background-color: $border-light;
  cursor: pointer;
  transition: background-color 0.3s;

  &.done {
    background-color: $primary;
  }

  &:hover {
    background-color: $primary-hover;
  }
}

.wizard-content {
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;

  // Shared by all steps. The global .form-section box adds too much space inside the modal.
  :deep(.form-section) {
    margin: 0;
    padding: 0;
    background: none;
  }

  :deep(.step-title) {
    font-size: 1.375rem;
    font-weight: 700;
    color: $text-primary;
    margin: 0;
  }

  // Pull the intro closer to its title; the step roots use a 1.5rem flex gap.
  :deep(.step-description) {
    color: $text-tertiary;
    margin: -1rem 0 0;
  }
}

.step-fade-enter-active,
.step-fade-leave-active {
  transition: opacity 0.15s ease;
}

.step-fade-enter-from,
.step-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .step-fade-enter-active,
  .step-fade-leave-active {
    transition: none;
  }
}

.wizard-footer {
  display: flex;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid $border-light;
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
  background-color: $primary;
  color: white;
}

.wizard-button.primary:hover:not(:disabled) {
  background-color: $primary-hover;
}

.wizard-button.primary:disabled {
  background-color: #cbd5e0;
  cursor: not-allowed;
  opacity: 0.6;
}

.wizard-button.secondary {
  background-color: $bg-alt;
  color: $text-primary;
}

.wizard-button.secondary:hover {
  background-color: $border-light;
}

/* Mobile responsive */
@media (max-width: $breakpoint-mobile) {
  .wizard-overlay {
    padding: 0;
  }

  .wizard-container {
    height: 100dvh;
    max-height: none;
    border-radius: 0;
  }

  .wizard-header,
  .wizard-progress {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .wizard-content {
    padding: 1.25rem 1rem;
  }

  .wizard-footer {
    padding: 0.75rem 1rem;
  }
}

@media (max-width: $breakpoint-mobile-small) {
  .wizard-header,
  .wizard-progress {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  .wizard-content {
    padding: 1rem 0.75rem;
  }

  .wizard-footer {
    padding: 0.75rem;
    gap: 0.5rem;
  }
}
</style>
