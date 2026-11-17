import { Router } from "express";

import {
  createErrand,
  listMyErands,
  getMyErand,
  updateMyErand,
		deleteMyErand,
  closeMyErand,
} from "./erand.controller.js";

import { requireAuth } from "../../middleware/requireAuth.js";
import { requireCsrf } from "../../middleware/csrfProtection.js";

const router = Router();

// Every errand route requires an authenticated session.
router.use(requireAuth);

// Create an errand and its optional shopping-list items.
router.post("/", requireCsrf, createErrand);

// List the authenticated customer's errands.
router.get("/", listMyErands);

// Retrieve one of the authenticated customer's errands.
router.get("/:id", getMyErand);

// Update an eligible request.
router.patch("/:id", requireCsrf, updateMyErand);
router.delete("/:id", requireCsrf, deleteMyErand);

// Stop accepting new offers.
router.post("/:id/close", requireCsrf, closeMyErand);

export default router;