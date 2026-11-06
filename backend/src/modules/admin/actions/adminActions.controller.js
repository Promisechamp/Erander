import { createClient } from "@supabase/supabase-js";
import { getDatabasePool } from "../../../config/database.js";
import { hasAdminPermission } from "../auth/adminPermissions.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADMIN_ROLES = ["super_admin", "finance_admin", "support_admin", "trust_safety_admin", "verification_admin", "operations_admin", "read_only_auditor"];

function fail(res, status, message, code = "ADMIN_ACTION_FAILED") {
  return res.status(status).json({ success: false, message, code });
}

function text(value, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function requirePermission(req, res, permission) {
  if (!hasAdminPermission(req.admin, permission)) {
    fail(res, 403, `You do not have permission to perform this action (${permission}).`, "ADMIN_PERMISSION_REQUIRED");
    return false;
  }
  return true;
}

function adminSupabase(req) {
  const accessToken = req.adminAccessToken;
  if (!accessToken) throw new Error("The administrator access token is not available for this operation. Sign in again.");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase client configuration is incomplete.");
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function writeAudit(client, req, { action, entityType, entityId, reason, before = {}, after = {}, metadata = {} }) {
  await client.query(
    `INSERT INTO public.admin_action_audit_logs
       (actor_id, action, entity_type, entity_id, reason, before_data, after_data, metadata)
     VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)`,
    [req.admin.id, action, entityType, String(entityId), reason, JSON.stringify(before), JSON.stringify(after), JSON.stringify(metadata)]
  );
}

function rpcError(error) {
  const message = text(error?.message || error?.details || "The database operation failed.", 500);
  return message.replace(/\s+/g, " ");
}

export async function getProfileAdminRoles(req, res, next) {
  if (!requirePermission(req, res, "admin_roles:manage")) return;
  const { profileId } = req.params;
  if (!UUID.test(profileId)) return fail(res, 400, "A valid profile ID is required.", "INVALID_PROFILE_ID");
  try {
    const result = await getDatabasePool().query(
      `SELECT id, role_code, assignment_status, reason, assigned_at, assigned_by, revoked_at, revoked_by
         FROM public.admin_role_assignments
        WHERE profile_id = $1::uuid
        ORDER BY role_code`,
      [profileId]
    );
    return res.json({ success: true, data: { assignments: result.rows, availableRoles: ADMIN_ROLES } });
  } catch (error) { return next(error); }
}

export async function setProfileAdminRole(req, res) {
  if (!requirePermission(req, res, "admin_roles:manage")) return;
  const { profileId, roleCode } = req.params;
  const activate = req.body?.activate === true;
  const reason = text(req.body?.reason, 1000);
  if (!UUID.test(profileId)) return fail(res, 400, "A valid profile ID is required.", "INVALID_PROFILE_ID");
  if (!ADMIN_ROLES.includes(roleCode)) return fail(res, 400, "Choose a valid administrator role.", "INVALID_ADMIN_ROLE");
  if (reason.length < 5) return fail(res, 400, "A reason of at least five characters is required.", "ADMIN_REASON_REQUIRED");
  try {
    const { data, error } = await adminSupabase(req).rpc("set_admin_role_assignment", {
      p_profile_id: profileId, p_role_code: roleCode, p_activate: activate, p_reason: reason,
    });
    if (error) return fail(res, 409, rpcError(error), "ADMIN_ROLE_ASSIGNMENT_REJECTED");
    return res.json({ success: true, message: `Administrator role ${activate ? "assigned" : "revoked"}.`, data: { assignmentId: data } });
  } catch (error) { return fail(res, 500, rpcError(error)); }
}

export async function updateProfileAccountStatus(req, res, next) {
  if (!requirePermission(req, res, "users:restrict")) return;
  const { profileId } = req.params;
  const status = text(req.body?.status, 30);
  const reason = text(req.body?.reason, 1000);
  if (!UUID.test(profileId)) return fail(res, 400, "A valid profile ID is required.", "INVALID_PROFILE_ID");
  if (!["active", "suspended", "deactivated"].includes(status)) return fail(res, 400, "Choose active, suspended or deactivated.", "INVALID_ACCOUNT_STATUS");
  if (reason.length < 10) return fail(res, 400, "A reason of at least ten characters is required.", "ADMIN_REASON_REQUIRED");
  const pool = getDatabasePool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query("SELECT id, account_status FROM public.profiles WHERE id = $1::uuid FOR UPDATE", [profileId]);
    if (!found.rows[0]) { await client.query("ROLLBACK"); return fail(res, 404, "User profile not found.", "PROFILE_NOT_FOUND"); }
    const before = found.rows[0];
    if (before.account_status === status) { await client.query("ROLLBACK"); return fail(res, 409, "The account already has this status.", "STATUS_UNCHANGED"); }
    if (status !== "active") {
      const targetAdmin = await client.query(
        `SELECT 1 FROM public.admin_role_assignments
          WHERE profile_id = $1::uuid AND role_code = 'super_admin' AND assignment_status = 'active' LIMIT 1`,
        [profileId]
      );
      if (targetAdmin.rows[0]) {
        const count = await client.query(
          `SELECT COUNT(*)::int AS total FROM public.admin_role_assignments
            WHERE role_code = 'super_admin' AND assignment_status = 'active'
              AND profile_id <> $1::uuid`,
          [profileId]
        );
        if (Number(count.rows[0]?.total || 0) === 0) {
          await client.query("ROLLBACK");
          return fail(res, 409, "The last active super administrator cannot be suspended or deactivated.", "LAST_SUPER_ADMIN_PROTECTED");
        }
      }
    }
    const updated = await client.query(
      `UPDATE public.profiles SET account_status = $2, updated_at = NOW()
        WHERE id = $1::uuid RETURNING id, account_status, updated_at`, [profileId, status]
    );
    await writeAudit(client, req, { action: "profile.account_status.updated", entityType: "profile", entityId: profileId, reason, before, after: updated.rows[0] });
    await client.query("COMMIT");
    return res.json({ success: true, message: `User account ${status}.`, data: { profile: updated.rows[0] } });
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); return next(error); }
  finally { client.release(); }
}

export async function updateBusinessVerification(req, res, next) {
  if (!requirePermission(req, res, "verification:manage")) return;
  const { businessId } = req.params;
  const status = text(req.body?.status, 30);
  const reason = text(req.body?.reason, 1000);
  if (!UUID.test(businessId)) return fail(res, 400, "A valid business ID is required.", "INVALID_BUSINESS_ID");
  if (!["pending", "verified", "rejected"].includes(status)) return fail(res, 400, "Choose a valid verification status.", "INVALID_VERIFICATION_STATUS");
  if (reason.length < 10) return fail(res, 400, "A reason of at least ten characters is required.", "ADMIN_REASON_REQUIRED");
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const found = await client.query("SELECT id, verification_status FROM public.businesses WHERE id = $1::uuid FOR UPDATE", [businessId]);
    if (!found.rows[0]) { await client.query("ROLLBACK"); return fail(res, 404, "Business not found.", "BUSINESS_NOT_FOUND"); }
    const before = found.rows[0];
    const updated = await client.query(
      `UPDATE public.businesses SET verification_status = $2, updated_at = NOW()
        WHERE id = $1::uuid RETURNING id, name, verification_status, updated_at`, [businessId, status]
    );
    await writeAudit(client, req, { action: "business.verification.updated", entityType: "business", entityId: businessId, reason, before, after: updated.rows[0] });
    await client.query("COMMIT");
    return res.json({ success: true, message: `Business verification status set to ${status}.`, data: { business: updated.rows[0] } });
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); return next(error); }
  finally { client.release(); }
}

export async function toggleErrandOffers(req, res, next) {
  if (!requirePermission(req, res, "errands:manage")) return;
  const { erandId } = req.params;
  const enabled = req.body?.enabled === true;
  const reason = text(req.body?.reason, 1000);
  if (!UUID.test(erandId)) return fail(res, 400, "A valid errand ID is required.", "INVALID_ERRAND_ID");
  if (reason.length < 10) return fail(res, 400, "A reason of at least ten characters is required.", "ADMIN_REASON_REQUIRED");
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT id, status, offers_enabled, agreement_locked_at, deleted_at
         FROM public.erands WHERE id = $1::uuid FOR UPDATE`, [erandId]
    );
    const before = found.rows[0];
    if (!before || before.deleted_at) { await client.query("ROLLBACK"); return fail(res, 404, "Active errand not found.", "ERRAND_NOT_FOUND"); }
    if (before.agreement_locked_at || !["draft", "open"].includes(before.status)) {
      await client.query("ROLLBACK");
      return fail(res, 409, "Offers can only be changed before an agreement is locked and while the errand is draft or open.", "ERRAND_NOT_EDITABLE");
    }
    const updated = await client.query(
      `UPDATE public.erands SET offers_enabled = $2, updated_at = NOW()
        WHERE id = $1::uuid RETURNING id, status, offers_enabled, updated_at`, [erandId, enabled]
    );
    await writeAudit(client, req, { action: "errand.offers.toggled", entityType: "errand", entityId: erandId, reason, before, after: updated.rows[0] });
    await client.query("COMMIT");
    return res.json({ success: true, message: `Errand offers ${enabled ? "enabled" : "paused"}.`, data: { errand: updated.rows[0] } });
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); return next(error); }
  finally { client.release(); }
}

export async function reviewSecurityDepositClaim(req, res) {
  if (!requirePermission(req, res, "security_deposits:review")) return;
  const { claimId } = req.params;
  const decision = text(req.body?.decision, 20);
  const reason = text(req.body?.reason, 1000);
  const approvedAmountMinor = req.body?.approvedAmountMinor == null || req.body?.approvedAmountMinor === "" ? null : Number(req.body.approvedAmountMinor);
  if (!UUID.test(claimId)) return fail(res, 400, "A valid claim ID is required.", "INVALID_CLAIM_ID");
  if (!["approved", "rejected"].includes(decision)) return fail(res, 400, "Choose approve or reject.", "INVALID_CLAIM_DECISION");
  if (reason.length < 10) return fail(res, 400, "A decision reason of at least ten characters is required.", "ADMIN_REASON_REQUIRED");
  if (decision === "approved" && (!Number.isSafeInteger(approvedAmountMinor) || approvedAmountMinor <= 0)) return fail(res, 400, "Enter a valid approved amount in minor units.", "INVALID_APPROVED_AMOUNT");
  if (decision === "rejected" && approvedAmountMinor !== null) return fail(res, 400, "A rejected claim cannot have an approved amount.", "INVALID_APPROVED_AMOUNT");
  try {
    const { data, error } = await adminSupabase(req).rpc("review_erander_security_deposit_claim", {
      p_claim_id: claimId, p_decision: decision, p_reason: reason, p_approved_amount_minor: approvedAmountMinor,
    });
    if (error) return fail(res, 409, rpcError(error), "SECURITY_CLAIM_REVIEW_REJECTED");
    await getDatabasePool().query(
      `INSERT INTO public.admin_action_audit_logs (actor_id, action, entity_type, entity_id, reason, after_data)
       VALUES ($1::uuid, $2, 'security_deposit_claim', $3, $4, $5::jsonb)`,
      [req.admin.id, `security_deposit.claim.${decision}`, claimId, reason, JSON.stringify({ decision, approvedAmountMinor })]
    );
    return res.json({ success: true, message: `Security-deposit claim ${decision}.`, data: { claimId: data } });
  } catch (error) { return fail(res, 500, rpcError(error)); }
}

export async function settleSecurityDepositClaim(req, res) {
  if (!requirePermission(req, res, "security_deposits:settle")) return;
  const { claimId } = req.params;
  if (!UUID.test(claimId)) return fail(res, 400, "A valid claim ID is required.", "INVALID_CLAIM_ID");
  try {
    const { data, error } = await adminSupabase(req).rpc("settle_erander_security_deposit_claim", { p_claim_id: claimId });
    if (error) return fail(res, 409, rpcError(error), "SECURITY_CLAIM_SETTLEMENT_REJECTED");
    await getDatabasePool().query(
      `INSERT INTO public.admin_action_audit_logs (actor_id, action, entity_type, entity_id, reason, after_data)
       VALUES ($1::uuid, 'security_deposit.claim.settled', 'security_deposit_claim', $2, 'Settlement through approved security-deposit claim workflow', $3::jsonb)`,
      [req.admin.id, claimId, JSON.stringify({ transactionId: data })]
    );
    return res.json({ success: true, message: "Approved security-deposit claim settled through the ledger workflow.", data: { transactionId: data } });
  } catch (error) { return fail(res, 500, rpcError(error)); }
}

export async function releaseSecurityDepositReservation(req, res) {
  if (!requirePermission(req, res, "security_deposits:settle")) return;
  const { reservationId } = req.params;
  const reason = text(req.body?.reason, 1000);
  if (!UUID.test(reservationId)) return fail(res, 400, "A valid reservation ID is required.", "INVALID_RESERVATION_ID");
  if (reason.length < 10) return fail(res, 400, "A review reason of at least ten characters is required.", "ADMIN_REASON_REQUIRED");
  try {
    const { data, error } = await adminSupabase(req).rpc("reviewed_release_erander_security_deposit", {
      p_reservation_id: reservationId, p_review_reason: reason,
    });
    if (error) return fail(res, 409, rpcError(error), "SECURITY_DEPOSIT_RELEASE_REJECTED");
    await getDatabasePool().query(
      `INSERT INTO public.admin_action_audit_logs (actor_id, action, entity_type, entity_id, reason, after_data)
       VALUES ($1::uuid, 'security_deposit.reservation.released', 'security_deposit_reservation', $2, $3, $4::jsonb)`,
      [req.admin.id, reservationId, reason, JSON.stringify({ transactionId: data })]
    );
    return res.json({ success: true, message: "Security deposit released through the reviewed ledger workflow.", data: { transactionId: data } });
  } catch (error) { return fail(res, 500, rpcError(error)); }
}

export async function runFinancialReconciliation(req, res) {
  if (!requirePermission(req, res, "reconciliation:manage")) return;
  const runType = text(req.body?.runType || "full_reconciliation", 40);
  const currencyCode = req.body?.currencyCode ? text(req.body.currencyCode, 3).toUpperCase() : null;
  if (!["wallet_balances", "ledger_integrity", "full_reconciliation"].includes(runType)) return fail(res, 400, "Choose a valid reconciliation run type.", "INVALID_RECONCILIATION_TYPE");
  if (currencyCode && !/^[A-Z]{3}$/.test(currencyCode)) return fail(res, 400, "Currency must be a three-letter code.", "INVALID_CURRENCY");
  try {
    const { data, error } = await adminSupabase(req).rpc("run_erander_financial_reconciliation", {
      p_run_type: runType, p_currency_code: currencyCode,
    });
    if (error) return fail(res, 409, rpcError(error), "RECONCILIATION_RUN_REJECTED");
    await getDatabasePool().query(
      `INSERT INTO public.admin_action_audit_logs (actor_id, action, entity_type, entity_id, reason, after_data)
       VALUES ($1::uuid, 'finance.reconciliation.started', 'reconciliation_run', $2, 'Administrator initiated financial reconciliation', $3::jsonb)`,
      [req.admin.id, String(data), JSON.stringify({ runType, currencyCode })]
    );
    return res.json({ success: true, message: "Financial reconciliation completed. Review the generated run and issues.", data: { runId: data } });
  } catch (error) { return fail(res, 500, rpcError(error)); }
}

export async function resolveReconciliationIssue(req, res, next) {
  if (!requirePermission(req, res, "reconciliation:manage")) return;
  const { issueId } = req.params;
  const status = text(req.body?.status, 20);
  const reason = text(req.body?.reason, 1000);
  if (!UUID.test(issueId)) return fail(res, 400, "A valid issue ID is required.", "INVALID_ISSUE_ID");
  if (!["resolved", "ignored", "investigating"].includes(status)) return fail(res, 400, "Choose resolved, ignored or investigating.", "INVALID_ISSUE_STATUS");
  if (reason.length < 10) return fail(res, 400, "A resolution note of at least ten characters is required.", "ADMIN_REASON_REQUIRED");
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const found = await client.query("SELECT id, status, resolution_notes FROM public.financial_reconciliation_issues WHERE id = $1::uuid FOR UPDATE", [issueId]);
    if (!found.rows[0]) { await client.query("ROLLBACK"); return fail(res, 404, "Reconciliation issue not found.", "ISSUE_NOT_FOUND"); }
    const before = found.rows[0];
    const updated = await client.query(
      `UPDATE public.financial_reconciliation_issues
          SET status = $2, resolution_notes = $3,
              resolved_by = CASE WHEN $2 = 'resolved' THEN $4::uuid ELSE resolved_by END,
              resolved_at = CASE WHEN $2 = 'resolved' THEN NOW() ELSE resolved_at END,
              updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING id, issue_reference, status, resolution_notes, resolved_by, resolved_at, updated_at`,
      [issueId, status, reason, req.admin.id]
    );
    await writeAudit(client, req, { action: "reconciliation.issue.updated", entityType: "reconciliation_issue", entityId: issueId, reason, before, after: updated.rows[0] });
    await client.query("COMMIT");
    return res.json({ success: true, message: `Reconciliation issue marked ${status}.`, data: { issue: updated.rows[0] } });
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); return next(error); }
  finally { client.release(); }
}

export async function listAdminActionAuditLogs(req, res, next) {
  if (!requirePermission(req, res, "audit_logs:read")) return;
  const page = Math.max(1, Math.min(Number.parseInt(req.query.page, 10) || 1, 100000));
  const limit = Math.max(1, Math.min(Number.parseInt(req.query.limit, 10) || 20, 100));
  const search = text(req.query.search, 100);
  const values = [];
  let where = "";
  if (search) {
    values.push(`%${search.replace(/[\\%_]/g, "\\$&")}%`);
    where = `WHERE (action ILIKE $1 ESCAPE '\\' OR entity_type ILIKE $1 ESCAPE '\\' OR entity_id ILIKE $1 ESCAPE '\\' OR reason ILIKE $1 ESCAPE '\\' OR actor_id::text ILIKE $1 ESCAPE '\\')`;
  }
  try {
    const pool = getDatabasePool();
    const count = await pool.query(`SELECT COUNT(*)::bigint AS total FROM public.admin_action_audit_logs ${where}`, values);
    const total = Number(count.rows[0]?.total || 0);
    const result = await pool.query(
      `SELECT id, actor_id, action, entity_type, entity_id, reason, before_data, after_data, metadata, created_at
         FROM public.admin_action_audit_logs ${where}
        ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, (page - 1) * limit]
    );
    return res.json({ success: true, data: { items: result.rows, columns: ["id", "actor_id", "action", "entity_type", "entity_id", "reason", "before_data", "after_data", "metadata", "created_at"], page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), permissions: req.admin.permissions || [] } });
  } catch (error) { return next(error); }
}
