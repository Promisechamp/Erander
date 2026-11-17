import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env.js";

export function createAuthClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );
}

export const authCookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "strict",
  path: "/api/v1",
};

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export function setSessionCookies(res, session, remember = true) {
  const accessTokenLifetime =
    Math.max(1, Number(session.expires_in) || 3600) * 1000;

  res.cookie("erander_access", session.access_token, {
    ...authCookieOptions,
    maxAge: accessTokenLifetime,
  });

  res.cookie("erander_refresh", session.refresh_token, {
    ...authCookieOptions,
    ...(remember ? { maxAge: THIRTY_DAYS } : {}),
  });

  res.cookie("erander_remember", remember ? "1" : "0", {
    ...authCookieOptions,
    ...(remember ? { maxAge: THIRTY_DAYS } : {}),
  });
}

export function clearSessionCookies(res) {
  res.clearCookie("erander_access", authCookieOptions);
  res.clearCookie("erander_refresh", authCookieOptions);
  res.clearCookie("erander_remember", authCookieOptions);
}