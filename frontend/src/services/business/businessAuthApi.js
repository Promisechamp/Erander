import { apiRequest } from "../api";

const BUSINESS_AUTH_OPTIONS = { notifyUnauthenticated: false };

export function registerBusiness(payload) {
  return apiRequest("/auth/business/register", {
    method: "POST",
    body: payload,
    ...BUSINESS_AUTH_OPTIONS,
  });
}

export function loginBusiness(credentials) {
  return apiRequest("/auth/business/login", {
    method: "POST",
    body: credentials,
    ...BUSINESS_AUTH_OPTIONS,
  });
}

export function getCurrentBusiness() {
  return apiRequest("/auth/business/me", BUSINESS_AUTH_OPTIONS);
}

export function logoutBusiness() {
  return apiRequest("/auth/business/logout", {
    method: "POST",
    body: {},
    ...BUSINESS_AUTH_OPTIONS,
  });
}
