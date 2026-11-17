import { Router } from "express";

import {
  listMyAddresses,
  createMyAddress,
  setMyDefaultAddress,
  updateMyAddress,
  deleteMyAddress,
} from "./address.controller.js";

import { requireAuth } from "../../middleware/requireAuth.js";
import { requireCsrf } from "../../middleware/csrfProtection.js";

const router = Router();

// All profile routes require an authenticated user.
router.use(requireAuth);

// Saved addresses
router.get("/addresses", listMyAddresses);

router.post("/addresses", requireCsrf, createMyAddress);

router.patch(
  "/addresses/:id/default",
  requireCsrf,
  setMyDefaultAddress
);

router.patch("/addresses/:id", requireCsrf, updateMyAddress);

router.delete("/addresses/:id", requireCsrf, deleteMyAddress);

export default router;