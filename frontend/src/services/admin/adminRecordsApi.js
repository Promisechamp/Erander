import { apiRequest } from "../api.js";

export function getAdminRecords({ section, dataset, page = 1, limit = 20, search = "", status = "" }) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  return apiRequest(`/admin/records/${encodeURIComponent(section)}/${encodeURIComponent(dataset)}?${params.toString()}`);
}

export function getAdminSettingsAvailability() {
  return apiRequest("/admin/records/settings/availability");
}

export function getAdminErrandDetails(erandId) {
  return apiRequest(`/admin/records/errands/${encodeURIComponent(erandId)}/details`);
}

export function getAdminUserDetails(profileId) {
  return apiRequest(`/admin/records/users/${encodeURIComponent(profileId)}/details`);
}
