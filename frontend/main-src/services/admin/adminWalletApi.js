import { apiRequest } from "../api.js";

export function getAdminWithdrawals({ status = "" } = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/admin/wallets/withdrawals${suffix}`);
}

export function approveAdminWithdrawal(withdrawalId) {
  return apiRequest(`/admin/wallets/withdrawals/${encodeURIComponent(withdrawalId)}/approve`, { method: "POST", body: {} });
}

export function rejectAdminWithdrawal(withdrawalId, reason) {
  return apiRequest(`/admin/wallets/withdrawals/${encodeURIComponent(withdrawalId)}/reject`, { method: "POST", body: { reason } });
}

export function processAdminWithdrawal(withdrawalId) {
  return apiRequest(`/admin/wallets/withdrawals/${encodeURIComponent(withdrawalId)}/process`, { method: "POST", body: {} });
}

export function verifyAdminWithdrawalTransfer(withdrawalId) {
  return apiRequest(`/admin/wallets/withdrawals/${encodeURIComponent(withdrawalId)}/verify-transfer`, { method: "POST", body: {} });
}
