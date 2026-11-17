import { apiRequest } from "../api.js";

export function getAdminDashboardOverview() {
  return apiRequest("/admin/dashboard/overview", {
    method: "GET",
    cache: "no-store",
  });
}
