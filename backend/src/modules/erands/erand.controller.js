import { randomUUID } from "node:crypto";

import { getDatabasePool } from "../../config/database.js";
import { notifyUser } from "../notifications/notification.service.js";
import { canCreateBusinessErrands } from "../business/auth/businessAuth.service.js";

const ALLOWED_CATEGORIES = new Set([
  "shopping",
  "delivery",
  "confidential",
  "pickup",
  "home_help",
  "personal_assistance",
  "business_support",
  "other",
]);

const ALLOWED_PRICING_TYPES = new Set(["fixed", "flexible"]);

const ALLOWED_LOCATION_TYPES = new Set([
  "residential",
  "business",
  "public",
  "other",
]);

const ALLOWED_CURRENCIES = new Set(["USD", "NGN", "GBP", "EUR"]);

const MAX_ITEMS = 100;
const MAX_PAGE_SIZE = 100;
const MAX_ADDRESSES = 50;


class RequestError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.name = "RequestError";
    this.status = status;
    this.details = details;
  }
}


function fail(status, message, details) {
  throw new RequestError(status, message, details);
}


function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}


function validateCategoryDetails(value) {
  if (value === undefined || value === null) {
    return {};
  }

  if (!isPlainObject(value)) {
    fail(400, "category_details must be a JSON object.");
  }

  let serialized;

  try {
    serialized = JSON.stringify(value);
  } catch {
    fail(400, "category_details must contain valid JSON data.");
  }

  if (Buffer.byteLength(serialized, "utf8") > 24000) {
    fail(400, "category_details must not exceed 24 KB.");
  }

  function inspect(node, depth = 0) {
    if (depth > 5) {
      fail(400, "category_details is nested too deeply.");
    }

    if (
      node === null ||
      typeof node === "boolean" ||
      typeof node === "string"
    ) {
      if (typeof node === "string" && node.length > 5000) {
        fail(400, "A category detail value exceeds 5,000 characters.");
      }
      return;
    }

    if (typeof node === "number") {
      if (!Number.isFinite(node)) {
        fail(400, "category_details contains an invalid number.");
      }
      return;
    }

    if (Array.isArray(node)) {
      if (node.length > 100) {
        fail(400, "A category detail list cannot contain more than 100 values.");
      }
      node.forEach((entry) => inspect(entry, depth + 1));
      return;
    }

    if (isPlainObject(node)) {
      const entries = Object.entries(node);
      if (entries.length > 100) {
        fail(400, "A category detail object cannot contain more than 100 fields.");
      }

      for (const [key, entry] of entries) {
        if (!key || key.length > 100) {
          fail(400, "A category detail field name is invalid.");
        }
        inspect(entry, depth + 1);
      }
      return;
    }

    fail(400, "category_details contains an unsupported value.");
  }

  inspect(value);
  return value;
}


function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}


function parseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}


function parseOptionalDate(value, fieldName) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    fail(400, `${fieldName} must be a valid date.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    fail(400, `${fieldName} must be a valid date.`);
  }

  if (date.getTime() <= Date.now()) {
    fail(400, `${fieldName} must be in the future.`);
  }

  return date.toISOString();
}


function parseOptionalAmount(value, fieldName) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    fail(400, `${fieldName} must be a non-negative number.`);
  }

  if (Math.round(amount * 100) !== amount * 100) {
    fail(
      400,
      `${fieldName} must have no more than two decimal places.`,
    );
  }

  return amount;
}


function parseOptionalInteger(
  value,
  fieldName,
  { min = 0, max = 100000 } = {},
) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < min ||
    parsed > max
  ) {
    fail(
      400,
      `${fieldName} must be an integer between ${min} and ${max}.`,
    );
  }

  return parsed;
}


function parseOptionalText(
  value,
  fieldName,
  { maxLength, nullable = true } = {},
) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    if (nullable) {
      return null;
    }

    fail(400, `${fieldName} is required.`);
  }

  if (typeof value !== "string") {
    fail(400, `${fieldName} must be text.`);
  }

  const result = value.trim();

  if (!result && !nullable) {
    fail(400, `${fieldName} is required.`);
  }

  if (maxLength !== undefined && result.length > maxLength) {
    fail(
      400,
      `${fieldName} must not exceed ${maxLength} characters.`,
    );
  }

  return result || null;
}


// =========================================================
// ITEM VALIDATION
// =========================================================

function validateItems(items) {
  if (items === undefined) {
    return undefined;
  }

  if (!Array.isArray(items)) {
    fail(400, "Items must be provided as an array.");
  }

  if (items.length > MAX_ITEMS) {
    fail(
      400,
      `An errand cannot contain more than ${MAX_ITEMS} items.`,
    );
  }

  return items.map((item, index) => {
    if (!isPlainObject(item)) {
      fail(400, `Item ${index + 1} must be an object.`);
    }

    const itemName =
      typeof item.item_name === "string"
        ? item.item_name.trim()
        : "";

    if (!itemName || itemName.length > 200) {
      fail(
        400,
        `Item ${index + 1} must have a name between 1 and 200 characters.`,
      );
    }

    const description = parseOptionalText(
      item.description,
      `Item ${index + 1} description`,
      { maxLength: 2000 },
    );

    const customerNotes = parseOptionalText(
      item.customer_notes,
      `Item ${index + 1} customer notes`,
      { maxLength: 2000 },
    );

    const quantity =
      item.quantity === undefined ? 1 : Number(item.quantity);

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      Math.round(quantity * 1000) !== quantity * 1000
    ) {
      fail(
        400,
        `Item ${index + 1} quantity must be positive and have no more than three decimal places.`,
      );
    }

    const unit =
      item.unit === undefined ? "item" : item.unit;

    if (
      typeof unit !== "string" ||
      !unit.trim() ||
      unit.trim().length > 50
    ) {
      fail(
        400,
        `Item ${index + 1} unit must contain between 1 and 50 characters.`,
      );
    }

    const pricingType =
      item.pricing_type === undefined
        ? "fixed"
        : item.pricing_type;

    if (!ALLOWED_PRICING_TYPES.has(pricingType)) {
      fail(
        400,
        `Item ${index + 1} pricing_type must be fixed or flexible.`,
      );
    }

    const estimatedUnitPrice = parseOptionalAmount(
      item.estimated_unit_price,
      `Item ${index + 1} estimated unit price`,
    );

    let itemUrl = item.item_url;

    if (itemUrl === undefined || itemUrl === "") {
      itemUrl = null;
    } else {
      if (typeof itemUrl !== "string" || itemUrl.length > 2048) {
        fail(
          400,
          `Item ${index + 1} item_url must be a valid HTTP or HTTPS URL no longer than 2048 characters.`,
        );
      }

      try {
        const parsedUrl = new URL(itemUrl);

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          fail(
            400,
            `Item ${index + 1} item_url must use HTTP or HTTPS.`,
          );
        }

        itemUrl = parsedUrl.toString();
      } catch (error) {
        if (error instanceof RequestError) {
          throw error;
        }

        fail(
          400,
          `Item ${index + 1} item_url must be a valid HTTP or HTTPS URL.`,
        );
      }
    }

    const sortOrder =
      item.sort_order === undefined
        ? index
        : Number(item.sort_order);

    if (
      !Number.isInteger(sortOrder) ||
      sortOrder < 0 ||
      sortOrder > 100000
    ) {
      fail(
        400,
        `Item ${index + 1} sort_order must be an integer between 0 and 100000.`,
      );
    }

    return {
      item_name: itemName,
      description,
      quantity,
      unit: unit.trim(),
      estimated_unit_price: estimatedUnitPrice ?? null,
      pricing_type: pricingType,
      item_url: itemUrl,
      customer_notes: customerNotes,
      sort_order: sortOrder,
    };
  });
}


// =========================================================
// ERRAND VALIDATION
// =========================================================

function validateErrandInput(input, { partial = false } = {}) {
  if (!isPlainObject(input)) {
    fail(400, "The request body must be an object.");
  }

  const allowedFields = new Set([
    "title",
    "description",
    "category",
    "currency_code",
    "category_details",
    "estimated_total",
    "max_erander_offers",
    "scheduled_for",
    "expires_at",
    "customer_notes",
    "items",
    "destination",
  ]);

  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) {
      fail(400, `The field "${field}" is not supported.`);
    }
  }

  const result = {};

  if (!partial || input.title !== undefined) {
    const title =
      typeof input.title === "string"
        ? input.title.trim()
        : "";

    if (title.length < 3 || title.length > 120) {
      fail(400, "Title must contain between 3 and 120 characters.");
    }

    result.title = title;
  }

  if (!partial || input.description !== undefined) {
    result.description = parseOptionalText(
      input.description,
      "Description",
      { maxLength: 5000 },
    );
  }

  if (!partial || input.category !== undefined) {
    if (
      typeof input.category !== "string" ||
      !ALLOWED_CATEGORIES.has(input.category)
    ) {
      fail(400, "Please select a valid errand category.");
    }

    result.category = input.category;
  }

  if (!partial || input.currency_code !== undefined) {
    const currencyCode = input.currency_code;

    if (
      typeof currencyCode !== "string" ||
      !ALLOWED_CURRENCIES.has(currencyCode.trim().toUpperCase())
    ) {
      fail(
        400,
        "Choose a transaction currency: USD, NGN, GBP or EUR.",
      );
    }

    result.currency_code = currencyCode.trim().toUpperCase();
  }

  if (input.category_details !== undefined) {
    result.category_details = validateCategoryDetails(
      input.category_details,
    );
  } else if (!partial) {
    result.category_details = {};
  }

  if (!partial || input.estimated_total !== undefined) {
    result.estimated_total = parseOptionalAmount(
      input.estimated_total,
      "Estimated total",
    );

    if (result.estimated_total === undefined) {
      result.estimated_total = null;
    }
  }

  if (!partial || input.max_erander_offers !== undefined) {
    const maximum =
      input.max_erander_offers === undefined
        ? 20
        : Number(input.max_erander_offers);

    if (
      !Number.isInteger(maximum) ||
      maximum < 1 ||
      maximum > 100
    ) {
      fail(
        400,
        "max_erander_offers must be an integer between 1 and 100.",
      );
    }

    result.max_erander_offers = maximum;
  }

  if (!partial || input.scheduled_for !== undefined) {
    result.scheduled_for = parseOptionalDate(
      input.scheduled_for,
      "scheduled_for",
    );
  }

  if (!partial || input.expires_at !== undefined) {
    result.expires_at = parseOptionalDate(
      input.expires_at,
      "expires_at",
    );
  }

  if (!partial || input.customer_notes !== undefined) {
    result.customer_notes = parseOptionalText(
      input.customer_notes,
      "Customer notes",
      { maxLength: 5000 },
    );
  }

  if (input.items !== undefined) {
    result.items = validateItems(input.items);
  } else if (!partial) {
    result.items = [];
  }

  if (input.destination !== undefined) {
    result.destination = validateDestinationInput(input.destination);
  } else if (!partial) {
    fail(400, "Please select or enter an errand destination.");
  }

  return result;
}


// =========================================================
// ADDRESS VALIDATION
// =========================================================

function validateAddress(address) {
  if (!isPlainObject(address)) {
    fail(400, "The destination address must be an object.");
  }

  const allowedFields = new Set([
    "label",
    "location_type",
    "country",
    "state",
    "city",
    "street",
    "home_address",
    "landmark",
  ]);

  for (const field of Object.keys(address)) {
    if (!allowedFields.has(field)) {
      fail(
        400,
        `The destination address field "${field}" is not supported.`,
      );
    }
  }

  const label = parseOptionalText(
    address.label,
    "Address label",
    {
      maxLength: 80,
      nullable: false,
    },
  );

  const locationType = address.location_type;

  if (!ALLOWED_LOCATION_TYPES.has(locationType)) {
    fail(
      400,
      "location_type must be residential, business, public, or other.",
    );
  }

  const country = parseOptionalText(
    address.country,
    "Country",
    {
      maxLength: 100,
      nullable: false,
    },
  );

  const state = parseOptionalText(
    address.state,
    "State",
    {
      maxLength: 100,
      nullable: false,
    },
  );

  const city = parseOptionalText(
    address.city,
    "City",
    {
      maxLength: 100,
      nullable: false,
    },
  );

  const street = parseOptionalText(
    address.street,
    "Street",
    {
      maxLength: 200,
      nullable: false,
    },
  );

  const homeAddress = parseOptionalText(
    address.home_address,
    "Home or building address",
    {
      maxLength: 300,
      nullable: false,
    },
  );

  const landmark = parseOptionalText(
    address.landmark,
    "Landmark",
    { maxLength: 300 },
  );

  return {
    label,
    location_type: locationType,
    country,
    state,
    city,
    street,
    home_address: homeAddress,
    landmark,
  };
}


function validateDestinationInput(destination) {
  if (!isPlainObject(destination)) {
    fail(400, "Destination must be an object.");
  }

  const hasAddressId = destination.address_id !== undefined;
  const hasNewAddress = destination.address !== undefined;

  if (hasAddressId === hasNewAddress) {
    fail(
      400,
      "Choose one saved address or provide one new destination address.",
    );
  }

  if (hasAddressId) {
    const allowedFields = new Set(["address_id"]);

    for (const field of Object.keys(destination)) {
      if (!allowedFields.has(field)) {
        fail(
          400,
          `The destination field "${field}" is not supported for a saved address.`,
        );
      }
    }

    if (
      typeof destination.address_id !== "string" ||
      !destination.address_id.trim() ||
      destination.address_id.length > 100
    ) {
      fail(400, "A valid saved address ID is required.");
    }

    return {
      address_id: destination.address_id.trim(),
    };
  }

  const allowedFields = new Set([
    "address",
    "save_address",
    "make_default",
  ]);

  for (const field of Object.keys(destination)) {
    if (!allowedFields.has(field)) {
      fail(
        400,
        `The destination field "${field}" is not supported.`,
      );
    }
  }

  const address = validateAddress(destination.address);

  const saveAddress =
    destination.save_address === undefined
      ? false
      : destination.save_address;

  const makeDefault =
    destination.make_default === undefined
      ? false
      : destination.make_default;

  if (
    typeof saveAddress !== "boolean" ||
    typeof makeDefault !== "boolean"
  ) {
    fail(
      400,
      "save_address and make_default must be true or false.",
    );
  }

  if (makeDefault && !saveAddress) {
    fail(
      400,
      "A destination must be saved before it can be set as the default address.",
    );
  }

  return {
    address,
    save_address: saveAddress,
    make_default: makeDefault,
  };
}


// =========================================================
// CUSTOMER VALIDATION
// =========================================================

async function requireActiveCustomer(client, userId) {
  const result = await client.query(
    `
      SELECT id, user_roles, account_status, addresses
      FROM public.profiles
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [userId],
  );

  const profile = result.rows[0];

  if (!profile) {
    fail(
      403,
      "Your customer profile could not be found. Please complete your profile first.",
    );
  }

  if (profile.account_status !== "active") {
    fail(403, "Your account is not currently active.");
  }

  const roles = parseJsonArray(profile.user_roles);

  if (!roles.includes("customer")) {
    fail(403, "Your account does not have customer access.");
  }

  profile.addresses = parseJsonArray(profile.addresses);

  return profile;
}


// =========================================================
// ADDRESS HELPERS
// =========================================================

function createAddressRecord(address, makeDefault = false) {
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    ...address,
    is_default: makeDefault,
    created_at: now,
    updated_at: now,
  };
}


function makeAddressSnapshot(address) {
  return {
    id: address.id ?? null,
    label: address.label,
    location_type: address.location_type,
    country: address.country,
    state: address.state,
    city: address.city,
    street: address.street,
    home_address: address.home_address,
    landmark: address.landmark ?? null,
  };
}


async function resolveDestination(client, profile, destination) {
  if (destination.address_id) {
    const savedAddress = profile.addresses.find(
      (address) => address.id === destination.address_id,
    );

    if (!savedAddress) {
      fail(
        404,
        "That saved address could not be found in your address book.",
      );
    }

    return {
      locationAddressId: savedAddress.id,
      locationSnapshot: makeAddressSnapshot(savedAddress),
    };
  }

  let newAddressRecord = null;

  if (destination.save_address) {
    if (profile.addresses.length >= MAX_ADDRESSES) {
      fail(
        400,
        `You can save a maximum of ${MAX_ADDRESSES} addresses.`,
      );
    }

    const shouldBeDefault =
      destination.make_default || profile.addresses.length === 0;

    newAddressRecord = createAddressRecord(
      destination.address,
      shouldBeDefault,
    );

    if (shouldBeDefault) {
      profile.addresses = profile.addresses.map((address) => ({
        ...address,
        is_default: false,
      }));
    }

    profile.addresses.push(newAddressRecord);

    await client.query(
      `
        UPDATE public.profiles
        SET addresses = $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
      `,
      [profile.id, JSON.stringify(profile.addresses)],
    );
  }

  const snapshotSource = newAddressRecord ?? destination.address;

  return {
    locationAddressId: newAddressRecord?.id ?? null,
    locationSnapshot: makeAddressSnapshot(snapshotSource),
  };
}


// =========================================================
// ERRAND ITEM HELPERS
// =========================================================

async function insertErrandItems(
  client,
  errandId,
  items,
  versionNumber = 1,
) {
  for (const item of items) {
    await client.query(
      `
        INSERT INTO public.erand_items (
          erand_id,
          item_name,
          description,
          quantity,
          unit,
          estimated_unit_price,
          pricing_type,
          item_url,
          customer_notes,
          sort_order,
          version_number,
          is_current
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE
        )
      `,
      [
        errandId,
        item.item_name,
        item.description,
        item.quantity,
        item.unit,
        item.estimated_unit_price,
        item.pricing_type,
        item.item_url,
        item.customer_notes,
        item.sort_order,
        versionNumber,
      ],
    );
  }
}


function areErrandItemsUnchanged(existingItems, submittedItems) {
  if (existingItems.length !== submittedItems.length) {
    return false;
  }

  const normalizeNullable = (value) => value ?? null;

  return existingItems.every((existing, index) => {
    const submitted = submittedItems[index];

    return (
      existing.item_name === submitted.item_name &&
      normalizeNullable(existing.description) ===
        normalizeNullable(submitted.description) &&
      Number(existing.quantity) === Number(submitted.quantity) &&
      existing.unit === submitted.unit &&
      (
        existing.estimated_unit_price === null
          ? submitted.estimated_unit_price === null
          : Number(existing.estimated_unit_price) ===
            Number(submitted.estimated_unit_price)
      ) &&
      existing.pricing_type === submitted.pricing_type &&
      normalizeNullable(existing.item_url) ===
        normalizeNullable(submitted.item_url) &&
      normalizeNullable(existing.customer_notes) ===
        normalizeNullable(submitted.customer_notes) &&
      Number(existing.sort_order) === Number(submitted.sort_order)
    );
  });
}


/**
 * Versioned item replacement.
 *
 * Never physically delete old item records.
 *
 * Offer items reference the original item IDs. Keeping those rows means
 * existing proposals remain valid and can still be displayed.
 */
async function updateErrandItems(
  client,
  errandId,
  submittedItems,
  newVersion,
) {
  const existingResult = await client.query(
    `
      SELECT
        id,
        erand_id,
        item_name,
        description,
        quantity,
        unit,
        estimated_unit_price,
        pricing_type,
        item_url,
        customer_notes,
        sort_order
      FROM public.erand_items
      WHERE erand_id = $1
        AND is_current = TRUE
      ORDER BY sort_order ASC, created_at ASC
      FOR UPDATE
    `,
    [errandId],
  );

  const existingItems = existingResult.rows;

  if (areErrandItemsUnchanged(existingItems, submittedItems)) {
    return false;
  }

  // Retire the previous item collection instead of deleting it.
  // Existing erand_offer_items continue referencing the old IDs.
  await client.query(
    `
      UPDATE public.erand_items
      SET is_current = FALSE,
          retired_at = NOW(),
          updated_at = NOW()
      WHERE erand_id = $1
        AND is_current = TRUE
    `,
    [errandId],
  );

  await insertErrandItems(
    client,
    errandId,
    submittedItems,
    newVersion,
  );

  return true;
}


// =========================================================
// ERRAND VERSION HISTORY
// =========================================================

async function saveErrandVersion(
  client,
  errandId,
  userId,
  versionNumber,
  changeType,
) {
  await client.query(
    `
      INSERT INTO public.erand_versions (
        erand_id,
        version_number,
        changed_by,
        change_type,
        snapshot
      )
      SELECT
        e.id,
        $2::integer,
        $3,
        $4,
        jsonb_build_object(
          'id', e.id,
          'reference_code', e.reference_code,
          'business_id', e.business_id,
          'version', $2::integer,
          'title', e.title,
          'description', e.description,
          'category', e.category,
          'category_details', e.category_details,
          'status', e.status,
          'currency_code', e.currency_code,
          'estimated_total', e.estimated_total,
          'max_erander_offers', e.max_erander_offers,
          'offers_enabled', e.offers_enabled,
          'scheduled_for', e.scheduled_for,
          'expires_at', e.expires_at,
          'customer_notes', e.customer_notes,
          'location_snapshot', e.location_snapshot,
          'location_address_id', e.location_address_id,
          'items', COALESCE(
            (
              SELECT jsonb_agg(
                to_jsonb(i)
                ORDER BY i.sort_order ASC, i.created_at ASC
              )
              FROM public.erand_items i
              WHERE i.erand_id = e.id
                AND i.is_current = TRUE
            ),
            '[]'::jsonb
          )
        )
      FROM public.erands e
      WHERE e.id = $1
    `,
    [
      errandId,
      versionNumber,
      userId,
      changeType,
    ],
  );
}




// =========================================================
// PROPOSAL SUBMITTER LOOKUP
// =========================================================

async function getProposalSubmitters(client, errandId) {
  const result = await client.query(
    `
      SELECT DISTINCT offered_by
      FROM public.erand_offers
      WHERE erand_id = $1
    `,
    [errandId],
  );

  return result.rows.map((row) => row.offered_by);
}


// =========================================================
// ERRAND RETRIEVAL
// =========================================================

async function getErrandWithItems(
  client,
  errandId,
  userId,
  { allowEranderWithOffer = false } = {},
) {
  const errandResult = await client.query(
    `
      SELECT
        e.*,

        CASE
          WHEN customer_profile.id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id', customer_profile.id,
            'display_name',
              COALESCE(
                NULLIF(BTRIM(customer_profile.display_name), ''),
                NULLIF(
                  BTRIM(
                    CONCAT_WS(
                      ' ',
                      customer_profile.first_name,
                      customer_profile.last_name
                    )
                  ),
                  ''
                )
              ),
            'first_name', customer_profile.first_name,
            'last_name', customer_profile.last_name,
            'other_names', customer_profile.other_names,
            'avatar_url', customer_profile.avatar_url
          )
        END AS customer,

        CASE
          WHEN erander_profile.id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id', erander_profile.id,
            'display_name',
              COALESCE(
                NULLIF(BTRIM(erander_profile.display_name), ''),
                NULLIF(
                  BTRIM(
                    CONCAT_WS(
                      ' ',
                      erander_profile.first_name,
                      erander_profile.last_name
                    )
                  ),
                  ''
                )
              ),
            'first_name', erander_profile.first_name,
            'last_name', erander_profile.last_name,
            'other_names', erander_profile.other_names,
            'avatar_url', erander_profile.avatar_url
          )
        END AS assigned_erander

      FROM public.erands AS e

      LEFT JOIN public.profiles AS customer_profile
        ON customer_profile.id = e.requested_by

      LEFT JOIN public.profiles AS erander_profile
        ON erander_profile.id = e.assigned_erander_id

      WHERE e.id = $1
        AND (
          e.requested_by = $2

          OR (
            e.deleted_at IS NULL
            AND e.assigned_erander_id = $2
          )

          OR (
            $3::boolean = TRUE
            AND e.deleted_at IS NULL
            AND e.accepted_offer_id IS NULL
            AND e.assigned_erander_id IS NULL
            AND e.status = 'open'
            AND EXISTS (
              SELECT 1
              FROM public.erand_offers AS o
              WHERE o.erand_id = e.id
                AND o.offered_by = $2
            )
          )
        )

      LIMIT 1
    `,
    [errandId, userId, allowEranderWithOffer],
  );

  const errand = errandResult.rows[0];

  if (!errand) {
    return null;
  }

  const itemsResult = await client.query(
    `
      SELECT
        id,
        erand_id,
        item_name,
        description,
        quantity,
        unit,
        estimated_unit_price,
        pricing_type,
        item_url,
        customer_notes,
        sort_order,
        version_number,
        created_at,
        updated_at
      FROM public.erand_items
      WHERE erand_id = $1
        AND is_current = TRUE
      ORDER BY sort_order ASC, created_at ASC
    `,
    [errandId],
  );

  let acceptedOffer = null;

  if (errand.accepted_offer_id) {
    const acceptedOfferResult = await client.query(
      `
        SELECT
          o.*,

          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', oi.id,
                  'erand_item_id', oi.erand_item_id,
                  'item_name', ei.item_name,
                  'description', ei.description,
                  'quantity', ei.quantity,
                  'unit', ei.unit,
                  'proposed_quantity', oi.proposed_quantity,
                  'proposed_unit_price', oi.proposed_unit_price,
                  'notes', oi.notes,
                  'sort_order', ei.sort_order
                )
                ORDER BY ei.sort_order ASC, oi.created_at ASC
              )
              FROM public.erand_offer_items AS oi
              JOIN public.erand_items AS ei
                ON ei.id = oi.erand_item_id
              WHERE oi.offer_id = o.id
            ),
            '[]'::jsonb
          ) AS items

        FROM public.erand_offers AS o

        WHERE o.id = $1
          AND o.erand_id = $2
          AND o.status = 'accepted'

        LIMIT 1
      `,
      [errand.accepted_offer_id, errandId],
    );

    acceptedOffer = acceptedOfferResult.rows[0] ?? null;
  }

  return {
    ...errand,
    items: itemsResult.rows,
    accepted_offer: acceptedOffer,
  };
}


// =========================================================
// ERROR HANDLING
// =========================================================

function sendError(res, error) {
  if (error instanceof RequestError) {
    const payload = {
      success: false,
      message: error.message,
    };

    if (error.details !== undefined) {
      payload.details = error.details;
    }

    return res.status(error.status).json(payload);
  }

  if (error?.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "This request conflicts with an existing record.",
    });
  }

  if (error?.code === "23503") {
    return res.status(409).json({
      success: false,
      message:
        "This operation conflicts with existing records that must be preserved.",
    });
  }

  if (error?.code === "23514") {
    return res.status(400).json({
      success: false,
      message: "Some of the supplied information is invalid.",
    });
  }

  console.error("ERANDER errand controller error:", error);

  return res.status(500).json({
    success: false,
    message: "Something went wrong while processing your errand.",
  });
}


// =========================================================
// EDITABILITY
// =========================================================

function isEditableErrand(errand) {
  return (
    ["draft", "open"].includes(errand.status) &&
    !errand.accepted_offer_id &&
    !errand.assigned_erander_id &&
    !errand.deleted_at
  );
}


function validateDateOrdering(input) {
  if (input.scheduled_for && input.expires_at) {
    if (
      new Date(input.expires_at).getTime() <=
      new Date(input.scheduled_for).getTime()
    ) {
      fail(
        400,
        "The expiry date must be later than the scheduled date.",
      );
    }
  }
}


// =========================================================
// CREATE ERRAND
// =========================================================

export async function createErrand(req, res) {
  const pool = getDatabasePool();
  const client = await pool.connect();

  try {
    const userId = req.user?.id;

    if (!userId) {
      fail(401, "Please sign in to create an errand.");
    }

    if (req.body?.business_id !== undefined) {
      fail(
        400,
        "Business errands are not enabled through this endpoint yet.",
      );
    }

    const input = validateErrandInput(req.body);

    if (input.category === "business_support") {
      fail(
        403,
        "Business Errands can only be created from an authorised business account.",
      );
    }

    validateDateOrdering(input);

    await client.query("BEGIN");

    const profile = await requireActiveCustomer(client, userId);

    const destination = await resolveDestination(
      client,
      profile,
      input.destination,
    );

    const insertResult = await client.query(
      `
        INSERT INTO public.erands (
          requested_by,
          title,
          description,
          category,
          status,
          currency_code,
          category_details,
          estimated_total,
          max_erander_offers,
          offers_enabled,
          scheduled_for,
          expires_at,
          customer_notes,
          location_snapshot,
          location_address_id,
          current_version
        )
        VALUES (
          $1, $2, $3, $4, 'open', $5, $6::jsonb, $7, $8, TRUE,
          $9, $10, $11, $12::jsonb, $13, 1
        )
        RETURNING *
      `,
      [
        userId,
        input.title,
        input.description ?? null,
        input.category,
        input.currency_code,
        JSON.stringify(input.category_details ?? {}),
        input.estimated_total ?? null,
        input.max_erander_offers ?? 20,
        input.scheduled_for ?? null,
        input.expires_at ?? null,
        input.customer_notes ?? null,
        JSON.stringify(destination.locationSnapshot),
        destination.locationAddressId,
      ],
    );

    const errand = insertResult.rows[0];

    await insertErrandItems(
      client,
      errand.id,
      input.items ?? [],
      1,
    );

    await saveErrandVersion(
      client,
      errand.id,
      userId,
      1,
      "created",
    );

    const completeErrand = await getErrandWithItems(
      client,
      errand.id,
      userId,
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Your errand has been created successfully.",
      data: {
        errand: completeErrand,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Failed to roll back errand creation:",
        rollbackError,
      );
    }

    return sendError(res, error);
  } finally {
    client.release();
  }
}


// =========================================================
// BUSINESS ERRANDS
// =========================================================

export async function createBusinessErrand(req, res) {
  const pool = getDatabasePool();
  const client = await pool.connect();

  try {
    const userId = req.user?.id;
    const business = req.business;

    if (!userId || !business?.business_id) {
      fail(401, "Please sign in to your business account.");
    }

    if (!canCreateBusinessErrands(business)) {
      fail(403, "Your business membership does not have permission to create errands.");
    }

    if (business.verification_status !== "verified") {
      fail(403, "Your business must be verified before it can create Business Errands.");
    }

    const input = validateErrandInput(req.body);

    if (input.category !== "business_support") {
      fail(400, "Business accounts can create Business Errands only through this endpoint.");
    }

    validateDateOrdering(input);
    await client.query("BEGIN");

    const profileResult = await client.query(
      `SELECT id, account_status, addresses
         FROM public.profiles
        WHERE id = $1
        LIMIT 1
        FOR UPDATE`,
      [userId],
    );
    const profile = profileResult.rows[0];

    if (!profile || profile.account_status !== "active") {
      fail(403, "Your personal profile must be active to create a Business Errand.");
    }

    profile.addresses = parseJsonArray(profile.addresses);
    const destination = await resolveDestination(client, profile, input.destination);

    const insertResult = await client.query(
      `INSERT INTO public.erands (
         requested_by,
         business_id,
         title,
         description,
         category,
         status,
         currency_code,
         category_details,
         estimated_total,
         max_erander_offers,
         offers_enabled,
         scheduled_for,
         expires_at,
         customer_notes,
         location_snapshot,
         location_address_id,
         current_version
       ) VALUES (
         $1, $2, $3, $4, 'business_support', 'open', $5, $6::jsonb,
         $7, $8, TRUE, $9, $10, $11, $12::jsonb, $13, 1
       )
       RETURNING *`,
      [
        userId,
        business.business_id,
        input.title,
        input.description ?? null,
        input.currency_code,
        JSON.stringify(input.category_details ?? {}),
        input.estimated_total ?? null,
        input.max_erander_offers ?? 20,
        input.scheduled_for ?? null,
        input.expires_at ?? null,
        input.customer_notes ?? null,
        JSON.stringify(destination.locationSnapshot),
        destination.locationAddressId,
      ],
    );

    const errand = insertResult.rows[0];
    await insertErrandItems(client, errand.id, input.items ?? [], 1);
    await saveErrandVersion(client, errand.id, userId, 1, "created");

    const completeErrand = await getErrandWithItems(client, errand.id, userId);
    if (!completeErrand) {
      fail(500, "The Business Errand was created but could not be retrieved.");
    }

    await client.query("COMMIT");
    return res.status(201).json({
      success: true,
      message: "Your Business Errand has been created successfully.",
      data: { errand: completeErrand },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Failed to roll back Business Errand creation:", rollbackError);
    }
    return sendError(res, error);
  } finally {
    client.release();
  }
}

export async function listBusinessErrands(req, res) {
  const businessId = req.business?.business_id;
  if (!businessId) {
    return res.status(401).json({ success: false, message: "Please sign in to your business account." });
  }

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const requestedLimit = Number.parseInt(req.query.limit, 10) || 20;
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, requestedLimit));
  const offset = (page - 1) * limit;
  const pool = getDatabasePool();

  try {
    const [countResult, result] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::integer AS total
           FROM public.erands
          WHERE business_id = $1
            AND deleted_at IS NULL`,
        [businessId],
      ),
      pool.query(
        `SELECT
           e.*,
           COALESCE(
             (
               SELECT jsonb_agg(to_jsonb(i) ORDER BY i.sort_order, i.created_at)
                 FROM public.erand_items i
                WHERE i.erand_id = e.id
                  AND i.is_current = TRUE
             ),
             '[]'::jsonb
           ) AS items,
           jsonb_build_object(
             'id', creator.id,
             'display_name', COALESCE(
               NULLIF(BTRIM(creator.display_name), ''),
               NULLIF(BTRIM(CONCAT_WS(' ', creator.first_name, creator.last_name)), '')
             ),
             'first_name', creator.first_name,
             'last_name', creator.last_name,
             'avatar_url', creator.avatar_url
           ) AS created_by_user
         FROM public.erands e
         JOIN public.profiles creator ON creator.id = e.requested_by
        WHERE e.business_id = $1
          AND e.deleted_at IS NULL
        ORDER BY e.created_at DESC
        LIMIT $2 OFFSET $3`,
        [businessId, limit, offset],
      ),
    ]);

    const total = countResult.rows[0]?.total ?? 0;
    return res.status(200).json({
      success: true,
      data: {
        errands: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}


// =========================================================
// LIST CUSTOMER ERRANDS
// =========================================================

export async function listMyErands(req, res) {
const pool = getDatabasePool();
const client = await pool.connect();

try {
const userId = req.user?.id;

if (!userId) {
  fail(401, "Please sign in to view your errands.");
}

const page = Math.max(
  1,
  Number.parseInt(req.query.page, 10) || 1,
);

const requestedLimit =
  Number.parseInt(req.query.limit, 10) || 20;

const limit = Math.min(
  MAX_PAGE_SIZE,
  Math.max(1, requestedLimit),
);

const offset = (page - 1) * limit;

const countResult = await client.query(
  `
    SELECT COUNT(*)::integer AS total
    FROM public.erands
    WHERE requested_by = $1
  `,
  [userId],
);

const total = countResult.rows[0]?.total ?? 0;

const result = await client.query(
  `
    SELECT
      e.*,
						
						      -- The accepted offer contains the customer's approved agreement amount.
      CASE
        WHEN e.accepted_offer_id IS NOT NULL THEN (
          SELECT jsonb_build_object(
            'id', o.id,
            'proposed_item_total', o.proposed_item_total,
            'proposed_service_fee', o.proposed_service_fee,
            'proposed_delivery_fee', o.proposed_delivery_fee,
            'proposed_other_fees', o.proposed_other_fees,
            'proposed_total', o.proposed_total,
            'currency_code', o.currency_code
          )
          FROM public.erand_offers AS o
          WHERE o.id = e.accepted_offer_id
            AND o.erand_id = e.id
            AND o.status = 'accepted'
          LIMIT 1
        )
        ELSE NULL
      END AS accepted_offer,

      -- Total number of offers submitted for this errand.
      -- Historical offers are preserved and included in this count.
      (
        SELECT COUNT(*)::integer
        FROM public.erand_offers AS o
        WHERE o.erand_id = e.id
      ) AS offers_count,

      -- Current errand requirements.
      COALESCE(
        (
          SELECT jsonb_agg(
            to_jsonb(i)
            ORDER BY i.sort_order ASC, i.created_at ASC
          )
          FROM public.erand_items AS i
          WHERE i.erand_id = e.id
            AND i.is_current = TRUE
        ),
        '[]'::jsonb
      ) AS items

    FROM public.erands AS e

    WHERE e.requested_by = $1

    ORDER BY e.created_at DESC

    LIMIT $2
    OFFSET $3
  `,
  [userId, limit, offset],
);

return res.status(200).json({
  success: true,
  data: {
    errands: result.rows,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  },
});

} catch (error) {
return sendError(res, error);
} finally {
client.release();
}
}





// =========================================================
// GET SINGLE ERRAND
// =========================================================

export async function getMyErand(req, res) {
  const pool = getDatabasePool();
  const client = await pool.connect();

  try {
    const userId = req.user?.id;

    if (!userId) {
      fail(401, "Please sign in to view this errand.");
    }

    const errandId = req.params.id;

    if (!isNonEmptyString(errandId)) {
      fail(400, "A valid errand ID is required.");
    }

    const errand = await getErrandWithItems(
      client,
      errandId,
      userId,
      { allowEranderWithOffer: true },
    );

    if (!errand) {
      fail(404, "Errand not found.");
    }

    return res.status(200).json({
      success: true,
      data: { errand },
    });
  } catch (error) {
    return sendError(res, error);
  } finally {
    client.release();
  }
}


// =========================================================
// UPDATE ERRAND
// =========================================================

export async function updateMyErand(req, res) {
  const pool = getDatabasePool();
  const client = await pool.connect();

  try {
    const userId = req.user?.id;

    if (!userId) {
      fail(401, "Please sign in to update this errand.");
    }

    const errandId = req.params.id;

    if (!isNonEmptyString(errandId)) {
      fail(400, "A valid errand ID is required.");
    }

    const input = validateErrandInput(
      req.body,
      { partial: true },
    );

    if (Object.keys(input).length === 0) {
      fail(400, "Provide at least one field to update.");
    }

    await client.query("BEGIN");

    const profile = await requireActiveCustomer(client, userId);

    const currentResult = await client.query(
      `
        SELECT *
        FROM public.erands
        WHERE id = $1
          AND requested_by = $2
        LIMIT 1
        FOR UPDATE
      `,
      [errandId, userId],
    );

    const currentErrand = currentResult.rows[0];

    if (!currentErrand) {
      fail(404, "Errand not found.");
    }

    if (!isEditableErrand(currentErrand)) {
      fail(
        409,
        "This errand can no longer be edited because it has been selected, assigned, or is no longer in draft or open status.",
      );
    }

    // Category-specific fields belong to their category. Clear the previous
    // category's details when a customer changes the category without
    // submitting a replacement details object.
    if (
      input.category !== undefined &&
      input.category !== currentErrand.category &&
      input.category_details === undefined
    ) {
      input.category_details = {};
    }

    // Transaction currency is immutable after errand creation.
    if (
      input.currency_code !== undefined &&
      input.currency_code !== currentErrand.currency_code
    ) {
      fail(
        409,
        "The transaction currency of an existing errand cannot be changed.",
      );
    }

    const proposedScheduledFor =
      input.scheduled_for !== undefined
        ? input.scheduled_for
        : currentErrand.scheduled_for;

    const proposedExpiresAt =
      input.expires_at !== undefined
        ? input.expires_at
        : currentErrand.expires_at;

    if (
      proposedScheduledFor &&
      proposedExpiresAt &&
      new Date(proposedExpiresAt).getTime() <=
        new Date(proposedScheduledFor).getTime()
    ) {
      fail(
        400,
        "The expiry date must be later than the scheduled date.",
      );
    }

    // Get proposal submitters before making changes.
    const proposalSubmitters = await getProposalSubmitters(
      client,
      errandId,
    );

    const updates = [];
    const values = [];

    const addUpdate = (column, value, cast = "") => {
      values.push(value);
      updates.push(`${column} = $${values.length}${cast}`);
    };

    const editableFields = [
      ["title", "title"],
      ["description", "description"],
      ["category", "category"],
      ["estimated_total", "estimated_total"],
      ["max_erander_offers", "max_erander_offers"],
      ["scheduled_for", "scheduled_for"],
      ["expires_at", "expires_at"],
      ["customer_notes", "customer_notes"],
    ];

    for (const [inputField, column] of editableFields) {
      if (input[inputField] !== undefined) {
        addUpdate(column, input[inputField]);
      }
    }

    if (input.category_details !== undefined) {
      addUpdate(
        "category_details",
        JSON.stringify(input.category_details),
        "::jsonb",
      );
    }

    if (input.destination !== undefined) {
      const destination = await resolveDestination(
        client,
        profile,
        input.destination,
      );

      addUpdate(
        "location_snapshot",
        JSON.stringify(destination.locationSnapshot),
      );

      addUpdate(
        "location_address_id",
        destination.locationAddressId,
      );
    }

    // Every accepted edit creates a new errand version.
    values.push(errandId, userId);

    const updateResult = await client.query(
      `
        UPDATE public.erands
        SET ${updates.length > 0 ? `${updates.join(", ")},` : ""}
            current_version = current_version + 1,
            updated_at = NOW()
        WHERE id = $${values.length - 1}
          AND requested_by = $${values.length}
          AND deleted_at IS NULL
        RETURNING current_version
      `,
      values,
    );

    if (updateResult.rowCount === 0) {
      fail(409, "This errand could not be updated.");
    }

    const newVersion = updateResult.rows[0].current_version;

    if (input.items !== undefined) {
      await updateErrandItems(
        client,
        errandId,
        input.items,
        newVersion,
      );
    }

    await saveErrandVersion(
      client,
      errandId,
      userId,
      newVersion,
      "updated",
    );

    // Existing offers are preserved. Notify each proposer that a new version
    // is available for review after the errand update commits.

    const updatedErrand = await getErrandWithItems(
      client,
      errandId,
      userId,
    );

    await client.query("COMMIT");

    for (const proposerId of proposalSubmitters) {
      notifyUser({
        recipientId: proposerId,
        type: "errand_updated",
        title: "An errand you offered on was updated",
        body: "The customer updated the errand details. Your existing offer has been preserved; review the latest version before proceeding.",
        actionUrl: "/dashboard/my-offers",
        entityType: "erand",
        entityId: errandId,
        data: { version: newVersion },
        dedupeKey: `errand_updated:${errandId}:${newVersion}:${proposerId}`,
      }).catch((error) => console.error("Errand update notification failed:", error?.message));
    }

    return res.status(200).json({
      success: true,
      message: "Your errand has been updated successfully.",
      data: {
        errand: updatedErrand,
        version: newVersion,
        proposal_submitters_to_notify: proposalSubmitters.length,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Failed to roll back errand update:",
        rollbackError,
      );
    }

    return sendError(res, error);
  } finally {
    client.release();
  }
}


// =========================================================
// CLOSE ERRAND
// =========================================================

export async function closeMyErand(req, res) {
  const pool = getDatabasePool();
  const client = await pool.connect();

  try {
    const userId = req.user?.id;

    if (!userId) {
      fail(401, "Please sign in to close this errand.");
    }

    const errandId = req.params.id;

    if (!isNonEmptyString(errandId)) {
      fail(400, "A valid errand ID is required.");
    }

    await client.query("BEGIN");

    const result = await client.query(
      `
        SELECT
          id,
          status,
          accepted_offer_id,
          assigned_erander_id,
          deleted_at
        FROM public.erands
        WHERE id = $1
          AND requested_by = $2
        LIMIT 1
        FOR UPDATE
      `,
      [errandId, userId],
    );

    const errand = result.rows[0];

    if (!errand) {
      fail(404, "Errand not found.");
    }

    if (
      errand.status !== "open" ||
      errand.accepted_offer_id ||
      errand.assigned_erander_id ||
      errand.deleted_at
    ) {
      fail(
        409,
        "Only an open errand without an accepted offer can be closed.",
      );
    }

    await client.query(
      `
        UPDATE public.erands
        SET offers_enabled = FALSE,
            updated_at = NOW()
        WHERE id = $1
          AND requested_by = $2
      `,
      [errandId, userId],
    );

    const closedErrand = await getErrandWithItems(
      client,
      errandId,
      userId,
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Offers for this errand have been closed.",
      data: {
        errand: closedErrand,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Failed to roll back errand closure:",
        rollbackError,
      );
    }

    return sendError(res, error);
  } finally {
    client.release();
  }
}


// =========================================================
// DELETE ERRAND — SOFT DELETE
// =========================================================

export async function deleteMyErand(req, res) {
  const pool = getDatabasePool();
  const client = await pool.connect();

  try {
    const userId = req.user?.id;

    if (!userId) {
      fail(401, "Please sign in to delete this errand.");
    }

    const errandId = req.params.id;

    if (!isNonEmptyString(errandId)) {
      fail(400, "A valid errand ID is required.");
    }

    await client.query("BEGIN");

    const currentResult = await client.query(
      `
        SELECT
          id,
          status,
          accepted_offer_id,
          assigned_erander_id,
          requested_by,
          deleted_at
        FROM public.erands
        WHERE id = $1
          AND requested_by = $2
        LIMIT 1
        FOR UPDATE
      `,
      [errandId, userId],
    );

    const currentErrand = currentResult.rows[0];

    if (!currentErrand) {
      fail(404, "Errand not found.");
    }

    if (!isEditableErrand(currentErrand)) {
      fail(
        409,
        "This errand can no longer be deleted because it has been selected, assigned, or is no longer in draft or open status.",
      );
    }

    // Proposals do not prevent deletion.
    // We preserve them and their referenced item records.
    const proposalSubmitters = await getProposalSubmitters(
      client,
      errandId,
    );

    const deleteResult = await client.query(
      `
        UPDATE public.erands
        SET deleted_at = NOW(),
            status = 'cancelled',
            offers_enabled = FALSE,
            updated_at = NOW()
        WHERE id = $1
          AND requested_by = $2
          AND deleted_at IS NULL
          AND status IN ('draft', 'open')
          AND accepted_offer_id IS NULL
          AND assigned_erander_id IS NULL
        RETURNING id
      `,
      [errandId, userId],
    );

    if (deleteResult.rowCount === 0) {
      fail(
        409,
        "This errand could not be deleted because its status has changed.",
      );
    }

    // Historical offer records remain intact; offer submitters are notified
    // immediately after this soft-delete transaction commits.

    await client.query("COMMIT");

    for (const proposerId of proposalSubmitters) {
      notifyUser({
        recipientId: proposerId,
        type: "errand_cancelled",
        title: "An errand you offered on was cancelled",
        body: "The customer deleted this errand. Your offer is no longer active, and no further action is required.",
        actionUrl: "/dashboard/my-offers",
        entityType: "erand",
        entityId: errandId,
        dedupeKey: `errand_cancelled:${errandId}:${proposerId}`,
      }).catch((error) => console.error("Errand cancellation notification failed:", error?.message));
    }

    return res.status(200).json({
      success: true,
      message: "Your errand has been deleted successfully.",
      data: {
        errand_id: errandId,
        deleted: true,
        proposal_submitters_to_notify: proposalSubmitters.length,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Failed to roll back errand deletion:",
        rollbackError,
      );
    }

    return sendError(res, error);
  } finally {
    client.release();
  }
}