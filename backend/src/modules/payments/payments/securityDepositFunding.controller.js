import crypto from "node:crypto";
import { getDatabasePool } from "../../config/database.js";
import { env } from "../../config/env.js";
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
} from "./paystack.service.js";
import { getErrandSecurityDepositVerification } from "./securityDepositStatus.service.js";

const ATTEMPT_TTL_MINUTES = 30;
const ACTIVE_FUNDING_STATES = ["initializing", "pending", "processing"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(res, status, message, code = "SECURITY_DEPOSIT_FUNDING_FAILED") {
  return res.status(status).json({ success: false, message, code });
}

function normalizeText(value, max = 180) {
  return String(value ?? "").trim().slice(0, max);
}

function decimalToMinor(value, { allowZero = false } = {}) {
  const input = String(value ?? "").trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(input)) {
    throw new Error("Enter a valid amount with no more than two decimal places.");
  }
  const [whole, fraction = ""] = input.split(".");
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if ((!allowZero && minor <= 0n) || minor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("The amount is outside the supported range.");
  }
  return Number(minor);
}

function minorToDecimal(value) {
  const minor = BigInt(value || 0);
  return `${minor / 100n}.${String(minor % 100n).padStart(2, "0")}`;
}

function asMetadata(value) {
  if (value && typeof value === "object") return value;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return {};
}

function mapSecurityTransaction(row) {
  if (!row) return null;
  const metadata = asMetadata(row.metadata);
  return {
    id: row.id,
    status: row.status === "succeeded" ? "succeeded" : (metadata.funding_state || "pending"),
    reservation_id: row.reservation_id,
    security_transaction_id: row.id,
    wallet_transaction_id: row.wallet_transaction_id,
    wallet_id: metadata.wallet_id || null,
    wallet_contribution_minor: Number(metadata.wallet_contribution_minor || 0),
    paystack_amount_minor: Number(metadata.paystack_contribution_minor || 0),
    required_amount_minor: Number(row.amount_minor),
    currency_code: row.currency_code,
    provider_reference: row.provider_reference,
    authorization_url: metadata.authorization_url || null,
    expires_at: metadata.expires_at || null,
    metadata,
    reservation_erand_id: row.reservation_erand_id || null,
  };
}

function buildCallbackUrl(offerId, reference) {
  const base = String(env.frontendUrl || "").trim();
  if (!base) throw new Error("FRONTEND_URL must be configured before security-deposit funding can be initialized.");
  const callback = new URL(`/dashboard/my-offers/${encodeURIComponent(offerId)}`, base);
  callback.searchParams.set("security_deposit_reference", reference);
  return callback.toString();
}

async function ensureWallet(client, profileId, currency) {
  await client.query(
    `INSERT INTO public.wallets (profile_id, currency_code)
     VALUES ($1::uuid, $2)
     ON CONFLICT (profile_id, currency_code) DO NOTHING`,
    [profileId, currency],
  );
  const result = await client.query(
    `SELECT id, profile_id, currency_code, available_balance,
            pending_balance, reserved_balance, status
       FROM public.wallets
      WHERE profile_id = $1::uuid AND currency_code = $2
      FOR UPDATE`,
    [profileId, currency],
  );
  if (!result.rows[0]) throw new Error("The erander wallet could not be loaded.");
  return result.rows[0];
}

async function ensureFinancialAccount(client, { profileId = null, walletId = null, code, name, type, currency }) {
  await client.query(
    `INSERT INTO public.financial_accounts
       (profile_id, wallet_id, account_code, account_name, account_type, currency_code)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
     ON CONFLICT (account_code, currency_code) DO NOTHING`,
    [profileId, walletId, code, name, type, currency],
  );
  const result = await client.query(
    `SELECT id, profile_id, wallet_id, account_type, currency_code
       FROM public.financial_accounts
      WHERE account_code = $1 AND currency_code = $2
      FOR UPDATE`,
    [code, currency],
  );
  if (!result.rows[0] || result.rows[0].account_type !== type) {
    throw new Error(`The ${name} financial account is not configured correctly.`);
  }
  return result.rows[0];
}

async function ensureWalletFinancialAccount(client, wallet) {
  const existing = await client.query(
    `SELECT id FROM public.financial_accounts
      WHERE wallet_id = $1::uuid AND profile_id = $2::uuid
        AND account_type = 'wallet' AND currency_code = $3
      FOR UPDATE`,
    [wallet.id, wallet.profile_id, wallet.currency_code],
  );
  if (existing.rows[0]) return existing.rows[0];
  const code = `WALLET_${wallet.id.replaceAll("-", "").toUpperCase()}`;
  return ensureFinancialAccount(client, {
    profileId: wallet.profile_id,
    walletId: wallet.id,
    code,
    name: `Wallet ${wallet.id}`,
    type: "wallet",
    currency: wallet.currency_code,
  });
}

async function getFundingTransaction(client, transactionId, { lock = false } = {}) {
  const result = await client.query(
    `SELECT st.*, r.status AS reservation_status,
            r.amount_minor AS reservation_amount_minor,
            r.currency_code AS reservation_currency_code,
            r.security_account_id AS reservation_security_account_id,
            r.erand_id AS reservation_erand_id,
            s.erander_id
       FROM public.erander_security_deposit_transactions st
       JOIN public.erander_security_deposit_reservations r ON r.id = st.reservation_id
       JOIN public.erander_security_deposit_accounts s ON s.id = st.security_account_id
      WHERE st.id = $1::uuid
      ${lock ? "FOR UPDATE OF st, r, s" : ""}`,
    [transactionId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...mapSecurityTransaction(row),
    erander_id: row.erander_id,
    reservation_status: row.reservation_status,
    reservation_amount_minor: row.reservation_amount_minor,
    reservation_currency_code: row.reservation_currency_code,
    reservation_erand_id: row.reservation_erand_id,
  };
}

async function setFundingMetadata(client, transactionId, patch) {
  await client.query(
    `UPDATE public.erander_security_deposit_transactions
        SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
            updated_at = NOW()
      WHERE id = $1::uuid`,
    [transactionId, JSON.stringify(patch)],
  );
}

async function restoreAttemptHold(client, attempt, terminalState, reason) {
  const walletPart = Number(attempt.wallet_contribution_minor || 0);
  if (walletPart > 0) {
    const walletResult = await client.query(
      `SELECT id, available_balance, reserved_balance
         FROM public.wallets WHERE id = $1::uuid FOR UPDATE`,
      [attempt.wallet_id],
    );
    const wallet = walletResult.rows[0];
    if (!wallet || Number(wallet.reserved_balance) < walletPart) {
      throw new Error("The held wallet contribution could not be reconciled. Manual finance review is required.");
    }
    await client.query(
      `UPDATE public.wallets
          SET available_balance = available_balance + $2::bigint,
              reserved_balance = reserved_balance - $2::bigint,
              updated_at = NOW()
        WHERE id = $1::uuid`,
      [wallet.id, walletPart],
    );
  }

  if (attempt.wallet_transaction_id) {
    await client.query(
      `UPDATE public.wallet_transactions
          SET status = $2,
              updated_at = NOW(),
              metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
        WHERE id = $1::uuid AND status = 'pending'`,
      [attempt.wallet_transaction_id, terminalState === "cancelled" || terminalState === "expired" ? "cancelled" : "failed", JSON.stringify({ failure_reason: reason || null })],
    );
  }

  await setFundingMetadata(client, attempt.id, {
    funding_state: terminalState,
    failure_reason: reason || null,
    terminal_at: new Date().toISOString(),
  });
}

async function finalizeAttempt({ attemptId, providerTransaction = null, source = "wallet_only" }) {
  const pool = getDatabasePool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const attempt = await getFundingTransaction(client, attemptId, { lock: true });
    if (!attempt) throw new Error("Security-deposit funding transaction not found.");
    if (attempt.status === "succeeded") {
      await client.query("COMMIT");
      return { secured: true, reservationId: attempt.reservation_id, alreadyCompleted: true };
    }
    if (!ACTIVE_FUNDING_STATES.includes(attempt.status)) {
      throw new Error("This security-deposit funding attempt is no longer active.");
    }
    if (attempt.reservation_status !== "pending") throw new Error("The security-deposit reservation is not pending.");

    const required = Number(attempt.required_amount_minor);
    const walletPart = Number(attempt.wallet_contribution_minor);
    const paystackPart = Number(attempt.paystack_amount_minor);
    if (walletPart + paystackPart !== required) throw new Error("The funding contributions do not equal the full security deposit.");

    if (paystackPart > 0) {
      if (!providerTransaction) throw new Error("Paystack confirmation is required.");
      if (
        providerTransaction.status !== "success" ||
        providerTransaction.reference !== attempt.provider_reference ||
        String(providerTransaction.currency || "").toUpperCase() !== attempt.currency_code ||
        Number(providerTransaction.amount) !== paystackPart
      ) {
        throw new Error("Paystack's verified amount, currency, reference or status does not match this security-deposit payment.");
      }
    }

    const walletResult = await client.query(
      `SELECT id, profile_id, currency_code, available_balance, reserved_balance, status
         FROM public.wallets WHERE id = $1::uuid FOR UPDATE`,
      [attempt.wallet_id],
    );
    const wallet = walletResult.rows[0];
    if (!wallet || wallet.status !== "active" || wallet.profile_id !== attempt.erander_id || wallet.currency_code !== attempt.currency_code) {
      throw new Error("The erander wallet is unavailable or does not match the security-deposit owner.");
    }

    const walletTransactionResult = await client.query(
      `SELECT id, status, amount_minor, currency_code, related_erand_id
         FROM public.wallet_transactions WHERE id = $1::uuid FOR UPDATE`,
      [attempt.wallet_transaction_id],
    );
    const walletTransaction = walletTransactionResult.rows[0];
    if (!walletTransaction || walletTransaction.status !== "pending" || Number(walletTransaction.amount_minor) !== required || walletTransaction.currency_code !== attempt.currency_code || walletTransaction.related_erand_id !== attempt.reservation_erand_id) {
      throw new Error("The pending wallet audit transaction could not be verified.");
    }

    const walletAccount = await ensureWalletFinancialAccount(client, wallet);
    const securityReserve = await ensureFinancialAccount(client, {
      code: "SYSTEM:SECURITY_RESERVE",
      name: "System security reserve",
      type: "security_reserve",
      currency: attempt.currency_code,
    });

    const debits = [];
    if (walletPart > 0) {
      debits.push({ accountId: walletAccount.id, amount: walletPart, description: "Erander wallet contribution to security deposit." });
    }
    if (paystackPart > 0) {
      const clearing = await ensureFinancialAccount(client, {
        code: `PAYSTACK_CLEARING_${attempt.currency_code}`,
        name: `Paystack payment clearing (${attempt.currency_code})`,
        type: "payment_clearing",
        currency: attempt.currency_code,
      });
      debits.push({ accountId: clearing.id, amount: paystackPart, description: "Direct Paystack contribution to security deposit." });
    }
    if (debits.reduce((sum, entry) => sum + entry.amount, 0) !== required) {
      throw new Error("The security-deposit ledger contributions do not reconcile.");
    }

    // The wallet contribution was held at checkout initialization. Paystack's
    // contribution is added to reserved balance only after provider confirmation.
    if (paystackPart > 0) {
      await client.query(
        `UPDATE public.wallets
            SET reserved_balance = reserved_balance + $2::bigint,
                updated_at = NOW()
          WHERE id = $1::uuid`,
        [wallet.id, paystackPart],
      );
    }

    for (const debit of debits) {
      await client.query(
        `INSERT INTO public.wallet_ledger_entries
           (transaction_id, account_id, entry_side, amount_minor, currency_code, description)
         VALUES ($1::uuid, $2::uuid, 'debit', $3::bigint, $4, $5)`,
        [attempt.wallet_transaction_id, debit.accountId, debit.amount, attempt.currency_code, debit.description],
      );
    }
    await client.query(
      `INSERT INTO public.wallet_ledger_entries
         (transaction_id, account_id, entry_side, amount_minor, currency_code, description)
       VALUES ($1::uuid, $2::uuid, 'credit', $3::bigint, $4, $5)`,
      [attempt.wallet_transaction_id, securityReserve.id, required, attempt.currency_code, "Full security deposit received into the system security reserve."],
    );

    const fundingMethod = paystackPart > 0 && walletPart > 0 ? "wallet_and_paystack" : paystackPart > 0 ? "paystack_direct" : "wallet_only";
    const finalMetadata = {
      funding_method: fundingMethod,
      wallet_contribution_minor: walletPart,
      paystack_contribution_minor: paystackPart,
      security_deposit_transaction_id: attempt.id,
      paystack_transaction_id: providerTransaction?.id ?? null,
      paid_at: providerTransaction?.paid_at ?? null,
      funding_state: "succeeded",
      verification_source: source,
    };

    await client.query(
      `UPDATE public.wallet_transactions
          SET status = 'successful', completed_at = NOW(), updated_at = NOW(),
              payment_provider = CASE WHEN $2::bigint > 0 THEN 'paystack' ELSE payment_provider END,
              provider_reference = COALESCE($3, provider_reference),
              metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb
        WHERE id = $1::uuid`,
      [attempt.wallet_transaction_id, paystackPart, attempt.provider_reference, JSON.stringify(finalMetadata)],
    );
    await client.query(
      `UPDATE public.erander_security_deposit_transactions
          SET status = 'succeeded',
              payment_provider = CASE WHEN $2::bigint > 0 THEN 'paystack' ELSE payment_provider END,
              provider_confirmed_at = CASE WHEN $2::bigint > 0 THEN NOW() ELSE provider_confirmed_at END,
              platform_confirmed_at = NOW(), updated_at = NOW(),
              metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
        WHERE id = $1::uuid`,
      [attempt.id, paystackPart, JSON.stringify(finalMetadata)],
    );
    await client.query(
      `UPDATE public.erander_security_deposit_reservations
          SET status = 'reserved', reserved_at = NOW(), updated_at = NOW()
        WHERE id = $1::uuid AND status = 'pending'`,
      [attempt.reservation_id],
    );

    await client.query("COMMIT");
    return { secured: true, reservationId: attempt.reservation_id, alreadyCompleted: false };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function failAttempt(attemptId, reason, terminalState = "failed") {
  const pool = getDatabasePool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const attempt = await getFundingTransaction(client, attemptId, { lock: true });
    if (attempt && ACTIVE_FUNDING_STATES.includes(attempt.status)) {
      await restoreAttemptHold(client, attempt, terminalState, reason);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function expireAttemptsForErrand(erandId) {
  const pool = getDatabasePool();
  const result = await pool.query(
    `SELECT st.id, st.provider_reference, st.status, st.metadata,
            st.wallet_transaction_id, st.reservation_id, st.security_account_id,
            st.erand_id, st.amount_minor, st.currency_code,
            s.erander_id
       FROM public.erander_security_deposit_transactions st
       JOIN public.erander_security_deposit_accounts s ON s.id = st.security_account_id
      WHERE st.erand_id = $1::uuid
        AND st.transaction_type = 'reservation'
        AND st.status = 'pending'
        AND st.created_at <= NOW() - ($2::text || ' minutes')::interval
        AND COALESCE(st.metadata->>'funding_state', 'pending') IN ('initializing','pending','processing')
      ORDER BY st.created_at ASC`,
    [erandId, ATTEMPT_TTL_MINUTES],
  );

  for (const row of result.rows) {
    const attempt = mapSecurityTransaction(row);
    attempt.erander_id = row.erander_id;
    if (attempt.paystack_amount_minor > 0 && attempt.provider_reference) {
      let providerTransaction;
      try {
        providerTransaction = await verifyPaystackTransaction(attempt.provider_reference);
      } catch (error) {
        // A missing provider transaction is safe to expire only when checkout
        // was never initialized. Otherwise an unknown status keeps the hold.
        if (!(attempt.status === "initializing" && !attempt.authorization_url && Number(error?.status) === 404)) {
          console.warn("Could not safely expire security-deposit checkout; provider status is unknown:", error?.message || error);
          continue;
        }
      }
      if (providerTransaction?.status === "success") {
        try { await finalizeAttempt({ attemptId: attempt.id, providerTransaction, source: "expiry_reconciliation" }); }
        catch (error) { console.error("Successful expired security-deposit payment needs reconciliation:", error); }
        continue;
      }
      if (providerTransaction && !["failed", "abandoned", "cancelled"].includes(String(providerTransaction.status || "").toLowerCase())) continue;
    }
    try {
      await failAttempt(attempt.id, "Security-deposit checkout expired before Paystack confirmed payment.", "expired");
    } catch (error) {
      console.error("Unable to expire security-deposit funding transaction:", error);
    }
  }
}

async function getOwnedErrand(client, erandId, profileId, { lock = false } = {}) {
  const result = await client.query(
    `SELECT e.id, e.requested_by, e.assigned_erander_id, e.accepted_offer_id,
            e.status, e.currency_code, e.agreement_accepted_at, e.agreement_locked_at,
            o.proposed_total, o.currency_code AS offer_currency_code, o.status AS offer_status,
            o.offered_by
       FROM public.erands e
       JOIN public.erand_offers o ON o.id = e.accepted_offer_id AND o.erand_id = e.id
      WHERE e.id = $1::uuid
        ${lock ? "FOR UPDATE OF e, o" : ""}`,
    [erandId],
  );
  const errand = result.rows[0];
  if (!errand) throw Object.assign(new Error("The accepted errand agreement could not be found."), { status: 404, code: "ERRAND_NOT_FOUND" });
  if (errand.assigned_erander_id !== profileId || errand.offered_by !== profileId) {
    throw Object.assign(new Error("Only the assigned erander can fund this security deposit."), { status: 403, code: "NOT_ASSIGNED_ERANDER" });
  }
  if (!errand.accepted_offer_id || !errand.agreement_accepted_at || !errand.agreement_locked_at || errand.offer_status !== "accepted") {
    throw Object.assign(new Error("A complete accepted and locked agreement is required before securing this errand."), { status: 409, code: "AGREEMENT_NOT_READY" });
  }
  if (!["offer_selected", "awaiting_funding", "funded"].includes(String(errand.status).toLowerCase())) {
    throw Object.assign(new Error("Security-deposit funding is not available at this errand stage."), { status: 409, code: "ERRAND_STAGE_NOT_ELIGIBLE" });
  }
  if (errand.currency_code !== errand.offer_currency_code) {
    throw Object.assign(new Error("The accepted offer currency does not match the errand currency."), { status: 409, code: "CURRENCY_MISMATCH" });
  }
  if (!["NGN", "USD"].includes(errand.currency_code)) {
    throw Object.assign(new Error("Security deposits currently support NGN and USD."), { status: 400, code: "UNSUPPORTED_CURRENCY" });
  }
  let requiredMinor;
  try { requiredMinor = decimalToMinor(errand.proposed_total); }
  catch { throw Object.assign(new Error("The accepted offer has an invalid security-deposit amount."), { status: 409, code: "INVALID_AGREEMENT_TOTAL" }); }
  return { ...errand, required_amount_minor: requiredMinor };
}

export async function getSecurityDepositFundingSummary(req, res) {
  const erandId = req.params.erandId;
  const profileId = req.user?.id;
  if (!UUID_PATTERN.test(String(erandId || "")) || !profileId) return fail(res, 400, "A valid errand and authenticated erander are required.", "INVALID_REQUEST");
  try {
    await expireAttemptsForErrand(erandId);
    const pool = getDatabasePool();
    const client = await pool.connect();
    try {
      const errand = await getOwnedErrand(client, erandId, profileId);
      const [walletResult, reservationResult, attemptResult, verification] = await Promise.all([
        client.query(`SELECT id, available_balance, reserved_balance, status FROM public.wallets WHERE profile_id = $1::uuid AND currency_code = $2 LIMIT 1`, [profileId, errand.currency_code]),
        client.query(`SELECT id, amount_minor, currency_code, status FROM public.erander_security_deposit_reservations WHERE erand_id = $1::uuid ORDER BY created_at DESC LIMIT 1`, [erandId]),
        client.query(
          `SELECT st.*, s.erander_id
             FROM public.erander_security_deposit_transactions st
             JOIN public.erander_security_deposit_accounts s ON s.id = st.security_account_id
            WHERE st.erand_id = $1::uuid AND s.erander_id = $2::uuid
              AND st.transaction_type = 'reservation' AND st.status = 'pending'
              AND COALESCE(st.metadata->>'funding_state', 'pending') IN ('initializing','pending','processing')
            ORDER BY st.created_at DESC LIMIT 1`,
          [erandId, profileId],
        ),
        getErrandSecurityDepositVerification(client, { id: errand.id, assigned_erander_id: errand.assigned_erander_id, accepted_offer_id: errand.accepted_offer_id }),
      ]);
      const wallet = walletResult.rows[0];
      const reservation = reservationResult.rows[0];
      const attempt = mapSecurityTransaction(attemptResult.rows[0]);
      return res.json({
        success: true,
        data: {
          errandId,
          currency: errand.currency_code,
          requiredAmountMinor: String(errand.required_amount_minor),
          requiredAmount: minorToDecimal(errand.required_amount_minor),
          availableBalanceMinor: String(wallet?.available_balance || 0),
          availableBalance: minorToDecimal(wallet?.available_balance || 0),
          walletStatus: wallet?.status || "not_created",
          reservation: reservation ? { id: reservation.id, status: reservation.status, amountMinor: String(reservation.amount_minor), currency: reservation.currency_code } : null,
          secured: verification.secured,
          securityDepositStatus: verification.status,
          pendingAttempt: attempt ? {
            id: attempt.id,
            status: attempt.status,
            walletContributionMinor: String(attempt.wallet_contribution_minor),
            paystackAmountMinor: String(attempt.paystack_amount_minor),
            providerReference: attempt.provider_reference,
            authorizationUrl: attempt.authorization_url,
            expiresAt: attempt.expires_at,
          } : null,
        },
      });
    } finally { client.release(); }
  } catch (error) {
    console.error("Unable to retrieve security-deposit funding summary:", error);
    return fail(res, error.status || 500, error.message || "Unable to retrieve security-deposit funding details.", error.code || "SECURITY_DEPOSIT_SUMMARY_FAILED");
  }
}

export async function initializeSecurityDepositFunding(req, res) {
  const erandId = req.params.erandId;
  const profileId = req.user?.id;
  if (!UUID_PATTERN.test(String(erandId || "")) || !profileId) return fail(res, 400, "A valid errand and authenticated erander are required.", "INVALID_REQUEST");
  let walletContributionMinor;
  try { walletContributionMinor = decimalToMinor(req.body?.walletContribution ?? "0", { allowZero: true }); }
  catch (error) { return fail(res, 400, error.message, "INVALID_WALLET_CONTRIBUTION"); }

  const pool = getDatabasePool();
  const client = await pool.connect();
  let attempt = null;
  let checkoutData = null;
  try {
    await client.query("BEGIN");
    const errand = await getOwnedErrand(client, erandId, profileId, { lock: true });
    const accountResult = await client.query(
      `SELECT id, account_status, required_deposit_percent, deposit_requirement_waived
         FROM public.erander_security_deposit_accounts WHERE erander_id = $1::uuid FOR UPDATE`,
      [profileId],
    );
    const securityAccount = accountResult.rows[0];
    if (!securityAccount || securityAccount.account_status !== "active" || Number(securityAccount.required_deposit_percent) !== 100 || securityAccount.deposit_requirement_waived === true) {
      throw Object.assign(new Error("Your security-deposit account is not eligible for the required 100% reservation. Contact support if you believe this is incorrect."), { status: 409, code: "SECURITY_ACCOUNT_NOT_ELIGIBLE" });
    }

    const reservationResult = await client.query(
      `SELECT id, status, amount_minor, currency_code
         FROM public.erander_security_deposit_reservations
        WHERE security_account_id = $1::uuid AND erand_id = $2::uuid
        FOR UPDATE`,
      [securityAccount.id, erandId],
    );
    let reservation = reservationResult.rows[0] || null;
    if (reservation?.status === "reserved") {
      if (Number(reservation.amount_minor) !== errand.required_amount_minor || reservation.currency_code !== errand.currency_code) throw Object.assign(new Error("The existing security-deposit reservation does not match the accepted agreement. Contact support."), { status: 409, code: "RESERVATION_MISMATCH" });
      await client.query("COMMIT");
      return res.json({ success: true, data: { secured: true, reservationId: reservation.id, message: "This errand is already secured." } });
    }
    if (reservation && reservation.status !== "pending") throw Object.assign(new Error(`This errand has a ${reservation.status} security-deposit reservation and cannot be funded automatically.`), { status: 409, code: "RESERVATION_NOT_FUNDABLE" });

    if (!reservation) {
      const inserted = await client.query(
        `INSERT INTO public.erander_security_deposit_reservations
           (security_account_id, erand_id, amount_minor, currency_code, status, notes)
         VALUES ($1::uuid, $2::uuid, $3::bigint, $4, 'pending', $5)
         RETURNING id, status, amount_minor, currency_code`,
        [securityAccount.id, erandId, errand.required_amount_minor, errand.currency_code, "Pending 100% security-deposit funding through wallet and/or Paystack."],
      );
      reservation = inserted.rows[0];
    } else if (Number(reservation.amount_minor) !== errand.required_amount_minor || reservation.currency_code !== errand.currency_code) {
      throw Object.assign(new Error("The pending reservation does not match the accepted agreement. Contact support."), { status: 409, code: "RESERVATION_MISMATCH" });
    }

    const activeResult = await client.query(
      `SELECT st.*, s.erander_id
         FROM public.erander_security_deposit_transactions st
         JOIN public.erander_security_deposit_accounts s ON s.id = st.security_account_id
        WHERE st.reservation_id = $1::uuid AND st.security_account_id = $2::uuid
          AND st.transaction_type = 'reservation' AND st.status = 'pending'
          AND COALESCE(st.metadata->>'funding_state', 'pending') IN ('initializing','pending','processing')
        ORDER BY st.created_at DESC LIMIT 1 FOR UPDATE OF st`,
      [reservation.id, securityAccount.id],
    );
    const activeAttempt = mapSecurityTransaction(activeResult.rows[0]);
    if (activeAttempt) {
      if (activeAttempt.wallet_contribution_minor !== walletContributionMinor) throw Object.assign(new Error("A security-deposit payment is already in progress. Resume or cancel it before choosing a different wallet contribution."), { status: 409, code: "FUNDING_ATTEMPT_IN_PROGRESS" });
      await client.query("COMMIT");
      return res.json({ success: true, data: { secured: false, pending: true, authorizationUrl: activeAttempt.authorization_url, reference: activeAttempt.provider_reference, status: activeAttempt.status, attemptId: activeAttempt.id, message: activeAttempt.authorization_url ? "Continue your existing Paystack checkout." : "Your security-deposit payment is being initialized." } });
    }

    const wallet = await ensureWallet(client, profileId, errand.currency_code);
    if (wallet.status !== "active") throw Object.assign(new Error("Your wallet is not active."), { status: 403, code: "WALLET_NOT_ACTIVE" });
    if (walletContributionMinor > Number(wallet.available_balance)) throw Object.assign(new Error("Your wallet contribution exceeds your available balance."), { status: 400, code: "INSUFFICIENT_WALLET_BALANCE" });
    if (walletContributionMinor > errand.required_amount_minor) throw Object.assign(new Error("Your wallet contribution cannot exceed the required security deposit."), { status: 400, code: "WALLET_CONTRIBUTION_TOO_HIGH" });

    const paystackAmountMinor = errand.required_amount_minor - walletContributionMinor;
    if (paystackAmountMinor > 0 && errand.currency_code !== "NGN") throw Object.assign(new Error("Direct Paystack security-deposit funding is currently available in NGN only. Use your wallet for this currency."), { status: 400, code: "PAYSTACK_CURRENCY_UNSUPPORTED" });
    if (paystackAmountMinor > 0 && !req.user?.email) throw Object.assign(new Error("Add an email address to your account before paying through Paystack."), { status: 400, code: "EMAIL_REQUIRED" });

    const now = new Date();
    const transactionReference = `SEC-DEP-${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`;
    const walletReference = `SEC-DEP-WALLET-${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`;
    const walletIdempotencyKey = `SECURITY-DEPOSIT-FUNDING:${crypto.randomUUID()}`;

    // Create an auditable wallet transaction for the complete secured amount.
    // For Paystack-only funding this is a ledger anchor, not a wallet debit.
    const walletTransactionResult = await client.query(
      `INSERT INTO public.wallet_transactions
         (wallet_id, reference, idempotency_key, type, amount_minor, currency_code,
          status, description, related_erand_id, metadata)
       VALUES ($1::uuid, $2, $3, 'reservation', $4::bigint, $5, 'pending', $6, $7::uuid, $8::jsonb)
       RETURNING id`,
      [wallet.id, walletReference, walletIdempotencyKey, errand.required_amount_minor, errand.currency_code, "Erander security-deposit reservation", erandId, JSON.stringify({ reservation_id: reservation.id, security_account_id: securityAccount.id, funding_state: "initializing" })],
    );
    const walletTransactionId = walletTransactionResult.rows[0].id;

    const metadata = {
      accepted_offer_id: errand.accepted_offer_id,
      wallet_id: wallet.id,
      wallet_transaction_id: walletTransactionId,
      wallet_contribution_minor: walletContributionMinor,
      paystack_contribution_minor: paystackAmountMinor,
      required_amount_minor: errand.required_amount_minor,
      funding_method: paystackAmountMinor > 0 && walletContributionMinor > 0 ? "wallet_and_paystack" : paystackAmountMinor > 0 ? "paystack_direct" : "wallet_only",
      funding_state: "initializing",
      expires_at: new Date(now.getTime() + ATTEMPT_TTL_MINUTES * 60_000).toISOString(),
    };
    const securityTransactionResult = await client.query(
      `INSERT INTO public.erander_security_deposit_transactions
         (security_account_id, reservation_id, erand_id, transaction_type,
          amount_minor, currency_code, status, payment_provider,
          provider_reference, wallet_transaction_id, initiated_at, reason, metadata)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'reservation', $4::bigint, $5,
               'pending', $6, $7, $8::uuid, NOW(), $9, $10::jsonb)
       RETURNING id`,
      [securityAccount.id, reservation.id, erandId, errand.required_amount_minor, errand.currency_code, paystackAmountMinor > 0 ? "paystack" : null, paystackAmountMinor > 0 ? transactionReference : null, walletTransactionId, `100% security deposit funding: ${paystackAmountMinor > 0 && walletContributionMinor > 0 ? "wallet and Paystack" : paystackAmountMinor > 0 ? "Paystack" : "wallet"}.`, JSON.stringify(metadata)],
    );
    const securityTransactionId = securityTransactionResult.rows[0].id;

    if (walletContributionMinor > 0) {
      const hold = await client.query(
        `UPDATE public.wallets
            SET available_balance = available_balance - $2::bigint,
                reserved_balance = reserved_balance + $2::bigint,
                updated_at = NOW()
          WHERE id = $1::uuid AND available_balance >= $2::bigint
          RETURNING id`,
        [wallet.id, walletContributionMinor],
      );
      if (!hold.rowCount) throw Object.assign(new Error("Your available wallet balance changed. Refresh and try again."), { status: 409, code: "WALLET_BALANCE_CHANGED" });
    }

    await client.query("COMMIT");
    attempt = { id: securityTransactionId, reservation_id: reservation.id, provider_reference: paystackAmountMinor > 0 ? transactionReference : null, wallet_contribution_minor: walletContributionMinor, paystack_amount_minor: paystackAmountMinor, required_amount_minor: errand.required_amount_minor, wallet_transaction_id: walletTransactionId, wallet_id: wallet.id, currency_code: errand.currency_code };
    checkoutData = { paystackAmountMinor, currency: errand.currency_code, offerId: errand.accepted_offer_id };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Unable to initialize security-deposit funding:", error);
    return fail(res, error.status || 500, error.message || "Unable to initialize security-deposit funding.", error.code || "SECURITY_DEPOSIT_INITIALIZATION_FAILED");
  } finally { client.release(); }

  if (checkoutData.paystackAmountMinor === 0) {
    try {
      const completed = await finalizeAttempt({ attemptId: attempt.id, source: "wallet_only" });
      return res.status(200).json({ success: true, message: "Your security deposit has been reserved successfully.", data: { ...completed, reservationId: completed.reservationId } });
    } catch (error) {
      console.error("Unable to finalize wallet-only security deposit:", error);
      await failAttempt(attempt.id, error.message).catch((releaseError) => console.error("Unable to release failed wallet-only hold:", releaseError));
      return fail(res, 500, "We could not complete the security-deposit reservation. Any held wallet contribution has been returned where possible.", "SECURITY_DEPOSIT_RESERVATION_FAILED");
    }
  }

  try {
    const checkout = await initializePaystackTransaction({
      email: req.user.email,
      amount: minorToDecimal(checkoutData.paystackAmountMinor),
      currency: checkoutData.currency,
      reference: attempt.provider_reference,
      callbackUrl: buildCallbackUrl(checkoutData.offerId, attempt.provider_reference),
      metadata: {
        purpose: "erander_security_deposit",
        security_deposit_transaction_id: attempt.id,
        reservation_id: attempt.reservation_id,
        errand_id: erandId,
        erander_id: profileId,
        wallet_contribution_minor: attempt.wallet_contribution_minor,
        security_deposit_amount_minor: attempt.required_amount_minor,
      },
    });
    await pool.query(
      `UPDATE public.erander_security_deposit_transactions
          SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = NOW()
        WHERE id = $1::uuid AND status = 'pending'`,
      [attempt.id, JSON.stringify({ funding_state: "pending", authorization_url: checkout.authorizationUrl })],
    );
    return res.status(201).json({ success: true, message: "Paystack checkout is ready. Your wallet contribution is held until payment is confirmed.", data: { secured: false, pending: true, authorizationUrl: checkout.authorizationUrl, reference: attempt.provider_reference, attemptId: attempt.id } });
  } catch (error) {
    console.error("Paystack security-deposit initialization failed:", { status: error?.status || null, providerMessage: error?.providerMessage || error?.message || null });
    await failAttempt(attempt.id, "Paystack could not initialize the security-deposit payment.").catch((releaseError) => console.error("Unable to release failed security-deposit hold:", releaseError));
    return fail(res, 502, "Paystack could not initialize this security-deposit payment. Any wallet contribution held for this attempt has been returned.", "PAYSTACK_INITIALIZATION_FAILED");
  }
}

export async function verifySecurityDepositFunding(req, res) {
  const erandId = req.params.erandId;
  const profileId = req.user?.id;
  const reference = normalizeText(req.body?.reference, 100);
  if (!UUID_PATTERN.test(String(erandId || "")) || !profileId || !reference) return fail(res, 400, "A valid errand and payment reference are required.", "INVALID_REQUEST");
  try {
    const result = await getDatabasePool().query(
      `SELECT st.*, s.erander_id
         FROM public.erander_security_deposit_transactions st
         JOIN public.erander_security_deposit_accounts s ON s.id = st.security_account_id
        WHERE st.erand_id = $1::uuid AND s.erander_id = $2::uuid
          AND st.provider_reference = $3 AND st.transaction_type = 'reservation'
        LIMIT 1`,
      [erandId, profileId, reference],
    );
    const attempt = mapSecurityTransaction(result.rows[0]);
    if (!attempt) return fail(res, 404, "Security-deposit payment not found.", "SECURITY_DEPOSIT_PAYMENT_NOT_FOUND");
    if (attempt.status === "succeeded") return res.json({ success: true, message: "Your security deposit is already secured.", data: { secured: true, alreadyCompleted: true } });
    if (!ACTIVE_FUNDING_STATES.includes(attempt.status)) return fail(res, 409, "This security-deposit payment is no longer active. You can start a new attempt.", "SECURITY_DEPOSIT_PAYMENT_NOT_ACTIVE");

    const providerTransaction = await verifyPaystackTransaction(reference);
    if (providerTransaction.status !== "success") {
      if (["failed", "abandoned", "cancelled"].includes(String(providerTransaction.status).toLowerCase())) {
        await failAttempt(attempt.id, `Paystack payment status: ${providerTransaction.status}.`);
        return fail(res, 409, "Paystack did not complete the security-deposit payment. Your wallet contribution has been returned.", "PAYSTACK_PAYMENT_NOT_SUCCESSFUL");
      }
      await setFundingMetadata(getDatabasePool(), attempt.id, { funding_state: "processing" });
      return res.status(202).json({ success: true, message: "Paystack has not confirmed this payment yet. You can safely retry verification.", data: { secured: false, processing: true } });
    }
    const completed = await finalizeAttempt({ attemptId: attempt.id, providerTransaction, source: "erander_callback_verification" });
    return res.json({ success: true, message: "Your security deposit has been reserved successfully.", data: { secured: completed.secured, reservationId: completed.reservationId, alreadyCompleted: completed.alreadyCompleted } });
  } catch (error) {
    console.error("Unable to verify security-deposit payment:", error);
    return fail(res, 502, error.message || "Unable to verify the security-deposit payment. Retry verification shortly.", "SECURITY_DEPOSIT_VERIFICATION_FAILED");
  }
}

export async function cancelSecurityDepositFunding(req, res) {
  const erandId = req.params.erandId;
  const profileId = req.user?.id;
  const attemptId = normalizeText(req.body?.attemptId, 50);
  if (!UUID_PATTERN.test(String(erandId || "")) || !UUID_PATTERN.test(attemptId) || !profileId) return fail(res, 400, "A valid errand and funding attempt are required.", "INVALID_REQUEST");
  try {
    const result = await getDatabasePool().query(
      `SELECT st.*, s.erander_id
         FROM public.erander_security_deposit_transactions st
         JOIN public.erander_security_deposit_accounts s ON s.id = st.security_account_id
        WHERE st.id = $1::uuid AND st.erand_id = $2::uuid AND s.erander_id = $3::uuid
        LIMIT 1`,
      [attemptId, erandId, profileId],
    );
    const attempt = mapSecurityTransaction(result.rows[0]);
    if (!attempt) return fail(res, 404, "Security-deposit funding attempt not found.", "FUNDING_ATTEMPT_NOT_FOUND");
    if (attempt.status === "succeeded") return res.json({ success: true, message: "This security deposit is already secured.", data: { secured: true } });
    if (!ACTIVE_FUNDING_STATES.includes(attempt.status)) return fail(res, 409, "This security-deposit checkout is no longer active.", "FUNDING_ATTEMPT_NOT_ACTIVE");

    if (attempt.paystack_amount_minor > 0 && attempt.provider_reference) {
      let providerTransaction;
      try { providerTransaction = await verifyPaystackTransaction(attempt.provider_reference); }
      catch (providerError) {
        if (!(attempt.status === "initializing" && !attempt.authorization_url && Number(providerError?.status) === 404)) throw providerError;
      }
      if (providerTransaction?.status === "success") {
        const completed = await finalizeAttempt({ attemptId, providerTransaction, source: "cancel_reconciliation" });
        return res.json({ success: true, message: "Paystack had already confirmed the payment, so the security deposit has been secured.", data: { secured: completed.secured } });
      }
      if (providerTransaction && !["failed", "abandoned", "cancelled"].includes(String(providerTransaction.status || "").toLowerCase())) {
        return fail(res, 409, "Paystack still reports this payment as pending. Your wallet contribution will remain held until the provider confirms success or a terminal failure.", "PAYMENT_STATUS_UNRESOLVED");
      }
    }
    await failAttempt(attemptId, "The erander cancelled the security-deposit checkout.", "cancelled");
    return res.json({ success: true, message: "The security-deposit checkout was cancelled. Your wallet contribution is available again.", data: { cancelled: true } });
  } catch (error) {
    console.error("Unable to cancel security-deposit funding:", error);
    return fail(res, 500, error.message || "Unable to cancel this security-deposit checkout.", "SECURITY_DEPOSIT_CANCELLATION_FAILED");
  }
}

/** Called by the signed Paystack webhook after signature validation. */
export async function processSecurityDepositPaystackWebhook(reference) {
  const normalizedReference = normalizeText(reference, 100);
  if (!normalizedReference.startsWith("SEC-DEP-")) return false;
  const result = await getDatabasePool().query(
    `SELECT st.*, s.erander_id
       FROM public.erander_security_deposit_transactions st
       JOIN public.erander_security_deposit_accounts s ON s.id = st.security_account_id
      WHERE st.provider_reference = $1 AND st.transaction_type = 'reservation'
      LIMIT 1`,
    [normalizedReference],
  );
  const attempt = mapSecurityTransaction(result.rows[0]);
  if (!attempt) throw new Error("Security-deposit transaction was not found for the Paystack webhook.");
  if (attempt.status === "succeeded") return true;
  if (!ACTIVE_FUNDING_STATES.includes(attempt.status)) throw new Error(`Paystack confirmed a security-deposit payment for an inactive transaction (${attempt.status}). Manual reconciliation is required.`);
  const providerTransaction = await verifyPaystackTransaction(normalizedReference);
  if (providerTransaction.status !== "success") return true;
  await finalizeAttempt({ attemptId: attempt.id, providerTransaction, source: "paystack_webhook" });
  return true;
}
