import { Router } from "express";

import authRoutes from "../modules/auth/auth.routes.js";
import adminAuthRoutes from "../modules/admin/auth/adminAuth.routes.js";
import adminDashboardRoutes from "../modules/admin/dashboard/adminDashboard.routes.js";
import adminRecordsRoutes from "../modules/admin/records/adminRecords.routes.js";
import adminActionsRoutes from "../modules/admin/actions/adminActions.routes.js";
import adminConfigurationRoutes from "../modules/admin/configuration/adminConfiguration.routes.js";
import profileRoutes from "../modules/profiles/profile.routes.js";
import erandRoutes from "../modules/erands/erand.routes.js";
import chatRoutes from "../modules/chats/chat.routes.js";
import availableErandRoutes from "../modules/erands/available-erands.routes.js";
import erandOfferRoutes from "../modules/erands/erand-offer.routes.js";
import paymentRoutes from "../modules/payments/payment.routes.js";
import walletRoutes, { walletAdminRoutes } from "../modules/wallets/wallet.routes.js";
import supportRoutes from "../modules/support/support.routes.js";
import favoriteErranderRoutes from "../modules/favorites/favoriteErranders.routes.js";
import notificationRoutes from "../modules/notifications/notification.routes.js";
import adminNotificationRoutes from "../modules/notifications/notification.admin.routes.js";


const router = Router();

router.get("/", (req, res) => {
  res.status(200).json({ success: true, message: "Welcome to the ERANDER API.", version: "1.0.0" });
});

router.use("/auth", authRoutes);
router.use("/auth/admin", adminAuthRoutes);
router.use("/profiles", profileRoutes);
router.use("/favorites/erranders", favoriteErranderRoutes);
router.use("/notifications", notificationRoutes);
router.use("/admin/notifications", adminNotificationRoutes);
router.use("/erands/available", availableErandRoutes);
router.use("/erands", erandRoutes);
router.use("/chats", chatRoutes);
router.use("/", erandOfferRoutes);
router.use("/payments", paymentRoutes);
router.use("/wallets", walletRoutes);
router.use("/support", supportRoutes);



router.use("/admin/dashboard", adminDashboardRoutes);
router.use("/admin/records", adminRecordsRoutes);
router.use("/admin/actions", adminActionsRoutes);
router.use("/admin/configuration", adminConfigurationRoutes);
router.use("/admin/wallets", walletAdminRoutes);

export default router;
