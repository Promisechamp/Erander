import { apiRequest } from "../api";

function requireId(value, message) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error(message);
  }

  return encodeURIComponent(String(value));
}

/**
 * Submit an offer for an errand.
 */
export function createErandOffer(erandId, payload) {
  const safeErandId = requireId(
    erandId,
    "An errand ID is required."
  );

  return apiRequest(`/erands/${safeErandId}/offers`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Retrieve offers submitted by the authenticated erander.
 */
export function getMyErandOffers(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  const query = params.toString();

  return apiRequest(
    `/erand-offers/mine${query ? `?${query}` : ""}`
  );
}

/**
 * Retrieve offers submitted for a specific errand.
 */
export function getOffersForErrand(erandId) {
  const safeErandId = requireId(
    erandId,
    "An errand ID is required."
  );

  return apiRequest(`/erands/${safeErandId}/offers`);
}

/**
 * Withdraw an offer submitted by the authenticated erander.
 */
export function withdrawErandOffer(offerId) {
  const safeOfferId = requireId(
    offerId,
    "An offer ID is required."
  );

  return apiRequest(`/erand-offers/${safeOfferId}/withdraw`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/**
 * Reject an offer as the customer who owns the errand.
 */
export function rejectErandOffer(offerId) {
  const safeOfferId = requireId(
    offerId,
    "An offer ID is required."
  );

  return apiRequest(`/erand-offers/${safeOfferId}/reject`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/**
 * Accept an offer as the customer who owns the errand.
 */
export function acceptErandOffer(offerId) {
  const safeOfferId = requireId(
    offerId,
    "An offer ID is required."
  );

  return apiRequest(`/erand-offers/${safeOfferId}/accept`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}