import { Router } from "express";

import {
  createTicket,
  getMyTickets,
  getTicketDetails,
  sendTicketMessage,

  getAllTickets,
  adminGetTicketDetails,
  adminUpdateTicket,
  adminReplyToTicket,
  adminAddInternalNote,
} from "./support.controller.js";

import { requireAuth } from "../../middleware/requireAuth.js";
import { requireAdminAuth } from "../../middleware/requireAdminAuth.js";
import { requireCsrf } from "../../middleware/csrfProtection.js";

const router = Router();


// ============================================================
// CUSTOMER / ERANDER ROUTES
// ============================================================

router.post(
  "/tickets",
  requireAuth,
  requireCsrf,
  createTicket
);

router.get(
  "/tickets",
  requireAuth,
  getMyTickets
);

router.get(
  "/tickets/:ticketId",
  requireAuth,
  getTicketDetails
);

router.post(
  "/tickets/:ticketId/messages",
  requireAuth,
  requireCsrf,
  sendTicketMessage
);


// ============================================================
// SUPER ADMIN ROUTES
// ============================================================

router.get(
  "/admin/tickets",
  requireAdminAuth,
  getAllTickets
);

router.get(
  "/admin/tickets/:ticketId",
  requireAdminAuth,
  adminGetTicketDetails
);

router.patch(
  "/admin/tickets/:ticketId",
  requireAdminAuth,
  requireCsrf,
  adminUpdateTicket
);

router.post(
  "/admin/tickets/:ticketId/reply",
  requireAdminAuth,
  requireCsrf,
  adminReplyToTicket
);

router.post(
  "/admin/tickets/:ticketId/notes",
  requireAdminAuth,
  requireCsrf,
  adminAddInternalNote
);


export default router;