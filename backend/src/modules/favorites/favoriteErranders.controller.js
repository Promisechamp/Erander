import { getDatabasePool } from "../../config/database.js";

class FavoriteError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function fail(status, message) {
  throw new FavoriteError(status, message);
}

function normalizeRoles(value) {
  if (Array.isArray(value)) return value.map((role) => String(role).trim().toLowerCase());
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((role) => String(role).trim().toLowerCase());
    } catch {
      return value.split(/[;,]/).map((role) => role.trim().toLowerCase()).filter(Boolean);
    }
  }
  return [];
}

function isEligibleErander(profile) {
  const roles = normalizeRoles(profile?.user_roles);
  return profile?.account_status === "active" && roles.includes("erander");
}

function handleError(res, error) {
  if (error instanceof FavoriteError) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  if (error?.code === "23505") {
    return res.status(409).json({ success: false, message: "This erander is already in your favorites." });
  }
  if (error?.code === "23503") {
    return res.status(400).json({ success: false, message: "This favorite could not be saved." });
  }
  console.error("Favorite erranders error:", error?.message);
  return res.status(500).json({ success: false, message: "We couldn't process your favorites right now. Please try again." });
}

function authenticatedUserId(req) {
  const id = req.user?.id;
  if (!id) fail(401, "Authentication is required.");
  return id;
}

async function requireCustomer(pool, userId) {
  const result = await pool.query(
    `SELECT user_roles, account_status FROM public.profiles WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const profile = result.rows[0];
  if (!profile || profile.account_status !== "active") fail(403, "An active customer account is required.");
  const roles = normalizeRoles(profile.user_roles);
  if (!roles.includes("customer")) fail(403, "This feature is available to customer accounts.");
}

export async function listFavoriteErranders(req, res) {
  try {
    const customerId = authenticatedUserId(req);
    const pool = getDatabasePool();
    await requireCustomer(pool, customerId);
    const result = await pool.query(
      `SELECT
         f.id AS favorite_id,
         f.created_at AS favorited_at,
         p.id AS erander_id,
         p.first_name,
         p.last_name,
         p.other_names,
         p.display_name,
         p.avatar_url,
         p.user_roles,
         p.account_status,
         p.created_at AS member_since
       FROM public.favorite_erranders f
       JOIN public.profiles p ON p.id = f.erander_id
       WHERE f.customer_id = $1
       ORDER BY f.created_at DESC`,
      [customerId]
    );
    const favorites = result.rows.map((row) => ({
      id: row.favorite_id,
      erander_id: row.erander_id,
      name: row.display_name || [row.first_name, row.other_names, row.last_name].filter(Boolean).join(" ").trim() || "ERANDER member",
      avatar_url: row.avatar_url || null,
      account_status: row.account_status,
      is_assignable: isEligibleErander(row),
      favorited_at: row.favorited_at,
      member_since: row.member_since,
    }));
    return res.status(200).json({ success: true, data: { favorites } });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function addFavoriteErander(req, res) {
  try {
    const customerId = authenticatedUserId(req);
    const eranderId = String(req.params.eranderId || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eranderId)) {
      fail(400, "A valid erander account is required.");
    }
    if (customerId === eranderId) fail(400, "You cannot add your own account to favorites.");
    const pool = getDatabasePool();
    await requireCustomer(pool, customerId);
    const profileResult = await pool.query(
      `SELECT id, user_roles, account_status FROM public.profiles WHERE id = $1 LIMIT 1`,
      [eranderId]
    );
    if (!profileResult.rows[0] || !isEligibleErander(profileResult.rows[0])) {
      fail(404, "This account cannot be added as an erander. Check the details and try again.");
    }
    const inserted = await pool.query(
      `INSERT INTO public.favorite_erranders (customer_id, erander_id)
       VALUES ($1, $2)
       ON CONFLICT (customer_id, erander_id) DO NOTHING
       RETURNING id, created_at`,
      [customerId, eranderId]
    );
    if (!inserted.rows.length) fail(409, "This erander is already in your favorites.");
    return res.status(201).json({ success: true, message: "Erander added to your favorites.", data: { favorite: inserted.rows[0] } });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function addFavoriteEranderByEmail(req, res) {
  try {
    const customerId = authenticatedUserId(req);
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail(400, "Enter a valid email address.");
    }
    const pool = getDatabasePool();
    await requireCustomer(pool, customerId);

    // Deliberately use one generic response for unknown, inactive and non-erander accounts.
    // This prevents this endpoint becoming an email/account-enumeration service.
    const account = await pool.query(
      `SELECT p.id, p.user_roles, p.account_status
       FROM auth.users u
       JOIN public.profiles p ON p.id = u.id
       WHERE lower(u.email) = $1
       LIMIT 1`,
      [email]
    );
    const erander = account.rows[0];
    if (!erander || !isEligibleErander(erander) || erander.id === customerId) {
      return res.status(404).json({ success: false, message: "We couldn't add an eligible erander with those details. Check the email address and try again." });
    }
    const inserted = await pool.query(
      `INSERT INTO public.favorite_erranders (customer_id, erander_id)
       VALUES ($1, $2)
       ON CONFLICT (customer_id, erander_id) DO NOTHING
       RETURNING id`,
      [customerId, erander.id]
    );
    if (!inserted.rows.length) {
      return res.status(409).json({ success: false, message: "This erander is already in your favorites." });
    }
    return res.status(201).json({ success: true, message: "Erander added to your favorites." });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function removeFavoriteErander(req, res) {
  try {
    const customerId = authenticatedUserId(req);
    const eranderId = String(req.params.eranderId || "").trim();
    const pool = getDatabasePool();
    await requireCustomer(pool, customerId);
    const result = await pool.query(
      `DELETE FROM public.favorite_erranders WHERE customer_id = $1 AND erander_id = $2 RETURNING id`,
      [customerId, eranderId]
    );
    if (!result.rowCount) fail(404, "This erander is not in your favorites.");
    return res.status(200).json({ success: true, message: "Erander removed from your favorites." });
  } catch (error) {
    return handleError(res, error);
  }
}
