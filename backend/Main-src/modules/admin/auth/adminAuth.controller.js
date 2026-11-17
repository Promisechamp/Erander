import { createAuthClient } from "../../auth/authSession.js";
import { clearAdminSessionCookies, setAdminSessionCookies } from "./adminAuthSession.js";
import { findActiveAdminByAuthUser } from "./adminAuth.service.js";

export async function adminLogin(req, res, next) {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const remember = req.body?.remember !== false;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const { data, error } = await createAuthClient().auth.signInWithPassword({ email, password });
    if (error || !data?.user || !data?.session) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const admin = await findActiveAdminByAuthUser(data.user);
    if (!admin) {
      return res.status(403).json({ success: false, message: "This account is not authorized to access the admin workspace." });
    }

    setAdminSessionCookies(res, data.session, remember);
    return res.status(200).json({ success: true, message: "Admin sign-in successful.", data: { admin } });
  } catch (error) {
    return next(error);
  }
}

export function adminMe(req, res) {
  return res.status(200).json({ success: true, data: { admin: req.admin } });
}

export function adminLogout(req, res) {
  clearAdminSessionCookies(res);
  return res.status(200).json({ success: true, message: "Admin signed out successfully." });
}
