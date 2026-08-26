import { describe, it, expect, vi, beforeEach } from 'vitest'
import { storageService } from '@/services/storage'
import { UserProfile } from '@/models/profile'
import { LiquidAsset } from '@/models/assets'

describe('Storage Service', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('should save and load profile', () => {
    const asset = new LiquidAsset('a1', 'Savings', 1000)
    const profile = new UserProfile(1200, [asset], [], 5)

    storageService.saveProfile(profile)

    const loadedProfile = storageService.loadProfile()
    expect(loadedProfile).not.toBeNull()
    const profileInstance = loadedProfile!
    expect(profileInstance.birthDate).toBe(profile.birthDate)
    expect(profileInstance.capitalAccounts).toHaveLength(1)
    expect(profileInstance.capitalAccounts[0]!.name).toBe('Savings')
  })

  it('should return null when loading non-existent profile', () => {
    expect(storageService.loadProfile()).toBeNull()
  })

  it('should clear profile', () => {
    const asset = new LiquidAsset('a1', 'Savings', 1000)
    const profile = new UserProfile(1200, [asset], [], 5)
    storageService.saveProfile(profile)

    storageService.clearProfile()
    expect(storageService.hasProfile()).toBe(false)
    expect(storageService.loadProfile()).toBeNull()
  })

  it('should check if profile exists', () => {
    expect(storageService.hasProfile()).toBe(false)
    const asset = new LiquidAsset('a1', 'Savings', 1000)
    const profile = new UserProfile(1200, [asset], [], 5)
    storageService.saveProfile(profile)
    expect(storageService.hasProfile()).toBe(true)
  })

  it('should save and load wizard completion state', () => {
    storageService.saveWizardCompleted(true)
    expect(storageService.loadWizardCompleted()).toBe(true)

    storageService.saveWizardCompleted(false)
    expect(storageService.loadWizardCompleted()).toBe(false)
  })

  it('should return null when loading non-existent wizard state', () => {
    expect(storageService.loadWizardCompleted()).toBeNull()
  })

  it('should clear wizard completion state', () => {
    storageService.saveWizardCompleted(true)
    storageService.clearWizardCompleted()
    expect(storageService.loadWizardCompleted()).toBeNull()
  })

  it('should handle errors gracefully during saveProfile', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Mock localStorage.setItem to throw error
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('LocalStorage error')
    })

    const asset = new LiquidAsset('a1', 'Savings', 1000)
    const profile = new UserProfile(1200, [asset], [], 5)

    expect(() => storageService.saveProfile(profile)).toThrow('Failed to save data')
    expect(consoleSpy).toHaveBeenCalled()

    setItemSpy.mockRestore()
    consoleSpy.mockRestore()
  })
})
