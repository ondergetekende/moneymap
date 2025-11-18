import {
  FinancialItem,
  LiquidAsset,
  FixedAsset,
  CashFlow,
  LinearDebt,
  AnnualizedDebt,
  InterestOnlyDebt,
} from '@/models'
import { getCurrentMonth, addMonths } from '@/types/month'

export interface ItemTypeDefinition {
  id: string
  category: 'asset' | 'cashflow' | 'debt'
  icon?: string
  color: string
  template: FinancialItem
}

// Get the button label from template name
export function getItemTypeButtonLabel(itemType: ItemTypeDefinition): string {
  return itemType.template.name
}

export const ITEM_TYPES: ItemTypeDefinition[] = [
  {
    id: 'liquid',
    category: 'asset',
    color: '#3b82f6', // blue
    template: new LiquidAsset(
      'template-liquid',
      'Savings',
      25000 // Typical savings buffer (3-6 months expenses)
    )
  },
  {
    id: 'house',
    category: 'asset',
    color: '#8b5cf6', // purple
    template: new FixedAsset(
      'template-house',
      'House',
      350000, // Average home value in Western Europe
      3.5 // Typical property appreciation rate
    )
  },
  {
    id: 'car',
    category: 'asset',
    color: '#8b5cf6', // purple
    template: new FixedAsset(
      'template-car',
      'Car',
      35000, // Average car value in Western Europe
      -3.5 // Typical car depreciation rate
    )
  },
  {
    id: 'income',
    category: 'cashflow',
    color: '#22c55e', // green
    template: new CashFlow(
      'template-income',
      'Income',
      3500, // Median gross salary in Western Europe
      'income'
    )
  },
  {
    id: 'expense',
    category: 'cashflow',
    color: '#ef4444', // red
    template: new CashFlow(
      'template-expense',
      'Expense',
      2500, // Typical monthly living expenses
      'expense'
    )
  },
  {
    id: 'windfall',
    category: 'cashflow',
    color: '#22c55e', // green
    template: new CashFlow(
      'template-windfall',
      'Windfall',
      10000, // One-time income (e.g., bonus, inheritance, tax refund)
      'income',
      getCurrentMonth(), // Requires a date for one-time transactions
      undefined,
      false,
      true // isOneTime
    )
  },
  {
    id: 'mortgage',
    category: 'debt',
    color: '#f97316', // orange
    template: new AnnualizedDebt({
      id: 'template-mortgage',
      name: 'Mortgage',
      amount: 300000, // Typical mortgage amount
      annualInterestRate: 3.5, // Current mortgage rates
      monthlyPayment: 1500, // Standard monthly payment
      startDate: getCurrentMonth(), // Current month
      endDate: addMonths(getCurrentMonth(), 360), // 30 years from now (30 * 12 = 360 months)
    })
  },
  {
    id: 'loan',
    category: 'debt',
    color: '#f97316', // orange
    template: new AnnualizedDebt({
      id: 'template-loan',
      name: 'Debt',
      amount: 30000, // Average car loan
      annualInterestRate: 4.5,
      monthlyPayment: 600,
      startDate: getCurrentMonth(), // Current month
      endDate: addMonths(getCurrentMonth(), 360), // 30 years from now (30 * 12 = 360 months)
    })
  },
]

export function getItemTypeById(id: string): ItemTypeDefinition | undefined {
  return ITEM_TYPES.find(type => type.id === id)
}

export function getAssetTypes(): ItemTypeDefinition[] {
  return ITEM_TYPES.filter(type => type.category === 'asset')
}

export function getCashFlowTypes(): ItemTypeDefinition[] {
  return ITEM_TYPES.filter(type => type.category === 'cashflow')
}

export function getDebtTypes(): ItemTypeDefinition[] {
  return ITEM_TYPES.filter(type => type.category === 'debt')
}
