import { Router } from "express";
import { requireBusinessAuth } from "../../../middleware/requireBusinessAuth.js";
import { requireCsrf } from "../../../middleware/csrfProtection.js";
import { addBusinessFavoriteErander, listBusinessFavoriteErranders, removeBusinessFavoriteErander } from "./businessFavoriteErranders.controller.js";

const router = Router();
router.use(requireBusinessAuth);
router.get("/", listBusinessFavoriteErranders);
router.post("/:eranderId", requireCsrf, addBusinessFavoriteErander);
router.delete("/:eranderId", requireCsrf, removeBusinessFavoriteErander);
export default router;
