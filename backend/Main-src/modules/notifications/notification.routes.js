import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireCsrf } from "../../middleware/csrfProtection.js";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "./notification.controller.js";

const router = Router();
router.use(requireAuth);
router.get("/", listNotifications);
router.patch("/read-all", requireCsrf, markAllNotificationsRead);
router.patch("/:notificationId/read", requireCsrf, markNotificationRead);
export default router;
