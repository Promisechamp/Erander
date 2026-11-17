import { getDatabasePool } from "../../config/database.js";

const SUPPORTED_CURRENCIES = new Set(["USD", "NGN", "GBP", "EUR"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TRANSACTION_TYPES = new Set([
  "deposit",
  "errand_payment",
  "errand_earning",
  "withdrawal",
  "refund",
  "reservation",
  "reservation_release",
  "security_deposit_deduction",
  "reversal",
  "adjustment",
]);

function sendError(res, statusCode, message, code = "WALLET_REQUEST_FAILED") {
  return res.status(statusCode).json({
    success: false,
    message,
    code,
  });
}

function toSafeInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function minorToDecimal(value) {
  const minor = BigInt(value);
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const whole = absolute / 100n;
  const fraction = String(absolute % 100n).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function serializeWallet(row) {
  return {
    id: row.id,
    currency: row.currency_code,
    availableBalanceMinor: String(row.available_balance),
    pendingBalanceMinor: String(row.pending_balance),
    reservedBalanceMinor: String(row.reserved_balance),
    availableBalance: minorToDecimal(row.available_balance),
    pendingBalance: minorToDecimal(row.pending_balance),
    reservedBalance: minorToDecimal(row.reserved_balance),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getTransactionDirection(type, metadata) {
  switch (type) {
    case "deposit":
    case "errand_earning":
    case "refund":
    case "reservation_release":
      return "credit";
    case "reservation":
      return "reserved";
    case "errand_payment":
    case "withdrawal":
    case "security_deposit_deduction":
      return "debit";
    case "reversal":
    case "adjustment": {
      const direction = metadata?.wallet_direction;
      return direction === "credit" || direction === "debit"
        ? direction
        : "neutral";
    }
    default:
      return "neutral";
  }
}

function serializeTransaction(row) {
  return {
    id: row.id,
    walletId: row.wallet_id,
    reference: row.reference,
    type: row.type,
    category: row.type,
    description: row.description || row.type.replaceAll("_", " "),
    amountMinor: String(row.amount_minor),
    amount: minorToDecimal(row.amount_minor),
    currency: row.currency_code,
    status: row.status,
    direction: getTransactionDirection(row.type, row.metadata),
    relatedErandId: row.related_erand_id,
    relatedTransactionId: row.related_transaction_id,
    paymentProvider: row.payment_provider,
    providerReference: row.provider_reference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

/**
 * GET /api/v1/wallets
 *
 * Returns all wallet currencies belonging to the authenticated profile,
 * plus a paginated transaction list for the selected currency.
 *
 * This endpoint is read-only. It never creates a wallet or changes a balance.
 */
export async function getWalletOverview(req, res) {
  const profileId = req.user?.id;

  if (!profileId) {
    return sendError(res, 401, "Authentication is required.", "AUTH_REQUIRED");
  }

  const requestedCurrency = String(req.query.currency || "USD")
    .trim()
    .toUpperCase();

  if (!SUPPORTED_CURRENCIES.has(requestedCurrency)) {
    return sendError(
      res,
      400,
      "Choose a supported wallet currency: USD, NGN, GBP or EUR.",
      "UNSUPPORTED_CURRENCY",
    );
  }

  const page = toSafeInteger(req.query.page, 1, 1, 1_000_000);
  const limit = toSafeInteger(req.query.limit, 20, 1, 100);
  const offset = (page - 1) * limit;
  const requestedType = String(req.query.type || "").trim();

  if (requestedType && !TRANSACTION_TYPES.has(requestedType)) {
    return sendError(
      res,
      400,
      "The requested transaction type is not supported.",
      "INVALID_TRANSACTION_TYPE",
    );
  }

  try {
    const pool = getDatabasePool();

    const walletResult = await pool.query(
      `
        SELECT
          id,
          currency_code,
          available_balance,
          pending_balance,
          reserved_balance,
          status,
          created_at,
          updated_at
        FROM public.wallets
        WHERE profile_id = $1::uuid
        ORDER BY
          CASE currency_code
            WHEN 'USD' THEN 1
            WHEN 'NGN' THEN 2
            WHEN 'GBP' THEN 3
            WHEN 'EUR' THEN 4
            ELSE 5
          END,
          created_at ASC
      `,
      [profileId],
    );

    const wallets = walletResult.rows.map(serializeWallet);
    const selectedWallet =
      wallets.find((wallet) => wallet.currency === requestedCurrency) || null;

    if (!selectedWallet) {
      return res.status(200).json({
        success: true,
        message: "Wallet overview retrieved successfully.",
        data: {
          wallets,
          selectedWallet: null,
          transactions: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        },
      });
    }

    const transactionValues = [selectedWallet.id];
    let typeClause = "";

    if (requestedType) {
      transactionValues.push(requestedType);
      typeClause = `AND type = $${transactionValues.length}`;
    }

    const countResult = await pool.query(
      `
        SELECT COUNT(*)::bigint AS total
        FROM public.wallet_transactions
        WHERE wallet_id = $1::uuid
          ${typeClause}
      `,
      transactionValues,
    );

    transactionValues.push(limit);
    const limitParameter = transactionValues.length;
    transactionValues.push(offset);
    const offsetParameter = transactionValues.length;

    const transactionResult = await pool.query(
      `
        SELECT
          id,
          wallet_id,
          reference,
          type,
          amount_minor,
          currency_code,
          status,
          description,
          related_erand_id,
          related_transaction_id,
          payment_provider,
          provider_reference,
          metadata,
          created_at,
          updated_at,
          completed_at
        FROM public.wallet_transactions
        WHERE wallet_id = $1::uuid
          ${typeClause}
        ORDER BY created_at DESC, id DESC
        LIMIT $${limitParameter}
        OFFSET $${offsetParameter}
      `,
      transactionValues,
    );

    const total = Number(countResult.rows[0]?.total || 0);

    return res.status(200).json({
      success: true,
      message: "Wallet overview retrieved successfully.",
      data: {
        wallets,
        selectedWallet,
        transactions: transactionResult.rows.map(serializeTransaction),
        pagination: {
          page,
          limit,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Unable to retrieve wallet overview:", error);
    return sendError(
      res,
      500,
      "Unable to load your wallet right now. Please try again.",
      "WALLET_OVERVIEW_FAILED",
    );
  }
}


/**
 * Loads the related financial records for a wallet transaction. The base
 * transaction is already ownership-checked by the caller. Related records
 * are read-only and never change balances or statuses.
 */
export async function loadWalletTransactionDetails(pool, transaction) {
  const transactionId = transaction.id;
  const relatedErandId = transaction.related_erand_id || null;

  const [ledgerResult, withdrawalResult, securityTransactionsResult, relatedTransactionsResult] = await Promise.all([
    pool.query(
      `SELECT transaction_id, account_id, entry_side, amount_minor, currency_code, description
       FROM public.wallet_ledger_entries
       WHERE transaction_id = $1::uuid`,
      [transactionId],
    ),
    pool.query(
      `SELECT id, reference, status, currency_code, amount_minor, fee_minor, net_amount_minor,
              payment_provider, provider_transfer_code, provider_transfer_reference,
              bank_name_snapshot, account_name_snapshot, account_number_last4_snapshot,
              rejection_reason, failure_reason, created_at, updated_at, reviewed_at,
              processed_at, completed_at
       FROM public.withdrawal_requests
       WHERE wallet_transaction_id = $1::uuid
       ORDER BY created_at DESC`,
      [transactionId],
    ),
    pool.query(
      `SELECT id, security_account_id, reservation_id, erand_id, wallet_transaction_id,
              transaction_type, amount_minor, currency_code, status, payment_provider,
              provider_reference, reason, failure_reason, initiated_at, provider_confirmed_at,
              platform_confirmed_at, created_at, updated_at
       FROM public.erander_security_deposit_transactions
       WHERE wallet_transaction_id = $1::uuid
       ORDER BY created_at DESC`,
      [transactionId],
    ),
    pool.query(
      `SELECT id, wallet_id, reference, type, amount_minor, currency_code, status, description,
              related_erand_id, related_transaction_id, payment_provider, provider_reference,
              created_at, updated_at, completed_at
       FROM public.wallet_transactions
       WHERE related_transaction_id = $1::uuid OR id = $2::uuid
       ORDER BY created_at ASC`,
      [transactionId, transaction.related_transaction_id || transactionId],
    ),
  ]);

  const securityTransactions = securityTransactionsResult.rows;
  const reservationIds = [...new Set(securityTransactions.map((item) => item.reservation_id).filter(Boolean))];
  let reservations = [];
  let claims = [];
  if (reservationIds.length) {
    const [reservationResult, claimResult] = await Promise.all([
      pool.query(
        `SELECT id, security_account_id, erand_id, amount_minor, currency_code, status,
                reserved_at, released_at, release_reason, notes, created_at, updated_at
         FROM public.erander_security_deposit_reservations
         WHERE id = ANY($1::uuid[]) ORDER BY created_at ASC`,
        [reservationIds],
      ),
      pool.query(
        `SELECT id, reservation_id, erand_id, customer_id, erander_id, currency_code,
                requested_amount_minor, approved_amount_minor, status, claim_reason, evidence,
                trust_safety_decision, trust_safety_reason, trust_safety_decided_at,
                finance_authorized_at, settled_at, created_at, updated_at
         FROM public.erander_security_deposit_claims
         WHERE reservation_id = ANY($1::uuid[]) ORDER BY created_at ASC`,
        [reservationIds],
      ),
    ]);
    reservations = reservationResult.rows;
    claims = claimResult.rows;
  }

  let errand = null;
  let payments = [];
  let refunds = [];
  let settlements = [];
  let paymentEvents = [];
  let paymentConfirmations = [];
  if (relatedErandId) {
    const errandResult = await pool.query(
      `SELECT id, reference_code, title, status, category, currency_code, estimated_total,
              requested_by, assigned_erander_id, created_at, updated_at
       FROM public.erands WHERE id = $1::uuid LIMIT 1`,
      [relatedErandId],
    );
    errand = errandResult.rows[0] || null;
    const paymentResult = await pool.query(
      `SELECT id, erand_id, payer_id, payment_type, amount, currency_code, status,
              payment_provider, provider_reference, initiated_at, provider_confirmed_at,
              platform_confirmed_at, failure_reason, created_at
       FROM public.erand_payments WHERE erand_id = $1::uuid ORDER BY created_at ASC`,
      [relatedErandId],
    );
    payments = paymentResult.rows;
    const paymentIds = payments.map((item) => item.id);
    if (paymentIds.length) {
      const [refundResult, eventResult, confirmationResult] = await Promise.all([
        pool.query(
          `SELECT id, payment_id, requested_by, amount, currency_code, status, reason,
                  payment_provider, provider_refund_reference, initiated_at,
                  provider_confirmed_at, platform_confirmed_at, failure_reason, created_at
           FROM public.erand_refunds WHERE payment_id = ANY($1::uuid[]) ORDER BY created_at ASC`,
          [paymentIds],
        ),
        pool.query(
          `SELECT id, payment_id, payment_provider, provider_event_id, event_type,
                  processing_status, payload_hash, metadata, created_at, updated_at
           FROM public.erand_payment_events WHERE payment_id = ANY($1::uuid[]) ORDER BY created_at ASC`,
          [paymentIds],
        ),
        pool.query(
          `SELECT to_jsonb(pc) AS record FROM public.erand_payment_confirmations pc
           WHERE pc.payment_id = ANY($1::uuid[]) ORDER BY pc.created_at ASC`,
          [paymentIds],
        ),
      ]);
      refunds = refundResult.rows;
      paymentEvents = eventResult.rows;
      paymentConfirmations = confirmationResult.rows.map((item) => item.record);
    }
    const settlementResult = await pool.query(
      `SELECT id, erand_id, recipient_id, settlement_type, amount, currency_code, status,
              payment_provider, provider_reference, approved_at, initiated_at,
              provider_confirmed_at, platform_confirmed_at, failure_reason, created_at
       FROM public.erand_settlements WHERE erand_id = $1::uuid ORDER BY created_at ASC`,
      [relatedErandId],
    );
    settlements = settlementResult.rows;
  }

  return {
    ledgerEntries: ledgerResult.rows,
    withdrawalRequests: withdrawalResult.rows,
    securityDepositTransactions: securityTransactions,
    reservations,
    claims,
    relatedTransactions: relatedTransactionsResult.rows.filter((item) => item.id !== transactionId),
    errand,
    payments,
    refunds,
    settlements,
    paymentEvents,
    paymentConfirmations,
    communications: {
      available: false,
      message: "No transaction-linked messaging table or API is present in the supplied v5 implementation. Existing chat data has not been guessed or exposed.",
    },
  };
}

/**
 * GET /api/v1/wallets/transactions/:transactionId
 *
 * Returns a transaction only when it belongs to a wallet owned by the
 * authenticated profile.
 */
export async function getWalletTransaction(req, res) {
  const profileId = req.user?.id;
  const { transactionId } = req.params;

  if (!profileId) {
    return sendError(res, 401, "Authentication is required.", "AUTH_REQUIRED");
  }

  if (!UUID_PATTERN.test(String(transactionId || ""))) {
    return sendError(
      res,
      400,
      "A valid transaction ID is required.",
      "INVALID_TRANSACTION_ID",
    );
  }

  try {
    const pool = getDatabasePool();

    const result = await pool.query(
      `
        SELECT
          wt.id,
          wt.wallet_id,
          wt.reference,
          wt.type,
          wt.amount_minor,
          wt.currency_code,
          wt.status,
          wt.description,
          wt.related_erand_id,
          wt.related_transaction_id,
          wt.payment_provider,
          wt.provider_reference,
          wt.metadata,
          wt.created_at,
          wt.updated_at,
          wt.completed_at
        FROM public.wallet_transactions wt
        INNER JOIN public.wallets w
          ON w.id = wt.wallet_id
        WHERE wt.id = $1::uuid
          AND w.profile_id = $2::uuid
        LIMIT 1
      `,
      [transactionId, profileId],
    );

    if (result.rowCount === 0) {
      return sendError(
        res,
        404,
        "Transaction not found.",
        "WALLET_TRANSACTION_NOT_FOUND",
      );
    }

    const details = await loadWalletTransactionDetails(pool, result.rows[0]);

    // A linked errand is exposed only to one of its participants.
    if (details.errand && ![details.errand.requested_by, details.errand.assigned_erander_id].includes(profileId)) {
      details.errand = null;
      details.payments = [];
      details.refunds = [];
      details.settlements = [];
      details.paymentEvents = [];
      details.paymentConfirmations = [];
    }

    return res.status(200).json({
      success: true,
      message: "Wallet transaction details retrieved successfully.",
      data: {
        transaction: serializeTransaction(result.rows[0]),
        details,
      },
    });
  } catch (error) {
    console.error("Unable to retrieve wallet transaction:", error);
    return sendError(
      res,
      500,
      "Unable to load this transaction. Please try again.",
      "WALLET_TRANSACTION_LOOKUP_FAILED",
    );
  }
}
