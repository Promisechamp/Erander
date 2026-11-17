import { apiRequest } from "@/services/api";

export async function getNotifications({ limit = 20, basePath = "/notifications" } = {}) {
  const result = await apiRequest(`${basePath}?limit=${encodeURIComponent(limit)}`);
  return result.data;
}

export async function markNotificationRead(notificationId, basePath = "/notifications") {
  const result = await apiRequest(`${basePath}/${notificationId}/read`, { method: "PATCH" });
  return result.data;
}

export async function markAllNotificationsRead(basePath = "/notifications") {
  const result = await apiRequest(`${basePath}/read-all`, { method: "PATCH" });
  return result.data;
}
