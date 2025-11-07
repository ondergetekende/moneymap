/**
 * LocalStorage service for persisting user data
 */

import { UserProfile } from '@/models'

const STORAGE_KEY = 'financial-planner-data'

export const storageService = {
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
}
