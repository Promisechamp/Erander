import { Router } from "express";

import { listAvailableErrands } from "./available-erands.controller.js";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = Router();

router.use(requireAuth);

router.get("/", listAvailableErrands);

export default router;