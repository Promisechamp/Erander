import { Router } from "express";
import {
  businessMe,
  loginBusiness,
  logoutBusiness,
  registerBusiness,
  updateBusinessProfile,
} from "./businessAuth.controller.js";
import { requireBusinessAuth } from "../../../middleware/requireBusinessAuth.js";
import { loginRateLimit } from "../../../middleware/authRateLimit.js";
import { env } from "../../../config/env.js";
import { issueCsrfToken, requireCsrf } from "../../../middleware/csrfProtection.js";

const router = Router();

function verifyBusinessOrigin(req, res, next) {
  const origin = req.get("origin");
  const allowedOrigin = env.frontendUrl.replace(/\/$/, "");
  if (origin && origin !== allowedOrigin) {
    return res.status(403).json({ success: false, message: "This request is not permitted." });
  }
  return next();
}

router.get("/csrf", issueCsrfToken);
router.post("/register", verifyBusinessOrigin, requireCsrf, registerBusiness);
router.post("/login", verifyBusinessOrigin, requireCsrf, loginRateLimit, loginBusiness);
router.get("/me", requireBusinessAuth, businessMe);
router.patch("/profile", requireBusinessAuth, requireCsrf, updateBusinessProfile);
router.post("/logout", verifyBusinessOrigin, requireCsrf, logoutBusiness);

export default router;
