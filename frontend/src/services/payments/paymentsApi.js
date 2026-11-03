import { apiRequest } from "../api";

function getErrorMessage(result, fallback) {
  return result?.message || result?.error?.message || fallback;
}

/**
 * Retrieve the funding summary for an errand.
 *
 * This does not initialize a payment or charge the customer.
 */
export async function getErrandFundingSummary(erandId) {
  if (!erandId || typeof erandId !== "string") {
    throw new Error("A valid errand ID is required.");
  }

  const result = await apiRequest(
    `/payments/erands/${encodeURIComponent(erandId)}/funding-summary`,
    {
      method: "GET",
    },
  );

  if (!result?.success) {
    throw new Error(
      getErrorMessage(result, "Unable to retrieve the funding summary."),
    );
  }

  const funding = result?.data?.funding;

  if (!funding) {
    throw new Error("The server returned an invalid funding summary.");
  }

  const rawPendingPayment =
    result?.data?.pendingPayment ??
    funding?.pendingPayment ??
    null;

  const pendingPayment =
    rawPendingPayment &&
    typeof rawPendingPayment.paymentId === "string" &&
    rawPendingPayment.paymentId.trim() &&
    typeof rawPendingPayment.reference === "string" &&
    rawPendingPayment.reference.trim()
      ? {
          paymentId: rawPendingPayment.paymentId,
          reference: rawPendingPayment.reference,
          amount: Number(rawPendingPayment.amount ?? 0),
          currency: String(
            rawPendingPayment.currency || funding.currency || "NGN",
          )
            .trim()
            .toUpperCase(),
          status: rawPendingPayment.status || "pending",
          initiatedAt: rawPendingPayment.initiatedAt ?? null,
          errandId: String(funding.errandId || erandId),
        }
      : null;

  return {
    errandId: funding.errandId,
    currency: String(funding.currency || "NGN")
      .trim()
      .toUpperCase(),
    agreedTotal: Number(funding.agreedTotal),
    amountFunded: Number(funding.amountFunded),
    amountDue: Number(funding.amountDue),
    overpaymentAmount: Number(funding.overpaymentAmount ?? 0),
    fundingStatus: funding.fundingStatus,
    errandStatus: funding.errandStatus,
    pendingPayment,
  };
}

/**
 * Initialize customer payment for an errand.
 */
export async function initializePayment(erandId) {
  if (!erandId || typeof erandId !== "string") {
    throw new Error("A valid errand ID is required.");
  }

  const result = await apiRequest(
    `/payments/erands/${encodeURIComponent(erandId)}/initialize`,
    {
      method: "POST",
    },
  );

  if (!result?.success) {
    throw new Error(
      getErrorMessage(result, "Unable to initialize payment."),
    );
  }

  const payment = result?.data?.payment ?? result?.data;

  const authorizationUrl =
    payment?.authorizationUrl || payment?.authorization_url;

  if (!authorizationUrl) {
    throw new Error(
      "The payment provider did not return a checkout URL.",
    );
  }

  return {
    ...payment,
    authorizationUrl,
    authorization_url: authorizationUrl,
  };
}

/**
 * Verify a previously initialized payment.
 */
export async function verifyPayment(paymentId) {
  if (!paymentId || typeof paymentId !== "string") {
    throw new Error("A valid payment ID is required.");
  }

  const result = await apiRequest(
    `/payments/${encodeURIComponent(paymentId)}/verify`,
    {
      method: "POST",
    },
  );

  if (!result?.success) {
    throw new Error(
      getErrorMessage(result, "Unable to verify payment."),
    );
  }

  return result.data;
}

/**
 * Request the release of funds for an already-funded errand.
 *
 * The backend verifies that the authenticated user is the selected
 * erander and that the errand is eligible for a fund-release request.
 *
 * This records a request only. It does not transfer or release funds.
 */
export async function requestFundRelease(erandId) {
  if (!erandId || typeof erandId !== "string" || !erandId.trim()) {
    throw new Error("A valid errand ID is required.");
  }

  const result = await apiRequest(
    `/payments/erands/${encodeURIComponent(erandId)}/fund-release-request`,
    {
      method: "POST",
    },
  );

  if (!result?.success) {
    throw new Error(
      getErrorMessage(
        result,
        "Unable to submit the fund-release request.",
      ),
    );
  }

  const data = result?.data;

  if (!data || typeof data !== "object" || !data.request) {
    throw new Error(
      "The server returned an invalid fund-release request response.",
    );
  }

  return {
    request: data.request,
    existing: Boolean(data.existing),
    message:
      result.message ||
      "Fund-release request submitted successfully.",
  };
}

/**
 * Retrieve the current fund-release request and its event history.
 *
 * A successful response with request: null means no request exists.
 * A rejected promise means the request status could not be retrieved.
 */
export async function getFundReleaseRequest(erandId) {
  if (!erandId || typeof erandId !== "string") {
    throw new Error("A valid errand ID is required.");
  }

  const result = await apiRequest(
    `/payments/erands/${encodeURIComponent(erandId)}/fund-release-request`,
    {
      method: "GET",
    },
  );

  if (!result?.success) {
    throw new Error(
      getErrorMessage(
        result,
        "Unable to retrieve the fund-release status.",
      ),
    );
  }

  const data = result?.data;

  if (!data || typeof data !== "object") {
    throw new Error(
      "The server returned an invalid fund-release response.",
    );
  }

  return {
    request: data.request ?? null,
    events: Array.isArray(data.events) ? data.events : [],
  };
}

const paymentsApi = {
  getErrandFundingSummary,
  initializePayment,
  verifyPayment,
  requestFundRelease,
  getFundReleaseRequest,
};

export default paymentsApi;