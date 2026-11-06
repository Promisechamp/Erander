import { createAuthClient } from "../modules/auth/authSession.js";
import { clearAdminSessionCookies, setAdminSessionCookies } from "../modules/admin/auth/adminAuthSession.js";
import { findActiveAdminByAuthUser } from "../modules/admin/auth/adminAuth.service.js";

export async function requireAdminAuth(req, res, next) {
  try {
    const accessToken = req.cookies?.erander_admin_access;
    const refreshToken = req.cookies?.erander_admin_refresh;
    const remember = req.cookies?.erander_admin_remember === "1";
    const supabase = createAuthClient();
    let authUser = null;

    if (accessToken) {
      const { data, error } = await supabase.auth.getUser(accessToken);
      if (!error && data?.user) authUser = data.user;
    }

    if (!authUser && refreshToken) {
      const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
      if (!error && data?.session && data?.user) {
        setAdminSessionCookies(res, data.session, remember);
        authUser = data.user;
      }
    }

    if (!authUser) {
      clearAdminSessionCookies(res);
      return res.status(401).json({ success: false, message: "Your admin session has expired. Please sign in again." });
    }

    const admin = await findActiveAdminByAuthUser(authUser);
    if (!admin) {
      clearAdminSessionCookies(res);
      return res.status(403).json({ success: false, message: "This account does not have active administrator access." });
    }

    req.user = authUser;
    req.admin = admin;
    return next();
  } catch (error) {
    return next(error);
  }
}
