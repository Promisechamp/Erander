import { apiRequest } from "../api";

export async function getCurrentUser() {
  const result = await apiRequest("/auth/me");
  const user = result?.data?.user;

  if (!user) {
    const error = new Error("Unable to retrieve your authenticated user.");
    error.status = 401;          // ← treat as unauthenticated
    throw error;
  }

  return user;
}

export function loginUser({ email, password, remember }) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: { email, password, remember },  
  });
}

export function logoutUser() {
  return apiRequest("/auth/logout", {
    method: "POST",
    body: {},                          
  });
}