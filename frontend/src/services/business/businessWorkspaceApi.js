import { apiRequest } from "../api";

const OPTIONS = { notifyUnauthenticated: false };

export function updateBusinessProfile(payload) {
  return apiRequest("/auth/business/profile", { method: "PATCH", body: payload, ...OPTIONS });
}
export function getBusinessFavoriteErranders() {
  return apiRequest("/business/favorites/erranders", OPTIONS);
}
export function addBusinessFavoriteErander(eranderId) {
  return apiRequest(`/business/favorites/erranders/${eranderId}`, { method: "POST", body: {}, ...OPTIONS });
}
export function removeBusinessFavoriteErander(eranderId) {
  return apiRequest(`/business/favorites/erranders/${eranderId}`, { method: "DELETE", body: {}, ...OPTIONS });
}
