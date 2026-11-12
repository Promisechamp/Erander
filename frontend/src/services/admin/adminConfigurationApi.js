import { apiRequest } from "../api.js";

export function getPlatformConfiguration() {
  return apiRequest("/admin/configuration");
}

export function getPlatformConfigurationHistory(configKey) {
  return apiRequest(`/admin/configuration/${encodeURIComponent(configKey)}/history`);
}

export function createPlatformConfigurationDraft(configKey, payload) {
  return apiRequest(`/admin/configuration/${encodeURIComponent(configKey)}/drafts`, {
    method: "POST",
    body: payload,
  });
}

export function activatePlatformConfiguration(configKey, payload) {
  return apiRequest(`/admin/configuration/${encodeURIComponent(configKey)}/activate`, {
    method: "POST",
    body: payload,
  });
}
