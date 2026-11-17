import { randomUUID } from "node:crypto";
import { getDatabasePool } from "../../config/database.js";

const MAX_ADDRESSES = 50;
const MAX_LABEL_LENGTH = 80;
const MAX_FIELD_LENGTH = 250;
const MAX_LANDMARK_LENGTH = 500;

const ALLOWED_LOCATION_TYPES = new Set([
  "residential",
  "business",
  "public",
  "other",
]);

const ADDRESS_FIELDS = new Set([
  "label",
  "location_type",
  "country",
  "state",
  "city",
  "street",
  "home_address",
  "landmark",
]);

class AddressError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function fail(status, message) {
  throw new AddressError(status, message);
}

function sendError(res, error) {
  if (error instanceof AddressError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  if (error?.code === "23503" || error?.code === "23514") {
    return res.status(400).json({
      success: false,
      message: "The address conflicts with a database rule.",
    });
  }

  console.error("Profile address controller error:", error?.message);

  return res.status(500).json({
    success: false,
    message: "Unable to process your address request right now.",
  });
}

function requireUserId(req) {
  const userId = req.user?.id;

  if (!userId) {
    fail(401, "Authentication is required.");
  }

  return userId;
}

function parseAddresses(value) {
  let addresses = value;

  // PostgreSQL normally returns decoded JSONB values. This also
  // handles a JSON string if the database adapter returns one.
  if (typeof addresses === "string") {
    try {
      addresses = JSON.parse(addresses);
    } catch {
      fail(500, "Your saved addresses could not be read.");
    }
  }

  if (!Array.isArray(addresses)) {
    fail(500, "Your saved addresses have an invalid format.");
  }

  return addresses;
}

function normalizeAddressString(
  value,
  fieldName,
  {
    required = false,
    maxLength = MAX_FIELD_LENGTH,
  } = {}
) {
  if (value === undefined || value === null) {
    if (required) {
      fail(400, `${fieldName} is required.`);
    }

    return "";
  }

  if (typeof value !== "string") {
    fail(400, `${fieldName} must be text.`);
  }

  const normalized = value.trim();

  if (required && !normalized) {
    fail(400, `${fieldName} is required.`);
  }

  if (normalized.length > maxLength) {
    fail(
      400,
      `${fieldName} cannot exceed ${maxLength} characters.`
    );
  }

  return normalized;
}

function validateAddressInput(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    fail(400, "A valid address object is required.");
  }

  const allowedFields = new Set([
    ...ADDRESS_FIELDS,
    "make_default",
  ]);

  for (const key of Object.keys(body)) {
    if (!allowedFields.has(key)) {
      fail(400, `The field "${key}" is not accepted.`);
    }
  }

  if (
    Object.hasOwn(body, "make_default") &&
    typeof body.make_default !== "boolean"
  ) {
    fail(400, "make_default must be true or false.");
  }

  const result = {};

  const stringFields = {
    label: {
      required: !partial,
      maxLength: MAX_LABEL_LENGTH,
      label: "Address label",
    },
    location_type: {
      required: !partial,
      maxLength: 30,
      label: "Location type",
    },
    country: {
      required: !partial,
      maxLength: MAX_FIELD_LENGTH,
      label: "Country",
    },
    state: {
      required: !partial,
      maxLength: MAX_FIELD_LENGTH,
      label: "State or region",
    },
    city: {
      required: !partial,
      maxLength: MAX_FIELD_LENGTH,
      label: "City",
    },
    street: {
      required: false,
      maxLength: MAX_FIELD_LENGTH,
      label: "Street",
    },
    home_address: {
      required: false,
      maxLength: MAX_FIELD_LENGTH,
      label: "Address details",
    },
    landmark: {
      required: false,
      maxLength: MAX_LANDMARK_LENGTH,
      label: "Landmark",
    },
  };

  for (const [field, config] of Object.entries(stringFields)) {
    if (partial && !Object.hasOwn(body, field)) {
      continue;
    }

    const value = normalizeAddressString(body[field], config.label, {
      required: config.required,
      maxLength: config.maxLength,
    });

    if (field === "location_type" && value) {
      if (!ALLOWED_LOCATION_TYPES.has(value)) {
        fail(400, "Please select a supported location type.");
      }
    }

    if (value || Object.hasOwn(body, field)) {
      result[field] = value;
    }
  }

  if (!partial) {
    if (!result.country) {
      fail(400, "Country is required.");
    }

    if (!result.state) {
      fail(400, "State or region is required.");
    }

    if (!result.city) {
      fail(400, "City is required.");
    }

    if (!result.street && !result.home_address) {
      fail(
        400,
        "Enter a street or address detail so the destination can be identified."
      );
    }
  }

  if (partial) {
    const hasStreet =
      Object.hasOwn(result, "street") && Boolean(result.street);
    const hasHomeAddress =
      Object.hasOwn(result, "home_address") &&
      Boolean(result.home_address);

    if (
      (Object.hasOwn(result, "street") ||
        Object.hasOwn(result, "home_address")) &&
      !hasStreet &&
      !hasHomeAddress
    ) {
      fail(
        400,
        "Provide a street or address detail so the destination can be identified."
      );
    }
  }

  if (Object.hasOwn(body, "make_default")) {
    result.make_default = body.make_default;
  }

  return result;
}

function mergeAddress(existing, changes) {
  const merged = {
    ...existing,
    ...changes,
    id: existing.id,
    default: existing.default === true,
  };

  delete merged.make_default;

  return merged;
}

function assertUniqueAddressIds(addresses) {
  const ids = new Set();

  for (const address of addresses) {
    if (
      !address ||
      typeof address !== "object" ||
      Array.isArray(address) ||
      typeof address.id !== "string"
    ) {
      fail(500, "Your saved addresses contain an invalid record.");
    }

    if (ids.has(address.id)) {
      fail(500, "Your saved addresses contain duplicate identifiers.");
    }

    ids.add(address.id);
  }
}

function setDefaultAddress(addresses, addressId) {
  let found = false;

  const updated = addresses.map((address) => {
    const isDefault = address.id === addressId;

    if (isDefault) {
      found = true;
    }

    return {
      ...address,
      default: isDefault,
    };
  });

  if (!found) {
    fail(404, "The saved address could not be found.");
  }

  return updated;
}

async function lockProfile(client, userId) {
  const result = await client.query(
    `SELECT id, addresses, account_status
       FROM public.profiles
      WHERE id = $1
      FOR UPDATE`,
    [userId]
  );

  const profile = result.rows[0];

  if (!profile) {
    fail(404, "Your profile could not be found.");
  }

  if (profile.account_status !== "active") {
    fail(403, "Your account cannot manage saved addresses.");
  }

  const addresses = parseAddresses(profile.addresses);

  assertUniqueAddressIds(addresses);

  return {
    profile,
    addresses,
  };
}

async function saveAddresses(client, userId, addresses) {
  await client.query(
    `UPDATE public.profiles
        SET addresses = $2::jsonb,
            updated_at = NOW()
      WHERE id = $1`,
    [userId, JSON.stringify(addresses)]
  );
}

// GET /api/v1/profiles/addresses
export async function listMyAddresses(req, res) {
  try {
    const userId = requireUserId(req);
    const pool = getDatabasePool();

    const result = await pool.query(
      `SELECT addresses
         FROM public.profiles
        WHERE id = $1
          AND account_status = 'active'
        LIMIT 1`,
      [userId]
    );

    if (result.rowCount === 0) {
      fail(404, "Your active profile could not be found.");
    }

    const addresses = parseAddresses(result.rows[0].addresses);

    assertUniqueAddressIds(addresses);

    return res.status(200).json({
      success: true,
      data: {
        addresses,
        default_address:
          addresses.find((address) => address.default === true) ?? null,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

// POST /api/v1/profiles/addresses
export async function createMyAddress(req, res) {
  const pool = getDatabasePool();
  const client = await pool.connect();

  try {
    const userId = requireUserId(req);
    const input = validateAddressInput(req.body);

    await client.query("BEGIN");

    const { addresses } = await lockProfile(client, userId);

    if (addresses.length >= MAX_ADDRESSES) {
      fail(
        409,
        `You can save a maximum of ${MAX_ADDRESSES} addresses.`
      );
    }

    const shouldBeDefault =
      input.make_default === true || addresses.length === 0;

    const address = {
      id: randomUUID(),
      label: input.label,
      location_type: input.location_type,
      country: input.country,
      state: input.state,
      city: input.city,
      street: input.street ?? "",
      home_address: input.home_address ?? "",
      landmark: input.landmark ?? "",
      default: shouldBeDefault,
    };

    const updatedAddresses = shouldBeDefault
      ? [
          ...addresses.map((savedAddress) => ({
            ...savedAddress,
            default: false,
          })),
          address,
        ]
      : [...addresses, address];

    await saveAddresses(client, userId, updatedAddresses);

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: shouldBeDefault
        ? "Address saved and set as your default."
        : "Address saved successfully.",
      data: {
        address,
        addresses: updatedAddresses,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return sendError(res, error);
  } finally {
    client.release();
  }
}

// PATCH /api/v1/profiles/addresses/:id/default
export async function setMyDefaultAddress(req, res) {
  const pool = getDatabasePool();
  const client = await pool.connect();

  try {
    const userId = requireUserId(req);
    const addressId = req.params.id;

    if (typeof addressId !== "string" || !addressId.trim()) {
      fail(400, "A valid address identifier is required.");
    }

    await client.query("BEGIN");

    const { addresses } = await lockProfile(client, userId);
    const updatedAddresses = setDefaultAddress(addresses, addressId);

    await saveAddresses(client, userId, updatedAddresses);

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Your default address has been updated.",
      data: {
        addresses: updatedAddresses,
        default_address:
          updatedAddresses.find((address) => address.default) ?? null,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return sendError(res, error);
  } finally {
    client.release();
  }
}

// PATCH /api/v1/profiles/addresses/:id
export async function updateMyAddress(req, res) {
  const pool = getDatabasePool();
  const client = await pool.connect();

  try {
    const userId = requireUserId(req);
    const addressId = req.params.id;

    if (typeof addressId !== "string" || !addressId.trim()) {
      fail(400, "A valid address identifier is required.");
    }

    const input = validateAddressInput(req.body, { partial: true });

    const makeDefault = input.make_default === true;
    delete input.make_default;

    if (Object.keys(input).length === 0 && !makeDefault) {
      fail(400, "Provide at least one address field to update.");
    }

    await client.query("BEGIN");

    const { addresses } = await lockProfile(client, userId);
    const existingAddress = addresses.find(
      (address) => address.id === addressId
    );

    if (!existingAddress) {
      fail(404, "The saved address could not be found.");
    }

    const updatedAddress = mergeAddress(existingAddress, input);

    let updatedAddresses = addresses.map((address) =>
      address.id === addressId ? updatedAddress : address
    );

    if (makeDefault) {
      updatedAddresses = setDefaultAddress(
        updatedAddresses,
        addressId
      );
    }

    await saveAddresses(client, userId, updatedAddresses);

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: makeDefault
        ? "Address updated and set as your default."
        : "Address updated successfully.",
      data: {
        address: updatedAddresses.find(
          (address) => address.id === addressId
        ),
        addresses: updatedAddresses,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return sendError(res, error);
  } finally {
    client.release();
  }
}

// DELETE /api/v1/profiles/addresses/:id
export async function deleteMyAddress(req, res) {
  const pool = getDatabasePool();
  const client = await pool.connect();

  try {
    const userId = requireUserId(req);
    const addressId = req.params.id;

    if (typeof addressId !== "string" || !addressId.trim()) {
      fail(400, "A valid address identifier is required.");
    }

    await client.query("BEGIN");

    const { addresses } = await lockProfile(client, userId);
    const existingAddress = addresses.find(
      (address) => address.id === addressId
    );

    if (!existingAddress) {
      fail(404, "The saved address could not be found.");
    }

    let updatedAddresses = addresses.filter(
      (address) => address.id !== addressId
    );

    // If the default address was deleted, promote the first remaining
    // address so the profile continues to have a default when possible.
    if (
      existingAddress.default === true &&
      updatedAddresses.length > 0
    ) {
      updatedAddresses = setDefaultAddress(
        updatedAddresses,
        updatedAddresses[0].id
      );
    }

    await saveAddresses(client, userId, updatedAddresses);

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully.",
      data: {
        addresses: updatedAddresses,
        default_address:
          updatedAddresses.find((address) => address.default) ?? null,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return sendError(res, error);
  } finally {
    client.release();
  }
}