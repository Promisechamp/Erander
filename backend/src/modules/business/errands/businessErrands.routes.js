import { Router } from "express";

import { requireBusinessAuth } from "../../../middleware/requireBusinessAuth.js";
import { requireCsrf } from "../../../middleware/csrfProtection.js";
import { createBusinessErrand, listBusinessErrands } from "../../erands/erand.controller.js";

const router = Router();

router.use(requireBusinessAuth);
router.get("/", listBusinessErrands);
router.post("/", requireCsrf, createBusinessErrand);

export default router;
