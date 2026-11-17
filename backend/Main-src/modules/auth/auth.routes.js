import { Router } from "express";

import {
  register,
  login,
  me,
  logout,
} from "./auth.controller.js";

import {
  registrationValidation,
  handleRegistrationValidation,
} from "./auth.validation.js";

import { loginRateLimit } from "../../middleware/authRateLimit.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { env } from "../../config/env.js";
import { issueCsrfToken, requireCsrf, } from "../../middleware/csrfProtection.js";

const router = Router();
router.get("/csrf", issueCsrfToken);

// Reject browser requests originating from unexpected websites.
function verifyOrigin(req, res, next) {
  const origin = req.get("origin");
  const allowedOrigin = env.frontendUrl.replace(/\/$/, "");

  if (origin && origin !== allowedOrigin) {
    return res.status(403).json({
      success: false,
      message: "This request is not permitted.",
    });
  }

  next();
}

router.post(
  "/register",
  verifyOrigin,
		requireCsrf,
  registrationValidation,
  handleRegistrationValidation,
  register
);

router.post(
  "/login",
  verifyOrigin,
		requireCsrf,
  loginRateLimit,
  login
);

// Return the verified, currently authenticated user.
router.get("/me", requireAuth, me);

// Clear authentication cookies.
router.post("/logout", verifyOrigin, logout);

export default router;