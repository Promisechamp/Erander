import { Router } from "express";

import {
  getErrandFundingSummary,
  initializePayment,
  verifyPayment,
} from "./payment.controller.js";

import {
  requestFundRelease,
  getFundReleaseRequest,
  getErrandSecurityDepositStatus,
} from "./fundRelease.controller.js";
import {
  getSecurityDepositFundingSummary,
  initializeSecurityDepositFunding,
  verifySecurityDepositFunding,
  cancelSecurityDepositFunding,
} from "./securityDepositFunding.controller.js";

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
// Customer-safe security-deposit status for the assigned erander.
// Only the errand customer may retrieve this status.
router.get(
  "/erands/:erandId/security-deposit-status",
  getErrandSecurityDepositStatus,
);

// Erander security-deposit funding: wallet-only, direct Paystack, or split.
router.get(
  "/erands/:erandId/security-deposit-funding",
  getSecurityDepositFundingSummary,
);
router.post(
  "/erands/:erandId/security-deposit-funding/initialize",
  requireCsrf,
  initializeSecurityDepositFunding,
);
router.post(
  "/erands/:erandId/security-deposit-funding/verify",
  requireCsrf,
  verifySecurityDepositFunding,
);
router.post(
  "/erands/:erandId/security-deposit-funding/cancel",
  requireCsrf,
  cancelSecurityDepositFunding,
);


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