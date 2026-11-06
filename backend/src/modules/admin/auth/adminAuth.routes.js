import { Router } from "express";
import { adminLogin, adminLogout, adminMe } from "./adminAuth.controller.js";
import { loginRateLimit } from "../../../middleware/authRateLimit.js";
import { requireAdminAuth } from "../../../middleware/requireAdminAuth.js";
import { env } from "../../../config/env.js";
import { issueCsrfToken, requireCsrf } from "../../../middleware/csrfProtection.js";

const router = Router();

function verifyAdminOrigin(req, res, next) {
  const origin = req.get("origin");
  const allowedOrigin = env.frontendUrl.replace(/\/$/, "");
  if (origin && origin !== allowedOrigin) {
    return res.status(403).json({ success: false, message: "This request is not permitted." });
  }
  return next();
}

router.get("/csrf", issueCsrfToken);
router.post("/login", verifyAdminOrigin, requireCsrf, loginRateLimit, adminLogin);
router.get("/me", requireAdminAuth, adminMe);
router.post("/logout", verifyAdminOrigin, requireCsrf, adminLogout);

export default router;
