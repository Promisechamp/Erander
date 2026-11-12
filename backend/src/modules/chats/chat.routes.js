import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireAdminAuth } from "../../middleware/requireAdminAuth.js";
import { requireCsrf } from "../../middleware/csrfProtection.js";
import {
  acceptChatDisclosure, archiveChat, closeChat, getAdminChatAttachment,
  getAdminChatDetails, getChatAttachment, getChatDetails, getErrandChatTargets,
  hideChat, listAdminChatReports, listAdminChats, listChats, openErrandChat,
  reopenChat, reportChat, sendChatMessage, unarchiveChat, updateAdminChatReport,
  updateErrandChatPreference,
} from "./chat.controller.js";

const router = Router();
router.use(requireAuth);
router.get("/errands/:errandId/targets", getErrandChatTargets);
router.post("/errands/:errandId/:eranderId/open", requireCsrf, openErrandChat);
router.patch("/errands/:errandId/inbound-preference", requireCsrf, updateErrandChatPreference);
router.get("/", listChats);
router.get("/:chatId", getChatDetails);
router.post("/:chatId/disclosure", requireCsrf, acceptChatDisclosure);
router.post("/:chatId/messages", requireCsrf, sendChatMessage);
router.get("/attachments/:attachmentId", getChatAttachment);
router.post("/:chatId/reports", requireCsrf, reportChat);
router.post("/:chatId/close", requireCsrf, closeChat);
router.post("/:chatId/reopen", requireCsrf, reopenChat);
router.post("/:chatId/archive", requireCsrf, archiveChat);
router.post("/:chatId/unarchive", requireCsrf, unarchiveChat);
router.post("/:chatId/hide", requireCsrf, hideChat);

const adminRouter = Router();
adminRouter.use(requireAdminAuth);
adminRouter.get("/", listAdminChats);
adminRouter.get("/reports", listAdminChatReports);
adminRouter.get("/:chatId", getAdminChatDetails);
adminRouter.get("/attachments/:attachmentId", getAdminChatAttachment);
adminRouter.patch("/reports/:reportId", requireCsrf, updateAdminChatReport);

export { adminRouter as adminChatRouter };
export default router;
