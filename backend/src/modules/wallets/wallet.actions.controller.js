import crypto from "node:crypto";
import { getDatabasePool } from "../../config/database.js";
import { env } from "../../config/env.js";
import {
  PaystackApiError,
  createPaystackTransferRecipient,
  getPaystackBanks,
  initializePaystackTransaction,
  initiatePaystackTransfer,
  resolvePaystackBankAccount,
  verifyPaystackTransaction,
  verifyPaystackTransfer,
} from "../payments/paystack.service.js";

const PROVIDER = "paystack";
const CURRENCY = "NGN";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(res, status, message, code = "WALLET_ACTION_FAILED") {
  return res.status(status).json({
    success: false,
    message,
    code,
  });
}

/**
 * Handles Paystack errors consistently.
 *
 * In particular:
 * - HTTP 429 is returned as HTTP 429.
 * - Retry-After is populated when Paystack provides a reset time.
 * - Provider diagnostics are logged without account numbers or credentials.
 */
function handlePaystackError(
  res,
  error,
  {
    operation,
    fallbackMessage,
    fallbackCode,
  }
) {
  const status = Number(
    error?.status || error?.response?.status
  );

  const isRateLimited =
    status === 429 ||
    error?.code === "PAYSTACK_RATE_LIMITED";

  const retryAfter = Number(error?.retryAfterSeconds);

  console.error(`Paystack ${operation} failed:`, {
    status: status || null,
    method: error?.method || null,
    endpoint: error?.endpoint || null,
    providerCode: error?.providerCode || null,
    providerMessage: error?.providerMessage || error?.message || null,
    retryAfterSeconds:
      Number.isFinite(retryAfter) && retryAfter >= 0
        ? retryAfter
        : null,
  });

  if (isRateLimited) {
    if (
      Number.isFinite(retryAfter) &&
      retryAfter > 0
    ) {
      res.set("Retry-After", String(Math.ceil(retryAfter)));
    }

    return fail(
      res,
      429,
      "Paystack is temporarily limiting requests. Please wait before trying again.",
      "PAYSTACK_RATE_LIMITED"
    );
  }

  return fail(
    res,
    502,
    fallbackMessage,
    fallbackCode
  );
}

function decimalToMinor(value) {
  const input = String(value ?? "").trim();

  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(input)) {
    throw new Error(
      "Enter a valid amount with no more than two decimal places."
    );
  }

  const [whole, fraction = ""] = input.split(".");
  const minor =
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0"));

  if (
    minor <= 0n ||
    minor > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error(
      "The amount is outside the supported range."
    );
  }

  return Number(minor);
}

function minorToDecimal(value) {
  const minor = BigInt(value);

  return `${minor / 100n}.${String(minor % 100n).padStart(2, "0")}`;
}

function makeReference(prefix) {
  return `${prefix}-${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`;
}

function normalizeText(value, max = 150) {
  return String(value ?? "").trim().slice(0, max);
}

async function ensureWallet(
  client,
  profileId,
  currency = CURRENCY,
  lock = true
) {
  await client.query(
    `INSERT INTO public.wallets (profile_id, currency_code)
     VALUES ($1::uuid, $2)
     ON CONFLICT (profile_id, currency_code) DO NOTHING`,
    [profileId, currency]
  );

  const result = await client.query(
    `SELECT id, profile_id, currency_code, available_balance,
            pending_balance, reserved_balance, status
       FROM public.wallets
      WHERE profile_id = $1::uuid
        AND currency_code = $2
      ${lock ? "FOR UPDATE" : ""}`,
    [profileId, currency]
  );

  return result.rows[0] || null;
}

async function ensureWalletFinancialAccount(client, wallet) {
  const existing = await client.query(
    `SELECT id, profile_id, wallet_id, account_type, currency_code
       FROM public.financial_accounts
      WHERE wallet_id = $1::uuid
        AND account_type = 'wallet'
      FOR UPDATE`,
    [wallet.id]
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const code =
    `WALLET_${wallet.id.replaceAll("-", "").toUpperCase()}`;

  await client.query(
    `INSERT INTO public.financial_accounts
       (profile_id, wallet_id, account_code, account_name,
        account_type, currency_code)
     VALUES ($1::uuid, $2::uuid, $3, $4, 'wallet', $5)
     ON CONFLICT (account_code, currency_code) DO NOTHING`,
    [
      wallet.profile_id,
      wallet.id,
      code,
      `Wallet ${wallet.id}`,
      wallet.currency_code,
    ]
  );

  const result = await client.query(
    `SELECT id, profile_id, wallet_id, account_type, currency_code
       FROM public.financial_accounts
      WHERE wallet_id = $1::uuid
        AND account_type = 'wallet'
      FOR UPDATE`,
    [wallet.id]
  );

  if (!result.rows[0]) {
    throw new Error(
      "The wallet financial account could not be created."
    );
  }

  return result.rows[0];
}

async function ensureSystemAccount(
  client,
  {
    code,
    name,
    type,
    currency = CURRENCY,
  }
) {
  await client.query(
    `INSERT INTO public.financial_accounts
       (profile_id, wallet_id, account_code, account_name,
        account_type, currency_code)
     VALUES (NULL, NULL, $1, $2, $3, $4)
     ON CONFLICT (account_code, currency_code) DO NOTHING`,
    [code, name, type, currency]
  );

  const result = await client.query(
    `SELECT id, account_type, currency_code
       FROM public.financial_accounts
      WHERE account_code = $1
        AND currency_code = $2
      FOR UPDATE`,
    [code, currency]
  );

  const account = result.rows[0];

  if (!account || account.account_type !== type) {
    throw new Error(
      `The ${name} financial account is misconfigured.`
    );
  }

  return account;
}

async function insertLedgerPair(
  client,
  {
    transactionId,
    currency,
    debitAccountId,
    creditAccountId,
    amountMinor,
    description,
  }
) {
  await client.query(
    `INSERT INTO public.wallet_ledger_entries
       (transaction_id, account_id, entry_side,
        amount_minor, currency_code, description)
     VALUES
       ($1::uuid, $2::uuid, 'debit', $4::bigint, $3, $5),
       ($1::uuid, $6::uuid, 'credit', $4::bigint, $3, $5)`,
    [
      transactionId,
      debitAccountId,
      currency,
      amountMinor,
      description,
      creditAccountId,
    ]
  );
}

function buildWalletCallbackUrl(reference) {
  const base = String(env.frontendUrl || "").trim();

  if (!base) {
    throw new Error(
      "FRONTEND_URL must be configured before wallet funding can be initialized."
    );
  }

  const callback = new URL("/dashboard/wallet", base);

  callback.searchParams.set(
    "wallet_deposit_reference",
    reference
  );

  return callback.toString();
}

/* -------------------------------------------------------------------------- */
/* BANK DIRECTORY                                                             */
/* -------------------------------------------------------------------------- */

/** GET /wallets/banks */
export async function listWithdrawalBanks(req, res) {
  try {
    const banks = await getPaystackBanks();

    return res.json({
      success: true,
      data: {
        banks: banks
          .filter((bank) => bank?.code && bank?.name)
          .map((bank) => ({
            code: String(bank.code),
            name: String(bank.name),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      },
    });
  } catch (error) {
    return handlePaystackError(res, error, {
      operation: "bank directory retrieval",
      fallbackMessage:
        "Unable to retrieve the bank list. Please try again.",
      fallbackCode: "BANK_LIST_FAILED",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* WALLET DEPOSITS                                                            */
/* -------------------------------------------------------------------------- */

/** POST /wallets/deposits/initialize */
export async function initializeWalletDeposit(req, res) {
  const profileId = req.user?.id;

  if (!profileId) {
    return fail(
      res,
      401,
      "Authentication is required.",
      "AUTH_REQUIRED"
    );
  }

  if (!req.user?.email) {
    return fail(
      res,
      400,
      "Add an email address to your account before funding your wallet.",
      "EMAIL_REQUIRED"
    );
  }

  let amountMinor;

  try {
    amountMinor = decimalToMinor(req.body?.amount);
  } catch (error) {
    return fail(
      res,
      400,
      error.message,
      "INVALID_AMOUNT"
    );
  }

  const currency = String(
    req.body?.currency || CURRENCY
  ).trim().toUpperCase();

  if (currency !== CURRENCY) {
    return fail(
      res,
      400,
      "Paystack wallet deposits are currently available in NGN only.",
      "UNSUPPORTED_DEPOSIT_CURRENCY"
    );
  }

  const idempotencyKey = normalizeText(
    req.get("Idempotency-Key") ||
      req.body?.idempotencyKey,
    150
  );

  if (!idempotencyKey) {
    return fail(
      res,
      400,
      "An idempotency key is required for this deposit.",
      "IDEMPOTENCY_KEY_REQUIRED"
    );
  }

  const pool = getDatabasePool();

  let transaction;
  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    const wallet = await ensureWallet(
      client,
      profileId,
      currency,
      true
    );

    if (!wallet || wallet.status !== "active") {
      await client.query("ROLLBACK");

      return fail(
        res,
        403,
        "Your NGN wallet is not active.",
        "WALLET_NOT_ACTIVE"
      );
    }

    const existing = await client.query(
      `SELECT id, wallet_id, amount_minor, currency_code,
              type, status, reference, metadata
         FROM public.wallet_transactions
        WHERE idempotency_key = $1
        LIMIT 1`,
      [idempotencyKey]
    );

    if (existing.rows[0]) {
      const row = existing.rows[0];

      if (
        row.wallet_id !== wallet.id ||
        Number(row.amount_minor) !== amountMinor ||
        row.currency_code !== currency ||
        row.type !== "deposit"
      ) {
        await client.query("ROLLBACK");

        return fail(
          res,
          409,
          "This idempotency key was already used for a different wallet transaction.",
          "IDEMPOTENCY_CONFLICT"
        );
      }

      await client.query("COMMIT");

      if (row.status === "successful") {
        return res.json({
          success: true,
          message: "This wallet deposit has already been completed.",
          data: {
            transactionId: row.id,
            reference: row.reference,
            status: row.status,
            alreadyCompleted: true,
          },
        });
      }

      if (
        row.status !== "pending" ||
        !row.metadata?.authorization_url
      ) {
        return fail(
          res,
          409,
          "This deposit cannot be resumed. Start a new deposit.",
          "DEPOSIT_NOT_RESUMABLE"
        );
      }

      return res.json({
        success: true,
        data: {
          transactionId: row.id,
          reference: row.reference,
          status: row.status,
          authorizationUrl: row.metadata.authorization_url,
        },
      });
    }

    const reference = makeReference("ERD-WALLET-DEP");

    const inserted = await client.query(
      `INSERT INTO public.wallet_transactions
         (wallet_id, reference, idempotency_key, type,
          amount_minor, currency_code, status, description,
          payment_provider, provider_reference, metadata)
       VALUES
         ($1::uuid, $2, $3, 'deposit', $4::bigint, $5,
          'pending', 'Wallet funding', $6, $2, $7::jsonb)
       RETURNING id, wallet_id, reference, amount_minor,
                 currency_code, status`,
      [
        wallet.id,
        reference,
        idempotencyKey,
        amountMinor,
        currency,
        PROVIDER,
        JSON.stringify({ purpose: "wallet_deposit" }),
      ]
    );

    transaction = inserted.rows[0];

    await client.query("COMMIT");
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error(
      "Unable to create wallet deposit:",
      error
    );

    return fail(
      res,
      500,
      "Unable to initialize your wallet deposit.",
      "DEPOSIT_CREATE_FAILED"
    );
  } finally {
    client?.release();
  }

  try {
    const checkout = await initializePaystackTransaction({
      email: req.user.email,
      amount: minorToDecimal(amountMinor),
      currency,
      reference: transaction.reference,
      callbackUrl: buildWalletCallbackUrl(
        transaction.reference
      ),
      metadata: {
        purpose: "wallet_deposit",
        wallet_transaction_id: transaction.id,
        profile_id: profileId,
      },
    });

    await pool.query(
      `UPDATE public.wallet_transactions
          SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
              updated_at = NOW()
        WHERE id = $1::uuid
          AND status = 'pending'`,
      [
        transaction.id,
        JSON.stringify({
          authorization_url: checkout.authorizationUrl,
          access_code: checkout.accessCode || null,
        }),
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Wallet deposit checkout initialized.",
      data: {
        transactionId: transaction.id,
        reference: transaction.reference,
        status: "pending",
        authorizationUrl: checkout.authorizationUrl,
      },
    });
  } catch (error) {
    const isRateLimited =
      Number(error?.status) === 429;

    console.error(
      "Paystack wallet deposit initialization failed:",
      {
        status: error?.status || null,
        endpoint: error?.endpoint || null,
        providerMessage:
          error?.providerMessage || error?.message || null,
      }
    );

    await pool.query(
      `UPDATE public.wallet_transactions
          SET status = 'failed',
              updated_at = NOW(),
              metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
        WHERE id = $1::uuid
          AND status = 'pending'`,
      [
        transaction.id,
        JSON.stringify({
          initialization_error: String(
            error?.message || "Paystack initialization failed."
          ).slice(0, 300),
        }),
      ]
    ).catch(() => {});

    if (isRateLimited) {
      return handlePaystackError(res, error, {
        operation: "wallet deposit initialization",
        fallbackMessage:
          "Paystack is temporarily limiting requests.",
        fallbackCode: "PAYSTACK_RATE_LIMITED",
      });
    }

    return fail(
      res,
      502,
      "Paystack could not initialize this deposit. No wallet funds have been added.",
      "PAYSTACK_INITIALIZATION_FAILED"
    );
  }
}

async function completeWalletDeposit({
  transactionId = null,
  reference = null,
  profileId,
  providerTransaction,
  source,
}) {
  const pool = getDatabasePool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lookup = transactionId
      ? await client.query(
          `SELECT wt.*, w.profile_id,
                  w.status AS wallet_status
             FROM public.wallet_transactions wt
             JOIN public.wallets w ON w.id = wt.wallet_id
            WHERE wt.id = $1::uuid
              AND w.profile_id = $2::uuid
            FOR UPDATE OF wt, w`,
          [transactionId, profileId]
        )
      : await client.query(
          `SELECT wt.*, w.profile_id,
                  w.status AS wallet_status
             FROM public.wallet_transactions wt
             JOIN public.wallets w ON w.id = wt.wallet_id
            WHERE wt.provider_reference = $1
              AND wt.payment_provider = $2
              AND w.profile_id = $3::uuid
            FOR UPDATE OF wt, w`,
          [reference, PROVIDER, profileId]
        );

    const transaction = lookup.rows[0];

    if (
      !transaction ||
      transaction.type !== "deposit" ||
      transaction.payment_provider !== PROVIDER
    ) {
      await client.query("ROLLBACK");

      return {
        status: 404,
        body: {
          success: false,
          message: "Wallet deposit not found.",
          code: "DEPOSIT_NOT_FOUND",
        },
      };
    }

    if (transaction.status === "successful") {
      await client.query("COMMIT");

      return {
        status: 200,
        body: {
          success: true,
          message: "Wallet deposit was already completed.",
          data: {
            transactionId: transaction.id,
            reference: transaction.reference,
            status: "successful",
            alreadyCompleted: true,
          },
        },
      };
    }

    if (transaction.status !== "pending") {
      await client.query("ROLLBACK");

      return {
        status: 409,
        body: {
          success: false,
          message: "This wallet deposit is no longer pending.",
          code: "DEPOSIT_NOT_PENDING",
        },
      };
    }

    if (transaction.wallet_status !== "active") {
      await client.query("ROLLBACK");

      return {
        status: 403,
        body: {
          success: false,
          message: "Your wallet is not active. Contact support before retrying.",
          code: "WALLET_NOT_ACTIVE",
        },
      };
    }

    const expectedReference = transaction.provider_reference;
    const expectedAmount = Number(transaction.amount_minor);

    if (
      providerTransaction.status !== "success" ||
      providerTransaction.reference !== expectedReference ||
      String(providerTransaction.currency).toUpperCase() !==
        transaction.currency_code ||
      Number(providerTransaction.amount) !== expectedAmount
    ) {
      await client.query("ROLLBACK");

      return {
        status: 409,
        body: {
          success: false,
          message:
            "Paystack's verified amount, currency or reference does not match this wallet deposit.",
          code: "PROVIDER_DETAILS_MISMATCH",
        },
      };
    }

    const wallet = {
      id: transaction.wallet_id,
      profile_id: transaction.profile_id,
      currency_code: transaction.currency_code,
    };

    const walletAccount =
      await ensureWalletFinancialAccount(client, wallet);

    const clearingAccount = await ensureSystemAccount(
      client,
      {
        code: `PAYSTACK_CLEARING_${transaction.currency_code}`,
        name: `Paystack payment clearing (${transaction.currency_code})`,
        type: "payment_clearing",
        currency: transaction.currency_code,
      }
    );

    await client.query(
      `UPDATE public.wallets
          SET available_balance = available_balance + $2::bigint,
              updated_at = NOW()
        WHERE id = $1::uuid`,
      [
        transaction.wallet_id,
        transaction.amount_minor,
      ]
    );

    await insertLedgerPair(client, {
      transactionId: transaction.id,
      currency: transaction.currency_code,
      debitAccountId: clearingAccount.id,
      creditAccountId: walletAccount.id,
      amountMinor: transaction.amount_minor,
      description: "Verified Paystack wallet deposit",
    });

    await client.query(
      `UPDATE public.wallet_transactions
          SET status = 'successful',
              completed_at = NOW(),
              updated_at = NOW(),
              metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
        WHERE id = $1::uuid`,
      [
        transaction.id,
        JSON.stringify({
          verification_source: source,
          paystack_transaction_id:
            providerTransaction.id ?? null,
          paid_at: providerTransaction.paid_at ?? null,
          channel: providerTransaction.channel ?? null,
        }),
      ]
    );

    await client.query("COMMIT");

    return {
      status: 200,
      body: {
        success: true,
        message: "Wallet deposit verified and credited.",
        data: {
          transactionId: transaction.id,
          reference: transaction.reference,
          status: "successful",
          amount: minorToDecimal(transaction.amount_minor),
          currency: transaction.currency_code,
        },
      },
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** POST /wallets/deposits/verify */
export async function verifyWalletDeposit(req, res) {
  const profileId = req.user?.id;

  const reference = normalizeText(
    req.body?.reference || req.query?.reference,
    100
  );

  if (!profileId) {
    return fail(
      res,
      401,
      "Authentication is required.",
      "AUTH_REQUIRED"
    );
  }

  if (!reference) {
    return fail(
      res,
      400,
      "A wallet deposit reference is required.",
      "REFERENCE_REQUIRED"
    );
  }

  try {
    const existing = await getDatabasePool().query(
      `SELECT wt.id, wt.status
         FROM public.wallet_transactions wt
         JOIN public.wallets w ON w.id = wt.wallet_id
        WHERE wt.provider_reference = $1
          AND wt.payment_provider = $2
          AND wt.type = 'deposit'
          AND w.profile_id = $3::uuid`,
      [reference, PROVIDER, profileId]
    );

    if (!existing.rows[0]) {
      return fail(
        res,
        404,
        "Wallet deposit not found.",
        "DEPOSIT_NOT_FOUND"
      );
    }

    if (existing.rows[0].status === "successful") {
      return res.json({
        success: true,
        data: {
          transactionId: existing.rows[0].id,
          reference,
          status: "successful",
          alreadyCompleted: true,
        },
      });
    }

    const verified =
      await verifyPaystackTransaction(reference);

    const result = await completeWalletDeposit({
      transactionId: existing.rows[0].id,
      profileId,
      providerTransaction: verified,
      source: "customer_verification",
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    return handlePaystackError(res, error, {
      operation: "wallet deposit verification",
      fallbackMessage:
        "Unable to verify this deposit with Paystack. You can safely retry verification.",
      fallbackCode: "DEPOSIT_VERIFICATION_FAILED",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* WITHDRAWAL ACCOUNTS                                                        */
/* -------------------------------------------------------------------------- */

/** GET /wallets/withdrawal-accounts */
export async function listWithdrawalAccounts(req, res) {
  try {
    const result = await getDatabasePool().query(
      `SELECT id, country_code, currency_code, bank_code,
              bank_name, account_name, account_number_last4,
              payment_provider, status, is_default,
              verified_at, created_at
         FROM public.withdrawal_accounts
        WHERE profile_id = $1::uuid
        ORDER BY is_default DESC, created_at DESC`,
      [req.user.id]
    );

    return res.json({
      success: true,
      data: {
        accounts: result.rows,
      },
    });
  } catch (error) {
    console.error(
      "Unable to list withdrawal accounts:",
      error
    );

    return fail(
      res,
      500,
      "Unable to retrieve your bank accounts.",
      "WITHDRAWAL_ACCOUNTS_FAILED"
    );
  }
}

/** POST /wallets/withdrawal-accounts/resolve */
export async function resolveWithdrawalAccount(req, res) {
  const accountNumber = String(
    req.body?.accountNumber ?? ""
  ).trim();

  const bankCode = normalizeText(
    req.body?.bankCode,
    50
  );

  if (!/^\d{10}$/.test(accountNumber) || !bankCode) {
    return fail(
      res,
      400,
      "Enter a valid 10-digit account number and select a bank.",
      "INVALID_BANK_DETAILS"
    );
  }

  try {
    const resolved = await resolvePaystackBankAccount({
      accountNumber,
      bankCode,
    });

    if (
      !resolved?.account_name ||
      !resolved?.account_number
    ) {
      return fail(
        res,
        422,
        "Paystack could not verify this bank account.",
        "ACCOUNT_RESOLUTION_FAILED"
      );
    }

    return res.json({
      success: true,
      data: {
        accountName: String(resolved.account_name),
        accountNumberLast4: String(
          resolved.account_number
        ).slice(-4),
        bankCode,
      },
    });
  } catch (error) {
    return handlePaystackError(res, error, {
      operation: "bank account resolution",
      fallbackMessage:
        "The bank account could not be verified. Check the details and try again.",
      fallbackCode: "ACCOUNT_RESOLUTION_FAILED",
    });
  }
}

/** POST /wallets/withdrawal-accounts */
export async function addWithdrawalAccount(req, res) {
  const profileId = req.user?.id;

  if (!profileId) {
    return fail(
      res,
      401,
      "Authentication is required.",
      "AUTH_REQUIRED"
    );
  }

  const accountNumber = String(
    req.body?.accountNumber ?? ""
  ).trim();

  const bankCode = normalizeText(
    req.body?.bankCode,
    50
  );

  const makeDefault = req.body?.isDefault === true;

  if (!/^\d{10}$/.test(accountNumber) || !bankCode) {
    return fail(
      res,
      400,
      "Provide a valid account number and bank.",
      "INVALID_BANK_DETAILS"
    );
  }

  const pool = getDatabasePool();

  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();

    /*
     * The bank directory is cached by paystack.service.js.
     * This should not generate a new Paystack bank-list request
     * on every account save.
     */
    const banks = await getPaystackBanks();

    const selectedBank = banks.find(
      (bank) => String(bank.code) === bankCode
    );

    if (!selectedBank?.name) {
      return fail(
        res,
        400,
        "Choose a bank from the current Paystack bank list.",
        "INVALID_BANK_CODE"
      );
    }

    const bankName = normalizeText(
      selectedBank.name,
      150
    );

    /*
     * The resolution service caches successful account
     * resolutions briefly. If the frontend resolved the same
     * account recently, this call can reuse that result.
     */
    const resolved = await resolvePaystackBankAccount({
      accountNumber,
      bankCode,
    });

    const accountName = normalizeText(
      resolved?.account_name,
      200
    );

    if (
      !accountName ||
      String(resolved.account_number).slice(-4) !==
        accountNumber.slice(-4)
    ) {
      return fail(
        res,
        422,
        "The bank account could not be verified.",
        "ACCOUNT_RESOLUTION_FAILED"
      );
    }

    /*
     * Do not automatically retry this POST.
     * If the provider response is interrupted, the recipient
     * may have been created even though ERANDER did not receive
     * the recipient code.
     */
    const recipient =
      await createPaystackTransferRecipient({
        name: accountName,
        accountNumber,
        bankCode,
      });

    if (!recipient?.recipient_code) {
      throw new Error(
        "Paystack did not return a transfer recipient code."
      );
    }

    await client.query("BEGIN");
    transactionStarted = true;

    if (makeDefault) {
      await client.query(
        `UPDATE public.withdrawal_accounts
            SET is_default = FALSE
          WHERE profile_id = $1::uuid
            AND currency_code = 'NGN'`,
        [profileId]
      );
    }

    const inserted = await client.query(
      `INSERT INTO public.withdrawal_accounts
         (profile_id, country_code, currency_code,
          bank_code, bank_name, account_name,
          account_number_last4, payment_provider,
          provider_recipient_code, status,
          is_default, verified_at)
       VALUES
         ($1::uuid, 'NG', 'NGN', $2, $3, $4,
          $5, $6, $7, 'active', $8, NOW())
       RETURNING id, country_code, currency_code,
                 bank_code, bank_name, account_name,
                 account_number_last4, payment_provider,
                 status, is_default, verified_at, created_at`,
      [
        profileId,
        bankCode,
        bankName,
        accountName,
        accountNumber.slice(-4),
        PROVIDER,
        recipient.recipient_code,
        makeDefault,
      ]
    );

    if (!makeDefault) {
      const count = await client.query(
        `SELECT COUNT(*)::int AS count
           FROM public.withdrawal_accounts
          WHERE profile_id = $1::uuid
            AND currency_code = 'NGN'
            AND is_default = TRUE`,
        [profileId]
      );

      if (count.rows[0].count === 0) {
        await client.query(
          `UPDATE public.withdrawal_accounts
              SET is_default = TRUE
            WHERE id = $1::uuid`,
          [inserted.rows[0].id]
        );

        inserted.rows[0].is_default = true;
      }
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Bank account verified and saved.",
      data: {
        account: inserted.rows[0],
      },
    });
  } catch (error) {
    if (client && transactionStarted) {
      await client.query("ROLLBACK").catch(() => {});
    }

    /*
     * This diagnostic identifies which Paystack endpoint failed.
     * It deliberately does not log accountNumber or request data.
     */
    return handlePaystackError(res, error, {
      operation: "withdrawal account creation",
      fallbackMessage:
        "Unable to save this bank account. Please try again.",
      fallbackCode: "WITHDRAWAL_ACCOUNT_CREATE_FAILED",
    });
  } finally {
    client?.release();
  }
}

/** PATCH /wallets/withdrawal-accounts/:accountId/default */
export async function setDefaultWithdrawalAccount(req, res) {
  const { accountId } = req.params;

  if (!UUID_PATTERN.test(String(accountId || ""))) {
    return fail(
      res,
      400,
      "A valid bank account ID is required.",
      "INVALID_ACCOUNT_ID"
    );
  }

  const client = await getDatabasePool().connect();

  try {
    await client.query("BEGIN");

    const account = await client.query(
      `SELECT id
         FROM public.withdrawal_accounts
        WHERE id = $1::uuid
          AND profile_id = $2::uuid
          AND currency_code = 'NGN'
          AND status = 'active'
        FOR UPDATE`,
      [accountId, req.user.id]
    );

    if (!account.rows[0]) {
      await client.query("ROLLBACK");

      return fail(
        res,
        404,
        "Active bank account not found.",
        "ACCOUNT_NOT_FOUND"
      );
    }

    await client.query(
      `UPDATE public.withdrawal_accounts
          SET is_default = FALSE
        WHERE profile_id = $1::uuid
          AND currency_code = 'NGN'`,
      [req.user.id]
    );

    await client.query(
      `UPDATE public.withdrawal_accounts
          SET is_default = TRUE
        WHERE id = $1::uuid`,
      [accountId]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Default bank account updated.",
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error(
      "Unable to update default bank account:",
      error
    );

    return fail(
      res,
      500,
      "Unable to update your default bank account.",
      "DEFAULT_ACCOUNT_FAILED"
    );
  } finally {
    client.release();
  }
}

/** DELETE /wallets/withdrawal-accounts/:accountId */
export async function disableWithdrawalAccount(req, res) {
  const { accountId } = req.params;

  if (!UUID_PATTERN.test(String(accountId || ""))) {
    return fail(
      res,
      400,
      "A valid bank account ID is required.",
      "INVALID_ACCOUNT_ID"
    );
  }

  try {
    const result = await getDatabasePool().query(
      `UPDATE public.withdrawal_accounts wa
          SET status = 'disabled',
              is_default = FALSE
        WHERE wa.id = $1::uuid
          AND wa.profile_id = $2::uuid
          AND wa.status = 'active'
          AND NOT EXISTS (
            SELECT 1
              FROM public.withdrawal_requests wr
             WHERE wr.withdrawal_account_id = wa.id
               AND wr.status IN ('pending', 'approved', 'processing')
          )
        RETURNING wa.id`,
      [accountId, req.user.id]
    );

    if (!result.rows[0]) {
      return fail(
        res,
        409,
        "This account cannot be disabled while it has an active withdrawal, or it is not available.",
        "ACCOUNT_NOT_DISABLEABLE"
      );
    }

    return res.json({
      success: true,
      message: "Bank account disabled.",
    });
  } catch (error) {
    console.error(
      "Unable to disable withdrawal account:",
      error
    );

    return fail(
      res,
      500,
      "Unable to disable this bank account.",
      "ACCOUNT_DISABLE_FAILED"
    );
  }
}

/* -------------------------------------------------------------------------- */
/* CUSTOMER WITHDRAWALS                                                       */
/* -------------------------------------------------------------------------- */

/** POST /wallets/withdrawals */
export async function createWithdrawalRequest(req, res) {
  const profileId = req.user?.id;

  const amount = (() => {
    try {
      return decimalToMinor(req.body?.amount);
    } catch (error) {
      return error;
    }
  })();

  if (amount instanceof Error) {
    return fail(
      res,
      400,
      amount.message,
      "INVALID_AMOUNT"
    );
  }

  const accountId = String(
    req.body?.withdrawalAccountId || ""
  );

  if (!UUID_PATTERN.test(accountId)) {
    return fail(
      res,
      400,
      "Choose a valid verified bank account.",
      "INVALID_WITHDRAWAL_ACCOUNT"
    );
  }

  const idempotencyKey = normalizeText(
    req.get("Idempotency-Key") ||
      req.body?.idempotencyKey,
    150
  );

  if (!idempotencyKey) {
    return fail(
      res,
      400,
      "An idempotency key is required.",
      "IDEMPOTENCY_KEY_REQUIRED"
    );
  }

  const client = await getDatabasePool().connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id, reference, status, amount_minor,
              currency_code, withdrawal_account_id
         FROM public.withdrawal_requests
        WHERE idempotency_key = $1
          AND profile_id = $2::uuid
        LIMIT 1`,
      [idempotencyKey, profileId]
    );

    if (existing.rows[0]) {
      const row = existing.rows[0];

      if (
        row.currency_code !== CURRENCY ||
        Number(row.amount_minor) !== amount ||
        row.withdrawal_account_id !== accountId
      ) {
        await client.query("ROLLBACK");

        return fail(
          res,
          409,
          "This idempotency key was already used for a different withdrawal.",
          "IDEMPOTENCY_CONFLICT"
        );
      }

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Existing withdrawal request retrieved.",
        data: {
          withdrawal: row,
          existing: true,
        },
      });
    }

    const wallet = await ensureWallet(
      client,
      profileId,
      CURRENCY,
      true
    );

    if (!wallet || wallet.status !== "active") {
      await client.query("ROLLBACK");

      return fail(
        res,
        403,
        "Your NGN wallet is not active.",
        "WALLET_NOT_ACTIVE"
      );
    }

    const accountResult = await client.query(
      `SELECT id, bank_name, account_name,
              account_number_last4, provider_recipient_code
         FROM public.withdrawal_accounts
        WHERE id = $1::uuid
          AND profile_id = $2::uuid
          AND currency_code = 'NGN'
          AND payment_provider = 'paystack'
          AND status = 'active'
        FOR UPDATE`,
      [accountId, profileId]
    );

    const account = accountResult.rows[0];

    if (!account?.provider_recipient_code) {
      await client.query("ROLLBACK");

      return fail(
        res,
        404,
        "Verified bank account not found.",
        "WITHDRAWAL_ACCOUNT_NOT_FOUND"
      );
    }

    if (
      BigInt(wallet.available_balance) <
      BigInt(amount)
    ) {
      await client.query("ROLLBACK");

      return fail(
        res,
        409,
        "Your available wallet balance is insufficient for this withdrawal.",
        "INSUFFICIENT_AVAILABLE_BALANCE"
      );
    }

    const reference = makeReference("ERD-WALLET-WD");

    const transactionResult = await client.query(
      `INSERT INTO public.wallet_transactions
         (wallet_id, reference, idempotency_key,
          type, amount_minor, currency_code,
          status, description, payment_provider, metadata)
       VALUES
         ($1::uuid, $2, $3, 'withdrawal', $4::bigint,
          'NGN', 'pending', 'Wallet withdrawal',
          'paystack', $5::jsonb)
       RETURNING id`,
      [
        wallet.id,
        reference,
        `wd:${idempotencyKey}`.slice(0, 150),
        amount,
        JSON.stringify({
          purpose: "wallet_withdrawal",
          withdrawal_idempotency_key: idempotencyKey,
        }),
      ]
    );

    const walletTransactionId =
      transactionResult.rows[0].id;

    const withdrawalResult = await client.query(
      `INSERT INTO public.withdrawal_requests
         (reference, idempotency_key, profile_id,
          wallet_id, withdrawal_account_id,
          currency_code, amount_minor, fee_minor,
          net_amount_minor, wallet_transaction_id,
          status, payment_provider, bank_name_snapshot,
          account_name_snapshot, account_number_last4_snapshot,
          provider_recipient_code_snapshot)
       VALUES
         ($1, $2, $3::uuid, $4::uuid, $5::uuid,
          'NGN', $6::bigint, 0, $6::bigint,
          $7::uuid, 'pending', 'paystack', $8, $9, $10, $11)
       RETURNING id, reference, status, amount_minor,
                 fee_minor, net_amount_minor, currency_code,
                 bank_name_snapshot, account_name_snapshot,
                 account_number_last4_snapshot, created_at`,
      [
        reference,
        idempotencyKey,
        profileId,
        wallet.id,
        account.id,
        amount,
        walletTransactionId,
        account.bank_name,
        account.account_name,
        account.account_number_last4,
        account.provider_recipient_code,
      ]
    );

    await client.query(
      `UPDATE public.wallets
          SET available_balance = available_balance - $2::bigint,
              reserved_balance = reserved_balance + $2::bigint,
              updated_at = NOW()
        WHERE id = $1::uuid`,
      [wallet.id, amount]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message:
        "Withdrawal request submitted for finance review. The amount has been reserved.",
      data: {
        withdrawal: withdrawalResult.rows[0],
        existing: false,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error(
      "Unable to create withdrawal request:",
      error
    );

    return fail(
      res,
      500,
      "Unable to submit your withdrawal request.",
      "WITHDRAWAL_REQUEST_FAILED"
    );
  } finally {
    client.release();
  }
}

/** GET /wallets/withdrawals */
export async function listMyWithdrawals(req, res) {
  try {
    const result = await getDatabasePool().query(
      `SELECT id, reference, status, amount_minor,
              fee_minor, net_amount_minor, currency_code,
              bank_name_snapshot, account_name_snapshot,
              account_number_last4_snapshot,
              rejection_reason, failure_reason,
              created_at, reviewed_at, processed_at, completed_at
         FROM public.withdrawal_requests
        WHERE profile_id = $1::uuid
        ORDER BY created_at DESC
        LIMIT 50`,
      [req.user.id]
    );

    return res.json({
      success: true,
      data: {
        withdrawals: result.rows.map((row) => ({
          ...row,
          amount: minorToDecimal(row.amount_minor),
          fee: minorToDecimal(row.fee_minor),
          netAmount: minorToDecimal(row.net_amount_minor),
        })),
      },
    });
  } catch (error) {
    console.error(
      "Unable to list withdrawals:",
      error
    );

    return fail(
      res,
      500,
      "Unable to retrieve your withdrawal requests.",
      "WITHDRAWAL_LIST_FAILED"
    );
  }
}

async function releaseWithdrawalReservation(
  client,
  withdrawal,
  nextStatus,
  reason = null,
  reviewedBy = null
) {
  const walletResult = await client.query(
    `SELECT id, available_balance, reserved_balance
       FROM public.wallets
      WHERE id = $1::uuid
      FOR UPDATE`,
    [withdrawal.wallet_id]
  );

  const wallet = walletResult.rows[0];

  if (!wallet) {
    throw new Error(
      "The withdrawal wallet could not be found."
    );
  }

  if (
    BigInt(wallet.reserved_balance) <
    BigInt(withdrawal.amount_minor)
  ) {
    throw new Error(
      "The reserved wallet balance is inconsistent. Manual reconciliation is required."
    );
  }

  await client.query(
    `UPDATE public.wallets
        SET available_balance = available_balance + $2::bigint,
            reserved_balance = reserved_balance - $2::bigint,
            updated_at = NOW()
      WHERE id = $1::uuid`,
    [wallet.id, withdrawal.amount_minor]
  );

  await client.query(
    `UPDATE public.wallet_transactions
        SET status = $2,
            updated_at = NOW()
      WHERE id = $1::uuid
        AND status IN ('pending', 'processing')`,
    [
      withdrawal.wallet_transaction_id,
      nextStatus === "cancelled" ? "cancelled" : "failed",
    ]
  );

  await client.query(
    `UPDATE public.withdrawal_requests
        SET status = $2,
            rejection_reason = $3,
            reviewed_by = COALESCE($4::uuid, reviewed_by),
            reviewed_at = CASE
              WHEN $4::uuid IS NULL THEN reviewed_at
              ELSE NOW()
            END,
            updated_at = NOW()
      WHERE id = $1::uuid`,
    [
      withdrawal.id,
      nextStatus,
      reason,
      reviewedBy,
    ]
  );
}

/** POST /wallets/withdrawals/:withdrawalId/cancel */
export async function cancelMyWithdrawal(req, res) {
  const { withdrawalId } = req.params;

  if (!UUID_PATTERN.test(String(withdrawalId || ""))) {
    return fail(
      res,
      400,
      "A valid withdrawal ID is required.",
      "INVALID_WITHDRAWAL_ID"
    );
  }

  const client = await getDatabasePool().connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT *
         FROM public.withdrawal_requests
        WHERE id = $1::uuid
          AND profile_id = $2::uuid
        FOR UPDATE`,
      [withdrawalId, req.user.id]
    );

    const withdrawal = result.rows[0];

    if (!withdrawal) {
      await client.query("ROLLBACK");

      return fail(
        res,
        404,
        "Withdrawal request not found.",
        "WITHDRAWAL_NOT_FOUND"
      );
    }

    if (withdrawal.status !== "pending") {
      await client.query("ROLLBACK");

      return fail(
        res,
        409,
        "Only a pending withdrawal can be cancelled. Contact support if you need help.",
        "WITHDRAWAL_NOT_CANCELLABLE"
      );
    }

    await releaseWithdrawalReservation(
      client,
      withdrawal,
      "cancelled",
      "Cancelled by the wallet owner."
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message:
        "Withdrawal cancelled and reserved funds returned to your available balance.",
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error(
      "Unable to cancel withdrawal:",
      error
    );

    return fail(
      res,
      500,
      "Unable to cancel this withdrawal.",
      "WITHDRAWAL_CANCEL_FAILED"
    );
  } finally {
    client.release();
  }
}

/* -------------------------------------------------------------------------- */
/* FINANCE ADMIN                                                              */
/* -------------------------------------------------------------------------- */

/** GET /admin/wallets/withdrawals */
export async function listAdminWithdrawals(req, res) {
  const status = normalizeText(
    req.query.status,
    25
  );

  const allowed = new Set([
    "pending",
    "approved",
    "processing",
    "successful",
    "failed",
    "rejected",
    "cancelled",
  ]);

  if (status && !allowed.has(status)) {
    return fail(
      res,
      400,
      "Invalid withdrawal status filter.",
      "INVALID_STATUS"
    );
  }

  try {
    const result = await getDatabasePool().query(
      `SELECT wr.id, wr.reference, wr.profile_id,
              wr.wallet_id, wr.withdrawal_account_id,
              wr.currency_code, wr.amount_minor,
              wr.fee_minor, wr.net_amount_minor,
              wr.status, wr.bank_name_snapshot,
              wr.account_name_snapshot,
              wr.account_number_last4_snapshot,
              wr.provider_transfer_reference,
              wr.provider_transfer_code,
              wr.created_at, wr.reviewed_at, wr.processed_at
         FROM public.withdrawal_requests wr
        WHERE ($1 = '' OR wr.status = $1)
        ORDER BY
          CASE wr.status
            WHEN 'pending' THEN 1
            WHEN 'approved' THEN 2
            WHEN 'processing' THEN 3
            ELSE 4
          END,
          wr.created_at ASC
        LIMIT 200`,
      [status]
    );

    return res.json({
      success: true,
      data: {
        withdrawals: result.rows.map((row) => ({
          ...row,
          amount: minorToDecimal(row.amount_minor),
          fee: minorToDecimal(row.fee_minor),
          netAmount: minorToDecimal(row.net_amount_minor),
        })),
      },
    });
  } catch (error) {
    console.error(
      "Unable to list admin withdrawals:",
      error
    );

    return fail(
      res,
      500,
      "Unable to retrieve withdrawal requests.",
      "ADMIN_WITHDRAWAL_LIST_FAILED"
    );
  }
}

async function getAdminWithdrawalForUpdate(
  client,
  withdrawalId
) {
  const result = await client.query(
    `SELECT *
       FROM public.withdrawal_requests
      WHERE id = $1::uuid
      FOR UPDATE`,
    [withdrawalId]
  );

  return result.rows[0] || null;
}

/** POST /admin/wallets/withdrawals/:withdrawalId/approve */
export async function approveWithdrawal(req, res) {
  const { withdrawalId } = req.params;

  if (!UUID_PATTERN.test(String(withdrawalId || ""))) {
    return fail(
      res,
      400,
      "A valid withdrawal ID is required.",
      "INVALID_WITHDRAWAL_ID"
    );
  }

  const client = await getDatabasePool().connect();

  try {
    await client.query("BEGIN");

    const withdrawal = await getAdminWithdrawalForUpdate(
      client,
      withdrawalId
    );

    if (!withdrawal) {
      await client.query("ROLLBACK");

      return fail(
        res,
        404,
        "Withdrawal request not found.",
        "WITHDRAWAL_NOT_FOUND"
      );
    }

    if (withdrawal.status !== "pending") {
      await client.query("ROLLBACK");

      return fail(
        res,
        409,
        "Only pending withdrawal requests can be approved.",
        "WITHDRAWAL_NOT_PENDING"
      );
    }

    await client.query(
      `UPDATE public.withdrawal_requests
          SET status = 'approved',
              reviewed_by = $2::uuid,
              reviewed_at = NOW(),
              updated_at = NOW()
        WHERE id = $1::uuid`,
      [withdrawalId, req.admin.id]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message:
        "Withdrawal approved. A finance administrator must initiate the transfer as a separate step.",
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error(
      "Unable to approve withdrawal:",
      error
    );

    return fail(
      res,
      500,
      "Unable to approve this withdrawal.",
      "WITHDRAWAL_APPROVAL_FAILED"
    );
  } finally {
    client.release();
  }
}

/** POST /admin/wallets/withdrawals/:withdrawalId/reject */
export async function rejectWithdrawal(req, res) {
  const { withdrawalId } = req.params;

  const reason = normalizeText(
    req.body?.reason,
    1000
  );

  if (!UUID_PATTERN.test(String(withdrawalId || ""))) {
    return fail(
      res,
      400,
      "A valid withdrawal ID is required.",
      "INVALID_WITHDRAWAL_ID"
    );
  }

  if (!reason) {
    return fail(
      res,
      400,
      "A rejection reason is required.",
      "REJECTION_REASON_REQUIRED"
    );
  }

  const client = await getDatabasePool().connect();

  try {
    await client.query("BEGIN");

    const withdrawal = await getAdminWithdrawalForUpdate(
      client,
      withdrawalId
    );

    if (!withdrawal) {
      await client.query("ROLLBACK");

      return fail(
        res,
        404,
        "Withdrawal request not found.",
        "WITHDRAWAL_NOT_FOUND"
      );
    }

    if (!["pending", "approved"].includes(withdrawal.status)) {
      await client.query("ROLLBACK");

      return fail(
        res,
        409,
        "Only pending or approved withdrawals can be rejected.",
        "WITHDRAWAL_NOT_REJECTABLE"
      );
    }

    await releaseWithdrawalReservation(
      client,
      withdrawal,
      "rejected",
      reason,
      req.admin.id
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message:
        "Withdrawal rejected and reserved funds returned to the customer's available balance.",
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error(
      "Unable to reject withdrawal:",
      error
    );

    return fail(
      res,
      500,
      "Unable to reject this withdrawal.",
      "WITHDRAWAL_REJECTION_FAILED"
    );
  } finally {
    client.release();
  }
}

/** POST /admin/wallets/withdrawals/:withdrawalId/process */
export async function processApprovedWithdrawal(req, res) {
  const { withdrawalId } = req.params;

  if (!UUID_PATTERN.test(String(withdrawalId || ""))) {
    return fail(
      res,
      400,
      "A valid withdrawal ID is required.",
      "INVALID_WITHDRAWAL_ID"
    );
  }

  const pool = getDatabasePool();
  const client = await pool.connect();

  let withdrawal;

  try {
    await client.query("BEGIN");

    withdrawal = await getAdminWithdrawalForUpdate(
      client,
      withdrawalId
    );

    if (!withdrawal) {
      await client.query("ROLLBACK");

      return fail(
        res,
        404,
        "Withdrawal request not found.",
        "WITHDRAWAL_NOT_FOUND"
      );
    }

    if (withdrawal.status !== "approved") {
      await client.query("ROLLBACK");

      return fail(
        res,
        409,
        "Only an approved withdrawal can be processed.",
        "WITHDRAWAL_NOT_APPROVED"
      );
    }

    if (!withdrawal.provider_recipient_code_snapshot) {
      await client.query("ROLLBACK");

      return fail(
        res,
        409,
        "The saved transfer recipient is missing. Contact support.",
        "RECIPIENT_MISSING"
      );
    }

    await client.query(
      `UPDATE public.withdrawal_requests
          SET status = 'processing',
              payment_provider = 'paystack',
              provider_transfer_reference = $2,
              processed_at = NOW(),
              updated_at = NOW()
        WHERE id = $1::uuid`,
      [withdrawalId, withdrawal.reference]
    );

    await client.query(
      `UPDATE public.wallet_transactions
          SET status = 'processing',
              updated_at = NOW()
        WHERE id = $1::uuid
          AND status = 'pending'`,
      [withdrawal.wallet_transaction_id]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error(
      "Unable to prepare withdrawal transfer:",
      error
    );

    return fail(
      res,
      500,
      "Unable to prepare this withdrawal transfer.",
      "WITHDRAWAL_PROCESSING_FAILED"
    );
  } finally {
    client.release();
  }

  try {
    const transfer = await initiatePaystackTransfer({
      amountMinor: Number(withdrawal.net_amount_minor),
      recipientCode:
        withdrawal.provider_recipient_code_snapshot,
      reference: withdrawal.reference,
      reason: `ERANDER withdrawal ${withdrawal.reference}`,
    });

    await pool.query(
      `UPDATE public.withdrawal_requests
          SET provider_transfer_code = $2,
              metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
              updated_at = NOW()
        WHERE id = $1::uuid
          AND status = 'processing'`,
      [
        withdrawalId,
        transfer.transfer_code || null,
        JSON.stringify({
          paystack_transfer_id: transfer.id ?? null,
          transfer_status: transfer.status ?? null,
        }),
      ]
    );

    return res.status(202).json({
      success: true,
      message:
        "Paystack transfer initiated. Verify the transfer status before marking the withdrawal complete.",
      data: {
        withdrawalId,
        reference: withdrawal.reference,
        transferCode: transfer.transfer_code || null,
        providerStatus: transfer.status || "pending",
      },
    });
  } catch (error) {
    /*
     * Do not reset the withdrawal to approved here.
     * A timeout or provider error may occur after Paystack
     * has accepted the transfer.
     */
    console.error(
      "Paystack transfer initiation outcome requires verification:",
      {
        status: error?.status || null,
        endpoint: error?.endpoint || null,
        providerMessage:
          error?.providerMessage || error?.message || null,
      }
    );

    return res.status(202).json({
      success: true,
      message:
        "The transfer request was sent, but Paystack's response was inconclusive. Verify this reference before attempting another transfer.",
      data: {
        withdrawalId,
        reference: withdrawal.reference,
        verificationRequired: true,
      },
    });
  }
}

async function settleWithdrawalFromProvider(
  withdrawalId,
  providerTransfer,
  adminId
) {
  const client = await getDatabasePool().connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT *
         FROM public.withdrawal_requests
        WHERE id = $1::uuid
        FOR UPDATE`,
      [withdrawalId]
    );

    const withdrawal = result.rows[0];

    if (!withdrawal) {
      throw new Error("Withdrawal request not found.");
    }

    if (withdrawal.status === "successful") {
      await client.query("COMMIT");

      return {
        alreadySettled: true,
        status: "successful",
      };
    }

    if (withdrawal.status !== "processing") {
      throw new Error(
        "Only a processing withdrawal can be verified."
      );
    }

    if (
      providerTransfer?.reference !== withdrawal.reference ||
      String(providerTransfer?.currency || "").toUpperCase() !==
        withdrawal.currency_code ||
      Number(providerTransfer?.amount) !==
        Number(withdrawal.net_amount_minor)
    ) {
      throw new Error(
        "Paystack transfer reference, currency or amount does not match the withdrawal record."
      );
    }

    const providerStatus = String(
      providerTransfer?.status || ""
    ).toLowerCase();

    if (
      ![
        "success",
        "failed",
        "reversed",
        "pending",
        "otp",
      ].includes(providerStatus)
    ) {
      throw new Error(
        "Paystack returned an unrecognized transfer status. Leave this withdrawal in processing and reconcile it manually."
      );
    }

    if (
      providerStatus === "pending" ||
      providerStatus === "otp"
    ) {
      await client.query("COMMIT");

      return {
        pending: true,
        status: "processing",
      };
    }

    const walletResult = await client.query(
      `SELECT id, profile_id, currency_code,
              available_balance, reserved_balance
         FROM public.wallets
        WHERE id = $1::uuid
        FOR UPDATE`,
      [withdrawal.wallet_id]
    );

    const wallet = walletResult.rows[0];

    if (
      !wallet ||
      BigInt(wallet.reserved_balance) <
        BigInt(withdrawal.amount_minor)
    ) {
      throw new Error(
        "Reserved balance does not cover this withdrawal. Manual reconciliation is required."
      );
    }

    if (providerStatus === "success") {
      const walletAccount =
        await ensureWalletFinancialAccount(
          client,
          wallet
        );

      const clearingAccount =
        await ensureSystemAccount(client, {
          code: `WITHDRAWAL_CLEARING_${withdrawal.currency_code}`,
          name: `Withdrawal clearing (${withdrawal.currency_code})`,
          type: "withdrawal_clearing",
          currency: withdrawal.currency_code,
        });

      await client.query(
        `UPDATE public.wallets
            SET reserved_balance = reserved_balance - $2::bigint,
                updated_at = NOW()
          WHERE id = $1::uuid`,
        [
          wallet.id,
          withdrawal.amount_minor,
        ]
      );

      await insertLedgerPair(client, {
        transactionId: withdrawal.wallet_transaction_id,
        currency: withdrawal.currency_code,
        debitAccountId: walletAccount.id,
        creditAccountId: clearingAccount.id,
        amountMinor: withdrawal.amount_minor,
        description: "Verified Paystack wallet withdrawal",
      });

      await client.query(
        `UPDATE public.wallet_transactions
            SET status = 'successful',
                completed_at = NOW(),
                updated_at = NOW(),
                metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
          WHERE id = $1::uuid`,
        [
          withdrawal.wallet_transaction_id,
          JSON.stringify({
            transfer_verified_by: adminId,
            paystack_transfer_status: providerStatus,
            paystack_transfer_id:
              providerTransfer.id ?? null,
          }),
        ]
      );

      await client.query(
        `UPDATE public.withdrawal_requests
            SET status = 'successful',
                completed_at = NOW(),
                updated_at = NOW(),
                metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
          WHERE id = $1::uuid`,
        [
          withdrawal.id,
          JSON.stringify({
            paystack_transfer_status: providerStatus,
            paystack_transfer_id:
              providerTransfer.id ?? null,
          }),
        ]
      );
    } else {
      await releaseWithdrawalReservation(
        client,
        withdrawal,
        "failed",
        `Paystack transfer status: ${providerStatus}`,
        adminId
      );

      await client.query(
        `UPDATE public.withdrawal_requests
            SET failure_reason = $2,
                updated_at = NOW()
          WHERE id = $1::uuid`,
        [
          withdrawal.id,
          `Paystack transfer status: ${providerStatus}`,
        ]
      );
    }

    await client.query("COMMIT");

    return {
      status: providerStatus,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** POST /admin/wallets/withdrawals/:withdrawalId/verify-transfer */
export async function verifyWithdrawalTransfer(req, res) {
  const { withdrawalId } = req.params;

  if (!UUID_PATTERN.test(String(withdrawalId || ""))) {
    return fail(
      res,
      400,
      "A valid withdrawal ID is required.",
      "INVALID_WITHDRAWAL_ID"
    );
  }

  try {
    const result = await getDatabasePool().query(
      `SELECT id, reference, status
         FROM public.withdrawal_requests
        WHERE id = $1::uuid`,
      [withdrawalId]
    );

    const withdrawal = result.rows[0];

    if (!withdrawal) {
      return fail(
        res,
        404,
        "Withdrawal request not found.",
        "WITHDRAWAL_NOT_FOUND"
      );
    }

    if (withdrawal.status === "successful") {
      return res.json({
        success: true,
        message:
          "Withdrawal already verified as successful.",
        data: {
          status: "successful",
        },
      });
    }

    if (withdrawal.status !== "processing") {
      return fail(
        res,
        409,
        "Only a processing withdrawal can be verified.",
        "WITHDRAWAL_NOT_PROCESSING"
      );
    }

    const transfer = await verifyPaystackTransfer(
      withdrawal.reference
    );

    const settlement =
      await settleWithdrawalFromProvider(
        withdrawalId,
        transfer,
        req.admin.id
      );

    return res.json({
      success: true,
      message: settlement.pending
        ? "Paystack has not completed the transfer yet."
        : "Transfer status verified and wallet records updated.",
      data: settlement,
    });
  } catch (error) {
    return handlePaystackError(res, error, {
      operation: "withdrawal transfer verification",
      fallbackMessage:
        "Unable to verify this transfer. Leave the request in processing and retry verification later.",
      fallbackCode: "TRANSFER_VERIFICATION_FAILED",
    });
  }
}