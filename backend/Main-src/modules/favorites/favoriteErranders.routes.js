import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireCsrf } from "../../middleware/csrfProtection.js";
import {
  listFavoriteErranders,
  addFavoriteErander,
  addFavoriteEranderByEmail,
  removeFavoriteErander,
} from "./favoriteErranders.controller.js";

const router = Router();
router.use(requireAuth);
router.get("/", listFavoriteErranders);
router.post("/by-email", requireCsrf, addFavoriteEranderByEmail);
router.post("/:eranderId", requireCsrf, addFavoriteErander);
router.delete("/:eranderId", requireCsrf, removeFavoriteErander);
export default router;
