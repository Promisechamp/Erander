import { apiRequest } from "../api.js";

export function adminLogin(credentials) {
  return apiRequest("/auth/admin/login", {
    method: "POST",
    body: credentials,          // ✅ plain object — apiRequest stringifies + sets Content-Type
  });
}

export function getCurrentAdmin() {
  return apiRequest("/auth/admin/me");
}

export function adminLogout() {
  return apiRequest("/auth/admin/logout", { method: "POST" });
}