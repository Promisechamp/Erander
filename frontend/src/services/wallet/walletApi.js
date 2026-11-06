import { apiRequest } from "../api";

function getErrorMessage(result, fallback) {
  return result?.message || result?.error?.message || fallback;
}

async function request(path, options, fallback) {
  const result = await apiRequest(path, options);
  if (!result?.success) throw new Error(getErrorMessage(result, fallback));
  return result.data ?? {};
}

export async function getWalletOverview({ currency = "USD", page = 1, limit = 20, type = "" } = {}) {
  const params = new URLSearchParams({ currency: String(currency).toUpperCase(), page: String(page), limit: String(limit) });
  if (type) params.set("type", type);
  const data = await request(`/wallets?${params}`, { method: "GET" }, "Unable to retrieve your wallet.");
  return {
    wallets: Array.isArray(data.wallets) ? data.wallets : [],
    selectedWallet: data.selectedWallet || null,
    transactions: Array.isArray(data.transactions) ? data.transactions : [],
    pagination: data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
  };
}

export async function getWalletTransaction(transactionId) {
  const data = await request(`/wallets/transactions/${encodeURIComponent(transactionId)}`, { method: "GET" }, "Unable to retrieve this transaction.");
  return data.transaction;
}

export async function getWithdrawalBanks() {
  const data = await request("/wallets/banks", { method: "GET" }, "Unable to retrieve banks.");
  return Array.isArray(data.banks) ? data.banks : [];
}

export async function initializeWalletDeposit({ amount, currency = "NGN", idempotencyKey }) {
  const data = await request("/wallets/deposits/initialize", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: { amount: String(amount), currency, idempotencyKey },
  }, "Unable to initialize wallet funding.");
  return data;
}

export async function verifyWalletDeposit(reference) {
  const data = await request("/wallets/deposits/verify", {
    method: "POST",
    body: { reference },
  }, "Unable to verify your wallet deposit.");
  return data;
}

export async function resolveWithdrawalAccount({ accountNumber, bankCode }) {
  const data = await request("/wallets/withdrawal-accounts/resolve", {
    method: "POST",
    body: { accountNumber, bankCode },
  }, "Unable to verify this bank account.");
  return data;
}

export async function addWithdrawalAccount({ accountNumber, bankCode, bankName, isDefault = false }) {
  const data = await request("/wallets/withdrawal-accounts", {
    method: "POST",
    body: { accountNumber, bankCode, bankName, isDefault },
  }, "Unable to save this bank account.");
  return data.account;
}

export async function getWithdrawalAccounts() {
  const data = await request("/wallets/withdrawal-accounts", { method: "GET" }, "Unable to retrieve your bank accounts.");
  return Array.isArray(data.accounts) ? data.accounts : [];
}

export async function setDefaultWithdrawalAccount(accountId) {
  return request(`/wallets/withdrawal-accounts/${encodeURIComponent(accountId)}/default`, { method: "PATCH" }, "Unable to update your default bank account.");
}

export async function disableWithdrawalAccount(accountId) {
  return request(`/wallets/withdrawal-accounts/${encodeURIComponent(accountId)}`, { method: "DELETE" }, "Unable to disable this bank account.");
}

export async function createWithdrawalRequest({ amount, withdrawalAccountId, idempotencyKey }) {
  const data = await request("/wallets/withdrawals", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: { amount: String(amount), withdrawalAccountId, idempotencyKey },
  }, "Unable to submit your withdrawal request.");
  return data.withdrawal;
}

export async function getMyWithdrawals() {
  const data = await request("/wallets/withdrawals", { method: "GET" }, "Unable to retrieve withdrawal requests.");
  return Array.isArray(data.withdrawals) ? data.withdrawals : [];
}

export async function cancelWithdrawal(withdrawalId) {
  return request(`/wallets/withdrawals/${encodeURIComponent(withdrawalId)}/cancel`, { method: "POST" }, "Unable to cancel this withdrawal.");
}

const walletApi = {
  getWalletOverview,
  getWalletTransaction,
  getWithdrawalBanks,
  initializeWalletDeposit,
  verifyWalletDeposit,
  resolveWithdrawalAccount,
  addWithdrawalAccount,
  getWithdrawalAccounts,
  setDefaultWithdrawalAccount,
  disableWithdrawalAccount,
  createWithdrawalRequest,
  getMyWithdrawals,
  cancelWithdrawal,
};

export default walletApi;
