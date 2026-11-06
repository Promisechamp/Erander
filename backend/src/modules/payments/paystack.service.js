import axios from "axios";
import crypto from "node:crypto";

import { env } from "../../config/env.js";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

const BANK_CACHE_TTL_MS = 15 * 60 * 1000;
const ACCOUNT_RESOLUTION_CACHE_TTL_MS = 5 * 60 * 1000;

let bankCache = null;
let bankCacheExpiresAt = 0;
let bankRequestInFlight = null;

const accountResolutionCache = new Map();

export class PaystackApiError extends Error {
  constructor({
    message,
    status = 502,
    endpoint = null,
    method = null,
    providerMessage = null,
    providerCode = null,
    retryAfterSeconds = null,
  }) {
    super(message);

    this.name = "PaystackApiError";
    this.status = status;
    this.endpoint = endpoint;
    this.method = method;
    this.providerMessage = providerMessage;
    this.providerCode = providerCode;
    this.retryAfterSeconds = retryAfterSeconds;
    this.isPaystackError = true;
  }
}

function getSecretKey() {
  if (!env.paystackSecretKey) {
    throw new Error(
      "Paystack is not configured. Set PAYSTACK_SECRET_KEY in the backend environment."
    );
  }

  if (
    env.nodeEnv === "production" &&
    env.paystackSecretKey.startsWith("sk_test_")
  ) {
    throw new Error("Paystack test keys cannot be used in production.");
  }

  return env.paystackSecretKey;
}

function getAuthorizationHeaders() {
  return {
    Authorization: `Bearer ${getSecretKey()}`,
    "Content-Type": "application/json",
  };
}

function toMinorUnits(amount) {
  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("The payment amount is invalid.");
  }

  const minor = Math.round(value * 100);

  if (
    !Number.isSafeInteger(minor) ||
    minor <= 0 ||
    Math.abs(value * 100 - minor) > 0.000001
  ) {
    throw new Error(
      "The payment amount cannot be represented in the currency's minor units."
    );
  }

  return minor;
}

function parseRetryAfterSeconds(headers = {}) {
  const normalizedHeaders = {};

  for (const [key, value] of Object.entries(headers || {})) {
    normalizedHeaders[String(key).toLowerCase()] = value;
  }

  const resetValue = normalizedHeaders["x-ratelimit-reset"];

  if (resetValue !== undefined && resetValue !== null) {
    const parsedReset = Number(resetValue);

    if (Number.isFinite(parsedReset) && parsedReset >= 0) {
      return Math.ceil(parsedReset);
    }
  }

  const retryAfterValue = normalizedHeaders["retry-after"];

  if (retryAfterValue !== undefined && retryAfterValue !== null) {
    const parsedRetryAfter = Number(retryAfterValue);

    if (Number.isFinite(parsedRetryAfter) && parsedRetryAfter >= 0) {
      return Math.ceil(parsedRetryAfter);
    }

    const retryDate = Date.parse(String(retryAfterValue));

    if (Number.isFinite(retryDate)) {
      return Math.max(0, Math.ceil((retryDate - Date.now()) / 1000));
    }
  }

  return null;
}

function getProviderErrorMessage(error) {
  const providerMessage = error?.response?.data?.message;

  if (typeof providerMessage === "string" && providerMessage.trim()) {
    return providerMessage.trim();
  }

  if (error?.code === "ECONNABORTED") {
    return "The request to Paystack timed out.";
  }

  if (error?.code === "ENOTFOUND" || error?.code === "ECONNREFUSED") {
    return "ERANDER could not connect to Paystack.";
  }

  return "Paystack could not complete the request.";
}

function createPaystackApiError(error, method, path) {
  if (error instanceof PaystackApiError) {
    return error;
  }

  const status = Number(error?.response?.status) || 502;
  const providerMessage = getProviderErrorMessage(error);
  const providerCode =
    error?.response?.data?.code ||
    error?.code ||
    null;

  const retryAfterSeconds =
    status === 429
      ? parseRetryAfterSeconds(error?.response?.headers)
      : null;

  const endpoint = String(path || "").split("?")[0];

  let message = providerMessage;

  if (status === 429) {
    message =
      "Paystack is temporarily rate-limiting this request. Please wait before trying again.";
  } else if (status >= 500) {
    message =
      "Paystack is temporarily unavailable. Please try again later.";
  } else if (status >= 400) {
    message = providerMessage;
  }

  return new PaystackApiError({
    message,
    status,
    endpoint,
    method,
    providerMessage,
    providerCode,
    retryAfterSeconds,
  });
}

async function paystackRequest(method, path, data) {
  try {
    const response = await axios({
      method,
      url: `${PAYSTACK_BASE_URL}${path}`,
      data,
      headers: getAuthorizationHeaders(),
      timeout: 20000,
    });

    if (!response.data?.status) {
      const providerError = new Error(
        response.data?.message ||
          "Paystack could not complete the request."
      );

      providerError.response = {
        status: response.status || 502,
        data: response.data,
        headers: response.headers,
      };

      throw createPaystackApiError(providerError, method, path);
    }

    return response.data.data;
  } catch (error) {
    throw createPaystackApiError(error, method, path);
  }
}

function cleanBankCode(bankCode) {
  const value = String(bankCode || "").trim();

  if (!value) {
    throw new Error("A bank code is required.");
  }

  return value;
}

function cleanAccountNumber(accountNumber) {
  const value = String(accountNumber || "").trim();

  if (!/^\d{10}$/.test(value)) {
    throw new Error("A valid 10-digit Nigerian bank account number is required.");
  }

  return value;
}

function createAccountResolutionCacheKey(accountNumber, bankCode) {
  return crypto
    .createHash("sha256")
    .update(`${bankCode}:${accountNumber}`)
    .digest("hex");
}

function getCachedAccountResolution(cacheKey) {
  const cached = accountResolutionCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    accountResolutionCache.delete(cacheKey);
    return null;
  }

  return cached.data;
}

function setCachedAccountResolution(cacheKey, data) {
  accountResolutionCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + ACCOUNT_RESOLUTION_CACHE_TTL_MS,
  });

  // Keep the in-memory cache bounded.
  if (accountResolutionCache.size > 500) {
    const now = Date.now();

    for (const [key, value] of accountResolutionCache.entries()) {
      if (value.expiresAt <= now) {
        accountResolutionCache.delete(key);
      }
    }

    while (accountResolutionCache.size > 500) {
      const oldestKey = accountResolutionCache.keys().next().value;

      if (!oldestKey) break;

      accountResolutionCache.delete(oldestKey);
    }
  }
}

export async function initializePaystackTransaction({
  email,
  amount,
  currency,
  reference,
  metadata,
  callbackUrl,
}) {
  if (!email || typeof email !== "string") {
    throw new Error("A valid customer email is required for payment.");
  }

  if (!reference) {
    throw new Error("A payment reference is required.");
  }

  const payload = {
    email,
    amount: toMinorUnits(amount),
    currency,
    reference,
    callback_url: callbackUrl || env.paystackCallbackUrl,
    metadata,
  };

  const data = await paystackRequest(
    "POST",
    "/transaction/initialize",
    payload
  );

  if (!data?.authorization_url) {
    throw new Error("Paystack did not return a checkout URL.");
  }

  return {
    authorizationUrl: data.authorization_url,
    accessCode: data.access_code,
    reference: data.reference,
  };
}

export async function verifyPaystackTransaction(reference) {
  if (!reference || typeof reference !== "string") {
    throw new Error("A valid payment reference is required.");
  }

  return paystackRequest(
    "GET",
    `/transaction/verify/${encodeURIComponent(reference)}`
  );
}

export async function getPaystackBanks({ forceRefresh = false } = {}) {
  const now = Date.now();

  if (
    !forceRefresh &&
    Array.isArray(bankCache) &&
    bankCacheExpiresAt > now
  ) {
    return bankCache;
  }

  // Avoid multiple simultaneous bank-list requests.
  if (!forceRefresh && bankRequestInFlight) {
    return bankRequestInFlight;
  }

  const request = (async () => {
    const data = await paystackRequest(
      "GET",
      "/bank?country=nigeria&currency=NGN&perPage=200"
    );

    const banks = Array.isArray(data) ? data : [];

    bankCache = banks;
    bankCacheExpiresAt = Date.now() + BANK_CACHE_TTL_MS;

    return banks;
  })();

  bankRequestInFlight = request;

  try {
    return await request;
  } finally {
    if (bankRequestInFlight === request) {
      bankRequestInFlight = null;
    }
  }
}

export async function resolvePaystackBankAccount({
  accountNumber,
  bankCode,
}) {
  const normalizedAccountNumber = cleanAccountNumber(accountNumber);
  const normalizedBankCode = cleanBankCode(bankCode);

  const cacheKey = createAccountResolutionCacheKey(
    normalizedAccountNumber,
    normalizedBankCode
  );

  const cached = getCachedAccountResolution(cacheKey);

  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    account_number: normalizedAccountNumber,
    bank_code: normalizedBankCode,
  });

  const data = await paystackRequest(
    "GET",
    `/bank/resolve?${params.toString()}`
  );

  if (!data || !data.account_name) {
    throw new Error(
      "Paystack could not verify the bank account details."
    );
  }

  const result = {
    ...data,
    account_number: normalizedAccountNumber,
  };

  setCachedAccountResolution(cacheKey, result);

  return result;
}

export async function createPaystackTransferRecipient({
  name,
  accountNumber,
  bankCode,
}) {
  const normalizedAccountNumber = cleanAccountNumber(accountNumber);
  const normalizedBankCode = cleanBankCode(bankCode);

  if (!name || typeof name !== "string" || !name.trim()) {
    throw new Error("A valid account holder name is required.");
  }

  return paystackRequest("POST", "/transferrecipient", {
    type: "nuban",
    name: name.trim(),
    account_number: normalizedAccountNumber,
    bank_code: normalizedBankCode,
    currency: "NGN",
  });
}

export async function initiatePaystackTransfer({
  amountMinor,
  recipientCode,
  reference,
  reason,
}) {
  const amount = Number(amountMinor);

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("The transfer amount is invalid.");
  }

  if (!recipientCode || typeof recipientCode !== "string") {
    throw new Error("A valid transfer recipient is required.");
  }

  if (!reference || typeof reference !== "string") {
    throw new Error("A valid transfer reference is required.");
  }

  return paystackRequest("POST", "/transfer", {
    source: "balance",
    amount,
    recipient: recipientCode,
    reason: String(reason || "ERANDER wallet withdrawal").slice(0, 100),
    reference,
    currency: "NGN",
  });
}

export async function verifyPaystackTransfer(reference) {
  if (!reference || typeof reference !== "string") {
    throw new Error("A valid transfer reference is required.");
  }

  return paystackRequest(
    "GET",
    `/transfer/verify/${encodeURIComponent(reference)}`
  );
}

export function verifyPaystackWebhookSignature(rawBody, signature) {
  if (!Buffer.isBuffer(rawBody) || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha512", getSecretKey())
    .update(rawBody)
    .digest("hex");

  const suppliedBuffer = Buffer.from(String(signature), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (suppliedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export function createPayloadHash(rawBody) {
  return crypto
    .createHash("sha256")
    .update(rawBody)
    .digest("hex");
}