/**
 * LocalStorage service for persisting user data
 */

import { UserProfile } from '@/models'

const STORAGE_KEY = 'moneymap-data'
const WIZARD_KEY = 'moneymap-wizard-completed'
const SCENARIOS_KEY = 'moneymap-scenarios'

export interface StoredScenario {
  id: string
  name: string
  profile: Record<string, unknown>
  wizardCompleted: boolean
}

export interface StoredPlans {
  activeId: string
  scenarios: StoredScenario[]
}

export const storageService = {
  savePlans(plans: StoredPlans): void {
    try {
      localStorage.setItem(SCENARIOS_KEY, JSON.stringify(plans))
    } catch (error) {
      console.error('Failed to save plans:', error)
      throw new Error('Failed to save plans. Your changes are not saved.')
    }
  },

  loadPlans(): StoredPlans | null {
    const serialized = localStorage.getItem(SCENARIOS_KEY)
    if (serialized === null) return null
    try {
      const data: unknown = JSON.parse(serialized)
      if (!data || typeof data !== 'object' || !('activeId' in data) || !('scenarios' in data)) {
        throw new Error('Invalid plans')
      }
      const { activeId, scenarios } = data
      if (
        typeof activeId !== 'string' ||
        !Array.isArray(scenarios) ||
        scenarios.length === 0 ||
        !scenarios.every(
          (scenario) =>
            scenario &&
            typeof scenario.id === 'string' &&
            typeof scenario.name === 'string' &&
            typeof scenario.wizardCompleted === 'boolean' &&
            scenario.profile &&
            typeof scenario.profile === 'object' &&
            !Array.isArray(scenario.profile) &&
            typeof scenario.profile.birthDate === 'number' &&
            Number.isFinite(scenario.profile.birthDate) &&
            Array.isArray(scenario.profile.capitalAccounts) &&
            Array.isArray(scenario.profile.cashFlows) &&
            Array.isArray(scenario.profile.debts) &&
            Array.isArray(scenario.profile.lifeEvents),
        ) ||
        new Set(scenarios.map((scenario) => scenario.id)).size !== scenarios.length ||
        !scenarios.some((scenario) => scenario.id === activeId)
      ) {
        throw new Error('Invalid plans')
      }
      for (const scenario of scenarios) UserProfile.fromJSON(scenario.profile)
      return { activeId, scenarios }
    } catch (error) {
      console.error('Failed to load plans:', error)
      throw new Error('Failed to load saved plans. Your saved data has not been changed.')
    }
  },
  /**
   * Save user profile to localStorage
   */
  saveProfile(profile: UserProfile): void {
    try {
      // Use the class's toJSON method for proper serialization
      const serialized = JSON.stringify(profile.toJSON())
      localStorage.setItem(STORAGE_KEY, serialized)
    } catch (error) {
      console.error('Failed to save profile to localStorage:', error)
      throw new Error('Failed to save data')
    }
  },

  /**
   * Load user profile from localStorage
   */
  loadProfile(): UserProfile | null {
    try {
      const serialized = localStorage.getItem(STORAGE_KEY)
      if (!serialized) {
        return null
      }
      const data = JSON.parse(serialized)
      // Use the class's fromJSON method to deserialize into class instance
      return UserProfile.fromJSON(data)
    } catch (error) {
      console.error('Failed to load profile from localStorage:', error)
      return null
    }
  },

  /**
   * Clear all saved data
   */
  clearProfile(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Failed to clear profile from localStorage:', error)
    }
  },

  /**
   * Check if saved data exists
   */
  hasProfile(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null
  },

  /**
   * Save wizard completion state
   */
  saveWizardCompleted(completed: boolean): void {
    try {
      localStorage.setItem(WIZARD_KEY, JSON.stringify(completed))
    } catch (error) {
      console.error('Failed to save wizard state:', error)
    }
  },

  /**
   * Load wizard completion state
   */
  loadWizardCompleted(): boolean | null {
    try {
      const state = localStorage.getItem(WIZARD_KEY)
      return state !== null ? JSON.parse(state) : null
    } catch (error) {
      console.error('Failed to load wizard state:', error)
      return null
    }
  },

  /**
   * Clear wizard completion state
   */
  clearWizardCompleted(): void {
    try {
      localStorage.removeItem(WIZARD_KEY)
    } catch (error) {
      console.error('Failed to clear wizard state:', error)
    }
  },
}
