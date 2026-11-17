import { apiRequest } from "../api.js";

export function getProfileAdminRoles(profileId) {
  return apiRequest(`/admin/actions/users/${encodeURIComponent(profileId)}/admin-roles`);
}

export function setProfileAdminRole(profileId, roleCode, { activate, reason }) {
  return apiRequest(`/admin/actions/users/${encodeURIComponent(profileId)}/admin-roles/${encodeURIComponent(roleCode)}`, {
    method: "POST",
    body: { activate, reason },
  });
}

export function updateProfileAccountStatus(profileId, { status, reason }) {
  return apiRequest(`/admin/actions/users/${encodeURIComponent(profileId)}/status`, {
    method: "PATCH",
    body: { status, reason },
  });
}

export function updateBusinessVerification(businessId, { status, reason }) {
  return apiRequest(`/admin/actions/businesses/${encodeURIComponent(businessId)}/verification`, {
    method: "PATCH",
    body: { status, reason },
  });
}

export function toggleErrandOffers(erandId, { enabled, reason }) {
  return apiRequest(`/admin/actions/errands/${encodeURIComponent(erandId)}/offers`, {
    method: "PATCH",
    body: { enabled, reason },
  });
}

export function reviewSecurityDepositClaim(claimId, payload) {
  return apiRequest(`/admin/actions/security-deposits/claims/${encodeURIComponent(claimId)}/review`, {
    method: "POST",
    body: payload,
  });
}

export function settleSecurityDepositClaim(claimId) {
  return apiRequest(`/admin/actions/security-deposits/claims/${encodeURIComponent(claimId)}/settle`, {
    method: "POST",
    body: {},
  });
}

export function releaseSecurityDepositReservation(reservationId, reason) {
  return apiRequest(`/admin/actions/security-deposits/reservations/${encodeURIComponent(reservationId)}/release`, {
    method: "POST",
    body: { reason },
  });
}

export function runFinancialReconciliation({ runType, currencyCode = null }) {
  return apiRequest("/admin/actions/reconciliation/run", {
    method: "POST",
    body: { runType, currencyCode },
  });
}

export function resolveReconciliationIssue(issueId, { status, reason }) {
  return apiRequest(`/admin/actions/reconciliation/issues/${encodeURIComponent(issueId)}`, {
    method: "PATCH",
    body: { status, reason },
  });
}

export function getAdminActionAuditLogs({ page = 1, limit = 20, search = "" } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set("search", search);
  return apiRequest(`/admin/actions/audit-logs?${params.toString()}`);
}
