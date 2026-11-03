import { Router } from "express";

import authRoutes from "../modules/auth/auth.routes.js";
import profileRoutes from "../modules/profiles/profile.routes.js";
import erandRoutes from "../modules/erands/erand.routes.js";
import availableErandRoutes from "../modules/erands/available-erands.routes.js";
import erandOfferRoutes from "../modules/erands/erand-offer.routes.js";
import paymentRoutes from "../modules/payments/payment.routes.js";

const router = Router();

// API status
router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to the ERANDER API.",
    version: "1.0.0",
  });
});

// Authentication routes
router.use("/auth", authRoutes);

// User profile and saved addresses
router.use("/profiles", profileRoutes);

// Available errands for eranders
router.use("/erands/available", availableErandRoutes);

// Customer errand management
router.use("/erands", erandRoutes);

// Erander offers
router.use("/", erandOfferRoutes);

// Customer payment operations
router.use("/payments", paymentRoutes);

export default router;