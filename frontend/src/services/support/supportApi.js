import { apiRequest } from "../api";

// ============================================================
// CUSTOMER / ERANDER — SUPPORT TICKETS
// ============================================================

/**
 * Create a general support ticket or report an errand issue.
 *
 * @param {Object} payload
 * @param {"support"|"issue"} payload.ticket_type
 * @param {string} payload.subject
 * @param {string} payload.description
 * @param {string} payload.category
 * @param {string|null} payload.errand_id
 * @param {Array} payload.attachments
 */
export function createSupportTicket(payload) {
  return apiRequest("/support/tickets", {
    method: "POST",
    body: payload,
  });
}


/**
 * List tickets belonging to the authenticated user.
 *
 * @param {Object} options
 * @param {string} options.status
 * @param {string} options.ticket_type
 * @param {number} options.page
 * @param {number} options.limit
 */
export function listSupportTickets({
  status = "",
  ticket_type = "",
  page = 1,
  limit = 15,
} = {}) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (status) query.set("status", status);
  if (ticket_type) query.set("ticket_type", ticket_type);

  return apiRequest(`/support/tickets?${query.toString()}`);
}


/**
 * Get a specific support ticket and its conversation.
 *
 * @param {string} ticketId
 */
export function getSupportTicketDetails(ticketId) {
  return apiRequest(
    `/support/tickets/${encodeURIComponent(ticketId)}`
  );
}


/**
 * Send a reply to an existing support ticket.
 *
 * @param {string} ticketId
 * @param {Object} payload
 */
export function sendSupportTicketMessage(ticketId, payload) {
  return apiRequest(
    `/support/tickets/${encodeURIComponent(ticketId)}/messages`,
    {
      method: "POST",
      body: payload,
    }
  );
}


// ============================================================
// SUPER ADMIN — SUPPORT MANAGEMENT
// ============================================================

/**
 * List all support tickets.
 *
 * @param {Object} options
 */
export function listAdminSupportTickets({
  search = "",
  status = "",
  priority = "",
  ticket_type = "",
  category = "",
  page = 1,
  limit = 15,
} = {}) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (search) query.set("search", search);
  if (status) query.set("status", status);
  if (priority) query.set("priority", priority);
  if (ticket_type) query.set("ticket_type", ticket_type);
  if (category) query.set("category", category);

  return apiRequest(
    `/support/admin/tickets?${query.toString()}`
  );
}


/**
 * Get complete ticket details for Super Admin.
 * Includes private internal notes.
 *
 * @param {string} ticketId
 */
export function getAdminSupportTicketDetails(ticketId) {
  return apiRequest(
    `/support/admin/tickets/${encodeURIComponent(ticketId)}`
  );
}


/**
 * Update ticket status or priority.
 *
 * @param {string} ticketId
 * @param {Object} payload
 */
export function updateAdminSupportTicket(ticketId, payload) {
  return apiRequest(
    `/support/admin/tickets/${encodeURIComponent(ticketId)}`,
    {
      method: "PATCH",
      body: payload,
    }
  );
}


/**
 * Send an official support response.
 *
 * @param {string} ticketId
 * @param {Object} payload
 */
export function replyToAdminSupportTicket(ticketId, payload) {
  return apiRequest(
    `/support/admin/tickets/${encodeURIComponent(ticketId)}/reply`,
    {
      method: "POST",
      body: payload,
    }
  );
}


/**
 * Add a private internal note.
 *
 * @param {string} ticketId
 * @param {Object} payload
 */
export function addAdminSupportInternalNote(ticketId, payload) {
  return apiRequest(
    `/support/admin/tickets/${encodeURIComponent(ticketId)}/notes`,
    {
      method: "POST",
      body: payload,
    }
  );
}