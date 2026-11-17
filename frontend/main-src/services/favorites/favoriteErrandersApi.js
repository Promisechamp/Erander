import { apiRequest } from "../api";

export async function getFavoriteErranders() {
  const result = await apiRequest("/favorites/erranders");
  const data = result?.data ?? result ?? {};
  return { ...result, data: { ...data, favorites: Array.isArray(data.favorites) ? data.favorites : [] } };
}

export function addFavoriteErander(eranderId) {
  if (!eranderId) throw new Error("An erander account is required.");
  return apiRequest(`/favorites/erranders/${encodeURIComponent(eranderId)}`, { method: "POST", body: {} });
}

export function addFavoriteEranderByEmail(email) {
  return apiRequest("/favorites/erranders/by-email", { method: "POST", body: { email } });
}

export function removeFavoriteErander(eranderId) {
  if (!eranderId) throw new Error("An erander account is required.");
  return apiRequest(`/favorites/erranders/${encodeURIComponent(eranderId)}`, { method: "DELETE" });
}
