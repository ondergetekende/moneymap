/**
 * Base class for all financial models
 */

/**
 * Abstract base class for all financial items (assets and cash flows)
 * Provides common id and name fields with validation
 */
export abstract class FinancialItem {
  readonly id: string
  readonly name: string

  constructor(id: string, name: string) {
    if (!id) {
      throw new Error(`${this.constructor.name} id cannot be empty`)
    }
    if (!name.trim()) {
      throw new Error(`${this.constructor.name} name cannot be empty`)
    }

    this.id = id
    this.name = name.trim()
  }
}
