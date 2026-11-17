import { getDatabasePool } from "../../config/database.js";
import { notifyUser } from "../notifications/notification.service.js";

class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

function sendError(res, error) {
  if (error instanceof RequestError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  if (error?.code === "23505") {
    return res.status(409).json({
      success: false,
      message:
        "A conflicting record already exists. You may already have submitted an offer for this errand.",
    });
  }

  if (error?.code === "23503" || error?.code === "23514") {
    return res.status(400).json({
      success: false,
      message:
        "The submitted information conflicts with the current errand or database rules.",
    });
  }

  console.error("ERANDER offer controller error:", error);

  return res.status(500).json({
    success: false,
    message: "Something went wrong while processing the offer.",
  });
}

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function parseMoney(value, fieldName, defaultValue = 0) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const stringValue = String(value).trim();

  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(stringValue)) {
    throw new RequestError(
      `${fieldName} must be a non-negative amount with no more than two decimal places.`
    );
  }

  const amount = Number(stringValue);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new RequestError(`${fieldName} is invalid.`);
  }

  return stringValue;
}

function parseQuantity(value, fieldName = "Quantity") {
  if (value === undefined || value === null || value === "") {
    throw new RequestError(`${fieldName} is required.`);
  }

  const stringValue = String(value).trim();

  if (!/^\d{1,9}(?:\.\d{1,3})?$/.test(stringValue)) {
    throw new RequestError(
      `${fieldName} must be a positive quantity with no more than three decimal places.`
    );
  }

  const quantity = Number(stringValue);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new RequestError(`${fieldName} must be greater than zero.`);
  }

  return stringValue;
}

function parseOptionalText(value, fieldName, maxLength) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new RequestError(`${fieldName} must be text.`);
  }

  const text = value.trim();

  if (text.length > maxLength) {
    throw new RequestError(
      `${fieldName} must not exceed ${maxLength} characters.`
    );
  }

  return text || null;
}

function parseExpiry(value, errandExpiry) {
  if (value === undefined || value === null || value === "") {
    return errandExpiry ?? null;
  }

  const requestedExpiry = new Date(value);

  if (Number.isNaN(requestedExpiry.getTime())) {
    throw new RequestError("The offer expiry date is invalid.");
  }

  if (requestedExpiry.getTime() <= Date.now()) {
    throw new RequestError("The offer expiry must be in the future.");
  }

  if (
    errandExpiry &&
    requestedExpiry.getTime() > new Date(errandExpiry).getTime()
  ) {
    throw new RequestError(
      "An offer cannot expire after the errand itself expires."
    );
  }

  return requestedExpiry.toISOString();
}

async function requireActiveErander(client, userId) {
  const result = await client.query(
    `
      SELECT id, user_roles, account_status
      FROM public.profiles
      WHERE id = $1
      FOR SHARE
    `,
    [userId]
  );

  const profile = result.rows[0];

  if (!profile || profile.account_status !== "active") {
    throw new RequestError(
      "An active account is required to submit or manage offers.",
      403
    );
  }

  const roles = Array.isArray(profile.user_roles)
    ? profile.user_roles
    : [];

  if (!roles.includes("erander")) {
    throw new RequestError(
      "Your account is not authorized to act as an erander.",
      403
    );
  }
}

/**
 * Get only the current items belonging to an errand.
 *
 * IMPORTANT:
 * current_version belongs to the entire errand version history.
 * Item version_number only changes when the item collection changes.
 *
 * Therefore, do not filter items by current_version.
 * is_current is the authoritative indicator of which items
 * belong to the current errand requirements.
 *
 * Historical offer items remain linked to their original item IDs.
 */
async function getErrandItems(client, erandId) {
  const result = await client.query(
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
        version_number,
        is_current
      FROM public.erand_items
      WHERE erand_id = $1
        AND is_current = TRUE
      ORDER BY sort_order ASC, created_at ASC
    `,
    [erandId]
  );

  return result.rows;
}



function validateOfferItems(submittedItems, errandItems) {
  if (submittedItems === undefined) {
    submittedItems = [];
  }

  if (!Array.isArray(submittedItems)) {
    throw new RequestError("Offer items must be provided as an array.");
  }

  if (submittedItems.length > 100) {
    throw new RequestError("An offer cannot contain more than 100 items.");
  }

  if (errandItems.length === 0 && submittedItems.length > 0) {
    throw new RequestError(
      "This errand does not contain itemized requirements."
    );
  }

  if (errandItems.length > 0 && submittedItems.length === 0) {
    throw new RequestError(
      "Provide proposed quantities and prices for the errand's required items."
    );
  }

  const originalIds = new Set(errandItems.map((item) => item.id));
  const submittedIds = new Set();

  const items = submittedItems.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new RequestError(`Offer item ${index + 1} is invalid.`);
    }

    if (!isUuid(item.erand_item_id)) {
      throw new RequestError(
        `Offer item ${index + 1} must reference a valid errand item.`
      );
    }

    if (!originalIds.has(item.erand_item_id)) {
      throw new RequestError(
        "An offer can only include items belonging to the current version of this errand."
      );
    }

    if (submittedIds.has(item.erand_item_id)) {
      throw new RequestError(
        "An offer cannot contain the same errand item more than once."
      );
    }

    submittedIds.add(item.erand_item_id);

    return {
      erand_item_id: item.erand_item_id,
      proposed_quantity: parseQuantity(
        item.proposed_quantity,
        `Quantity for offer item ${index + 1}`
      ),
      proposed_unit_price: parseMoney(
        item.proposed_unit_price,
        `Unit price for offer item ${index + 1}`
      ),
      notes: parseOptionalText(
        item.notes,
        `Notes for offer item ${index + 1}`,
        1000
      ),
    };
  });

  if (submittedIds.size !== originalIds.size) {
    throw new RequestError(
      "An offer must account for every item in the errand."
    );
  }

  return items;
}

/**
 * Retrieve an offer with its original item references.
 *
 * Do not filter these items by is_current or version_number.
 * An existing offer must retain its original item context even
 * after the customer edits the errand.
 */
async function getOfferById(client, offerId) {
  const result = await client.query(
    `
      SELECT
        o.*,
        COALESCE(items.offer_items, '[]'::jsonb) AS items
      FROM public.erand_offers AS o
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'erand_item_id', oi.erand_item_id,
            'proposed_quantity', oi.proposed_quantity,
            'proposed_unit_price', oi.proposed_unit_price,
            'notes', oi.notes,
            'item_name', ei.item_name,
            'item_description', ei.description,
            'original_quantity', ei.quantity,
            'original_unit', ei.unit,
            'original_estimated_unit_price', ei.estimated_unit_price,
            'original_pricing_type', ei.pricing_type,
            'item_version_number', ei.version_number
          )
          ORDER BY ei.sort_order ASC, oi.created_at ASC
        ) AS offer_items
        FROM public.erand_offer_items AS oi
        JOIN public.erand_items AS ei
          ON ei.id = oi.erand_item_id
        WHERE oi.offer_id = o.id
      ) AS items ON TRUE
      WHERE o.id = $1
    `,
    [offerId]
  );

  return result.rows[0] ?? null;
}

/**
 * POST /api/v1/erands/:erandId/offers
 *
 * Submit an offer for an open, non-deleted errand.
 */
export async function createOffer(req, res) {
  const userId = req.user?.id;
  const { erandId } = req.params;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication is required.",
    });
  }

  if (!isUuid(erandId)) {
    return res.status(400).json({
      success: false,
      message: "The errand ID is invalid.",
    });
  }

  const body = req.body ?? {};

  if (
    Object.prototype.hasOwnProperty.call(body, "business_id") &&
    body.business_id !== null &&
    body.business_id !== ""
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Business-submitted offers are not enabled by this endpoint yet.",
    });
  }

  let client;

  try {
    const offerMessage = parseOptionalText(
      body.offer_message,
      "Offer message",
      3000
    );

    const serviceFee = parseMoney(
      body.proposed_service_fee,
      "Service fee"
    );

    const deliveryFee = parseMoney(
      body.proposed_delivery_fee,
      "Delivery fee"
    );

    const otherFees = parseMoney(
      body.proposed_other_fees,
      "Other fees"
    );

    client = await getDatabasePool().connect();

    await client.query("BEGIN");

    await requireActiveErander(client, userId);

    const errandResult = await client.query(
      `
        SELECT
          id,
          requested_by,
          business_id,
          status,
          currency_code,
          current_version,
          deleted_at,
          offers_enabled,
          expires_at,
          max_erander_offers,
          accepted_offer_id,
          agreement_locked_at
        FROM public.erands
        WHERE id = $1
        FOR UPDATE
      `,
      [erandId]
    );

    const errand = errandResult.rows[0];

    if (!errand) {
      throw new RequestError("This errand could not be found.", 404);
    }

    if (errand.deleted_at) {
      throw new RequestError(
        "This errand has been deleted by the customer and is no longer accepting offers.",
        409
      );
    }

    if (errand.requested_by === userId) {
      throw new RequestError(
        "You cannot submit an offer for your own errand.",
        403
      );
    }

    if (errand.status !== "open" || !errand.offers_enabled) {
      throw new RequestError(
        "This errand is no longer accepting offers.",
        409
      );
    }

    if (
      errand.expires_at &&
      new Date(errand.expires_at).getTime() <= Date.now()
    ) {
      throw new RequestError(
        "This errand has expired and is no longer accepting offers.",
        409
      );
    }

    if (errand.accepted_offer_id || errand.agreement_locked_at) {
      throw new RequestError(
        "An agreement has already been selected for this errand.",
        409
      );
    }

    if (
      !Number.isInteger(errand.current_version) ||
      errand.current_version < 1
    ) {
      throw new RequestError(
        "The current errand version could not be determined.",
        409
      );
    }

    const currentItems = await getErrandItems(
      client,
      erandId
    );

    const submittedItems = validateOfferItems(
      body.items,
      currentItems
    );

    const countResult = await client.query(
      `
        SELECT COUNT(*)::integer AS offer_count
        FROM public.erand_offers
        WHERE erand_id = $1
      `,
      [erandId]
    );

    if (
      countResult.rows[0].offer_count >= errand.max_erander_offers
    ) {
      throw new RequestError(
        "This errand has reached its offer limit.",
        409
      );
    }

    const expiresAt = parseExpiry(body.expires_at, errand.expires_at);

    const offerResult = await client.query(
      `
        INSERT INTO public.erand_offers (
          erand_id,
          offered_by,
          business_id,
          offer_message,
          proposed_item_total,
          proposed_service_fee,
          proposed_delivery_fee,
          proposed_other_fees,
          currency_code,
          status,
          expires_at
        )
        VALUES (
          $1, $2, NULL, $3, 0, $4, $5, $6, $7, 'pending', $8
        )
        RETURNING *
      `,
      [
        erandId,
        userId,
        offerMessage,
        serviceFee,
        deliveryFee,
        otherFees,
        errand.currency_code,
        expiresAt,
      ]
    );

    const offer = offerResult.rows[0];

    for (const item of submittedItems) {
      await client.query(
        `
          INSERT INTO public.erand_offer_items (
            offer_id,
            erand_item_id,
            proposed_quantity,
            proposed_unit_price,
            notes
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          offer.id,
          item.erand_item_id,
          item.proposed_quantity,
          item.proposed_unit_price,
          item.notes,
        ]
      );
    }

    const totalResult = await client.query(
      `
        SELECT
          COALESCE(
            SUM(proposed_quantity * proposed_unit_price),
            0
          )::numeric(14, 2) AS item_total
        FROM public.erand_offer_items
        WHERE offer_id = $1
      `,
      [offer.id]
    );

    const itemTotal = totalResult.rows[0].item_total;

    const updatedOfferResult = await client.query(
      `
        UPDATE public.erand_offers
        SET
          proposed_item_total = $2,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [offer.id, itemTotal]
    );

    const completeOffer = await getOfferById(
      client,
      updatedOfferResult.rows[0].id
    );

    await client.query("COMMIT");

    notifyUser({
      recipientId: errand.requested_by,
      type: "offer_received",
      title: "You received a new offer",
      body: `An erander has submitted an offer for “${errand.title || "your errand"}”. Review the offer to compare the details.`,
      actionUrl: "/dashboard/erands",
      entityType: "erand",
      entityId: erandId,
      data: { offerId: offer.id },
      dedupeKey: `offer_received:${offer.id}`,
    }).catch((error) => console.error("Offer notification failed:", error?.message));

    return res.status(201).json({
      success: true,
      message: "Your offer has been submitted.",
      data: {
        offer: completeOffer,
      },
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    return sendError(res, error);
  } finally {
    client?.release();
  }
}

/**
 * GET /api/v1/erands/:erandId/offers
 *
 * List offers on an errand owned by the authenticated customer.
 */
export async function listErrandOffers(req, res) {
  const userId = req.user?.id;
  const { erandId } = req.params;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication is required.",
    });
  }

  if (!isUuid(erandId)) {
    return res.status(400).json({
      success: false,
      message: "The errand ID is invalid.",
    });
  }

  try {
    const pool = getDatabasePool();

    const errandResult = await pool.query(
      `
        SELECT
          id,
          requested_by,
          deleted_at
        FROM public.erands
        WHERE id = $1
      `,
      [erandId]
    );

    const errand = errandResult.rows[0];

    if (!errand) {
      throw new RequestError("This errand could not be found.", 404);
    }

    if (errand.requested_by !== userId) {
      throw new RequestError(
        "You are not authorized to view offers for this errand.",
        403
      );
    }

    const result = await pool.query(
      `
        SELECT
          o.*,
          p.display_name AS erander_display_name,
          p.first_name AS erander_first_name,
          p.last_name AS erander_last_name,
          p.avatar_url AS erander_avatar_url,
          COALESCE(items.offer_items, '[]'::jsonb) AS items
        FROM public.erand_offers AS o
        JOIN public.profiles AS p
          ON p.id = o.offered_by
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', oi.id,
              'erand_item_id', oi.erand_item_id,
              'item_name', ei.item_name,
              'description', ei.description,
              'quantity', ei.quantity,
              'unit', ei.unit,
              'estimated_unit_price', ei.estimated_unit_price,
              'pricing_type', ei.pricing_type,
              'version_number', ei.version_number,
              'proposed_quantity', oi.proposed_quantity,
              'proposed_unit_price', oi.proposed_unit_price,
              'notes', oi.notes
            )
            ORDER BY ei.sort_order ASC, oi.created_at ASC
          ) AS offer_items
          FROM public.erand_offer_items AS oi
          JOIN public.erand_items AS ei
            ON ei.id = oi.erand_item_id
          WHERE oi.offer_id = o.id
        ) AS items ON TRUE
        WHERE o.erand_id = $1
        ORDER BY
          CASE WHEN o.status = 'pending' THEN 0 ELSE 1 END,
          o.created_at DESC
      `,
      [erandId]
    );

    return res.status(200).json({
      success: true,
      message: "Offers retrieved successfully.",
      data: {
        errand: {
          id: errand.id,
          deleted_at: errand.deleted_at,
          is_deleted: Boolean(errand.deleted_at),
        },
        offers: result.rows,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * GET /api/v1/erand-offers/mine
 *
 * List offers submitted by the authenticated erander.
 *
 * Deleted errands remain visible here so the erander can see
 * the status of their proposal and withdraw it if it is pending.
 *
 * Historical offer items always reference their original item
 * records, regardless of the errand's current version.
 */
export async function listMyOffers(req, res) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication is required.",
    });
  }

  try {
    const result = await getDatabasePool().query(
      `
        SELECT
          o.*,

          e.reference_code AS errand_reference_code,
          e.title AS errand_title,
          e.category AS errand_category,
          e.status AS errand_status,
          e.deleted_at AS errand_deleted_at,

          COALESCE(items.offer_items, '[]'::jsonb) AS items,

          jsonb_build_object(
            'id',                  e.id,
            'reference_code',      e.reference_code,
            'title',               e.title,
            'category',            e.category,
            'status',              e.status,
            'description',         e.description,
            'scheduled_for',       e.scheduled_for,
            'expires_at',          e.expires_at,
            'customer_notes',      e.customer_notes,
            'location_snapshot',   e.location_snapshot,
            'location_address_id', e.location_address_id,
            'estimated_total',     e.estimated_total,
            'currency_code',       e.currency_code,
            'max_erander_offers',  e.max_erander_offers,
            'offers_enabled',      e.offers_enabled,
            'current_version',     e.current_version,
            'requested_by',        e.requested_by,
            'created_at',          e.created_at,
            'deleted_at',          e.deleted_at,
            'is_deleted',          (e.deleted_at IS NOT NULL)
          ) AS errand

        FROM public.erand_offers AS o

        JOIN public.erands AS e
          ON e.id = o.erand_id

        LEFT JOIN LATERAL (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id',                     oi.id,
              'erand_item_id',          oi.erand_item_id,
              'item_name',              ei.item_name,
              'description',            ei.description,
              'quantity',               ei.quantity,
              'unit',                   ei.unit,
              'estimated_unit_price',   ei.estimated_unit_price,
              'pricing_type',           ei.pricing_type,
              'item_url',               ei.item_url,
              'customer_notes',         ei.customer_notes,
              'sort_order',             ei.sort_order,
              'version_number',         ei.version_number,
              'proposed_quantity',      oi.proposed_quantity,
              'proposed_unit_price',    oi.proposed_unit_price,
              'notes',                  oi.notes
            )
            ORDER BY ei.sort_order ASC, oi.created_at ASC
          ) AS offer_items

          FROM public.erand_offer_items AS oi

          JOIN public.erand_items AS ei
            ON ei.id = oi.erand_item_id

          WHERE oi.offer_id = o.id
        ) AS items ON TRUE

        WHERE o.offered_by = $1

        ORDER BY o.created_at DESC
      `,
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: "Your offers were retrieved successfully.",
      data: {
        offers: result.rows,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * POST /api/v1/erand-offers/:offerId/withdraw
 *
 * Withdraw a pending offer submitted by the authenticated erander.
 *
 * Special case:
 * If the customer has deleted the errand, the erander can still
 * withdraw their pending offer even if the errand's lifecycle
 * status is no longer "open".
 *
 * The offer is retained as withdrawn for historical records.
 */
export async function withdrawOffer(req, res) {
  const userId = req.user?.id;
  const { offerId } = req.params;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication is required.",
    });
  }

  if (!isUuid(offerId)) {
    return res.status(400).json({
      success: false,
      message: "The offer ID is invalid.",
    });
  }

  let client;

  try {
    client = await getDatabasePool().connect();

    await client.query("BEGIN");

    const lookup = await client.query(
      `
        SELECT erand_id
        FROM public.erand_offers
        WHERE id = $1
      `,
      [offerId]
    );

    const initialOffer = lookup.rows[0];

    if (!initialOffer) {
      throw new RequestError("This offer could not be found.", 404);
    }

    const errandResult = await client.query(
      `
        SELECT
          id,
          status,
          deleted_at,
          accepted_offer_id,
          agreement_locked_at
        FROM public.erands
        WHERE id = $1
        FOR UPDATE
      `,
      [initialOffer.erand_id]
    );

    const errand = errandResult.rows[0];

    if (!errand) {
      throw new RequestError("This errand could not be found.", 404);
    }

    const offerResult = await client.query(
      `
        SELECT *
        FROM public.erand_offers
        WHERE id = $1
          AND erand_id = $2
        FOR UPDATE
      `,
      [offerId, errand.id]
    );

    const offer = offerResult.rows[0];

    if (!offer || offer.offered_by !== userId) {
      throw new RequestError(
        "You are not authorized to withdraw this offer.",
        403
      );
    }

    if (offer.status !== "pending") {
      throw new RequestError(
        "Only pending offers can be withdrawn.",
        409
      );
    }

    if (errand.accepted_offer_id || errand.agreement_locked_at) {
      throw new RequestError(
        "This offer can no longer be withdrawn because an agreement has already been selected.",
        409
      );
    }

    /*
     * A deleted errand is a special case.
     * The erander may withdraw their pending offer even if the
     * errand's lifecycle status is no longer "open".
     */
    if (!errand.deleted_at && errand.status !== "open") {
      throw new RequestError(
        "This offer can no longer be withdrawn because the errand has progressed.",
        409
      );
    }

    await client.query(
      `
        UPDATE public.erand_offers
        SET
          status = 'withdrawn',
          responded_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `,
      [offerId]
    );

    const updatedOffer = await getOfferById(client, offerId);

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: errand.deleted_at
        ? "Your offer has been withdrawn from the deleted errand."
        : "Your offer has been withdrawn.",
      data: {
        offer: updatedOffer,
      },
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    return sendError(res, error);
  } finally {
    client?.release();
  }
}

/**
 * POST /api/v1/erand-offers/:offerId/reject
 *
 * Reject a pending offer on the authenticated customer's errand.
 *
 * Offers cannot be rejected after the customer has deleted
 * the errand.
 */
export async function rejectOffer(req, res) {
  const userId = req.user?.id;
  const { offerId } = req.params;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication is required.",
    });
  }

  if (!isUuid(offerId)) {
    return res.status(400).json({
      success: false,
      message: "The offer ID is invalid.",
    });
  }

  let client;

  try {
    client = await getDatabasePool().connect();

    await client.query("BEGIN");

    const lookup = await client.query(
      `
        SELECT erand_id
        FROM public.erand_offers
        WHERE id = $1
      `,
      [offerId]
    );

    const initialOffer = lookup.rows[0];

    if (!initialOffer) {
      throw new RequestError("This offer could not be found.", 404);
    }

    const errandResult = await client.query(
      `
        SELECT
          id,
          requested_by,
          status,
          deleted_at,
          accepted_offer_id,
          agreement_locked_at
        FROM public.erands
        WHERE id = $1
        FOR UPDATE
      `,
      [initialOffer.erand_id]
    );

    const errand = errandResult.rows[0];

    if (!errand) {
      throw new RequestError("This errand could not be found.", 404);
    }

    if (errand.requested_by !== userId) {
      throw new RequestError(
        "You are not authorized to respond to offers for this errand.",
        403
      );
    }

    if (errand.deleted_at) {
      throw new RequestError(
        "This errand has been deleted. Its offers can no longer be rejected.",
        409
      );
    }

    if (
      errand.status !== "open" ||
      errand.accepted_offer_id ||
      errand.agreement_locked_at
    ) {
      throw new RequestError(
        "Offers can no longer be rejected for this errand.",
        409
      );
    }

    const offerResult = await client.query(
      `
        SELECT *
        FROM public.erand_offers
        WHERE id = $1
          AND erand_id = $2
        FOR UPDATE
      `,
      [offerId, errand.id]
    );

    const offer = offerResult.rows[0];

    if (!offer || offer.status !== "pending") {
      throw new RequestError(
        "This offer is no longer awaiting a response.",
        409
      );
    }

    await client.query(
      `
        UPDATE public.erand_offers
        SET
          status = 'rejected',
          responded_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `,
      [offerId]
    );

    const updatedOffer = await getOfferById(client, offerId);

    await client.query("COMMIT");

    notifyUser({
      recipientId: offer.offered_by,
      type: "offer_rejected",
      title: "Your offer was not selected",
      body: "The customer has rejected your offer. You can continue exploring other errands.",
      actionUrl: "/dashboard/my-offers",
      entityType: "erand",
      entityId: errand.id,
      data: { offerId: offer.id },
      dedupeKey: `offer_rejected:${offer.id}`,
    }).catch((error) => console.error("Offer rejection notification failed:", error?.message));

    return res.status(200).json({
      success: true,
      message: "The offer has been rejected.",
      data: {
        offer: updatedOffer,
      },
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    return sendError(res, error);
  } finally {
    client?.release();
  }
}

/**
 * POST /api/v1/erand-offers/:offerId/accept
 *
 * Accept one pending offer and establish the selected agreement.
 *
 * Offers cannot be accepted after the customer has deleted
 * the errand.
 */
export async function acceptOffer(req, res) {
  const userId = req.user?.id;
  const { offerId } = req.params;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication is required.",
    });
  }

  if (!isUuid(offerId)) {
    return res.status(400).json({
      success: false,
      message: "The offer ID is invalid.",
    });
  }

  let client;

  try {
    client = await getDatabasePool().connect();

    await client.query("BEGIN");

    const lookup = await client.query(
      `
        SELECT erand_id
        FROM public.erand_offers
        WHERE id = $1
      `,
      [offerId]
    );

    const initialOffer = lookup.rows[0];

    if (!initialOffer) {
      throw new RequestError("This offer could not be found.", 404);
    }

    const errandResult = await client.query(
      `
        SELECT *
        FROM public.erands
        WHERE id = $1
        FOR UPDATE
      `,
      [initialOffer.erand_id]
    );

    const errand = errandResult.rows[0];

    if (!errand) {
      throw new RequestError("This errand could not be found.", 404);
    }

    if (errand.requested_by !== userId) {
      throw new RequestError(
        "You are not authorized to accept offers for this errand.",
        403
      );
    }

    if (errand.deleted_at) {
      throw new RequestError(
        "This errand has been deleted. Its offers can no longer be accepted.",
        409
      );
    }

    if (
      errand.status !== "open" ||
      !errand.offers_enabled ||
      errand.accepted_offer_id ||
      errand.agreement_locked_at
    ) {
      throw new RequestError(
        "This errand is no longer available for offer acceptance.",
        409
      );
    }

    if (
      errand.expires_at &&
      new Date(errand.expires_at).getTime() <= Date.now()
    ) {
      throw new RequestError(
        "This errand has expired and cannot accept an offer.",
        409
      );
    }

    const offerResult = await client.query(
      `
        SELECT *
        FROM public.erand_offers
        WHERE id = $1
          AND erand_id = $2
        FOR UPDATE
      `,
      [offerId, errand.id]
    );

    const offer = offerResult.rows[0];

    if (!offer || offer.status !== "pending") {
      throw new RequestError(
        "This offer is no longer available for acceptance.",
        409
      );
    }

    if (
      offer.expires_at &&
      new Date(offer.expires_at).getTime() <= Date.now()
    ) {
      await client.query(
        `
          UPDATE public.erand_offers
          SET
            status = 'expired',
            responded_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
        `,
        [offerId]
      );

      await client.query("COMMIT");

      return res.status(409).json({
        success: false,
        message: "This offer has expired.",
      });
    }

    const supersededOffersResult = await client.query(
      `SELECT id, offered_by FROM public.erand_offers
        WHERE erand_id = $1 AND id <> $2 AND status = 'pending'`,
      [errand.id, offerId]
    );
    const supersededOffers = supersededOffersResult.rows;

    await client.query(
      `
        UPDATE public.erand_offers
        SET
          status = 'superseded',
          responded_at = NOW(),
          updated_at = NOW()
        WHERE erand_id = $1
          AND id <> $2
          AND status = 'pending'
      `,
      [errand.id, offerId]
    );

    await client.query(
      `
        UPDATE public.erand_offers
        SET
          status = 'accepted',
          responded_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `,
      [offerId]
    );

    await client.query(
      `
        UPDATE public.erands
        SET
          accepted_offer_id = $2,
          assigned_erander_id = $3,
          agreement_accepted_at = NOW(),
          status = 'awaiting_funding',
          updated_at = NOW()
        WHERE id = $1
      `,
      [errand.id, offer.id, offer.offered_by]
    );

    await client.query(
      `SELECT public.reconcile_erand_funding($1)`,
      [errand.id]
    );

    const updatedOffer = await getOfferById(client, offerId);

    const updatedErrandResult = await client.query(
      `
        SELECT
          id,
          reference_code,
          status,
          accepted_offer_id,
          assigned_erander_id,
          agreement_accepted_at,
          agreement_locked_at
        FROM public.erands
        WHERE id = $1
      `,
      [errand.id]
    );

    await client.query("COMMIT");

    for (const supersededOffer of supersededOffers) {
      notifyUser({
        recipientId: supersededOffer.offered_by,
        type: "offer_not_selected",
        title: "Another offer was selected",
        body: "The customer selected another erander for this errand. You can continue exploring other opportunities.",
        actionUrl: "/dashboard/my-offers",
        entityType: "erand",
        entityId: errand.id,
        data: { offerId: supersededOffer.id },
        dedupeKey: `offer_not_selected:${supersededOffer.id}`,
      }).catch((error) => console.error("Superseded offer notification failed:", error?.message));
    }

    notifyUser({
      recipientId: offer.offered_by,
      type: "offer_accepted_assignment",
      title: "Your offer was accepted — you're assigned",
      body: "The customer accepted your offer. You are now assigned to this errand; you do not need to accept the assignment again.",
      actionUrl: "/dashboard/erands",
      entityType: "erand",
      entityId: errand.id,
      data: { offerId: offer.id },
      dedupeKey: `offer_accepted_assignment:${offer.id}`,
    }).catch((error) => console.error("Offer acceptance notification failed:", error?.message));

    return res.status(200).json({
      success: true,
      message:
        "The offer has been accepted. The errand is proceeding through funding reconciliation.",
      data: {
        offer: updatedOffer,
        errand: updatedErrandResult.rows[0],
      },
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    return sendError(res, error);
  } finally {
    client?.release();
  }
}