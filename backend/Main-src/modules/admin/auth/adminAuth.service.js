import { getDatabasePool } from "../../../config/database.js";
import { getAdminPermissions } from "./adminPermissions.js";

export async function findActiveAdminByAuthUser(authUser) {
  if (!authUser?.id) return null;

  const result = await getDatabasePool().query(
    `SELECT p.id, p.first_name, p.last_name, p.display_name, p.avatar_url,
            p.phone, p.account_status, ara.role_code
       FROM public.profiles p
       JOIN public.admin_role_assignments ara ON ara.profile_id = p.id
      WHERE p.id = $1
        AND p.account_status = 'active'
        AND ara.assignment_status = 'active'
      ORDER BY ara.role_code`,
    [authUser.id]
  );

  if (!result.rows.length) return null;
  const row = result.rows[0];
  const roles = [...new Set(result.rows.map((item) => item.role_code))];

  return {
    id: row.id,
    email: authUser.email || null,
    profile: {
      first_name: row.first_name,
      last_name: row.last_name,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      phone: row.phone,
      account_status: row.account_status,
    },
    roles,
    permissions: getAdminPermissions(roles),
  };
}
