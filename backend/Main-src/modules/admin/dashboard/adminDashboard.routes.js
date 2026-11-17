import { Router } from "express";
import { requireAdminAuth } from "../../../middleware/requireAdminAuth.js";
import { getAdminDashboardOverview } from "./adminDashboard.controller.js";

const router = Router();

// Every endpoint in this router uses the separate administrator session.
router.use(requireAdminAuth);
router.get("/overview", getAdminDashboardOverview);

export default router;
