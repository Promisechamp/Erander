import { getDatabasePool } from "../../config/database.js";

import {
  validateCreateTicket,
  validateMessage,
  validateAdminTicketUpdate,
  validateUUID,
} from "./support.validation.js";

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 15;

function getUserId(req) {
  return req.user?.id;
}

function getAdminId(req) {
  return req.user?.id;
}

function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

function getPagination(query) {
  const page = Math.max(
    1,
    Number.parseInt(query.page, 10) || 1
  );

  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(
      1,
      Number.parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE
    )
  );

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

function normalizeAttachments(attachments = []) {
  return JSON.stringify(attachments);
}

function isValidUserAttachmentPath(attachments, userId) {
  return attachments.every((attachment) => {
    const path = attachment.path.replace(/^\/+/, "");

    return (
      path.startsWith(`${userId}/`) &&
      !path.includes("..")
    );
  });
}

async function getProfile(userId) {
  const db = getDatabasePool();

  const result = await db.query(
    `
      SELECT
        id,
        first_name,
        last_name,
        display_name,
        user_roles,
        account_status
      FROM public.profiles
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function getOwnedTicket(ticketId, userId) {
  const db = getDatabasePool();

  const result = await db.query(
    `
      SELECT *
      FROM public.support_tickets
      WHERE id = $1
        AND user_id = $2
      LIMIT 1
    `,
    [ticketId, userId]
  );

  return result.rows[0] || null;
}


// ============================================================
// CUSTOMER / ERANDER
// ============================================================

/**
 * Create a support ticket or report an errand issue.
 *
 * POST /support/tickets
 */
export async function createTicket(req, res, next) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return sendError(res, 401, "Authentication required.");
    }

    const validation = validateCreateTicket(req.body);

    if (!validation.valid) {
      return sendError(res, 400, validation.message);
    }

    const {
      ticket_type,
      subject,
      description,
      category,
      errand_id,
      attachments = [],
    } = req.body;

    const profile = await getProfile(userId);

    if (!profile) {
      return sendError(res, 404, "Your profile could not be found.");
    }

    if (profile.account_status !== "active") {
      return sendError(
        res,
        403,
        "Your account cannot submit support tickets."
      );
    }

    if (
      !isValidUserAttachmentPath(attachments, userId)
    ) {
      return sendError(
        res,
        400,
        "Invalid attachment storage path."
      );
    }

    const db = getDatabasePool();

    if (errand_id) {
      const errandResult = await db.query(
        `
          SELECT
            id,
            requested_by,
            assigned_erander_id
          FROM public.erands
          WHERE id = $1
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [errand_id]
      );

      const errand = errandResult.rows[0];

      if (!errand) {
        return sendError(res, 404, "Errand not found.");
      }

      const isInvolved =
        errand.requested_by === userId ||
        errand.assigned_erander_id === userId;

      if (!isInvolved) {
        return sendError(
          res,
          403,
          "You cannot report an issue against this errand."
        );
      }
    }

    const result = await db.query(
      `
        INSERT INTO public.support_tickets (
          user_id,
          errand_id,
          ticket_type,
          subject,
          description,
          category,
          priority,
          status,
          attachments
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          'normal',
          'open',
          $7::jsonb
        )
        RETURNING *
      `,
      [
        userId,
        errand_id || null,
        ticket_type,
        subject.trim(),
        description.trim(),
        category,
        normalizeAttachments(attachments),
      ]
    );

    const ticket = result.rows[0];

    return res.status(201).json({
      success: true,
      message: ticket_type === "issue"
        ? "Your issue report has been submitted successfully."
        : "Your support ticket has been created successfully.",
      data: {
        ticket,
      },
    });
  } catch (error) {
    next(error);
  }
}


/**
 * Get authenticated user's tickets.
 *
 * GET /support/tickets
 */
export async function getMyTickets(req, res, next) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return sendError(res, 401, "Authentication required.");
    }

    const { page, limit, offset } = getPagination(req.query);

    const {
      status,
      ticket_type,
    } = req.query;

    const db = getDatabasePool();

    const conditions = ["t.user_id = $1"];
    const values = [userId];

    if (status) {
      values.push(status);
      conditions.push(`t.status = $${values.length}`);
    }

    if (ticket_type) {
      values.push(ticket_type);
      conditions.push(`t.ticket_type = $${values.length}`);
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await db.query(
      `
        SELECT COUNT(*)::integer AS total
        FROM public.support_tickets t
        WHERE ${whereClause}
      `,
      values
    );

    const total = countResult.rows[0].total;

    const result = await db.query(
      `
        SELECT
          t.*,

          (
            SELECT jsonb_build_object(
              'message', m.message,
              'sender_type', m.sender_type,
              'created_at', m.created_at
            )
            FROM public.support_messages m
            WHERE m.ticket_id = t.id
              AND m.is_internal = FALSE
            ORDER BY m.created_at DESC
            LIMIT 1
          ) AS latest_message

        FROM public.support_tickets t

        WHERE ${whereClause}

        ORDER BY t.updated_at DESC

        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
      `,
      [...values, limit, offset]
    );

    return res.status(200).json({
      success: true,
      data: {
        tickets: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}


/**
 * Get a user's ticket details and public conversation.
 *
 * GET /support/tickets/:ticketId
 */
export async function getTicketDetails(req, res, next) {
  try {
    const userId = getUserId(req);
    const { ticketId } = req.params;

    if (!validateUUID(ticketId)) {
      return sendError(res, 400, "Invalid ticket reference.");
    }

    const ticket = await getOwnedTicket(ticketId, userId);

    if (!ticket) {
      return sendError(res, 404, "Support ticket not found.");
    }

    const db = getDatabasePool();

    const messagesResult = await db.query(
      `
        SELECT
          id,
          ticket_id,
          sender_id,
          sender_type,
          message,
          attachments,
          created_at
        FROM public.support_messages
        WHERE ticket_id = $1
          AND is_internal = FALSE
        ORDER BY created_at ASC
      `,
      [ticketId]
    );

    return res.status(200).json({
      success: true,
      data: {
        ticket,
        messages: messagesResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
}


/**
 * Send a customer/erander message.
 *
 * POST /support/tickets/:ticketId/messages
 */
export async function sendTicketMessage(req, res, next) {
  try {
    const userId = getUserId(req);
    const { ticketId } = req.params;

    if (!validateUUID(ticketId)) {
      return sendError(res, 400, "Invalid ticket reference.");
    }

    const validation = validateMessage(req.body);

    if (!validation.valid) {
      return sendError(res, 400, validation.message);
    }

    const ticket = await getOwnedTicket(ticketId, userId);

    if (!ticket) {
      return sendError(res, 404, "Support ticket not found.");
    }

    if (ticket.status === "closed") {
      return sendError(
        res,
        409,
        "This ticket is closed and can no longer receive replies."
      );
    }

    const profile = await getProfile(userId);

    if (!profile || profile.account_status !== "active") {
      return sendError(res, 403, "Your account cannot send messages.");
    }

    const requestedSenderType = req.body.sender_type;

    const roles = Array.isArray(profile.user_roles)
      ? profile.user_roles
      : [];

    if (
      !["customer", "erander"].includes(requestedSenderType) ||
      !roles.includes(requestedSenderType)
    ) {
      return sendError(
        res,
        403,
        "You cannot send a message using this account role."
      );
    }

    const {
      message,
      attachments = [],
    } = req.body;

    if (
      !isValidUserAttachmentPath(attachments, userId)
    ) {
      return sendError(
        res,
        400,
        "Invalid attachment storage path."
      );
    }

    const db = getDatabasePool();

    const client = await db.connect();

    try {
      await client.query("BEGIN");

      const insertedMessage = await client.query(
        `
          INSERT INTO public.support_messages (
            ticket_id,
            sender_id,
            sender_type,
            message,
            attachments,
            is_internal
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, FALSE)
          RETURNING *
        `,
        [
          ticketId,
          userId,
          requestedSenderType,
          message.trim(),
          normalizeAttachments(attachments),
        ]
      );

      await client.query(
        `
          UPDATE public.support_tickets
          SET
            status = CASE
              WHEN status = 'resolved' THEN 'open'
              WHEN status = 'awaiting_user' THEN 'in_progress'
              ELSE status
            END
          WHERE id = $1
        `,
        [ticketId]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "Your reply has been sent.",
        data: {
          message: insertedMessage.rows[0],
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
}


// ============================================================
// ADMIN
// ============================================================

/**
 * Get all support tickets.
 *
 * GET /support/admin/tickets
 */
export async function getAllTickets(req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req.query);

    const {
      status,
      priority,
      ticket_type,
      category,
      search,
    } = req.query;

    const db = getDatabasePool();

    const conditions = ["1 = 1"];
    const values = [];

    if (status) {
      values.push(status);
      conditions.push(`t.status = $${values.length}`);
    }

    if (priority) {
      values.push(priority);
      conditions.push(`t.priority = $${values.length}`);
    }

    if (ticket_type) {
      values.push(ticket_type);
      conditions.push(`t.ticket_type = $${values.length}`);
    }

    if (category) {
      values.push(category);
      conditions.push(`t.category = $${values.length}`);
    }

    if (search) {
      values.push(`%${search.trim()}%`);

      conditions.push(`
        (
          t.ticket_number ILIKE $${values.length}
          OR t.subject ILIKE $${values.length}
        )
      `);
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await db.query(
      `
        SELECT COUNT(*)::integer AS total
        FROM public.support_tickets t
        WHERE ${whereClause}
      `,
      values
    );

    const total = countResult.rows[0].total;

    const result = await db.query(
      `
        SELECT
          t.*,

          jsonb_build_object(
            'id', p.id,
            'first_name', p.first_name,
            'last_name', p.last_name,
            'display_name', p.display_name,
            'avatar_url', p.avatar_url
          ) AS user,

          (
            SELECT COUNT(*)::integer
            FROM public.support_messages m
            WHERE m.ticket_id = t.id
              AND m.is_internal = FALSE
          ) AS message_count,

          (
            SELECT jsonb_build_object(
              'message', m.message,
              'sender_type', m.sender_type,
              'created_at', m.created_at
            )
            FROM public.support_messages m
            WHERE m.ticket_id = t.id
              AND m.is_internal = FALSE
            ORDER BY m.created_at DESC
            LIMIT 1
          ) AS latest_message

        FROM public.support_tickets t

        INNER JOIN public.profiles p
          ON p.id = t.user_id

        WHERE ${whereClause}

        ORDER BY
          CASE t.priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
          END,
          t.updated_at DESC

        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
      `,
      [...values, limit, offset]
    );

    return res.status(200).json({
      success: true,
      data: {
        tickets: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}


/**
 * Get complete ticket details for admin.
 * Includes internal notes.
 *
 * GET /support/admin/tickets/:ticketId
 */
export async function adminGetTicketDetails(req, res, next) {
  try {
    const { ticketId } = req.params;

    if (!validateUUID(ticketId)) {
      return sendError(res, 400, "Invalid ticket reference.");
    }

    const db = getDatabasePool();

    const ticketResult = await db.query(
      `
        SELECT
          t.*,

          jsonb_build_object(
            'id', p.id,
            'first_name', p.first_name,
            'last_name', p.last_name,
            'other_names', p.other_names,
            'display_name', p.display_name,
            'avatar_url', p.avatar_url,
            'phone', p.phone,
            'user_roles', p.user_roles
          ) AS user,

          CASE
            WHEN e.id IS NULL THEN NULL
            ELSE jsonb_build_object(
              'id', e.id,
              'reference_code', e.reference_code,
              'title', e.title,
              'status', e.status,
              'requested_by', e.requested_by,
              'assigned_erander_id', e.assigned_erander_id
            )
          END AS errand

        FROM public.support_tickets t

        INNER JOIN public.profiles p
          ON p.id = t.user_id

        LEFT JOIN public.erands e
          ON e.id = t.errand_id

        WHERE t.id = $1

        LIMIT 1
      `,
      [ticketId]
    );

    const ticket = ticketResult.rows[0];

    if (!ticket) {
      return sendError(res, 404, "Support ticket not found.");
    }

    const messagesResult = await db.query(
      `
        SELECT
          m.*,

          CASE
            WHEN p.id IS NULL THEN NULL
            ELSE jsonb_build_object(
              'id', p.id,
              'first_name', p.first_name,
              'last_name', p.last_name,
              'display_name', p.display_name,
              'avatar_url', p.avatar_url
            )
          END AS sender

        FROM public.support_messages m

        LEFT JOIN public.profiles p
          ON p.id = m.sender_id

        WHERE m.ticket_id = $1

        ORDER BY m.created_at ASC
      `,
      [ticketId]
    );

    return res.status(200).json({
      success: true,
      data: {
        ticket,
        messages: messagesResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
}


/**
 * Admin updates ticket status and priority.
 *
 * PATCH /support/admin/tickets/:ticketId
 */
export async function adminUpdateTicket(req, res, next) {
  try {
    const { ticketId } = req.params;

    if (!validateUUID(ticketId)) {
      return sendError(res, 400, "Invalid ticket reference.");
    }

    const validation = validateAdminTicketUpdate(req.body);

    if (!validation.valid) {
      return sendError(res, 400, validation.message);
    }

    const {
      status,
      priority,
    } = req.body;

    const db = getDatabasePool();

    const updates = [];
    const values = [ticketId];

    if (status !== undefined) {
      values.push(status);
      updates.push(`status = $${values.length}`);
    }

    if (priority !== undefined) {
      values.push(priority);
      updates.push(`priority = $${values.length}`);
    }

    const result = await db.query(
      `
        UPDATE public.support_tickets

        SET ${updates.join(", ")}

        WHERE id = $1

        RETURNING *
      `,
      values
    );

    if (!result.rows.length) {
      return sendError(res, 404, "Support ticket not found.");
    }

    return res.status(200).json({
      success: true,
      message: "Ticket updated successfully.",
      data: {
        ticket: result.rows[0],
      },
    });
  } catch (error) {
    next(error);
  }
}


/**
 * Admin replies to a ticket.
 *
 * POST /support/admin/tickets/:ticketId/reply
 */
export async function adminReplyToTicket(req, res, next) {
  try {
    const adminId = getAdminId(req);
    const { ticketId } = req.params;

    if (!validateUUID(ticketId)) {
      return sendError(res, 400, "Invalid ticket reference.");
    }

    const validation = validateMessage(req.body);

    if (!validation.valid) {
      return sendError(res, 400, validation.message);
    }

    const db = getDatabasePool();

    const ticketResult = await db.query(
      `
        SELECT id, status
        FROM public.support_tickets
        WHERE id = $1
        LIMIT 1
      `,
      [ticketId]
    );

    const ticket = ticketResult.rows[0];

    if (!ticket) {
      return sendError(res, 404, "Support ticket not found.");
    }

    if (ticket.status === "closed") {
      return sendError(
        res,
        409,
        "This ticket is closed."
      );
    }

    const profile = await getProfile(adminId);

    if (!profile) {
      return sendError(
        res,
        409,
        "The administrator account must have a profile before sending support replies."
      );
    }

    const {
      message,
      attachments = [],
    } = req.body;

    if (
      !isValidUserAttachmentPath(attachments, adminId)
    ) {
      return sendError(
        res,
        400,
        "Invalid attachment storage path."
      );
    }

    const client = await db.connect();

    try {
      await client.query("BEGIN");

      const messageResult = await client.query(
        `
          INSERT INTO public.support_messages (
            ticket_id,
            sender_id,
            sender_type,
            message,
            attachments,
            is_internal
          )
          VALUES ($1, $2, 'admin', $3, $4::jsonb, FALSE)
          RETURNING *
        `,
        [
          ticketId,
          adminId,
          message.trim(),
          normalizeAttachments(attachments),
        ]
      );

      await client.query(
        `
          UPDATE public.support_tickets
          SET status = 'awaiting_user'
          WHERE id = $1
        `,
        [ticketId]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "Your response has been sent.",
        data: {
          message: messageResult.rows[0],
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
}


/**
 * Admin adds private internal note.
 *
 * POST /support/admin/tickets/:ticketId/notes
 */
export async function adminAddInternalNote(req, res, next) {
  try {
    const adminId = getAdminId(req);
    const { ticketId } = req.params;

    if (!validateUUID(ticketId)) {
      return sendError(res, 400, "Invalid ticket reference.");
    }

    const validation = validateMessage(req.body);

    if (!validation.valid) {
      return sendError(res, 400, validation.message);
    }

    const db = getDatabasePool();

    const ticketResult = await db.query(
      `
        SELECT id
        FROM public.support_tickets
        WHERE id = $1
        LIMIT 1
      `,
      [ticketId]
    );

    if (!ticketResult.rows.length) {
      return sendError(res, 404, "Support ticket not found.");
    }

    const profile = await getProfile(adminId);

    if (!profile) {
      return sendError(
        res,
        409,
        "The administrator account must have a profile before adding internal notes."
      );
    }

    const {
      message,
      attachments = [],
    } = req.body;

    if (
      !isValidUserAttachmentPath(attachments, adminId)
    ) {
      return sendError(
        res,
        400,
        "Invalid attachment storage path."
      );
    }

    const result = await db.query(
      `
        INSERT INTO public.support_messages (
          ticket_id,
          sender_id,
          sender_type,
          message,
          attachments,
          is_internal
        )
        VALUES ($1, $2, 'admin', $3, $4::jsonb, TRUE)
        RETURNING *
      `,
      [
        ticketId,
        adminId,
        message.trim(),
        normalizeAttachments(attachments),
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Internal note added successfully.",
      data: {
        note: result.rows[0],
      },
    });
  } catch (error) {
    next(error);
  }
}