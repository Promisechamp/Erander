import { getDatabasePool } from "../../../config/database.js";

export async function listActiveBusinessMemberships(userId) {
  if (!userId) return [];

  const result = await getDatabasePool().query(
    `SELECT
        b.id AS business_id,
        b.name,
        b.legal_name,
        b.description,
        b.logo_url,
        b.website,
        b.email,
        b.phone,
        b.country_code,
        b.verification_status,
        b.account_status,
        bm.id AS membership_id,
        bm.membership_role,
        bm.membership_status
       FROM public.business_members bm
       JOIN public.businesses b ON b.id = bm.business_id
      WHERE bm.user_id = $1
        AND bm.membership_status = 'active'
        AND b.account_status = 'active'
      ORDER BY
        CASE bm.membership_role
          WHEN 'owner' THEN 0
          WHEN 'admin' THEN 1
          WHEN 'manager' THEN 2
          ELSE 3
        END,
        b.created_at ASC`,
    [userId]
  );

  return result.rows;
}

export async function findActiveBusinessMembership(userId, businessId) {
  if (!userId || !businessId) return null;

  const result = await getDatabasePool().query(
    `SELECT
        b.id AS business_id,
        b.name,
        b.legal_name,
        b.description,
        b.logo_url,
        b.website,
        b.email,
        b.phone,
        b.country_code,
        b.verification_status,
        b.account_status,
        bm.id AS membership_id,
        bm.membership_role,
        bm.membership_status
       FROM public.business_members bm
       JOIN public.businesses b ON b.id = bm.business_id
      WHERE bm.user_id = $1
        AND bm.business_id = $2
        AND bm.membership_status = 'active'
        AND b.account_status = 'active'
      LIMIT 1`,
    [userId, businessId]
  );

  return result.rows[0] ?? null;
}

export function canCreateBusinessErrands(membership) {
  if (!membership) return false;
  return ["owner", "admin", "manager"].includes(
    String(membership.membership_role || "").toLowerCase()
  );
}
