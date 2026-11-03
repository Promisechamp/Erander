import { apiRequest } from "../api";

/**
 * Retrieve the currently authenticated user.
 */
export async function getCurrentUser() {
  const result = await apiRequest("/auth/me");

  const user = result?.data?.user;

  if (!user) {
    throw new Error("Unable to retrieve your authenticated user.");
  }

  return user;
}

/**
 * Sign out the current user.
 */
export function logoutUser() {
  return apiRequest("/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
}