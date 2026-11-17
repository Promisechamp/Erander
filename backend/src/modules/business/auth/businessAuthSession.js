import { env } from "../../../config/env.js";

const cookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "strict",
  path: "/api/v1",
};

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export function setBusinessSessionCookies(res, session, businessId, remember = true) {
  const accessLifetime = Math.max(1, Number(session.expires_in) || 3600) * 1000;

  res.cookie("erander_business_access", session.access_token, {
    ...cookieOptions,
    maxAge: accessLifetime,
  });
  if (session.refresh_token) {
    res.cookie("erander_business_refresh", session.refresh_token, {
      ...cookieOptions,
      ...(remember ? { maxAge: THIRTY_DAYS } : {}),
    });
  }
  res.cookie("erander_business_remember", remember ? "1" : "0", {
    ...cookieOptions,
    ...(remember ? { maxAge: THIRTY_DAYS } : {}),
  });
  res.cookie("erander_business_id", businessId, {
    ...cookieOptions,
    ...(remember ? { maxAge: THIRTY_DAYS } : {}),
  });
}

export function clearBusinessSessionCookies(res) {
  res.clearCookie("erander_business_access", cookieOptions);
  res.clearCookie("erander_business_refresh", cookieOptions);
  res.clearCookie("erander_business_remember", cookieOptions);
  res.clearCookie("erander_business_id", cookieOptions);
}
