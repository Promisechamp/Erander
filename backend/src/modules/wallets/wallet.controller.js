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

    return res.status(200).json({
      success: true,
      message: "Wallet transaction retrieved successfully.",
      data: {
        transaction: serializeTransaction(result.rows[0]),
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
