import { apiRequest } from "../api";

function getErrorMessage(result, fallback) {
  return result?.message || result?.error?.message || fallback;
}

async function request(path, options, fallback) {
  const result = await apiRequest(path, options);
  if (!result?.success) throw new Error(getErrorMessage(result, fallback));
  return result.data ?? {};
}

export async function getSecurityDepositFundingSummary(erandId) {
  if (!erandId || typeof erandId !== "string") {
    throw new Error("A valid errand ID is required.");
  }
  return request(
    `/payments/erands/${encodeURIComponent(erandId)}/security-deposit-funding`,
    { method: "GET" },
    "Unable to retrieve security-deposit funding details.",
  );
}

export async function initializeSecurityDepositFunding({ erandId, walletContribution }) {
  if (!erandId || typeof erandId !== "string") {
    throw new Error("A valid errand ID is required.");
  }
  return request(
    `/payments/erands/${encodeURIComponent(erandId)}/security-deposit-funding/initialize`,
    {
      method: "POST",
      body: { walletContribution: String(walletContribution ?? "0") },
    },
    "Unable to initialize security-deposit funding.",
  );
}

export async function verifySecurityDepositFunding({ erandId, reference }) {
  if (!erandId || typeof erandId !== "string" || !reference) {
    throw new Error("The errand ID and Paystack reference are required.");
  }
  return request(
    `/payments/erands/${encodeURIComponent(erandId)}/security-deposit-funding/verify`,
    { method: "POST", body: { reference } },
    "Unable to verify the security-deposit payment.",
  );
}

export async function cancelSecurityDepositFunding({ erandId, attemptId }) {
  if (!erandId || typeof erandId !== "string" || !attemptId) {
    throw new Error("The errand ID and funding attempt are required.");
  }
  return request(
    `/payments/erands/${encodeURIComponent(erandId)}/security-deposit-funding/cancel`,
    { method: "POST", body: { attemptId } },
    "Unable to cancel security-deposit funding.",
  );
}

const securityDepositFundingApi = {
  getSecurityDepositFundingSummary,
  initializeSecurityDepositFunding,
  verifySecurityDepositFunding,
  cancelSecurityDepositFunding,
};

export default securityDepositFundingApi;
