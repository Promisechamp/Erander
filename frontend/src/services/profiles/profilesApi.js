import { apiRequest } from "../api";

/**
 * Retrieves the authenticated user's profile.
 * Expected response: { data: { user, profile } }
 */
export async function getMyProfile() {
  const result = await apiRequest("/auth/me");
  const data = result?.data ?? result ?? {};

  return {
    ...result,
    data: {
      ...data,
      user: data.user ?? null,
      profile: data.profile ?? null,
    },
  };
}

/**
 * Updates personal profile information.
 *
 * Assumed backend endpoint: PATCH /profiles/me
 * Adjust the path if your existing profile update route differs.
 */
export function updateMyProfile(payload) {
  return apiRequest("/profiles/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/**
 * Retrieves the authenticated user's saved addresses.
 */
export async function getMyAddresses() {
  const result = await apiRequest("/profiles/addresses");
  const data = result?.data ?? result ?? {};

  return {
    ...result,
    data: {
      ...data,
      addresses: Array.isArray(data.addresses)
        ? data.addresses
        : [],
    },
  };
}

/**
 * Creates a saved address.
 */
export function createMyAddress(payload) {
  return apiRequest("/profiles/addresses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Updates a saved address.
 */
export function updateMyAddress(addressId, payload) {
  if (!addressId) {
    throw new Error("An address ID is required.");
  }

  return apiRequest(
    `/profiles/addresses/${encodeURIComponent(addressId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Makes a saved address the default address.
 */
export function setMyDefaultAddress(addressId) {
  if (!addressId) {
    throw new Error("An address ID is required.");
  }

  return apiRequest(
    `/profiles/addresses/${encodeURIComponent(addressId)}/default`,
    {
      method: "PATCH",
      body: JSON.stringify({}),
    }
  );
}

/**
 * Deletes a saved address.
 */
export function deleteMyAddress(addressId) {
  if (!addressId) {
    throw new Error("An address ID is required.");
  }

  return apiRequest(
    `/profiles/addresses/${encodeURIComponent(addressId)}`,
    {
      method: "DELETE",
    }
  );
}