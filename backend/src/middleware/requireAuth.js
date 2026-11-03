import {
  createAuthClient,
  setSessionCookies,
  clearSessionCookies,
} from "../modules/auth/authSession.js";

export async function requireAuth(req, res, next) {
  try {
    const accessToken = req.cookies?.erander_access;
    const refreshToken = req.cookies?.erander_refresh;
    const remember = req.cookies?.erander_remember === "1";

    const supabase = createAuthClient();

    // First, verify the existing access token.
    if (accessToken) {
      const { data, error } = await supabase.auth.getUser(accessToken);

      if (!error && data.user) {
        req.user = data.user;
        return next();
      }
    }

    // If the access token is missing or expired, try refreshing it.
    if (refreshToken) {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (!error && data.session && data.user) {
        setSessionCookies(res, data.session, remember);

        req.user = data.user;
        return next();
      }
    }

    clearSessionCookies(res);

    return res.status(401).json({
      success: false,
      message: "Your session has expired. Please sign in again.",
    });
  } catch (error) {
    next(error);
  }
}