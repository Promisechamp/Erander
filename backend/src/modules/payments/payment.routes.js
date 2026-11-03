import { Router } from "express";

import {
  getErrandFundingSummary,
  initializePayment,
  verifyPayment,
} from "./payment.controller.js";

import {
  requestFundRelease,
  getFundReleaseRequest,
} from "./fundRelease.controller.js";

import { requireAuth } from "../../middleware/requireAuth.js";
import { requireCsrf } from "../../middleware/csrfProtection.js";

const router = Router();

// All payment routes require an authenticated user.
router.use(requireAuth);

// --------------------------------------------------
// CUSTOMER FUNDING
// --------------------------------------------------

// Retrieve the funding summary without creating a
// Paystack transaction.
router.get(
  "/erands/:erandId/funding-summary",
  getErrandFundingSummary,
);

// Initialize payment only after the customer chooses
// to fund the errand.
router.post(
  "/erands/:erandId/initialize",
  requireCsrf,
  initializePayment,
);

// Verify a previously initialized payment.
router.post(
  "/:paymentId/verify",
  requireCsrf,
  verifyPayment,
);

// --------------------------------------------------
// FUND RELEASE
// --------------------------------------------------

// Submit a fund-release request.
//
// Authentication and CSRF protection are required.
// The controller verifies that the authenticated user
// is the selected erander and that the errand is funded.
//
// This endpoint records a request only. It does not
// initiate a transfer or mark funds as released.
router.post(
  "/erands/:erandId/fund-release-request",
  requireCsrf,
  requestFundRelease,
);

// Retrieve the current fund-release request and its
// timestamped events.
//
// The controller checks whether the authenticated user
// is the customer or the selected erander.
router.get(
  "/erands/:erandId/fund-release-request",
  getFundReleaseRequest,
);

export default router;