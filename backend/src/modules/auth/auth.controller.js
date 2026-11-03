import supabase from "../../config/supabase.js";
import { getDatabasePool } from "../../config/database.js";

import {
  createAuthClient,
  setSessionCookies,
  clearSessionCookies,
} from "./authSession.js";

import { clearCsrfCookie } from "../../middleware/csrfProtection.js";

export async function register(req, res, next) {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      password,
      role,
    } = req.body;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name,
          last_name,
          phone,
          role,
        },
      },
    });

    if (error) {
      console.error("Registration failed:", {
        message: error.message,
        status: error.status,
        code: error.code,
      });

      const errorMessage = error.message?.toLowerCase() || "";

      if (
        errorMessage.includes("rate limit") ||
        errorMessage.includes("email rate limit") ||
        error.code === "over_email_send_rate_limit"
      ) {
        return res.status(429).json({
          success: false,
          message:
            "Too many registration email requests. Please wait before trying again.",
        });
      }

      if (
        errorMessage.includes("already registered") ||
        errorMessage.includes("already been registered") ||
        error.code === "user_already_exists"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "An account with this email may already exist. Try signing in instead.",
        });
      }

      const status =
        error.status >= 400 && error.status < 500
          ? error.status
          : 400;

      return res.status(status).json({
        success: false,
        message:
          "We couldn't complete your registration. Please check your details and try again.",
      });
    }

    if (!data.user) {
      return res.status(500).json({
        success: false,
        message:
          "Your account could not be created. Please try again.",
      });
    }

    const confirmationRequired = !data.session;

    return res.status(201).json({
      success: true,
      message: confirmationRequired
        ? "Registration received. Please check your email for a confirmation link."
        : "Your account has been created successfully.",
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        confirmationRequired,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const {
      email,
      password,
      remember = true,
    } = req.body ?? {};

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter your email and password.",
      });
    }

    const authClient = createAuthClient();

    const { data, error } =
      await authClient.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (error || !data.user || !data.session) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password. Please try again.",
      });
    }

    setSessionCookies(
      res,
      data.session,
      remember === true
    );

    return res.status(200).json({
      success: true,
      message: "Welcome back to ERANDER!",
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
          user_metadata: data.user.user_metadata,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/auth/me
 *
 * Returns the authenticated Supabase user together with
 * their PostgreSQL profile and saved addresses.
 */
export async function me(req, res, next) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    const pool = getDatabasePool();

    const result = await pool.query(
      `SELECT
          id,
          first_name,
          last_name,
          other_names,
          display_name,
          avatar_url,
          phone,
          user_roles,
          account_status,
          addresses,
          created_at,
          updated_at
       FROM public.profiles
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    const profile = result.rows[0] ?? null;

    let normalizedProfile = profile;

    if (profile) {
      let addresses = profile.addresses;

      if (typeof addresses === "string") {
        try {
          addresses = JSON.parse(addresses);
        } catch {
          console.error(
            "Profile addresses could not be parsed for user:",
            userId
          );

          return res.status(500).json({
            success: false,
            message:
              "Your profile addresses could not be retrieved.",
          });
        }
      }

      if (!Array.isArray(addresses)) {
        console.error(
          "Profile addresses are not an array for user:",
          userId
        );

        return res.status(500).json({
          success: false,
          message:
            "Your profile addresses could not be retrieved.",
        });
      }

      normalizedProfile = {
        ...profile,
        addresses,
      };
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          user_metadata: req.user.user_metadata,
        },
        profile: normalizedProfile,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res) {
  clearSessionCookies(res);
  clearCsrfCookie(res);

  return res.status(200).json({
    success: true,
    message: "You've signed out successfully.",
  });
}