import { getDatabasePool } from "../../config/database.js";

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

  console.error("Available errands error:", error);

  return res.status(500).json({
    success: false,
    message: "Unable to retrieve available errands. Please try again.",
  });
}

function parsePositiveInteger(value, fallback, maximum) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new RequestError("Invalid pagination parameters.");
  }

  return Math.min(parsed, maximum);
}

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

const ALLOWED_SORTS = new Set([
  "newest",
  "oldest",
  "budget_high",
  "budget_low",
  "schedule",
]);

export async function listAvailableErrands(req, res) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new RequestError(
        "You must be signed in to browse available errands.",
        401
      );
    }

    const page = parsePositiveInteger(req.query.page, 1, 100000);
    const limit = parsePositiveInteger(req.query.limit, 12, 50);
    const offset = (page - 1) * limit;

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim().slice(0, 120)
        : "";

    const category =
      typeof req.query.category === "string"
        ? req.query.category.trim()
        : "";

    const sort =
      typeof req.query.sort === "string"
        ? req.query.sort.trim()
        : "newest";

    if (category && !ALLOWED_CATEGORIES.has(category)) {
      throw new RequestError("Please select a valid errand category.");
    }

    if (!ALLOWED_SORTS.has(sort)) {
      throw new RequestError("Please select a valid sorting option.");
    }

    const orderBy = {
      newest: "e.created_at DESC",
      oldest: "e.created_at ASC",
      budget_high: "e.estimated_total DESC, e.created_at DESC",
      budget_low: "e.estimated_total ASC, e.created_at DESC",
      schedule:
        "e.scheduled_for ASC NULLS LAST, e.created_at DESC",
    }[sort];

    const values = [userId];
    const conditions = [
      "e.status = 'open'",
      "e.offers_enabled = TRUE",
      "e.requested_by <> $1",
      "e.accepted_offer_id IS NULL",
      "e.agreement_locked_at IS NULL",
      "(e.expires_at IS NULL OR e.expires_at > NOW())",
      `(
        e.max_erander_offers >
        (
          SELECT COUNT(*)
          FROM public.erand_offers counted_offer
          WHERE counted_offer.erand_id = e.id
        )
      )`,
    ];

    if (category) {
      values.push(category);
      conditions.push(`e.category = $${values.length}`);
    }

    if (search) {
      values.push(`%${search.replace(/[\\%_]/g, "\\$&")}%`);
      conditions.push(
        `(
          e.title ILIKE $${values.length} ESCAPE '\\'
          OR e.description ILIKE $${values.length} ESCAPE '\\'
          OR e.reference_code ILIKE $${values.length} ESCAPE '\\'
        )`
      );
    }

    const whereClause = conditions.join("\nAND ");

    const pool = getDatabasePool();
    const client = await pool.connect();

    try {
      const countResult = await client.query(
        `
          SELECT COUNT(*)::INTEGER AS total
          FROM public.erands e
          WHERE ${whereClause}
        `,
        values
      );

      const total = Number(countResult.rows[0]?.total || 0);

      const result = await client.query(
        `
          SELECT
            e.id,
            e.reference_code,
            e.title,
            e.description,
            e.category,
            e.status,
            e.currency_code,
            e.estimated_total,
            e.max_erander_offers,
            e.scheduled_for,
            e.expires_at,
            e.created_at,
            e.updated_at,

            (
              SELECT COUNT(*)::INTEGER
              FROM public.erand_offers offer_count
              WHERE offer_count.erand_id = e.id
            ) AS offer_count,

            COALESCE(
              (
                SELECT JSONB_AGG(
                  JSONB_BUILD_OBJECT(
                    'id', item.id,
                    'item_name', item.item_name,
                    'description', item.description,
                    'quantity', item.quantity,
                    'unit', item.unit,
                    'estimated_unit_price', item.estimated_unit_price,
                    'pricing_type', item.pricing_type,
                    'item_url', item.item_url,
                    'customer_notes', item.customer_notes,
                    'sort_order', item.sort_order
                  )
                  ORDER BY item.sort_order ASC, item.created_at ASC
                )
                FROM public.erand_items item
                WHERE item.erand_id = e.id
              ),
              '[]'::JSONB
            ) AS items

          FROM public.erands e
          WHERE ${whereClause}
          ORDER BY ${orderBy}
          LIMIT $${values.length + 1}
          OFFSET $${values.length + 2}
        `,
        [...values, limit, offset]
      );

      return res.status(200).json({
        success: true,
        data: {
          errands: result.rows,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page * limit < total,
            hasPreviousPage: page > 1,
          },
          filters: {
            search,
            category,
            sort,
          },
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return sendError(res, error);
  }
}