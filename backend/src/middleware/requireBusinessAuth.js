import { createAuthClient } from "../modules/auth/authSession.js";
import {
  clearBusinessSessionCookies,
  setBusinessSessionCookies,
} from "../modules/business/auth/businessAuthSession.js";
import { findActiveBusinessMembership } from "../modules/business/auth/businessAuth.service.js";

export async function requireBusinessAuth(req, res, next) {
  try {
    const accessToken = req.cookies?.erander_business_access;
    const refreshToken = req.cookies?.erander_business_refresh;
    const remember = req.cookies?.erander_business_remember === "1";
    const businessId = req.cookies?.erander_business_id;
    const authClient = createAuthClient();
    let authUser = null;

    if (accessToken) {
      const { data, error } = await authClient.auth.getUser(accessToken);
      if (!error && data?.user) authUser = data.user;
    }

    if (!authUser && refreshToken) {
      const { data, error } = await authClient.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (!error && data?.session && data?.user) {
        setBusinessSessionCookies(res, data.session, businessId, remember);
        authUser = data.user;
      }
    }

    if (!authUser) {
      clearBusinessSessionCookies(res);
      return res.status(401).json({
        success: false,
        message: "Your business session has expired. Please sign in again.",
      });
    }

    if (!businessId) {
      clearBusinessSessionCookies(res);
      return res.status(401).json({
        success: false,
        message: "Select a business account to continue.",
      });
    }

    const membership = await findActiveBusinessMembership(authUser.id, businessId);
    if (!membership) {
      clearBusinessSessionCookies(res);
      return res.status(403).json({
        success: false,
        message: "You no longer have access to this business account.",
      });
    }

    req.user = authUser;
    req.business = membership;
    return next();
  } catch (error) {
    return next(error);
  }
}
