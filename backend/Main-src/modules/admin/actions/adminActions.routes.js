import { Router } from "express";
import { requireAdminAuth } from "../../../middleware/requireAdminAuth.js";
import { requireCsrf } from "../../../middleware/csrfProtection.js";
import {
  getAdminFundReleaseRequestDetails,
  initiateAdminFundRelease,
  listAdminFundReleaseRequests,
  rejectAdminFundReleaseRequest,
  verifyAdminFundReleaseTransfer,
} from "./fundReleaseAdmin.controller.js";
import {
  getProfileAdminRoles,
  listAdminActionAuditLogs,
  releaseSecurityDepositReservation,
  resolveReconciliationIssue,
  reviewSecurityDepositClaim,
  runFinancialReconciliation,
  setProfileAdminRole,
  settleSecurityDepositClaim,
  toggleErrandOffers,
  updateBusinessVerification,
  updateProfileAccountStatus,
} from "./adminActions.controller.js";

const router = Router();
router.use(requireAdminAuth);

router.get("/audit-logs", listAdminActionAuditLogs);
router.get("/fund-releases", listAdminFundReleaseRequests);
router.get("/fund-releases/:requestId", getAdminFundReleaseRequestDetails);
router.post("/fund-releases/:requestId/release", requireCsrf, initiateAdminFundRelease);
router.post("/fund-releases/:requestId/reject", requireCsrf, rejectAdminFundReleaseRequest);
router.post("/fund-releases/:requestId/verify", requireCsrf, verifyAdminFundReleaseTransfer);
router.get("/users/:profileId/admin-roles", getProfileAdminRoles);
router.post("/users/:profileId/admin-roles/:roleCode", requireCsrf, setProfileAdminRole);
router.patch("/users/:profileId/status", requireCsrf, updateProfileAccountStatus);
router.patch("/businesses/:businessId/verification", requireCsrf, updateBusinessVerification);
router.patch("/errands/:erandId/offers", requireCsrf, toggleErrandOffers);
router.post("/security-deposits/claims/:claimId/review", requireCsrf, reviewSecurityDepositClaim);
router.post("/security-deposits/claims/:claimId/settle", requireCsrf, settleSecurityDepositClaim);
router.post("/security-deposits/reservations/:reservationId/release", requireCsrf, releaseSecurityDepositReservation);
router.post("/reconciliation/run", requireCsrf, runFinancialReconciliation);
router.patch("/reconciliation/issues/:issueId", requireCsrf, resolveReconciliationIssue);

export default router;
