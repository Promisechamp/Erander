import { getDatabasePool } from "../../../config/database.js";

function normalizeRoles(value) {
  if (Array.isArray(value)) return value.map((role) => String(role).trim().toLowerCase());
  if (typeof value === "string") {
    try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.map((role) => String(role).trim().toLowerCase()); } catch { return value.split(/[;,]/).map((role) => role.trim().toLowerCase()).filter(Boolean); }
  }
  return [];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendError(res, error) {
  if (error?.code === "23505") return res.status(409).json({ success: false, message: "This erander is already in your business favourites." });
  if (error?.code === "23503") return res.status(400).json({ success: false, message: "This favourite could not be saved." });
  console.error("Business favourites error:", error?.message || error);
  return res.status(500).json({ success: false, message: "We couldn't process business favourites right now." });
}

export async function listBusinessFavoriteErranders(req, res) {
  try {
    const businessId = req.business?.business_id;
    if (!businessId) return res.status(401).json({ success: false, message: "A business session is required." });
    const result = await getDatabasePool().query(
      `SELECT f.id AS favorite_id, f.created_at AS favorited_at,
              p.id AS erander_id, p.first_name, p.last_name, p.display_name,
              p.avatar_url, p.account_status, p.user_roles
         FROM public.business_favorite_erranders f
         JOIN public.profiles p ON p.id = f.erander_id
        WHERE f.business_id = $1
        ORDER BY f.created_at DESC`, [businessId]
    );
    const favorites = result.rows.map((row) => ({
      id: row.favorite_id, erander_id: row.erander_id,
      name: row.display_name || [row.first_name, row.last_name].filter(Boolean).join(" ") || "ERANDER member",
      avatar_url: row.avatar_url || null, account_status: row.account_status,
      is_assignable: row.account_status === "active" && normalizeRoles(row.user_roles).includes("erander"),
      favorited_at: row.favorited_at,
    }));
    return res.json({ success: true, data: { favorites } });
  } catch (error) { return sendError(res, error); }
}

export async function addBusinessFavoriteErander(req, res) {
  try {
    const businessId = req.business?.business_id;
    const userId = req.user?.id;
    const eranderId = String(req.params.eranderId || "");
    if (!businessId || !userId) return res.status(401).json({ success: false, message: "A business session is required." });
    if (!UUID.test(eranderId)) return res.status(400).json({ success: false, message: "A valid erander account is required." });
    if (eranderId === userId) return res.status(400).json({ success: false, message: "You cannot favourite your own account." });
    const pool = getDatabasePool();
    const profile = await pool.query(`SELECT id, account_status, user_roles FROM public.profiles WHERE id = $1`, [eranderId]);
    const row = profile.rows[0];
    const roles = normalizeRoles(row?.user_roles);
    if (!row || row.account_status !== "active" || !roles.includes("erander")) {
      return res.status(404).json({ success: false, message: "This account is not an active erander." });
    }
    const inserted = await pool.query(
      `INSERT INTO public.business_favorite_erranders (business_id, erander_id, created_by)
       VALUES ($1, $2, $3) RETURNING id, created_at`, [businessId, eranderId, userId]
    );
    return res.status(201).json({ success: true, message: "Erander added to business favourites.", data: { favorite: inserted.rows[0] } });
  } catch (error) { return sendError(res, error); }
}

export async function removeBusinessFavoriteErander(req, res) {
  try {
    const businessId = req.business?.business_id;
    const eranderId = String(req.params.eranderId || "");
    if (!businessId) return res.status(401).json({ success: false, message: "A business session is required." });
    if (!UUID.test(eranderId)) return res.status(400).json({ success: false, message: "A valid erander account is required." });
    const result = await getDatabasePool().query(
      `DELETE FROM public.business_favorite_erranders WHERE business_id = $1 AND erander_id = $2 RETURNING id`, [businessId, eranderId]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: "This erander is not in your business favourites." });
    return res.json({ success: true, message: "Erander removed from business favourites." });
  } catch (error) { return sendError(res, error); }
}
