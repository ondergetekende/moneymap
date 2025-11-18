/**
 * Tax Configuration System
 *
 * Defines tax structures for income tax, wealth tax, and capital gains tax
 * across multiple countries. Supports both flat rates and progressive bracket systems.
 */

/**
 * Represents a single tax bracket in a progressive tax system
 */
export interface TaxBracket {
  /** Amount (in currency) where this bracket starts */
  threshold: number
  /** Tax rate as a percentage (e.g., 25 for 25%) */
  rate: number
}

/**
 * Tax type enum
 */
export type TaxType = 'income' | 'wealth' | 'capital_gains'

/**
 * Represents a single tax option within a country's tax system
 */
export interface TaxOption {
  /** Unique identifier (e.g., 'nl-box1', 'us-federal-single') */
  id: string

  /** Display name for UI */
  name: string

  /** Type of tax */
  type: TaxType

  /** Whether this is the default tax option for this type in this country */
  isDefault: boolean

  /** Flat tax rate (percentage). Use this OR brackets, not both. */
  rate?: number

  /** Progressive tax brackets. Use this OR rate, not both. */
  brackets?: TaxBracket[]

  /** Exemption threshold - no tax below this amount */
  exemptionThreshold?: number

  /** Additional notes or context */
  notes?: string
}

/**
 * Complete tax configuration for a country
 */
export interface CountryTaxConfig {
  /** ISO country code (e.g., 'NL', 'US', 'GB') */
  countryCode: string

  /** Display name for the country */
  countryName: string

  /** Income tax options */
  incomeTaxes: TaxOption[]

  /** Wealth tax options (empty array if country has no wealth tax) */
  wealthTaxes: TaxOption[]

  /** Capital gains tax options */
  capitalGainsTaxes: TaxOption[]

  /** Data sources or references */
  sources?: string[]
}

// =============================================================================
// JSON IMPORTS
// =============================================================================

// Import generated tax configurations from JSON files
import BE_TAX_CONFIG from './tax.BE.json'
import CA_TAX_CONFIG from './tax.CA.json'
import DE_TAX_CONFIG from './tax.DE.json'
import DK_TAX_CONFIG from './tax.DK.json'
import ES_TAX_CONFIG from './tax.ES.json'
import FR_TAX_CONFIG from './tax.FR.json'
import GB_TAX_CONFIG from './tax.GB.json'
import LU_TAX_CONFIG from './tax.LU.json'
import NL_TAX_CONFIG from './tax.NL.json'
import US_TAX_CONFIG from './tax.US.json'


// =============================================================================
// EXPORTS
// =============================================================================

/**
 * All available tax configurations indexed by country code
 */
export const TAX_CONFIGS: Record<string, CountryTaxConfig> = {
  BE: BE_TAX_CONFIG as CountryTaxConfig,
  CA: CA_TAX_CONFIG as CountryTaxConfig,
  DE: DE_TAX_CONFIG as CountryTaxConfig,
  DK: DK_TAX_CONFIG as CountryTaxConfig,
  ES: ES_TAX_CONFIG as CountryTaxConfig,
  FR: FR_TAX_CONFIG as CountryTaxConfig,
  GB: GB_TAX_CONFIG as CountryTaxConfig,
  LU: LU_TAX_CONFIG as CountryTaxConfig,
  NL: NL_TAX_CONFIG as CountryTaxConfig,
  US: US_TAX_CONFIG as CountryTaxConfig,
}

/**
 * List of all supported country codes
 */
export const SUPPORTED_COUNTRIES = Object.keys(TAX_CONFIGS).sort()

/**
 * Get tax configuration for a country
 */
export function getTaxConfig(countryCode: string): CountryTaxConfig | undefined {
  return TAX_CONFIGS[countryCode]
}

/**
 * Get all tax options of a specific type for a country
 */
export function getTaxOptions(
  countryCode: string,
  taxType: TaxType
): TaxOption[] {
  const config = getTaxConfig(countryCode)
  if (!config) return []

  switch (taxType) {
    case 'income':
      return config.incomeTaxes
    case 'wealth':
      return config.wealthTaxes
    case 'capital_gains':
      return config.capitalGainsTaxes
    default:
      return []
  }
}

/**
 * Get the default tax option for a country and tax type
 */
export function getDefaultTaxOption(
  countryCode: string,
  taxType: TaxType
): TaxOption | undefined {
  const options = getTaxOptions(countryCode, taxType)
  return options.find(option => option.isDefault)
}

/**
 * Find a specific tax option by ID
 */
export function findTaxOption(
  taxId: string,
  countryCode?: string
): TaxOption | undefined {
  if (countryCode) {
    // Search in specific country
    const config = getTaxConfig(countryCode)
    if (!config) return undefined

    const allOptions = [
      ...config.incomeTaxes,
      ...config.wealthTaxes,
      ...config.capitalGainsTaxes
    ]
    return allOptions.find(option => option.id === taxId)
  } else {
    // Search across all countries
    for (const config of Object.values(TAX_CONFIGS)) {
      const allOptions = [
        ...config.incomeTaxes,
        ...config.wealthTaxes,
        ...config.capitalGainsTaxes
      ]
      const found = allOptions.find(option => option.id === taxId)
      if (found) return found
    }
  }

  return undefined
}
