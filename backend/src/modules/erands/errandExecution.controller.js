import { getDatabasePool } from "../../config/database.js";
import { notifyUsers } from "../notifications/notification.service.js";
import { getErrandSecurityDepositVerification } from "../payments/securityDepositStatus.service.js";

class ExecutionError extends Error {
  constructor(status, message, code = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function fail(status, message, code) {
  throw new ExecutionError(status, message, code);
}

function validUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sendError(res, error) {
  if (error instanceof ExecutionError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
    });
  }
  if (error?.code === "23514" || error?.code === "23503") {
    return res.status(409).json({
      success: false,
      message: "This action conflicts with the current errand or its database rules.",
    });
  }
  console.error("ERANDER execution workflow error:", error);
  return res.status(500).json({
    success: false,
    message: "We couldn't update the errand. Please try again.",
  });
}

async function getLockedErrand(client, errandId) {
  const result = await client.query(
    `SELECT id, reference_code, requested_by, assigned_erander_id,
            accepted_offer_id, status, deleted_at
       FROM public.erands
      WHERE id = $1::uuid
      FOR UPDATE`,
    [errandId],
  );
  const errand = result.rows[0];
  if (!errand || errand.deleted_at) fail(404, "Errand not found.", "ERRAND_NOT_FOUND");
  return errand;
}

async function requireActiveRole(client, userId, role) {
  const result = await client.query(
    `SELECT id, account_status, user_roles
       FROM public.profiles
      WHERE id = $1::uuid
      FOR SHARE`,
    [userId],
  );
  const profile = result.rows[0];
  const roles = Array.isArray(profile?.user_roles) ? profile.user_roles : [];
  if (!profile || profile.account_status !== "active" || !roles.includes(role)) {
    fail(403, `An active ${role} account is required for this action.`, "ROLE_REQUIRED");
  }
}

async function getReleasedFundRequest(client, errandId, eranderId) {
  const result = await client.query(
    `SELECT id, status, released_at
       FROM public.erand_fund_release_requests
      WHERE erand_id = $1::uuid
        AND erander_id = $2::uuid
      ORDER BY requested_at DESC, created_at DESC
      LIMIT 1`,
    [errandId, eranderId],
  );
  return result.rows[0] || null;
}

async function updateErrandStatus(client, errandId, status) {
  const result = await client.query(
    `UPDATE public.erands
        SET status = $2,
            updated_at = NOW()
      WHERE id = $1::uuid
      RETURNING id, reference_code, status, requested_by, assigned_erander_id, updated_at`,
    [errandId, status],
  );
  return result.rows[0];
}

/** Start work only after full execution funds have been released and the
 * assigned erander's 100% security deposit is still validly reserved. */
export async function startErrandExecution(req, res) {
  const userId = req.user?.id;
  const errandId = req.params.id;
  if (!userId || !validUuid(errandId)) return res.status(400).json({ success: false, message: "A valid errand ID is required." });

  const pool = getDatabasePool();
  const client = await pool.connect();
  let committedErrand;
  try {
    await client.query("BEGIN");
    await requireActiveRole(client, userId, "erander");
    const errand = await getLockedErrand(client, errandId);
    if (errand.assigned_erander_id !== userId) fail(403, "Only the assigned erander can start this errand.", "NOT_ASSIGNED_ERANDER");
    if (errand.status !== "funded") fail(409, "This errand can only start after customer funding is confirmed.", "ERRAND_NOT_FUNDED");

    const release = await getReleasedFundRequest(client, errand.id, userId);
    if (!release || release.status !== "released" || !release.released_at) {
      fail(409, "The full execution-fund release must be confirmed before you start work.", "EXECUTION_FUNDS_NOT_RELEASED");
    }

    const security = await getErrandSecurityDepositVerification(client, errand);
    if (!security.secured) {
      fail(409, "Your required 100% security-deposit reservation must remain secured before work can start.", "SECURITY_DEPOSIT_NOT_SECURED");
    }

    committedErrand = await updateErrandStatus(client, errand.id, "in_progress");
    await client.query("COMMIT");

    notifyUsers([errand.requested_by], {
      type: "errand_work_started",
      title: "Your errand is now in progress",
      body: `The assigned erander has started work on ${errand.reference_code}. Follow progress and share updates in your errand chat.`,
      actionUrl: "/dashboard/erands",
      entityType: "erand",
      entityId: errand.id,
      dedupeKey: `errand_work_started:${errand.id}`,
    }).catch((error) => console.error("Errand-start notification failed:", error?.message));

    return res.json({ success: true, message: "Your errand is now in progress.", data: { errand: committedErrand } });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    return sendError(res, error);
  } finally {
    client.release();
  }
}

/** Submit completion for customer review. Receipts, images and other evidence
 * remain in the existing customer-erander chat; this endpoint stores no files. */
export async function submitErrandCompletion(req, res) {
  const userId = req.user?.id;
  const errandId = req.params.id;
  if (!userId || !validUuid(errandId)) return res.status(400).json({ success: false, message: "A valid errand ID is required." });

  const pool = getDatabasePool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await requireActiveRole(client, userId, "erander");
    const errand = await getLockedErrand(client, errandId);
    if (errand.assigned_erander_id !== userId) fail(403, "Only the assigned erander can submit completion.", "NOT_ASSIGNED_ERANDER");
    if (errand.status !== "in_progress") fail(409, "Only an errand in progress can be submitted for completion.", "ERRAND_NOT_IN_PROGRESS");

    const release = await getReleasedFundRequest(client, errand.id, userId);
    if (!release || release.status !== "released" || !release.released_at) {
      fail(409, "The execution-fund release is not confirmed. Completion cannot be submitted.", "EXECUTION_FUNDS_NOT_RELEASED");
    }

    const updated = await updateErrandStatus(client, errand.id, "completion_submitted");
    await client.query("COMMIT");

    notifyUsers([errand.requested_by], {
      type: "errand_completion_submitted",
      title: "Your errander submitted the completed work",
      body: `The work on ${errand.reference_code} is ready for your review. Check the errand chat for receipts, photos and handover updates before confirming completion.`,
      actionUrl: "/dashboard/erands",
      entityType: "erand",
      entityId: errand.id,
      dedupeKey: `errand_completion_submitted:${errand.id}`,
    }).catch((error) => console.error("Completion-submitted notification failed:", error?.message));

    return res.json({
      success: true,
      message: "Completion has been submitted. The customer can now review the work and chat evidence.",
      data: { errand: updated },
    });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    return sendError(res, error);
  } finally {
    client.release();
  }
}

/** Customer confirmation finalizes the errand status only. It deliberately
 * does not create payouts, release wallet funds, or bypass settlement review. */
export async function confirmErrandCompletion(req, res) {
  const userId = req.user?.id;
  const errandId = req.params.id;
  if (!userId || !validUuid(errandId)) return res.status(400).json({ success: false, message: "A valid errand ID is required." });

  const pool = getDatabasePool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const errand = await getLockedErrand(client, errandId);
    if (errand.requested_by !== userId) fail(403, "Only the customer who requested this errand can confirm completion.", "NOT_ERRAND_CUSTOMER");
    if (errand.status !== "completion_submitted") fail(409, "There is no completion submission awaiting your review.", "NO_COMPLETION_TO_REVIEW");

    const updated = await updateErrandStatus(client, errand.id, "completed");
    await client.query("COMMIT");

    notifyUsers([errand.assigned_erander_id], {
      type: "errand_completion_confirmed",
      title: "The customer confirmed completion",
      body: `The customer confirmed that ${errand.reference_code} is complete. Any payout or remaining settlement follows ERANDER's separate settlement process.`,
      actionUrl: "/dashboard/my-offers",
      entityType: "erand",
      entityId: errand.id,
      dedupeKey: `errand_completion_confirmed:${errand.id}`,
    }).catch((error) => console.error("Completion-confirmed notification failed:", error?.message));

    return res.json({
      success: true,
      message: "Completion confirmed. Any remaining settlement is handled separately under the platform's settlement rules.",
      data: { errand: updated },
    });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    return sendError(res, error);
  } finally {
    client.release();
  }
}
