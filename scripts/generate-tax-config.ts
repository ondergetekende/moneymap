#!/usr/bin/env node
/**
 * Tax Configuration Generator
 *
 * Generates tax configuration files for countries using an LLM via OpenRouter API.
 *
 * Usage:
 *   npm run generate-tax <COUNTRY_CODE>
 *
 * The script will automatically load OPENROUTER_API_KEY from a .env file in the
 * current working directory if present. Alternatively, you can set it inline:
 *
 *   OPENROUTER_API_KEY=sk-xxx npm run generate-tax <COUNTRY_CODE>
 *
 * Example:
 *   npm run generate-tax DE
 *   npm run generate-tax FR
 *
 * .env file format:
 *   OPENROUTER_API_KEY=sk-or-v1-xxxxx
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Type definitions matching the taxConfig.ts structure
interface TaxBracket {
  threshold: number
  rate: number
}

type TaxType = 'income' | 'wealth' | 'capital_gains'

interface TaxOption {
  id: string
  name: string
  type: TaxType
  isDefault: boolean
  rate?: number
  brackets?: TaxBracket[]
  exemptionThreshold?: number
  notes?: string
}

interface CountryTaxConfig {
  countryCode: string
  countryName: string
  incomeTaxes: TaxOption[]
  wealthTaxes: TaxOption[]
  capitalGainsTaxes: TaxOption[]
  sources?: string[]
}

// Configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'anthropic/claude-3.5-sonnet' // Using a capable model for accurate research

/**
 * Load environment variables from .env file if present
 */
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env')

  if (!fs.existsSync(envPath)) {
    return // No .env file, skip
  }

  try {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    const lines = envContent.split('\n')

    for (const line of lines) {
      // Skip empty lines and comments
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        continue
      }

      // Parse key=value
      const match = trimmed.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        let value = match[2].trim()

        // Remove surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }

        // Only set if not already in environment
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    }

    console.log('✓ Loaded environment variables from .env\n')
  } catch (error) {
    console.warn('Warning: Failed to load .env file:', error instanceof Error ? error.message : String(error))
  }
}

/**
 * Main function
 */
async function main() {
  // Load .env file first
  loadEnvFile()

  // Parse command line arguments
  const countryCode = process.argv[2]?.toUpperCase()

  if (!countryCode) {
    console.error('Error: Country code is required')
    console.error('Usage: npm run generate-tax <COUNTRY_CODE>')
    console.error('Example: npm run generate-tax DE')
    process.exit(1)
  }

  // Check for API key
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.error('Error: OPENROUTER_API_KEY environment variable is not set')
    console.error('Please set it before running this script:')
    console.error('  OPENROUTER_API_KEY=sk-xxx npm run generate-tax', countryCode)
    process.exit(1)
  }

  console.log(`Generating tax configuration for country: ${countryCode}`)
  console.log('Querying LLM for tax information...\n')

  try {
    // Generate the prompt
    const prompt = createPrompt(countryCode)

    // Call OpenRouter API
    const taxConfig = await fetchTaxConfigFromLLM(apiKey, prompt)

    // Validate the response
    validateTaxConfig(taxConfig)

    // Write to file
    const outputPath = path.join(__dirname, '..', 'src', 'config', `tax.${countryCode}.json`)
    fs.writeFileSync(outputPath, JSON.stringify(taxConfig, null, 2))

    console.log('\n✅ Success!')
    console.log(`Tax configuration written to: ${outputPath}`)
    console.log('\nGenerated configuration:')
    console.log(JSON.stringify(taxConfig, null, 2))

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

/**
 * Create a detailed prompt for the LLM
 */
function createPrompt(countryCode: string): string {
  return `You are a tax research assistant. I need you to research the current tax system for country code "${countryCode}" and provide a comprehensive tax configuration.

IMPORTANT: You must respond with ONLY a valid JSON object. Do not include any markdown formatting, code blocks, or explanatory text. Just return the raw JSON.

The JSON must follow this exact structure:

{
  "countryCode": "${countryCode}",
  "countryName": "Full Country Name",
  "incomeTaxes": [
    {
      "id": "unique-id-lowercase",
      "name": "Descriptive Name",
      "type": "income",
      "isDefault": true,
      "rate": 25.5,  // OR use "brackets" (not both)
      "brackets": [  // For progressive tax systems
        { "threshold": 0, "rate": 10 },
        { "threshold": 50000, "rate": 20 }
      ],
      "exemptionThreshold": 12000,  // Optional
      "notes": "Additional context and tax year"
    }
  ],
  "wealthTaxes": [
    // Same structure as above, or empty array if no wealth tax exists
  ],
  "capitalGainsTaxes": [
    // Same structure as above with type: "capital_gains"
  ],
  "sources": [
    "https://example.com/official-tax-authority",
    "https://en.wikipedia.org/wiki/..."
  ]
}

Research Requirements:
1. Use the MOST RECENT tax year data available (2024 or 2025)
2. Include ALL major tax variants (e.g., for US: single filer, married filing jointly)
3. For income tax: Include progressive brackets if applicable, or flat rate
4. For wealth tax: Include if the country has one (many don't)
5. For capital gains tax: Include short-term and long-term variants if applicable
6. Set "isDefault: true" for the most common/standard option in each category
7. Include exemption thresholds where applicable
8. Add detailed notes explaining the tax system, filing status, and tax year
9. Provide authoritative sources (government websites, Wikipedia)

Naming conventions:
- id: Use format "{country-code-lowercase}-{tax-type}-{variant}" (e.g., "de-income-single", "fr-wealth")
- name: Clear, user-friendly description (e.g., "Federal Income Tax (Single Filer)")
- Use actual currency thresholds (not simplified)

Special cases:
- If a country has NO wealth tax, include one entry with rate: 0 and appropriate notes
- If a country has NO capital gains tax, include one entry with rate: 0 and appropriate notes
- For countries with regional variations (like US states or UK nations), focus on federal/national level but mention regional differences in notes

Remember: Respond with ONLY the JSON object, no additional text or formatting.`
}

/**
 * Fetch tax configuration from OpenRouter API
 */
async function fetchTaxConfigFromLLM(apiKey: string, prompt: string): Promise<CountryTaxConfig> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/ondergetekende/financial-planner',
      'X-Title': 'MoneyMap Tax Config Generator'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Lower temperature for more consistent, factual output
      max_tokens: 4000
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response format from OpenRouter API')
  }

  const content = data.choices[0].message.content.trim()

  // Try to extract JSON from the response (in case LLM adds markdown formatting)
  let jsonText = content

  // Remove markdown code blocks if present
  if (content.includes('```json')) {
    const match = content.match(/```json\n([\s\S]*?)\n```/)
    if (match) {
      jsonText = match[1]
    }
  } else if (content.includes('```')) {
    const match = content.match(/```\n([\s\S]*?)\n```/)
    if (match) {
      jsonText = match[1]
    }
  }

  try {
    const taxConfig = JSON.parse(jsonText)
    return taxConfig as CountryTaxConfig
  } catch (error) {
    console.error('Failed to parse LLM response as JSON:')
    console.error(content)
    throw new Error(`Failed to parse JSON from LLM response: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Validate the tax configuration structure
 */
function validateTaxConfig(config: any): asserts config is CountryTaxConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('Tax config must be an object')
  }

  // Required fields
  const requiredFields = ['countryCode', 'countryName', 'incomeTaxes', 'wealthTaxes', 'capitalGainsTaxes']
  for (const field of requiredFields) {
    if (!(field in config)) {
      throw new Error(`Missing required field: ${field}`)
    }
  }

  // Validate arrays
  if (!Array.isArray(config.incomeTaxes)) {
    throw new Error('incomeTaxes must be an array')
  }
  if (!Array.isArray(config.wealthTaxes)) {
    throw new Error('wealthTaxes must be an array')
  }
  if (!Array.isArray(config.capitalGainsTaxes)) {
    throw new Error('capitalGainsTaxes must be an array')
  }

  // Validate each tax option
  const allTaxes = [
    ...config.incomeTaxes,
    ...config.wealthTaxes,
    ...config.capitalGainsTaxes
  ]

  for (const tax of allTaxes) {
    if (!tax.id || typeof tax.id !== 'string') {
      throw new Error('Each tax option must have a string id')
    }
    if (!tax.name || typeof tax.name !== 'string') {
      throw new Error('Each tax option must have a string name')
    }
    if (!tax.type || !['income', 'wealth', 'capital_gains'].includes(tax.type)) {
      throw new Error(`Invalid tax type: ${tax.type}`)
    }
    if (typeof tax.isDefault !== 'boolean') {
      throw new Error('Each tax option must have a boolean isDefault field')
    }

    // Must have either rate or brackets, not both
    const hasRate = 'rate' in tax && tax.rate !== undefined
    const hasBrackets = 'brackets' in tax && Array.isArray(tax.brackets) && tax.brackets.length > 0

    if (!hasRate && !hasBrackets) {
      throw new Error(`Tax option ${tax.id} must have either rate or brackets`)
    }
    if (hasRate && hasBrackets) {
      throw new Error(`Tax option ${tax.id} cannot have both rate and brackets`)
    }

    // Validate brackets if present
    if (hasBrackets) {
      for (const bracket of tax.brackets) {
        if (typeof bracket.threshold !== 'number' || typeof bracket.rate !== 'number') {
          throw new Error(`Invalid bracket in ${tax.id}: must have numeric threshold and rate`)
        }
      }
    }
  }

  // Check that at least one default exists for each type
  const hasDefaultIncome = config.incomeTaxes.some((t: any) => t.isDefault)
  const hasDefaultWealth = config.wealthTaxes.some((t: any) => t.isDefault)
  const hasDefaultCapitalGains = config.capitalGainsTaxes.some((t: any) => t.isDefault)

  if (!hasDefaultIncome && config.incomeTaxes.length > 0) {
    throw new Error('At least one income tax must be marked as default')
  }
  if (!hasDefaultWealth && config.wealthTaxes.length > 0) {
    throw new Error('At least one wealth tax must be marked as default')
  }
  if (!hasDefaultCapitalGains && config.capitalGainsTaxes.length > 0) {
    throw new Error('At least one capital gains tax must be marked as default')
  }

  console.log('✓ Validation passed')
}

// Run the script
main().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
