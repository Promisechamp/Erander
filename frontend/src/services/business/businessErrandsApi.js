import { apiRequest } from "../api";

const BUSINESS_REQUEST_OPTIONS = { notifyUnauthenticated: false };

export function getBusinessErrands(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return apiRequest(`/business/erands${query ? `?${query}` : ""}`, BUSINESS_REQUEST_OPTIONS);
}

export function createBusinessErrand(payload) {
  return apiRequest("/business/erands", {
    method: "POST",
    body: JSON.stringify(payload),
    ...BUSINESS_REQUEST_OPTIONS,
  });
}
