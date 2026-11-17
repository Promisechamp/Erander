import { Router } from "express";
import { requireAdminAuth } from "../../../middleware/requireAdminAuth.js";
import {
  getAdminErrandDetails,
  getAdminSettingsAvailability,
  getAdminUserDetails,
  getAdminTransactionDetails,
  listAdminRecords,
} from "./adminRecords.controller.js";

const router = Router();
router.use(requireAdminAuth);
router.get("/settings/availability", getAdminSettingsAvailability);
router.get("/errands/:erandId/details", getAdminErrandDetails);
router.get("/users/:profileId/details", getAdminUserDetails);
router.get("/transactions/:transactionId/details", getAdminTransactionDetails);
router.get("/:section/:dataset", listAdminRecords);
export default router;
