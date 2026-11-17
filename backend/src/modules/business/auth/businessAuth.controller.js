import { getDatabasePool } from "../../../config/database.js";
import { createAuthClient } from "../../auth/authSession.js";
import { supabaseAdmin } from "../../../config/supabase.js";
import {
  clearBusinessSessionCookies,
  setBusinessSessionCookies,
} from "./businessAuthSession.js";
import {
  listActiveBusinessMemberships,
  findActiveBusinessMembership,
} from "./businessAuth.service.js";

function cleanOptionalString(value, maxLength) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function validEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function resolvePersonalSession(req) {
  const accessToken = req.cookies?.erander_access;
  const refreshToken = req.cookies?.erander_refresh;
  const remember = req.cookies?.erander_remember === "1";
  const authClient = createAuthClient();

  if (accessToken) {
    const { data, error } = await authClient.auth.getUser(accessToken);
    if (!error && data?.user) {
      return {
        user: data.user,
        session: { access_token: accessToken, refresh_token: refreshToken || null, expires_in: 3600 },
        remember,
      };
    }
  }

  if (refreshToken) {
    const { data, error } = await authClient.auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (!error && data?.user && data?.session) {
      return { user: data.user, session: data.session, remember };
    }
  }

  return null;
}

export async function registerBusiness(req, res, next) {
  let createdAuthUserId = null;
  let databaseClient = null;

  try {
    const body = req.body ?? {};
    const businessInput = body.business && typeof body.business === "object"
      ? body.business
      : body;

    const name = cleanOptionalString(businessInput.name, 160);
    if (!name) {
      return res.status(400).json({ success: false, message: "Business name is required." });
    }

    const businessEmail = cleanOptionalString(businessInput.email, 254);
    if (businessEmail && !validEmail(businessEmail)) {
      return res.status(400).json({ success: false, message: "Please provide a valid business email address." });
    }

    const countryCode = cleanOptionalString(businessInput.country_code, 2);
    if (countryCode && !/^[A-Za-z]{2}$/.test(countryCode)) {
      return res.status(400).json({ success: false, message: "Country code must be a two-letter ISO country code." });
    }

    let authUser = null;
    let authSession = null;
    let remember = body.remember !== false;

    const existingPersonalSession = await resolvePersonalSession(req);
    if (existingPersonalSession) {
      authUser = existingPersonalSession.user;
      authSession = existingPersonalSession.session;
      remember = existingPersonalSession.remember;
    } else {
      const owner = body.owner && typeof body.owner === "object" ? body.owner : body;
      if (!supabaseAdmin) {
        return res.status(503).json({
          success: false,
          message: "Business self-registration is temporarily unavailable. Sign in to an existing personal ERANDER account and register the business from that session, or contact support.",
        });
      }

      const firstName = cleanOptionalString(owner.first_name, 80);
      const lastName = cleanOptionalString(owner.last_name, 80);
      const email = typeof owner.email === "string" ? owner.email.trim().toLowerCase() : "";
      const phone = cleanOptionalString(owner.phone, 30);
      const password = typeof owner.password === "string" ? owner.password : "";

      if (!firstName || !lastName || !validEmail(email) || !phone || password.length < 8 || password.length > 128) {
        return res.status(400).json({
          success: false,
          message: "Provide the business owner's first name, last name, email, phone number and a password of at least 8 characters, or sign in to an existing personal account first.",
        });
      }

      const { data, error } = await createAuthClient().auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            phone,
            role: "customer",
          },
        },
      });

      if (error || !data?.user) {
        const message = error?.message?.toLowerCase() || "";
        if (message.includes("already registered") || message.includes("already been registered") || error?.code === "user_already_exists") {
          return res.status(409).json({ success: false, message: "A personal account with this email already exists. Sign in to that account before registering the business." });
        }
        if (message.includes("rate limit") || error?.code === "over_email_send_rate_limit") {
          return res.status(429).json({ success: false, message: "Too many registration email requests. Please wait before trying again." });
        }
        return res.status(400).json({ success: false, message: "We couldn't create the business owner's personal account. Please check the details and try again." });
      }

      authUser = data.user;
      authSession = data.session ?? null;
      createdAuthUserId = data.user.id;
    }

    const pool = getDatabasePool();
    databaseClient = await pool.connect();
    await databaseClient.query("BEGIN");

    // The auth.users trigger normally creates this row. This idempotent
    // insert also protects registration if the trigger is not installed.
    await databaseClient.query(
      `INSERT INTO public.profiles (id, email)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [authUser.id, authUser.email || null]
    );

    const businessResult = await databaseClient.query(
      `INSERT INTO public.businesses (
         name, legal_name, description, logo_url, email, phone,
         website, country_code, verification_status, account_status, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'active', $9)
       RETURNING id, name, legal_name, description, logo_url, email, phone,
                 website, country_code, verification_status, account_status,
                 created_by, created_at, updated_at`,
      [
        name,
        cleanOptionalString(businessInput.legal_name, 180),
        cleanOptionalString(businessInput.description, 2000),
        cleanOptionalString(businessInput.logo_url, 1000),
        businessEmail,
        cleanOptionalString(businessInput.phone, 30),
        cleanOptionalString(businessInput.website, 500),
        countryCode?.toUpperCase() ?? null,
        authUser.id,
      ]
    );

    const business = businessResult.rows[0];

    await databaseClient.query(
      `INSERT INTO public.business_members AS existing_member (
         business_id, user_id, membership_role, membership_status,
         joined_at
       ) VALUES ($1, $2, 'owner', 'active', NOW())
       ON CONFLICT (business_id, user_id) DO UPDATE
         SET membership_role = 'owner',
             membership_status = 'active',
             joined_at = COALESCE(existing_member.joined_at, NOW()),
             updated_at = NOW()`,
      [business.id, authUser.id]
    );

    await databaseClient.query("COMMIT");

    if (authSession) {
      setBusinessSessionCookies(res, authSession, business.id, remember);
    } else if (existingPersonalSession?.session) {
      setBusinessSessionCookies(res, existingPersonalSession.session, business.id, remember);
    }

    return res.status(201).json({
      success: true,
      message: authSession || existingPersonalSession?.session
        ? "Your business account has been created. Verification is pending."
        : "Your business registration has been received. Confirm the owner's email, then sign in to access the business workspace.",
      data: {
        business,
        membership: { business_id: business.id, user_id: authUser.id, membership_role: "owner", membership_status: "active" },
        confirmationRequired: !authSession && !existingPersonalSession?.session,
        verificationRequired: true,
      },
    });
  } catch (error) {
    if (databaseClient) {
      try { await databaseClient.query("ROLLBACK"); } catch { /* preserve original error */ }
    }

    // Compensate for an auth account created during this request if the
    // database transaction failed. This requires the configured service key.
    if (createdAuthUserId && supabaseAdmin) {
      try { await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId); } catch (cleanupError) {
        console.error("Business registration auth cleanup failed:", cleanupError?.message);
      }
    }

    return next(error);
  } finally {
    databaseClient?.release();
  }
}

export async function loginBusiness(req, res, next) {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const remember = req.body?.remember !== false;
    const requestedBusinessId = typeof req.body?.business_id === "string" ? req.body.business_id : null;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const { data, error } = await createAuthClient().auth.signInWithPassword({ email, password });
    if (error || !data?.user || !data?.session) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const memberships = await listActiveBusinessMemberships(data.user.id);
    if (!memberships.length) {
      return res.status(403).json({ success: false, message: "This personal account does not have an active business membership." });
    }

    let selectedMembership = null;
    if (requestedBusinessId) {
      selectedMembership = await findActiveBusinessMembership(data.user.id, requestedBusinessId);
      if (!selectedMembership) {
        return res.status(403).json({ success: false, message: "You do not have access to the selected business account." });
      }
    } else if (memberships.length === 1) {
      selectedMembership = memberships[0];
    } else {
      return res.status(409).json({
        success: false,
        message: "Choose which business account you want to access.",
        data: { businesses: memberships },
      });
    }

    const portalUser = await getBusinessPortalUser(data.user.id, data.user.email);
    setBusinessSessionCookies(res, data.session, selectedMembership.business_id, remember);
    return res.status(200).json({
      success: true,
      message: "Business sign-in successful.",
      data: { user: portalUser, business: selectedMembership, businesses: memberships },
    });
  } catch (error) {
    return next(error);
  }
}

async function getBusinessPortalUser(userId, email = null) {
  const result = await getDatabasePool().query(
    `SELECT id, email, first_name, last_name, display_name, preferred_currency
       FROM public.profiles
      WHERE id = $1
      LIMIT 1`,
    [userId],
  );

  const profile = result.rows[0] ?? {};
  return {
    id: userId,
    email: profile.email || email || null,
    first_name: profile.first_name ?? null,
    last_name: profile.last_name ?? null,
    display_name: profile.display_name ?? null,
    preferred_currency: profile.preferred_currency || "USD",
  };
}

export async function businessMe(req, res) {
  const [businesses, user] = await Promise.all([
    listActiveBusinessMemberships(req.user.id),
    getBusinessPortalUser(req.user.id, req.user.email),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      user,
      business: req.business,
      businesses,
    },
  });
}

export function logoutBusiness(_req, res) {
  clearBusinessSessionCookies(res);
  return res.status(200).json({ success: true, message: "Business signed out successfully." });
}

/** Update the business-facing identity. Personal profile identity is untouched. */
export async function updateBusinessProfile(req, res, next) {
  try {
    const role = String(req.business?.membership_role || "").toLowerCase();
    if (!req.business?.business_id || !["owner", "admin"].includes(role)) {
      return res.status(403).json({ success: false, message: "Only a business owner or administrator can update business branding." });
    }

    const input = req.body?.business && typeof req.body.business === "object" ? req.body.business : req.body || {};
    const clean = (value, max) => {
      if (value === undefined) return undefined;
      if (value === null || value === "") return null;
      if (typeof value !== "string") return undefined;
      const result = value.trim();
      return result ? result.slice(0, max) : null;
    };
    const fields = {
      name: clean(input.name, 160),
      legal_name: clean(input.legal_name, 180),
      description: clean(input.description, 2000),
      logo_url: clean(input.logo_url, 1000),
      email: clean(input.email, 254),
      phone: clean(input.phone, 30),
      website: clean(input.website, 500),
    };
    if (fields.name === null) {
      return res.status(400).json({ success: false, message: "Business name cannot be empty." });
    }
    if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      return res.status(400).json({ success: false, message: "Enter a valid business email address." });
    }
    for (const key of ["logo_url", "website"]) {
      if (fields[key] && !/^https:\/\//i.test(fields[key])) {
        return res.status(400).json({ success: false, message: `${key === "logo_url" ? "Logo" : "Website"} URL must use HTTPS.` });
      }
    }

    const allowed = Object.entries(fields).filter(([, value]) => value !== undefined);
    if (!allowed.length) {
      return res.status(400).json({ success: false, message: "Provide at least one business profile field to update." });
    }
    const setSql = allowed.map(([key], index) => `${key} = $${index + 2}`).join(", ");
    const values = [req.business.business_id, ...allowed.map(([, value]) => value)];
    const result = await getDatabasePool().query(
      `UPDATE public.businesses SET ${setSql}, updated_at = now()
        WHERE id = $1 AND account_status = 'active'
        RETURNING id AS business_id, name, legal_name, description, logo_url,
                  email, phone, website, country_code, verification_status,
                  account_status`,
      values
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: "Business account not found." });
    return res.json({ success: true, message: "Business profile updated.", data: { business: { ...req.business, ...result.rows[0] } } });
  } catch (error) {
    return next(error);
  }
}
