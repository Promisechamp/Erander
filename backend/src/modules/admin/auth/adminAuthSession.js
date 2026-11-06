import { env } from "../../../config/env.js";

const cookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "strict",
  path: "/api/v1",
};
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export function setAdminSessionCookies(res, session, remember = true) {
  res.cookie("erander_admin_access", session.access_token, {
    ...cookieOptions,
    maxAge: Math.max(1, Number(session.expires_in) || 3600) * 1000,
  });
  res.cookie("erander_admin_refresh", session.refresh_token, {
    ...cookieOptions,
    ...(remember ? { maxAge: THIRTY_DAYS } : {}),
  });
  res.cookie("erander_admin_remember", remember ? "1" : "0", {
    ...cookieOptions,
    ...(remember ? { maxAge: THIRTY_DAYS } : {}),
  });
}

export function clearAdminSessionCookies(res) {
  res.clearCookie("erander_admin_access", cookieOptions);
  res.clearCookie("erander_admin_refresh", cookieOptions);
  res.clearCookie("erander_admin_remember", cookieOptions);
}
