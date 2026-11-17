import { Router } from "express";
import { requireAdminAuth } from "../../../middleware/requireAdminAuth.js";
import { requireCsrf } from "../../../middleware/csrfProtection.js";
import {
  activatePlatformConfiguration,
  createPlatformConfigurationDraft,
  getPlatformConfigurationHistory,
  listPlatformConfiguration,
} from "./adminConfiguration.controller.js";

const router = Router();
router.use(requireAdminAuth);
router.get("/", listPlatformConfiguration);
router.get("/:configKey/history", getPlatformConfigurationHistory);
router.post("/:configKey/drafts", requireCsrf, createPlatformConfigurationDraft);
router.post("/:configKey/activate", requireCsrf, activatePlatformConfiguration);
export default router;
