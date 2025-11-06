<template>
  <div class="capital-accounts">
    <h3>Starting Capital</h3>

    <!-- Global Liquid Assets Interest Rate -->
    <div class="liquid-rate-setting">
      <label>
        <strong>Liquid Assets Interest Rate:</strong>
        <div class="interest-rate-group">
          <input
            v-model.number="liquidRate"
            type="number"
            placeholder="Interest %"
            step="0.1"
            min="-100"
            max="100"
            @blur="updateLiquidRate"
          />
          <span class="percent-label">%</span>
        </div>
      </label>
    </div>

    <div v-if="accounts.length > 0" class="accounts-list">
      <div v-for="account in accounts" :key="account.id" class="account-item">
        <input
          v-model="account.name"
          type="text"
          placeholder="Account name"
          @blur="updateAccount(account)"
        />
        <input
          v-model.number="account.amount"
          type="number"
          placeholder="Amount"
          step="100"
          @blur="updateAccount(account)"
        />
        <select v-model="account.assetType" @blur="updateAccount(account)" class="asset-type-select">
          <option value="liquid">Liquid</option>
          <option value="fixed">Fixed</option>
        </select>
        <div v-if="account.assetType === 'fixed'" class="interest-rate-group">
          <input
            v-model.number="account.annualInterestRate"
            type="number"
            placeholder="Appr/Depr %"
            step="0.1"
            min="-100"
            max="100"
            @blur="updateAccount(account)"
          />
          <span class="percent-label">%</span>
        </div>
        <button @click="removeAccount(account.id)" class="btn-remove">Remove</button>
      </div>
      <div class="totals">
        <div><strong>Liquid Assets:</strong> {{ formatCurrency(totalLiquidAssets) }}</div>
        <div><strong>Fixed Assets:</strong> {{ formatCurrency(totalFixedAssets) }}</div>
        <div><strong>Total Capital:</strong> {{ formatCurrency(totalCapital) }}</div>
      </div>
    </div>

    <div class="add-form">
      <input v-model="newAccountName" type="text" placeholder="Account name" />
      <input v-model.number="newAccountAmount" type="number" placeholder="Amount" step="100" />
      <select v-model="newAccountAssetType" class="asset-type-select">
        <option value="liquid">Liquid</option>
        <option value="fixed">Fixed</option>
      </select>
      <div v-if="newAccountAssetType === 'fixed'" class="interest-rate-group">
        <input
          v-model.number="newAccountInterestRate"
          type="number"
          placeholder="Appr/Depr %"
          step="0.1"
          min="-100"
          max="100"
        />
        <span class="percent-label">%</span>
      </div>
      <button @click="addAccount" class="btn-add">Add Account</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { CapitalAccount, AssetType, FixedAsset, LiquidAsset } from '@/types/models'

const props = defineProps<{
  accounts: CapitalAccount[]
  liquidAssetsInterestRate: number
}>()

const emit = defineEmits<{
  add: [account: Omit<CapitalAccount, 'id'>]
  update: [id: string, updates: Partial<CapitalAccount>]
  remove: [id: string]
  updateLiquidRate: [rate: number]
}>()

const newAccountName = ref('')
const newAccountAmount = ref<number>(0)
const newAccountInterestRate = ref<number>(0)
const newAccountAssetType = ref<AssetType>('liquid')
const liquidRate = ref<number>(props.liquidAssetsInterestRate)

const totalCapital = computed(() =>
  props.accounts.reduce((sum, account) => sum + account.amount, 0),
)

const totalLiquidAssets = computed(() =>
  props.accounts
    .filter((account) => account.assetType === 'liquid')
    .reduce((sum, account) => sum + account.amount, 0),
)

const totalFixedAssets = computed(() =>
  props.accounts
    .filter((account) => account.assetType === 'fixed')
    .reduce((sum, account) => sum + account.amount, 0),
)

function addAccount() {
  if (newAccountName.value.trim() && newAccountAmount.value > 0) {
    if (newAccountAssetType.value === 'fixed') {
      const account: Omit<FixedAsset, 'id'> = {
        name: newAccountName.value.trim(),
        amount: newAccountAmount.value,
        annualInterestRate: newAccountInterestRate.value,
        assetType: 'fixed',
      }
      emit('add', account)
    } else {
      const account: Omit<LiquidAsset, 'id'> = {
        name: newAccountName.value.trim(),
        amount: newAccountAmount.value,
        assetType: 'liquid',
      }
      emit('add', account)
    }
    newAccountName.value = ''
    newAccountAmount.value = 0
    newAccountInterestRate.value = 0
    newAccountAssetType.value = 'liquid'
  }
}

function updateAccount(account: CapitalAccount) {
  if (account.assetType === 'fixed') {
    emit('update', account.id, {
      name: account.name,
      amount: account.amount,
      annualInterestRate: account.annualInterestRate,
      assetType: 'fixed',
    })
  } else {
    emit('update', account.id, {
      name: account.name,
      amount: account.amount,
      assetType: 'liquid',
    })
  }
}

function removeAccount(id: string) {
  emit('remove', id)
}

function updateLiquidRate() {
  emit('updateLiquidRate', liquidRate.value)
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}
</script>

<style scoped>
.capital-accounts {
  margin-bottom: 2rem;
}

h3 {
  margin-bottom: 1rem;
  color: #2c3e50;
}

.liquid-rate-setting {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: #f0f9ff;
  border-radius: 4px;
  border: 1px solid #bee3f8;
}

.liquid-rate-setting label {
  display: flex;
  align-items: center;
  gap: 1rem;
  justify-content: space-between;
}

.accounts-list {
  margin-bottom: 1rem;
}

.account-item {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.account-item input[type='text'] {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.account-item input[type='number'] {
  width: 150px;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.asset-type-select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  font-size: 0.95rem;
}

.asset-type-select:focus {
  outline: none;
  border-color: #42b983;
}

.interest-rate-group {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  position: relative;
}

.interest-rate-group input[type='number'] {
  width: 80px;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.percent-label {
  color: #666;
  font-size: 0.9rem;
}

.add-form {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.add-form input[type='text'] {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.add-form input[type='number'] {
  width: 150px;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.btn-add {
  padding: 0.5rem 1rem;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.btn-add:hover {
  background-color: #359268;
}

.btn-remove {
  padding: 0.5rem 1rem;
  background-color: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-remove:hover {
  background-color: #c0392b;
}

.totals {
  margin-top: 1rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 4px;
  font-size: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.totals > div:last-child {
  font-size: 1.1rem;
  padding-top: 0.5rem;
  border-top: 2px solid #ddd;
}

input:focus {
  outline: none;
  border-color: #42b983;
}
</style>
