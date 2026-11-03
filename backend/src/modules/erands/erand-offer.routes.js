import { Router } from "express";

import {
  acceptOffer,
  createOffer,
  listErrandOffers,
  listMyOffers,
  rejectOffer,
  withdrawOffer,
} from "./erand-offer.controller.js";

import { requireAuth } from "../../middleware/requireAuth.js";
import { requireCsrf } from "../../middleware/csrfProtection.js";

const router = Router();

/*
 * All offer routes require an authenticated user.
 * State-changing routes also require CSRF verification.
 */
router.use(requireAuth);

/*
 * Offers belonging to a particular errand.
 */
router.get("/erands/:erandId/offers", listErrandOffers);

router.post(
  "/erands/:erandId/offers",
  requireCsrf,
  createOffer
);

/*
 * Offers submitted by the current erander.
 */
router.get("/erand-offers/mine", listMyOffers);

/*
 * Actions on individual offers.
 */
router.post(
  "/erand-offers/:offerId/withdraw",
  requireCsrf,
  withdrawOffer
);

router.post(
  "/erand-offers/:offerId/reject",
  requireCsrf,
  rejectOffer
);

router.post(
  "/erand-offers/:offerId/accept",
  requireCsrf,
  acceptOffer
);

export default router;