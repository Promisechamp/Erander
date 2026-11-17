import { apiRequest } from "../api.js";

export function listAdminFundReleaseRequests({ status = "", search = "" } = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  return apiRequest(`/admin/actions/fund-releases${params.toString() ? `?${params}` : ""}`);
}

export function getAdminFundReleaseRequest(requestId) {
  return apiRequest(`/admin/actions/fund-releases/${encodeURIComponent(requestId)}`);
}

export function releaseAdminFundReleaseRequest(requestId, reason) {
  return apiRequest(`/admin/actions/fund-releases/${encodeURIComponent(requestId)}/release`, {
    method: "POST",
    body: { reason },
  });
}

export function rejectAdminFundReleaseRequest(requestId, reason) {
  return apiRequest(`/admin/actions/fund-releases/${encodeURIComponent(requestId)}/reject`, {
    method: "POST",
    body: { reason },
  });
}

export function verifyAdminFundReleaseTransfer(requestId) {
  return apiRequest(`/admin/actions/fund-releases/${encodeURIComponent(requestId)}/verify`, {
    method: "POST",
    body: {},
  });
}
