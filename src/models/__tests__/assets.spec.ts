import { describe, it, expect } from 'vitest'
import { LiquidAsset, FixedAsset, isLiquidAsset, isFixedAsset } from '@/models/assets'
import { createAbsoluteDate } from '@/types/month'

describe('Asset Models', () => {
  describe('LiquidAsset', () => {
    it('should initialize correctly', () => {
      const asset = new LiquidAsset('1', 'Savings', 1000, 'wealth-id', 'cg-id')
      expect(asset.id).toBe('1')
      expect(asset.name).toBe('Savings')
      expect(asset.amount).toBe(1000)
      expect(asset.wealthTaxId).toBe('wealth-id')
      expect(asset.capitalGainsTaxId).toBe('cg-id')
    })

    it('should throw if amount is negative', () => {
      expect(() => new LiquidAsset('1', 'Savings', -100)).toThrow(
        'LiquidAsset amount cannot be negative',
      )
    })

    it('should update properties with .with()', () => {
      const asset = new LiquidAsset('1', 'Savings', 1000)
      const updated = asset.with({ amount: 2000, name: 'New Savings' })
      expect(updated.amount).toBe(2000)
      expect(updated.name).toBe('New Savings')
      expect(updated.id).toBe('1')
    })

    it('should serialize to JSON correctly', () => {
      const asset = new LiquidAsset('1', 'Savings', 1000, 'w', 'c')
      const json = asset.toJSON()
      expect(json.assetType).toBe('liquid')
      expect(json.amount).toBe(1000)
    })

    it('should deserialize from JSON correctly', () => {
      const data: Record<string, unknown> = {
        id: '2',
        name: 'Checking',
        amount: 500,
        wealthTaxId: 'w2',
        capitalGainsTaxId: 'c2',
      }
      const asset = LiquidAsset.fromJSON(data)
      expect(asset.id).toBe('2')
      expect(asset.name).toBe('Checking')
      expect(asset.amount).toBe(500)
      expect(asset.wealthTaxId).toBe('w2')
      expect(asset.capitalGainsTaxId).toBe('c2')
    })

    it('should detect instance via isLiquidAsset', () => {
      const asset = new LiquidAsset('1', 'Savings', 1000)
      expect(isLiquidAsset(asset)).toBe(true)
    })
  })

  describe('FixedAsset', () => {
    it('should initialize correctly', () => {
      const date = createAbsoluteDate(600)
      const asset = new FixedAsset('1', 'House', 300000, 3, date)
      expect(asset.id).toBe('1')
      expect(asset.name).toBe('House')
      expect(asset.amount).toBe(300000)
      expect(asset.annualInterestRate).toBe(3)
      expect(asset.liquidationDate).toEqual(date)
    })

    it('should throw if amount is negative', () => {
      expect(() => new FixedAsset('1', 'House', -100, 3)).toThrow(
        'FixedAsset amount cannot be negative',
      )
    })

    it('should update properties with .with()', () => {
      const asset = new FixedAsset('1', 'House', 300000, 3)
      const updated = asset.with({ amount: 350000, annualInterestRate: 4 })
      expect(updated.amount).toBe(350000)
      expect(updated.annualInterestRate).toBe(4)
      expect(updated.id).toBe('1')
    })

    it('should serialize to JSON correctly', () => {
      const asset = new FixedAsset('1', 'House', 300000, 3)
      const json = asset.toJSON()
      expect(json.assetType).toBe('fixed')
      expect(json.amount).toBe(300000)
    })

    it('should deserialize from JSON correctly', () => {
      const date = createAbsoluteDate(600)
      const data: Record<string, unknown> = {
        id: '2',
        name: 'Car',
        amount: 20000,
        annualInterestRate: -10,
        liquidationDate: date,
      }
      const asset = FixedAsset.fromJSON(data)
      expect(asset.id).toBe('2')
      expect(asset.name).toBe('Car')
      expect(asset.amount).toBe(20000)
      expect(asset.annualInterestRate).toBe(-10)
      expect(asset.liquidationDate).toEqual(date)
    })

    it('should detect instance via isFixedAsset', () => {
      const asset = new FixedAsset('1', 'House', 300000, 3)
      expect(isFixedAsset(asset)).toBe(true)
    })
  })
})
