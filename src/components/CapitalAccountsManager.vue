<template>
  <div class="capital-accounts">
    <h3>Starting Capital</h3>

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
        <div class="interest-rate-group">
          <input
            v-model.number="account.annualInterestRate"
            type="number"
            placeholder="Interest %"
            step="0.1"
            min="0"
            max="100"
            @blur="updateAccount(account)"
          />
          <span class="percent-label">%</span>
        </div>
        <button @click="removeAccount(account.id)" class="btn-remove">Remove</button>
      </div>
      <div class="total"><strong>Total Capital:</strong> {{ formatCurrency(totalCapital) }}</div>
    </div>

    <div class="add-form">
      <input v-model="newAccountName" type="text" placeholder="Account name" />
      <input v-model.number="newAccountAmount" type="number" placeholder="Amount" step="100" />
      <div class="interest-rate-group">
        <input
          v-model.number="newAccountInterestRate"
          type="number"
          placeholder="Interest %"
          step="0.1"
          min="0"
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
import type { CapitalAccount } from '@/types/models'

const props = defineProps<{
  accounts: CapitalAccount[]
}>()

const emit = defineEmits<{
  add: [account: Omit<CapitalAccount, 'id'>]
  update: [id: string, updates: Partial<CapitalAccount>]
  remove: [id: string]
}>()

const newAccountName = ref('')
const newAccountAmount = ref<number>(0)
const newAccountInterestRate = ref<number>(5)

const totalCapital = computed(() =>
  props.accounts.reduce((sum, account) => sum + account.amount, 0),
)

function addAccount() {
  if (newAccountName.value.trim() && newAccountAmount.value > 0) {
    emit('add', {
      name: newAccountName.value.trim(),
      amount: newAccountAmount.value,
      annualInterestRate: newAccountInterestRate.value,
    })
    newAccountName.value = ''
    newAccountAmount.value = 0
    newAccountInterestRate.value = 5
  }
}

function updateAccount(account: CapitalAccount) {
  emit('update', account.id, {
    name: account.name,
    amount: account.amount,
    annualInterestRate: account.annualInterestRate,
  })
}

function removeAccount(id: string) {
  emit('remove', id)
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

.total {
  margin-top: 1rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 4px;
  font-size: 1.1rem;
}

input:focus {
  outline: none;
  border-color: #42b983;
}
</style>
