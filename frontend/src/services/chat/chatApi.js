import { apiRequest } from "../api";

export function getErrandChatTargets(errandId) {
  return apiRequest(`/chats/errands/${encodeURIComponent(errandId)}/targets`);
}

export function openErrandChat(errandId, eranderId) {
  return apiRequest(`/chats/errands/${encodeURIComponent(errandId)}/${encodeURIComponent(eranderId)}/open`, {
    method: "POST",
    body: {},
  });
}

export function listChats({ archived = false, search = "", page = 1 } = {}) {
  const query = new URLSearchParams({ archived: String(archived), search, page: String(page) });
  return apiRequest(`/chats?${query.toString()}`);
}

export function getChatDetails(chatId, options = {}) {
  const query = new URLSearchParams();
  if (options.before) query.set("before", options.before);
  if (options.limit) query.set("limit", String(options.limit));
  return apiRequest(`/chats/${encodeURIComponent(chatId)}${query.size ? `?${query}` : ""}`);
}

export function acceptChatDisclosure(chatId) {
  return apiRequest(`/chats/${encodeURIComponent(chatId)}/disclosure`, { method: "POST", body: {} });
}

export function sendChatMessage(chatId, payload) {
  return apiRequest(`/chats/${encodeURIComponent(chatId)}/messages`, { method: "POST", body: payload });
}

export function reportChat(chatId, payload) {
  return apiRequest(`/chats/${encodeURIComponent(chatId)}/reports`, { method: "POST", body: payload });
}

export function closeChat(chatId) {
  return apiRequest(`/chats/${encodeURIComponent(chatId)}/close`, { method: "POST", body: {} });
}

export function reopenChat(chatId) {
  return apiRequest(`/chats/${encodeURIComponent(chatId)}/reopen`, { method: "POST", body: {} });
}

export function archiveChat(chatId) {
  return apiRequest(`/chats/${encodeURIComponent(chatId)}/archive`, { method: "POST", body: {} });
}

export function unarchiveChat(chatId) {
  return apiRequest(`/chats/${encodeURIComponent(chatId)}/unarchive`, { method: "POST", body: {} });
}

export function hideChat(chatId) {
  return apiRequest(`/chats/${encodeURIComponent(chatId)}/hide`, { method: "POST", body: {} });
}

export function updateErrandChatPreference(errandId, allowEranderInitiatedChat) {
  return apiRequest(`/chats/errands/${encodeURIComponent(errandId)}/inbound-preference`, {
    method: "PATCH",
    body: { allowEranderInitiatedChat },
  });
}

export function listAdminChats({ search = "", flagged = false, status = "all", errandId = "", page = 1 } = {}) {
  const query = new URLSearchParams({ search, flagged: String(flagged), status, page: String(page) });
  if (errandId) query.set("errandId", errandId);
  return apiRequest(`/admin/chats?${query.toString()}`);
}

export function getAdminChatDetails(chatId, reason, options = {}) {
  const query = new URLSearchParams({ reason });
  if (options.before) query.set("before", options.before);
  if (options.limit) query.set("limit", String(options.limit));
  return apiRequest(`/admin/chats/${encodeURIComponent(chatId)}?${query.toString()}`);
}

export function listAdminChatReports(status = "active") {
  return apiRequest(`/admin/chats/reports?status=${encodeURIComponent(status)}`);
}

export function updateAdminChatReport(reportId, payload) {
  return apiRequest(`/admin/chats/reports/${encodeURIComponent(reportId)}`, { method: "PATCH", body: payload });
}
