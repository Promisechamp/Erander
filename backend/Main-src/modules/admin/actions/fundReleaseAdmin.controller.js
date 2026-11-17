import { getDatabasePool } from "../../../config/database.js";
import { notifyUser } from "../../notifications/notification.service.js";
import { hasAdminPermission } from "../auth/adminPermissions.js";
import { getErrandSecurityDepositVerification } from "../../payments/securityDepositStatus.service.js";
import {
  initiatePaystackTransfer,
  verifyPaystackTransfer,
} from "../../payments/paystack.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_STATUSES = new Set(["pending", "approved", "processing", "released", "rejected", "failed"]);

function fail(res, status, message, code = "FUND_RELEASE_ADMIN_FAILED") {
  return res.status(status).json({ success: false, message, code });
}

function canRead(req) {
  return hasAdminPermission(req.admin, "finance:read");
}

function canManage(req) {
  return hasAdminPermission(req.admin, "finance:manage");
}

function cleanText(value, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function toMinor(value, label = "Amount") {
  const input = String(value ?? "").trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(input)) {
    throw new Error(`${label} cannot be represented in minor currency units.`);
  }
  const [whole, fraction = ""] = input.split(".");
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (minor < 0n || minor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} is outside the supported range.`);
  }
  return Number(minor);
}

function minorToString(value) {
  const minor = BigInt(value || 0);
  return `${minor / 100n}.${String(minor % 100n).padStart(2, "0")}`;
}

function makeTransferReference(requestId) {
  return `ERAND-FUND-${String(requestId).replaceAll("-", "").toUpperCase()}`;
}

async function getActiveConfig(client, key) {
  const result = await client.query(
    `SELECT v.id, v.config_key, v.config, v.version_number
       FROM public.platform_configuration_activations a
       JOIN public.platform_configuration_versions v ON v.id = a.config_version_id
      WHERE v.config_key = $1
        AND a.effective_at <= NOW()
        AND (a.superseded_at IS NULL OR a.superseded_at > NOW())
      ORDER BY a.effective_at DESC
      LIMIT 1`,
    [key],
  );
  return result.rows[0] || null;
}

function getCountryCode(locationSnapshot) {
  let snapshot = locationSnapshot;
  if (typeof snapshot === "string") {
    try { snapshot = JSON.parse(snapshot); } catch { snapshot = {}; }
  }
  return String(snapshot?.country_code || snapshot?.countryCode || "NG").trim().toUpperCase();
}

function getCommissionRate(config, category, countryCode) {
  const categoryRate = config?.category_overrides?.[category];
  const countryRate = config?.country_overrides?.[countryCode];
  const rate = categoryRate ?? countryRate ?? config?.default_rate_percent;
  const numeric = Number(rate);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
    throw new Error("An active, valid commission rate is required before this fund release can proceed.");
  }
  return numeric;
}

async function insertRequestEvent(client, request, actorId, eventType, details = {}) {
  await client.query(
    `INSERT INTO public.erand_fund_release_request_events
       (request_id, erand_id, actor_id, event_type, occurred_at, details)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, NOW(), $5::jsonb)`,
    [request.id, request.erand_id, actorId || null, eventType, JSON.stringify(details)],
  );
}

async function insertAudit(client, req, { action, request, reason, before = {}, after = {}, metadata = {} }) {
  await client.query(
    `INSERT INTO public.audit_logs
       (event_category, actor_id, action, entity_type, entity_id, reason, before_data, after_data, metadata)
     VALUES ('financial_operation', $1::uuid, $2, 'errand_fund_release_request', $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)`,
    [
      req.admin.id,
      action,
      request.id,
      reason,
      JSON.stringify(before),
      JSON.stringify(after),
      JSON.stringify(metadata),
    ],
  );
}

async function loadRequestReview(client, requestId, { lock = false } = {}) {
  const result = await client.query(
    `SELECT
        fr.*,
        e.reference_code,
        e.title AS errand_title,
        e.description AS errand_description,
        e.category AS errand_category,
        e.status AS errand_status,
        e.currency_code AS errand_currency_code,
        e.requested_by AS customer_id,
        e.assigned_erander_id,
        e.accepted_offer_id,
        e.agreement_accepted_at,
        e.agreement_locked_at,
        e.location_snapshot,
        o.proposed_item_total,
        o.proposed_service_fee,
        o.proposed_delivery_fee,
        o.proposed_other_fees,
        o.proposed_total,
        o.currency_code AS offer_currency_code,
        o.status AS offer_status,
        c.display_name AS customer_display_name,
        c.first_name AS customer_first_name,
        c.last_name AS customer_last_name,
        c.email AS customer_email,
        r.display_name AS erander_display_name,
        r.first_name AS erander_first_name,
        r.last_name AS erander_last_name,
        r.email AS erander_email
       FROM public.erand_fund_release_requests fr
       JOIN public.erands e ON e.id = fr.erand_id
       LEFT JOIN public.erand_offers o ON o.id = e.accepted_offer_id AND o.erand_id = e.id
       LEFT JOIN public.profiles c ON c.id = e.requested_by
       LEFT JOIN public.profiles r ON r.id = fr.erander_id
      WHERE fr.id = $1::uuid
      ${lock ? "FOR UPDATE OF fr, e" : ""}`,
    [requestId],
  );
  return result.rows[0] || null;
}

function personName(row, prefix) {
  return row[`${prefix}_display_name`] ||
    [row[`${prefix}_first_name`], row[`${prefix}_last_name`]].filter(Boolean).join(" ") ||
    row[`${prefix}_email`] || "Unknown";
}

function serializeRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    erandId: row.erand_id,
    eranderId: row.erander_id,
    status: row.status,
    requestedAt: row.requested_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    releaseInitiatedAt: row.release_initiated_at,
    releasedAt: row.released_at,
    providerReference: row.provider_reference,
    decisionReason: row.decision_reason,
    failureReason: row.failure_reason,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeReview(row) {
  return {
    request: serializeRequest(row),
    errand: {
      id: row.erand_id,
      referenceCode: row.reference_code,
      title: row.errand_title,
      description: row.errand_description,
      category: row.errand_category,
      status: row.errand_status,
      currencyCode: row.errand_currency_code,
      customerId: row.customer_id,
      assignedEranderId: row.assigned_erander_id,
      acceptedOfferId: row.accepted_offer_id,
      agreementAcceptedAt: row.agreement_accepted_at,
      agreementLockedAt: row.agreement_locked_at,
      locationSnapshot: row.location_snapshot,
    },
    customer: { id: row.customer_id, name: personName(row, "customer"), email: row.customer_email },
    erander: { id: row.erander_id, name: personName(row, "erander"), email: row.erander_email },
    offer: row.accepted_offer_id ? {
      id: row.accepted_offer_id,
      status: row.offer_status,
      itemTotal: row.proposed_item_total,
      serviceFee: row.proposed_service_fee,
      deliveryFee: row.proposed_delivery_fee,
      otherFees: row.proposed_other_fees,
      total: row.proposed_total,
      currencyCode: row.offer_currency_code,
    } : null,
  };
}

async function getFunding(client, erandId) {
  const result = await client.query(
    `SELECT * FROM public.calculate_erand_funding($1::uuid)`,
    [erandId],
  );
  return result.rows[0] || null;
}

async function getPayoutAccount(client, eranderId, currencyCode, lock = false) {
  const result = await client.query(
    `SELECT id, profile_id, payment_provider, country_code, currency_code,
            bank_name, account_name, account_number_last4,
            provider_recipient_code, status, is_default, verified_at
       FROM public.withdrawal_accounts
      WHERE profile_id = $1::uuid
        AND currency_code = $2
        AND payment_provider = 'paystack'
        AND status = 'active'
        AND is_default = TRUE
      ORDER BY verified_at DESC NULLS LAST, created_at DESC
      LIMIT 1
      ${lock ? "FOR UPDATE" : ""}`,
    [eranderId, currencyCode],
  );
  return result.rows[0] || null;
}

export async function listAdminFundReleaseRequests(req, res, next) {
  if (!canRead(req)) return fail(res, 403, "You do not have permission to view fund-release requests.", "ADMIN_PERMISSION_REQUIRED");
  const status = cleanText(req.query.status, 30);
  const search = cleanText(req.query.search, 100);
  if (status && !REQUEST_STATUSES.has(status)) return fail(res, 400, "Invalid fund-release status filter.", "INVALID_STATUS_FILTER");
  try {
    const result = await getDatabasePool().query(
      `SELECT
          fr.id, fr.erand_id, fr.erander_id, fr.status, fr.requested_at,
          fr.reviewed_at, fr.release_initiated_at, fr.released_at,
          fr.provider_reference, fr.decision_reason, fr.failure_reason,
          e.reference_code, e.title AS errand_title, e.status AS errand_status,
          e.currency_code, (o.proposed_item_total + o.proposed_delivery_fee) AS execution_funds_total,
          c.display_name AS customer_display_name, c.first_name AS customer_first_name, c.last_name AS customer_last_name,
          r.display_name AS erander_display_name, r.first_name AS erander_first_name, r.last_name AS erander_last_name,
          r.email AS erander_email
       FROM public.erand_fund_release_requests fr
       JOIN public.erands e ON e.id = fr.erand_id
       LEFT JOIN public.erand_offers o ON o.id = e.accepted_offer_id AND o.erand_id = e.id
       LEFT JOIN public.profiles c ON c.id = e.requested_by
       LEFT JOIN public.profiles r ON r.id = fr.erander_id
      WHERE ($1 = '' OR fr.status = $1)
        AND ($2 = '' OR e.title ILIKE '%' || $2 || '%' OR e.reference_code ILIKE '%' || $2 || '%'
             OR r.display_name ILIKE '%' || $2 || '%' OR r.email ILIKE '%' || $2 || '%' OR fr.id::text ILIKE '%' || $2 || '%')
      ORDER BY CASE fr.status WHEN 'pending' THEN 1 WHEN 'processing' THEN 2 WHEN 'failed' THEN 3 WHEN 'released' THEN 4 ELSE 5 END,
               fr.requested_at DESC
      LIMIT 200`,
      [status, search],
    );
    const items = result.rows.map((row) => ({
      id: row.id,
      erandId: row.erand_id,
      eranderId: row.erander_id,
      status: row.status,
      requestedAt: row.requested_at,
      reviewedAt: row.reviewed_at,
      releaseInitiatedAt: row.release_initiated_at,
      releasedAt: row.released_at,
      providerReference: row.provider_reference,
      decisionReason: row.decision_reason,
      failureReason: row.failure_reason,
      errand: { id: row.erand_id, referenceCode: row.reference_code, title: row.errand_title, status: row.errand_status, currencyCode: row.currency_code, total: row.execution_funds_total },
      customer: { name: personName(row, "customer") },
      erander: { id: row.erander_id, name: personName(row, "erander"), email: row.erander_email },
    }));
    const counts = await getDatabasePool().query(
      `SELECT status, COUNT(*)::int AS count
         FROM public.erand_fund_release_requests
        GROUP BY status`,
    );
    return res.json({ success: true, data: { items, counts: Object.fromEntries(counts.rows.map((row) => [row.status, row.count])) } });
  } catch (error) {
    return next(error);
  }
}

export async function getAdminFundReleaseRequestDetails(req, res, next) {
  if (!canRead(req)) return fail(res, 403, "You do not have permission to view fund-release requests.", "ADMIN_PERMISSION_REQUIRED");
  const { requestId } = req.params;
  if (!UUID.test(requestId || "")) return fail(res, 400, "A valid request ID is required.", "INVALID_REQUEST_ID");
  try {
    const pool = getDatabasePool();
    const row = await loadRequestReview(pool, requestId);
    if (!row) return fail(res, 404, "Fund-release request not found.", "REQUEST_NOT_FOUND");
    const [funding, payments, refunds, events, payoutAccount, securityDeposit] = await Promise.all([
      getFunding(pool, row.erand_id),
      pool.query(
        `SELECT id, payment_type, amount, currency_code, status, payment_provider,
                provider_reference, provider_confirmed_at, platform_confirmed_at, failure_reason, created_at
           FROM public.erand_payments WHERE erand_id = $1::uuid ORDER BY created_at ASC`,
        [row.erand_id],
      ),
      pool.query(
        `SELECT rf.id, rf.payment_id, rf.amount, rf.currency_code, rf.status, rf.reason,
                rf.provider_refund_reference, rf.platform_confirmed_at, rf.failure_reason, rf.created_at
           FROM public.erand_refunds rf
           JOIN public.erand_payments p ON p.id = rf.payment_id
          WHERE p.erand_id = $1::uuid ORDER BY rf.created_at ASC`,
        [row.erand_id],
      ),
      pool.query(
        `SELECT id, actor_id, event_type, occurred_at, details
           FROM public.erand_fund_release_request_events
          WHERE request_id = $1::uuid ORDER BY occurred_at ASC, id ASC`,
        [requestId],
      ),
      getPayoutAccount(pool, row.erander_id, row.offer_currency_code || row.errand_currency_code),
      getErrandSecurityDepositVerification(pool, {
        id: row.erand_id,
        assigned_erander_id: row.assigned_erander_id,
        accepted_offer_id: row.accepted_offer_id,
      }),
    ]);
    const countryCode = getCountryCode(row.location_snapshot);
    const [commissionPolicy, releasePolicy, earningsPolicy] = await Promise.all([
      getActiveConfig(pool, "finance.commission_policy"),
      getActiveConfig(pool, "funding.release_policy"),
      getActiveConfig(pool, "wallet.earnings_policy"),
    ]);
    let commissionRate = null;
    if (commissionPolicy) {
      commissionRate = getCommissionRate(commissionPolicy.config, row.errand_category, countryCode);
    }
    const itemBudgetMinor = toMinor(row.proposed_item_total || 0, "Item budget");
    const deliveryFundsMinor = toMinor(row.proposed_delivery_fee || 0, "Delivery funds");
    const serviceFeeMinor = toMinor(row.proposed_service_fee || 0, "Service fee");
    const additionalCompensationMinor = toMinor(row.proposed_other_fees || 0, "Additional compensation");
    const acceptedTotalMinor = toMinor(row.proposed_total, "Accepted offer total");
    const componentTotalMinor = itemBudgetMinor + deliveryFundsMinor + serviceFeeMinor + additionalCompensationMinor;
    const executionFundsMinor = itemBudgetMinor + deliveryFundsMinor;
    const compensationMinor = serviceFeeMinor + additionalCompensationMinor;
    const commissionMinor = commissionRate == null ? null : Math.round(compensationMinor * commissionRate / 100);
    const breakdownMatches = componentTotalMinor === acceptedTotalMinor;
    return res.json({
      success: true,
      data: {
        ...serializeReview(row),
        funding,
        payments: payments.rows,
        refunds: refunds.rows,
        events: events.rows,
        payoutAccount: payoutAccount ? {
          id: payoutAccount.id,
          bankName: payoutAccount.bank_name,
          accountName: payoutAccount.account_name,
          accountNumberLast4: payoutAccount.account_number_last4,
          currencyCode: payoutAccount.currency_code,
          provider: payoutAccount.payment_provider,
          status: payoutAccount.status,
          isDefault: payoutAccount.is_default,
          hasProviderRecipient: Boolean(payoutAccount.provider_recipient_code),
        } : null,
        securityDeposit: { status: securityDeposit.status, secured: Boolean(securityDeposit.secured) },
        policies: {
          releaseReady: Boolean(releasePolicy && releasePolicy.config?.release_mode === "full_only" && releasePolicy.config?.allow_partial_release === false && releasePolicy.config?.customer_funding_must_be_confirmed === true && releasePolicy.config?.admin_approval_required === true && releasePolicy.config?.execution_funds_release_must_be_confirmed === true),
          earningsReady: Boolean(earningsPolicy && earningsPolicy.config?.credit_pending_after_successful_execution_fund_release === true && earningsPolicy.config?.security_deposit_is_separate === true),
        },
        calculation: {
          currencyCode: row.offer_currency_code || row.errand_currency_code,
          executionFundsMinor,
          acceptedOfferTotalMinor: acceptedTotalMinor,
          breakdownMatches,
          commissionRatePercent: commissionRate,
          grossCompensationMinor: compensationMinor,
          platformCommissionMinor: commissionMinor,
          netEarningsMinor: commissionMinor == null ? null : compensationMinor - commissionMinor,
          note: "The full execution-fund transfer covers the accepted item budget and delivery funds. Net service and additional compensation, less platform commission, is recorded as pending wallet earnings after provider confirmation.",
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function rejectAdminFundReleaseRequest(req, res) {
  if (!canManage(req)) return fail(res, 403, "You do not have permission to review fund-release requests.", "ADMIN_PERMISSION_REQUIRED");
  const { requestId } = req.params;
  const reason = cleanText(req.body?.reason, 1000);
  if (!UUID.test(requestId || "")) return fail(res, 400, "A valid request ID is required.", "INVALID_REQUEST_ID");
  if (reason.length < 10) return fail(res, 400, "A rejection reason of at least ten characters is required.", "REJECTION_REASON_REQUIRED");
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const request = await loadRequestReview(client, requestId, { lock: true });
    if (!request) { await client.query("ROLLBACK"); return fail(res, 404, "Fund-release request not found.", "REQUEST_NOT_FOUND"); }
    if (!["pending", "approved"].includes(request.status)) { await client.query("ROLLBACK"); return fail(res, 409, "Only pending or approved fund-release requests can be rejected before a transfer starts.", "REQUEST_NOT_REJECTABLE"); }
    const updated = await client.query(
      `UPDATE public.erand_fund_release_requests
          SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $2::uuid,
              decision_reason = $3, updated_at = NOW()
        WHERE id = $1::uuid RETURNING *`,
      [requestId, req.admin.id, reason],
    );
    await insertRequestEvent(client, request, req.admin.id, "fund_release_rejected", { reason });
    await insertAudit(client, req, { action: "errand_fund_release.rejected", request, reason, before: { status: request.status }, after: { status: "rejected" } });
    await client.query("COMMIT");
    notifyUser({
      recipientId: request.erander_id,
      type: "fund_release_rejected",
      title: "Your execution-fund request was rejected",
      body: `The admin review team rejected your request. Reason: ${reason}`,
      actionUrl: "/dashboard/erands",
      entityType: "erand",
      entityId: request.erand_id,
      data: { requestId },
      dedupeKey: `fund_release_rejected:${requestId}`,
    }).catch((error) => console.error("Fund-release rejection notification failed:", error?.message));
    return res.json({ success: true, message: "Fund-release request rejected.", data: { request: serializeRequest(updated.rows[0]) } });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return fail(res, 500, "Unable to reject this fund-release request.", "FUND_RELEASE_REJECTION_FAILED");
  } finally {
    client.release();
  }
}

export async function initiateAdminFundRelease(req, res) {
  if (!canManage(req)) return fail(res, 403, "You do not have permission to release errand funds.", "ADMIN_PERMISSION_REQUIRED");
  const { requestId } = req.params;
  const reason = cleanText(req.body?.reason, 1000);
  if (!UUID.test(requestId || "")) return fail(res, 400, "A valid request ID is required.", "INVALID_REQUEST_ID");
  if (reason.length < 10) return fail(res, 400, "A review reason of at least ten characters is required.", "REVIEW_REASON_REQUIRED");

  const pool = getDatabasePool();
  const client = await pool.connect();
  let transferPlan;
  try {
    await client.query("BEGIN");
    const request = await loadRequestReview(client, requestId, { lock: true });
    if (!request) { await client.query("ROLLBACK"); return fail(res, 404, "Fund-release request not found.", "REQUEST_NOT_FOUND"); }
    if (request.status === "processing") { await client.query("ROLLBACK"); return fail(res, 409, "A transfer has already been initiated or its outcome is awaiting verification. Verify the existing provider reference instead of initiating another transfer.", "TRANSFER_ALREADY_PROCESSING"); }
    if (!["pending", "approved"].includes(request.status)) { await client.query("ROLLBACK"); return fail(res, 409, "Only pending or approved fund-release requests can be released.", "REQUEST_NOT_PENDING"); }
    if (request.provider_reference || request.release_initiated_at) {
      await client.query("ROLLBACK");
      return fail(res, 409, "This request already has a transfer reference or initiation timestamp. Verify the existing transfer before proceeding.", "EXISTING_TRANSFER_REFERENCE");
    }
    if (request.errand_status !== "funded" || request.assigned_erander_id !== request.erander_id || !request.accepted_offer_id || request.offer_status !== "accepted" || !request.agreement_locked_at) {
      await client.query("ROLLBACK");
      return fail(res, 409, "The errand must have a locked accepted agreement, confirmed funding and the same assigned erander before release.", "ERRAND_NOT_ELIGIBLE");
    }
    if (request.offer_currency_code !== request.errand_currency_code) {
      await client.query("ROLLBACK");
      return fail(res, 409, "The accepted offer currency does not match the errand currency.", "CURRENCY_MISMATCH");
    }
    if (request.offer_currency_code !== "NGN") {
      await client.query("ROLLBACK");
      return fail(res, 409, "Bank execution-fund release is currently supported in NGN only. This request must remain pending until a payout provider is configured for its currency.", "PAYOUT_CURRENCY_UNSUPPORTED");
    }
    const funding = await getFunding(client, request.erand_id);
    if (!funding || funding.funding_status !== "fully_funded" || Number(funding.eligible_funding_amount) !== Number(funding.required_amount) || Number(funding.overpayment_amount || 0) !== 0) {
      await client.query("ROLLBACK");
      return fail(res, 409, "The accepted offer must be funded in full with no unresolved overpayment or funding shortfall.", "FUNDING_NOT_RECONCILED");
    }
    const securityDeposit = await getErrandSecurityDepositVerification(client, {
      id: request.erand_id,
      assigned_erander_id: request.assigned_erander_id,
      accepted_offer_id: request.accepted_offer_id,
    });
    if (!securityDeposit.secured) {
      await client.query("ROLLBACK");
      return fail(res, 409, "The assigned erander's 100% security-deposit reservation must be verified before execution funds can be released.", "SECURITY_DEPOSIT_NOT_SECURED");
    }
    const [releasePolicy, earningsPolicy, commissionPolicy] = await Promise.all([
      getActiveConfig(client, "funding.release_policy"),
      getActiveConfig(client, "wallet.earnings_policy"),
      getActiveConfig(client, "finance.commission_policy"),
    ]);
    if (!releasePolicy || releasePolicy.config?.release_mode !== "full_only" || releasePolicy.config?.allow_partial_release !== false || releasePolicy.config?.customer_funding_must_be_confirmed !== true || releasePolicy.config?.admin_approval_required !== true || releasePolicy.config?.execution_funds_release_must_be_confirmed !== true) {
      await client.query("ROLLBACK");
      return fail(res, 409, "The active full-release funding policy is missing or invalid. Ask a Super Admin to review platform configuration.", "RELEASE_POLICY_UNAVAILABLE");
    }
    if (!earningsPolicy || earningsPolicy.config?.credit_pending_after_successful_execution_fund_release !== true || earningsPolicy.config?.security_deposit_is_separate !== true) {
      await client.query("ROLLBACK");
      return fail(res, 409, "The active wallet earnings policy is missing or invalid.", "EARNINGS_POLICY_UNAVAILABLE");
    }
    if (!commissionPolicy) {
      await client.query("ROLLBACK");
      return fail(res, 409, "The active commission policy is not configured.", "COMMISSION_POLICY_UNAVAILABLE");
    }
    const countryCode = getCountryCode(request.location_snapshot);
    const commissionRate = getCommissionRate(commissionPolicy.config, request.errand_category, countryCode);
    const itemBudgetMinor = toMinor(request.proposed_item_total || 0, "Item budget");
    const deliveryFundsMinor = toMinor(request.proposed_delivery_fee || 0, "Delivery funds");
    const serviceFeeMinor = toMinor(request.proposed_service_fee || 0, "Service fee");
    const additionalCompensationMinor = toMinor(request.proposed_other_fees || 0, "Additional compensation");
    const acceptedTotalMinor = toMinor(request.proposed_total, "Accepted offer total");
    if (itemBudgetMinor + deliveryFundsMinor + serviceFeeMinor + additionalCompensationMinor !== acceptedTotalMinor) {
      await client.query("ROLLBACK");
      return fail(res, 409, "The accepted offer breakdown does not add up to its recorded total. Manual financial review is required.", "OFFER_BREAKDOWN_MISMATCH");
    }
    const executionFundsMinor = itemBudgetMinor + deliveryFundsMinor;
    if (executionFundsMinor <= 0) {
      await client.query("ROLLBACK");
      return fail(res, 409, "This accepted offer has no positive execution-fund amount to release.", "NO_EXECUTION_FUNDS");
    }
    const grossCompensationMinor = serviceFeeMinor + additionalCompensationMinor;
    const commissionMinor = Math.round(grossCompensationMinor * commissionRate / 100);
    const netEarningsMinor = grossCompensationMinor - commissionMinor;
    const payoutAccount = await getPayoutAccount(client, request.erander_id, request.offer_currency_code, true);
    if (!payoutAccount?.provider_recipient_code) {
      await client.query("ROLLBACK");
      return fail(res, 409, "The assigned erander needs an active, verified default NGN bank account before execution funds can be released.", "PAYOUT_ACCOUNT_REQUIRED");
    }
    const providerReference = makeTransferReference(request.id);
    const releaseMetadata = {
      release_mode: "full_only",
      execution_funds_components: ["accepted_item_budget", "accepted_delivery_funds"],
      item_budget_minor: itemBudgetMinor,
      delivery_funds_minor: deliveryFundsMinor,
      accepted_offer_total_minor: acceptedTotalMinor,
      execution_funds_minor: executionFundsMinor,
      currency_code: request.offer_currency_code,
      payout_account_id: payoutAccount.id,
      payout_bank_name: payoutAccount.bank_name,
      payout_account_name: payoutAccount.account_name,
      payout_account_last4: payoutAccount.account_number_last4,
      commission_policy_version_id: commissionPolicy.id,
      commission_rate_percent: commissionRate,
      gross_compensation_minor: grossCompensationMinor,
      platform_commission_minor: commissionMinor,
      net_earnings_minor: netEarningsMinor,
      pending_earning_credit_after_provider_success: true,
    };
    const updated = await client.query(
      `UPDATE public.erand_fund_release_requests
          SET status = 'processing', reviewed_at = NOW(), reviewed_by = $2::uuid,
              release_initiated_at = NOW(), provider_reference = $3,
              decision_reason = $4, failure_reason = NULL,
              metadata = COALESCE(metadata, '{}'::jsonb) || $5::jsonb,
              updated_at = NOW()
        WHERE id = $1::uuid RETURNING *`,
      [requestId, req.admin.id, providerReference, reason, JSON.stringify(releaseMetadata)],
    );
    await insertRequestEvent(client, request, req.admin.id, "fund_release_approved", { reason, releaseMode: "full_only", executionFundsMinor, currencyCode: request.offer_currency_code });
    await insertRequestEvent(client, request, req.admin.id, "fund_release_processing", { providerReference, payoutBankName: payoutAccount.bank_name, payoutAccountLast4: payoutAccount.account_number_last4 });
    await insertAudit(client, req, {
      action: "errand_fund_release.initiated",
      request,
      reason,
      before: { status: request.status },
      after: { status: "processing", providerReference },
      metadata: releaseMetadata,
    });
    await client.query("COMMIT");
    transferPlan = {
      request: updated.rows[0],
      amountMinor: executionFundsMinor,
      recipientCode: payoutAccount.provider_recipient_code,
      reference: providerReference,
      reason: `ERANDER execution funds for ${request.reference_code || request.erand_id}`,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Unable to prepare errand fund release:", { code: error?.code || null, message: error?.message || "Unknown error" });
    return fail(res, 500, "Unable to prepare this fund release. No transfer was initiated.", "FUND_RELEASE_PREPARATION_FAILED");
  } finally {
    client.release();
  }

  try {
    const transfer = await initiatePaystackTransfer({
      amountMinor: transferPlan.amountMinor,
      recipientCode: transferPlan.recipientCode,
      reference: transferPlan.reference,
      reason: transferPlan.reason,
    });
    await pool.query(
      `UPDATE public.erand_fund_release_requests
          SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = NOW()
        WHERE id = $1::uuid AND status = 'processing'`,
      [requestId, JSON.stringify({ paystack_transfer_id: transfer?.id ?? null, paystack_transfer_status: transfer?.status ?? null, transfer_initiation_received_at: new Date().toISOString() })],
    );
    return res.status(202).json({
      success: true,
      message: "The full execution-fund transfer was initiated. Verify the Paystack transfer before marking funds as released.",
      data: { request: serializeRequest(transferPlan.request), providerStatus: transfer?.status || "pending", verificationRequired: true },
    });
  } catch (error) {
    console.error("Paystack execution-fund transfer initiation is inconclusive:", {
      status: error?.status || null,
      endpoint: error?.endpoint || null,
      providerMessage: error?.providerMessage || error?.message || null,
    });
    await pool.query(
      `UPDATE public.erand_fund_release_requests
          SET failure_reason = $2,
              metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
              updated_at = NOW()
        WHERE id = $1::uuid AND status = 'processing'`,
      [requestId, cleanText(error?.providerMessage || error?.message || "Paystack transfer initiation outcome requires verification.", 500), JSON.stringify({ transfer_initiation_inconclusive: true })],
    ).catch(() => {});
    return res.status(202).json({ success: true, message: "Paystack's response was inconclusive. The request remains processing; verify the existing provider reference before attempting any further action.", data: { request: serializeRequest(transferPlan.request), verificationRequired: true } });
  }
}

async function createPendingEarning(client, request, adminId) {
  const metadata = request.metadata || {};
  const earningMinor = Number(metadata.net_earnings_minor || 0);
  if (!Number.isSafeInteger(earningMinor) || earningMinor < 0) {
    throw new Error("The pending earnings amount is invalid.");
  }
  if (earningMinor === 0) return null;

  await client.query(
    `INSERT INTO public.wallets (profile_id, currency_code)
     VALUES ($1::uuid, $2)
     ON CONFLICT (profile_id, currency_code) DO NOTHING`,
    [request.erander_id, metadata.currency_code],
  );
  const walletResult = await client.query(
    `SELECT id, profile_id, currency_code, pending_balance, status
       FROM public.wallets
      WHERE profile_id = $1::uuid AND currency_code = $2
      FOR UPDATE`,
    [request.erander_id, metadata.currency_code],
  );
  const wallet = walletResult.rows[0];
  if (!wallet || wallet.status !== "active") throw new Error("The erander's wallet is not active for the settlement currency.");

  const idempotencyKey = `errand-earning:fund-release:${request.id}`;
  const existing = await client.query(
    `SELECT id, wallet_id, amount_minor, currency_code, type, status
       FROM public.wallet_transactions WHERE idempotency_key = $1 LIMIT 1`,
    [idempotencyKey],
  );
  if (existing.rows[0]) {
    const transaction = existing.rows[0];
    if (transaction.wallet_id !== wallet.id || Number(transaction.amount_minor) !== earningMinor || transaction.currency_code !== metadata.currency_code || transaction.type !== "errand_earning") {
      throw new Error("An existing pending-earnings transaction does not match this fund-release request.");
    }
    return transaction.id;
  }

  const inserted = await client.query(
    `INSERT INTO public.wallet_transactions
       (wallet_id, reference, idempotency_key, type, amount_minor,
        currency_code, status, description, related_erand_id, metadata)
     VALUES ($1::uuid, $2, $3, 'errand_earning', $4::bigint,
             $5, 'pending', 'Pending erander earnings after execution-fund release', $6::uuid, $7::jsonb)
     RETURNING id`,
    [
      wallet.id,
      `ERD-EARN-${request.id.replaceAll("-", "").toUpperCase()}`,
      idempotencyKey,
      earningMinor,
      metadata.currency_code,
      request.erand_id,
      JSON.stringify({
        purpose: "errand_earning",
        fund_release_request_id: request.id,
        commission_rate_percent: metadata.commission_rate_percent,
        gross_compensation_minor: metadata.gross_compensation_minor,
        platform_commission_minor: metadata.platform_commission_minor,
        pending_until_errand_finalization: true,
      }),
    ],
  );
  await client.query(
    `UPDATE public.wallets
        SET pending_balance = pending_balance + $2::bigint, updated_at = NOW()
      WHERE id = $1::uuid`,
    [wallet.id, earningMinor],
  );
  return inserted.rows[0].id;
}

async function postExecutionFundReleaseJournal(client, request, amountMinor) {
  const existing = await client.query(
    `SELECT id, status FROM public.erand_ledger_journals
      WHERE idempotency_key = $1 LIMIT 1 FOR UPDATE`,
    [`execution-fund-release:${request.id}`],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].status !== "posted") throw new Error("An existing execution-fund release journal is not posted. Manual reconciliation is required.");
    return existing.rows[0].id;
  }

  const accounts = await client.query(
    `SELECT account_key, account_code
       FROM public.erand_ledger_account_config
      WHERE account_key IN ('customer_funds_payable', 'payment_clearing')
        AND is_active = TRUE`,
  );
  const accountMap = Object.fromEntries(accounts.rows.map((row) => [row.account_key, row.account_code]));
  if (!accountMap.customer_funds_payable || !accountMap.payment_clearing) {
    throw new Error("The customer-funds payable and payment-clearing ledger accounts must both be active.");
  }
  const journal = await client.query(
    `INSERT INTO public.erand_ledger_journals
       (erand_id, journal_type, currency_code, description, status, idempotency_key)
     VALUES ($1::uuid, 'execution_fund_release', $2, 'Full execution funds released to assigned erander', 'draft', $3)
     RETURNING id`,
    [request.erand_id, request.metadata.currency_code, `execution-fund-release:${request.id}`],
  );
  const journalId = journal.rows[0].id;
  await client.query(
    `INSERT INTO public.erand_ledger_entries
       (journal_id, erand_id, account_code, entry_type, debit_amount, credit_amount, currency_code, description)
     VALUES
       ($1::uuid, $2::uuid, $3, 'execution_fund_release', $5::numeric, 0, $4, 'Customer funds payable cleared after verified execution-fund transfer'),
       ($1::uuid, $2::uuid, $6, 'execution_fund_release', 0, $5::numeric, $4, 'Paystack clearing reduced after verified execution-fund transfer')`,
    [journalId, request.erand_id, accountMap.customer_funds_payable, request.metadata.currency_code, minorToString(amountMinor), accountMap.payment_clearing],
  );
  await client.query("SELECT public.post_erand_ledger_journal($1::uuid)", [journalId]);
  return journalId;
}

async function finalizeSuccessfulTransfer(requestId, providerTransfer, adminId) {
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT * FROM public.erand_fund_release_requests WHERE id = $1::uuid FOR UPDATE`,
      [requestId],
    );
    const request = result.rows[0];
    if (!request) throw new Error("Fund-release request not found.");
    if (request.status === "released") { await client.query("COMMIT"); return { alreadyReleased: true, status: "released" }; }
    if (request.status !== "processing") throw new Error("Only a processing fund-release request can be finalized.");
    const expectedAmount = Number(request.metadata?.execution_funds_minor);
    if (!Number.isSafeInteger(expectedAmount) || expectedAmount <= 0) throw new Error("The recorded execution-fund amount is invalid.");
    if (providerTransfer?.reference !== request.provider_reference || String(providerTransfer?.currency || "").toUpperCase() !== request.metadata?.currency_code || Number(providerTransfer?.amount) !== expectedAmount) {
      throw new Error("The verified provider transfer reference, amount or currency does not match the fund-release request.");
    }
    const providerStatus = String(providerTransfer?.status || "").toLowerCase();
    if (providerStatus === "pending" || providerStatus === "otp") {
      await client.query("COMMIT");
      return { pending: true, status: "processing" };
    }
    if (["failed", "reversed"].includes(providerStatus)) {
      await client.query(
        `UPDATE public.erand_fund_release_requests
            SET status = 'failed', failure_reason = $2, updated_at = NOW(),
                metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
          WHERE id = $1::uuid`,
        [requestId, `Paystack transfer status: ${providerStatus}`, JSON.stringify({ paystack_transfer_status: providerStatus, transfer_verified_at: new Date().toISOString() })],
      );
      await insertRequestEvent(client, request, adminId, "fund_release_failed", { providerStatus, reason: "Provider confirmed that the transfer did not succeed." });
      await insertAudit(client, { admin: { id: adminId } }, { action: "errand_fund_release.failed", request, reason: `Paystack transfer status: ${providerStatus}`, before: { status: request.status }, after: { status: "failed" }, metadata: { providerStatus } });
      await client.query("COMMIT");
      notifyUser({
        recipientId: request.erander_id,
        type: "fund_release_failed",
        title: "Your execution-fund transfer failed",
        body: `Paystack confirmed that the transfer did not succeed (${providerStatus}). No execution funds were confirmed as released.`,
        actionUrl: "/dashboard/erands",
        entityType: "erand",
        entityId: request.erand_id,
        data: { requestId },
        dedupeKey: `fund_release_failed:${requestId}`,
      }).catch((error) => console.error("Fund-release failure notification failed:", error?.message));
      return { status: "failed", providerStatus };
    }
    if (providerStatus !== "success") throw new Error(`Paystack returned an unrecognized transfer status: ${providerStatus || "empty"}.`);

    const amountMinor = expectedAmount;
    const earningTransactionId = await createPendingEarning(client, request, adminId);
    const journalId = await postExecutionFundReleaseJournal(client, request, amountMinor);
    const updated = await client.query(
      `UPDATE public.erand_fund_release_requests
          SET status = 'released', released_at = NOW(), failure_reason = NULL,
              metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = NOW()
        WHERE id = $1::uuid RETURNING *`,
      [requestId, JSON.stringify({
        paystack_transfer_status: providerStatus,
        paystack_transfer_id: providerTransfer.id ?? null,
        transfer_verified_at: new Date().toISOString(),
        pending_earning_wallet_transaction_id: earningTransactionId,
        execution_fund_release_journal_id: journalId,
      })],
    );
    await insertRequestEvent(client, request, adminId, "fund_release_released", {
      providerReference: request.provider_reference,
      executionFundsMinor: amountMinor,
      currencyCode: request.metadata.currency_code,
      pendingEarningWalletTransactionId: earningTransactionId,
      ledgerJournalId: journalId,
    });
    await insertAudit(client, { admin: { id: adminId } }, {
      action: "errand_fund_release.released",
      request,
      reason: "Paystack confirmed successful full execution-fund transfer.",
      before: { status: request.status },
      after: { status: "released", releasedAt: updated.rows[0].released_at },
      metadata: { providerReference: request.provider_reference, amountMinor, currencyCode: request.metadata.currency_code, earningTransactionId, journalId },
    });
    await client.query("COMMIT");
    notifyUser({
      recipientId: request.erander_id,
      type: "fund_release_completed",
      title: "Execution funds have been released",
      body: "Paystack confirmed the execution-fund transfer to your registered bank account. Your service earnings remain pending until the errand is finalized.",
      actionUrl: "/dashboard/erands",
      entityType: "erand",
      entityId: request.erand_id,
      data: { requestId, providerReference: request.provider_reference },
      dedupeKey: `fund_release_completed:${requestId}`,
    }).catch((error) => console.error("Fund-release success notification failed:", error?.message));
    return { status: "released", releasedAt: updated.rows[0].released_at, earningTransactionId, journalId };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyAdminFundReleaseTransfer(req, res) {
  if (!canManage(req)) return fail(res, 403, "You do not have permission to verify fund-release transfers.", "ADMIN_PERMISSION_REQUIRED");
  const { requestId } = req.params;
  if (!UUID.test(requestId || "")) return fail(res, 400, "A valid request ID is required.", "INVALID_REQUEST_ID");
  try {
    const result = await getDatabasePool().query(
      `SELECT id, status, provider_reference FROM public.erand_fund_release_requests WHERE id = $1::uuid`,
      [requestId],
    );
    const request = result.rows[0];
    if (!request) return fail(res, 404, "Fund-release request not found.", "REQUEST_NOT_FOUND");
    if (request.status === "released") return res.json({ success: true, message: "This fund release has already been confirmed.", data: { status: "released", alreadyReleased: true } });
    if (request.status !== "processing" || !request.provider_reference) return fail(res, 409, "Only a processing request with an existing provider reference can be verified.", "REQUEST_NOT_PROCESSING");
    const transfer = await verifyPaystackTransfer(request.provider_reference);
    const settlement = await finalizeSuccessfulTransfer(requestId, transfer, req.admin.id);
    return res.json({
      success: true,
      message: settlement.pending ? "Paystack has not completed the transfer yet." : settlement.status === "failed" ? "Paystack confirmed that the transfer failed." : "Provider transfer verified and fund-release records updated.",
      data: settlement,
    });
  } catch (error) {
    console.error("Unable to verify errand fund release:", {
      status: error?.status || null,
      endpoint: error?.endpoint || null,
      providerMessage: error?.providerMessage || error?.message || null,
    });
    return fail(res, 502, "Unable to verify this transfer. Keep the request in processing and retry verification later.", "FUND_RELEASE_VERIFICATION_FAILED");
  }
}
