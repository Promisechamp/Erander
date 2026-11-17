import { createHash, randomUUID } from "node:crypto";
import { getDatabasePool } from "../../config/database.js";
import { notifyUser } from "../notifications/notification.service.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { hasAdminPermission } from "../admin/auth/adminPermissions.js";

const IMAGE_LIMIT = 8 * 1024 * 1024;
const ALLOWED_IMAGES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const REPORT_REASONS = new Set([
  "fraud_scam", "harassment", "abuse", "unsafe_request",
  "off_platform_contact", "spam", "other",
]);
const ADMIN_ACCESS_REASONS = new Set([
  "reported_conversation", "fraud_prevention", "safety_review",
  "customer_support", "legal_compliance", "quality_review",
]);

class ChatError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function fail(status, message) {
  throw new ChatError(status, message);
}

function sendError(res, error) {
  if (error instanceof ChatError) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  if (error?.code === "23505") {
    return res.status(409).json({ success: false, message: "This conversation already exists. Refresh and try again." });
  }
  if (error?.code === "23503" || error?.code === "23514") {
    return res.status(400).json({ success: false, message: error.message || "The chat action conflicts with current conversation rules." });
  }
  if (error?.code === "42P01" && String(error.message || "").includes("audit_logs")) {
    return res.status(503).json({ success: false, message: "Deploy the unified audit-log migration before using admin chat review." });
  }
  console.error("ERANDER chat controller error:", error);
  return res.status(500).json({ success: false, message: "We couldn't complete that chat action. Please try again." });
}

function validUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function scanRisk(text) {
  const value = String(text || "");
  if (!value) return [];
  const flags = [];
  const add = (type, matches) => {
    const unique = [...new Set(matches)].slice(0, 12);
    if (unique.length) flags.push({ type, matches: unique });
  };

  const explicitLinks = value.match(/(?:https?:\/\/|www\.)[^\s<>()]+/gi) || [];
  const emailMatches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const obfuscatedEmails = value.match(/\b[a-z0-9._%+-]+\s+(?:at|@)\s+[a-z0-9-]+\s+(?:dot|\.)\s+[a-z]{2,}\b/gi) || [];
  const obfuscatedDomains = value.match(/\b[a-z0-9-]+\s+dot\s+[a-z]{2,}\b/gi) || [];
  const withoutLinksOrEmails = value
    .replace(/(?:https?:\/\/|www\.)[^\s<>()]+/gi, " ")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ");
  add("external_link", [
    ...explicitLinks,
    ...(withoutLinksOrEmails.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>()]*)?/gi) || []),
    ...obfuscatedDomains,
  ]);
  add("email_address", [...emailMatches, ...obfuscatedEmails]);
  add("phone_number", value.match(/(?:\+?\d[\d\s().-]{5,}\d)/g) || []);

  // Preserve the original wording. This is a review signal, not a block.
  const numberWords = "zero|oh|nought|nil|one|won|two|too|to|three|tree|four|for|five|six|seven|eight|ate|nine|nin|niner|ten|double|triple|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|hundred|thousand";
  const plusWordRuns = value.match(new RegExp(`\\bplus\\s+(?:${numberWords})(?:[\\s,.-]+(?:${numberWords})){2,}\\b`, "gi")) || [];
  const withoutPlusWordRuns = value.replace(new RegExp(`\\bplus\\s+(?:${numberWords})(?:[\\s,.-]+(?:${numberWords})){2,}\\b`, "gi"), " ");
  const wordRuns = [
    ...plusWordRuns,
    ...(withoutPlusWordRuns.match(new RegExp(`\\b(?:${numberWords})(?:[\\s,.-]+(?:${numberWords})){2,}\\b`, "gi")) || []),
  ];
  add("spelled_out_number_sequence", wordRuns);
  return flags;
}

function parseImage(image) {
  if (!image) return null;
  if (typeof image.dataUrl !== "string" || typeof image.filename !== "string") {
    fail(400, "The image attachment is invalid.");
  }
  const match = image.dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) fail(400, "Only JPEG, PNG, WEBP, and GIF images are supported.");
  const mimeType = match[1];
  if (!ALLOWED_IMAGES.has(mimeType)) fail(400, "This image format is not supported.");
  const data = Buffer.from(match[2], "base64");
  if (!data.length || data.length > IMAGE_LIMIT) fail(400, "Images must be 8 MB or smaller.");
  const signatures = {
    "image/jpeg": data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
    "image/png": data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/webp": data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP",
    "image/gif": data.length >= 6 && ["GIF87a", "GIF89a"].includes(data.toString("ascii", 0, 6)),
  };
  if (!signatures[mimeType]) fail(400, "The uploaded file does not match its image format.");
  const filename = image.filename.trim().replace(/[\r\n\\/]/g, "_").slice(0, 180) || "chat-image";
  return { mimeType, data, filename, sha256: createHash("sha256").update(data).digest("hex") };
}

function requireUser(req) {
  if (!req.user?.id) fail(401, "Please sign in to use chat.");
  return req.user.id;
}

function requireAdmin(req, permission = "chats:read") {
  if (!req.admin?.id || !hasAdminPermission(req.admin, permission)) {
    fail(403, "You do not have permission to access chat records.");
  }
  return req.admin.id;
}

async function getParticipant(database, chatId, profileId, { lock = false } = {}) {
  if (!validUuid(chatId)) fail(400, "The conversation ID is invalid.");
  const result = await database.query(
    `SELECT c.id, c.erand_id, c.customer_id, c.erander_id, c.status,
            c.risk_review_required, p.participant_role, p.disclosure_accepted_at,
            p.hidden_at
       FROM public.erand_chats c
       JOIN public.erand_chat_participants p ON p.chat_id = c.id
      WHERE c.id = $1 AND p.profile_id = $2 ${lock ? "FOR UPDATE OF c, p" : ""}`,
    [chatId, profileId]
  );
  if (!result.rows[0] || result.rows[0].hidden_at) fail(404, "This conversation could not be found.");
  return result.rows[0];
}

async function recordEvent(database, chatId, actorId, eventType, details = {}) {
  await database.query(
    `INSERT INTO public.erand_chat_events (chat_id, actor_id, event_type, details)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [chatId, actorId || null, eventType, JSON.stringify(details)]
  );
}

export async function getErrandChatTargets(req, res) {
  try {
    const userId = requireUser(req);
    const { errandId } = req.params;
    if (!validUuid(errandId)) fail(400, "The errand ID is invalid.");
    const db = getDatabasePool();
    const erandResult = await db.query(
      `SELECT id, requested_by, assigned_erander_id, allow_erander_initiated_chat
         FROM public.erands WHERE id = $1 AND deleted_at IS NULL`,
      [errandId]
    );
    const erand = erandResult.rows[0];
    if (!erand) fail(404, "This errand could not be found.");

    let rows;
    if (erand.requested_by === userId) {
      const result = await db.query(
        `SELECT eo.offered_by AS erander_id, eo.status AS offer_status,
                COALESCE(NULLIF(p.display_name, ''), NULLIF(concat_ws(' ', p.first_name, p.last_name), ''), 'ERANDER') AS display_name,
                p.avatar_url, c.id AS chat_id, c.status AS chat_status
           FROM public.erand_offers eo
           JOIN public.profiles p ON p.id = eo.offered_by
           LEFT JOIN public.erand_chats c ON c.erand_id = eo.erand_id AND c.erander_id = eo.offered_by
          WHERE eo.erand_id = $1
            AND (eo.status IN ('pending', 'accepted') OR c.id IS NOT NULL)
          ORDER BY (eo.status = 'accepted') DESC, eo.created_at DESC`,
        [errandId]
      );
      rows = result.rows;
    } else {
      const result = await db.query(
        `SELECT eo.offered_by AS erander_id, eo.status AS offer_status,
                COALESCE(NULLIF(p.display_name, ''), NULLIF(concat_ws(' ', p.first_name, p.last_name), ''), 'Customer') AS display_name,
                p.avatar_url, c.id AS chat_id, c.status AS chat_status
           FROM public.erand_offers eo
           JOIN public.erands e ON e.id = eo.erand_id
           JOIN public.profiles p ON p.id = e.requested_by
           LEFT JOIN public.erand_chats c ON c.erand_id = eo.erand_id AND c.erander_id = eo.offered_by
          WHERE eo.erand_id = $1 AND eo.offered_by = $2
          LIMIT 1`,
        [errandId, userId]
      );
      rows = result.rows;
    }
    return res.json({
      success: true,
      data: {
        targets: rows,
        canEranderInitiate: Boolean(erand.allow_erander_initiated_chat),
        isCustomer: erand.requested_by === userId,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function openErrandChat(req, res) {
  const { errandId, eranderId } = req.params;
  if (!validUuid(errandId) || !validUuid(eranderId)) return sendError(res, new ChatError(400, "The errand or erander ID is invalid."));
  const db = getDatabasePool();
  const client = await db.connect();
  try {
    const userId = requireUser(req);
    await client.query("BEGIN");
    const erandResult = await client.query(
      `SELECT id, requested_by, status, allow_erander_initiated_chat
         FROM public.erands WHERE id = $1 AND deleted_at IS NULL FOR SHARE`,
      [errandId]
    );
    const erand = erandResult.rows[0];
    if (!erand) fail(404, "This errand could not be found.");
    if (erand.requested_by === eranderId) fail(400, "A customer cannot start a chat with themselves.");

    const offerResult = await client.query(
      `SELECT status FROM public.erand_offers WHERE erand_id = $1 AND offered_by = $2`,
      [errandId, eranderId]
    );
    const offer = offerResult.rows[0];
    if (!offer) fail(403, "Chat is available only with an erander who has submitted an offer for this errand.");

    const isCustomer = userId === erand.requested_by;
    const isErander = userId === eranderId;
    if (!isCustomer && !isErander) fail(403, "You are not a party to this errand conversation.");

    const existing = await client.query(
      `SELECT id FROM public.erand_chats WHERE erand_id = $1 AND erander_id = $2 FOR UPDATE`,
      [errandId, eranderId]
    );
    if (!existing.rows[0] && isErander && !erand.allow_erander_initiated_chat) {
      fail(403, "The customer is not accepting new conversations from eranders for this errand.");
    }
    if (!existing.rows[0] && !["pending", "accepted"].includes(offer.status)) {
      fail(403, "A new chat can only be started while the offer is active or accepted.");
    }
    if (!existing.rows[0] && !["open", "offer_selected", "awaiting_funding", "funded", "in_progress", "completion_submitted"].includes(erand.status)) {
      fail(403, "A new conversation cannot be started after this errand has ended or entered a dispute.");
    }

    let chatId = existing.rows[0]?.id;
    let created = false;
    if (!chatId) {
      const inserted = await client.query(
        `INSERT INTO public.erand_chats (erand_id, customer_id, erander_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (erand_id, erander_id) DO NOTHING
         RETURNING id`,
        [errandId, erand.requested_by, eranderId]
      );
      if (inserted.rows[0]) {
        chatId = inserted.rows[0].id;
        created = true;
        await client.query(
          `INSERT INTO public.erand_chat_participants (chat_id, profile_id, participant_role)
           VALUES ($1, $2, 'customer'), ($1, $3, 'erander')`,
          [chatId, erand.requested_by, eranderId]
        );
        await recordEvent(client, chatId, userId, "created", { initiated_by: isCustomer ? "customer" : "erander" });
      } else {
        const concurrent = await client.query(
          `SELECT id FROM public.erand_chats WHERE erand_id = $1 AND erander_id = $2 FOR UPDATE`,
          [errandId, eranderId]
        );
        chatId = concurrent.rows[0]?.id;
        if (!chatId) fail(409, "The conversation is being created. Please try again.");
      }
    }

    await client.query(
      `UPDATE public.erand_chat_participants
          SET hidden_at = NULL, archived_at = NULL
        WHERE chat_id = $1 AND profile_id = $2`,
      [chatId, userId]
    );
    await client.query("COMMIT");
    return res.status(created ? 201 : 200).json({ success: true, data: { chatId, created } });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return sendError(res, error);
  } finally {
    client.release();
  }
}

export async function listChats(req, res) {
  try {
    const userId = requireUser(req);
    const archived = req.query.archived === "true";
    const search = String(req.query.search || "").trim().slice(0, 100);
    const page = Math.max(1, Math.min(Number.parseInt(req.query.page, 10) || 1, 100000));
    const pageSize = 30;
    const archivedFilter = archived ? "IS NOT NULL" : "IS NULL";
    const filterSql = `cp.hidden_at IS NULL AND cp.archived_at ${archivedFilter}
      AND ($2 = '' OR e.title ILIKE '%' || $2 || '%' OR e.reference_code ILIKE '%' || $2 || '%'
        OR other.display_name ILIKE '%' || $2 || '%' OR other.first_name ILIKE '%' || $2 || '%' OR other.last_name ILIKE '%' || $2 || '%')`;
    const db = getDatabasePool();
    const countResult = await db.query(
      `SELECT count(*)::int AS total
         FROM public.erand_chats c
         JOIN public.erand_chat_participants cp ON cp.chat_id = c.id AND cp.profile_id = $1
         JOIN public.profiles other ON other.id = CASE WHEN c.customer_id = $1 THEN c.erander_id ELSE c.customer_id END
         JOIN public.erands e ON e.id = c.erand_id
        WHERE ${filterSql}`,
      [userId, search]
    );
    const total = countResult.rows[0]?.total || 0;
    const result = await db.query(
      `SELECT c.id, c.erand_id, c.status, c.risk_review_required, c.created_at,
              c.last_message_at, e.reference_code, e.title AS errand_title,
              other.id AS other_profile_id,
              COALESCE(NULLIF(other.display_name, ''), NULLIF(concat_ws(' ', other.first_name, other.last_name), ''), 'ERANDER user') AS other_display_name,
              other.avatar_url,
              CASE WHEN cp.disclosure_accepted_at IS NOT NULL THEN lm.body ELSE NULL END AS last_message_body,
              CASE WHEN cp.disclosure_accepted_at IS NOT NULL THEN lm.message_type ELSE NULL END AS last_message_type,
              lm.sender_id AS last_message_sender_id,
              COALESCE(unread.unread_count, 0)::int AS unread_count,
              cp.archived_at
         FROM public.erand_chats c
         JOIN public.erand_chat_participants cp ON cp.chat_id = c.id AND cp.profile_id = $1
         JOIN public.profiles other ON other.id = CASE WHEN c.customer_id = $1 THEN c.erander_id ELSE c.customer_id END
         JOIN public.erands e ON e.id = c.erand_id
         LEFT JOIN LATERAL (
           SELECT m.body, m.message_type, m.sender_id
             FROM public.erand_chat_messages m
            WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1
         ) lm ON true
         LEFT JOIN LATERAL (
           SELECT count(*) AS unread_count FROM public.erand_chat_messages m
            WHERE m.chat_id = c.id AND m.sender_id <> $1
              AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
         ) unread ON true
        WHERE ${filterSql}
        ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
        LIMIT $3 OFFSET $4`,
      [userId, search, pageSize, (page - 1) * pageSize]
    );
    return res.json({
      success: true,
      data: {
        chats: result.rows,
        pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function getMessages(database, chatId, { before = null, limit = 60 } = {}) {
  const result = await database.query(
    `SELECT m.id, m.chat_id, m.sender_id, m.message_type, m.body,
            m.reply_to_message_id, m.risk_flags, m.risk_review_required, m.created_at,
            COALESCE(NULLIF(sender.display_name, ''), NULLIF(concat_ws(' ', sender.first_name, sender.last_name), ''), 'ERANDER user') AS sender_name,
            sender.avatar_url,
            reply.body AS reply_body, reply.sender_id AS reply_sender_id,
            COALESCE(NULLIF(reply_sender.display_name, ''), concat_ws(' ', reply_sender.first_name, reply_sender.last_name)) AS reply_sender_name,
            attachment.id AS attachment_id, attachment.original_filename,
            attachment.mime_type, attachment.size_bytes
       FROM public.erand_chat_messages m
       JOIN public.profiles sender ON sender.id = m.sender_id
       LEFT JOIN public.erand_chat_messages reply ON reply.chat_id = m.chat_id AND reply.id = m.reply_to_message_id
       LEFT JOIN public.profiles reply_sender ON reply_sender.id = reply.sender_id
       LEFT JOIN public.erand_chat_attachments attachment ON attachment.message_id = m.id
      WHERE m.chat_id = $1 AND ($2::timestamptz IS NULL OR m.created_at < $2)
      ORDER BY m.created_at DESC LIMIT $3`,
    [chatId, before, Math.min(Math.max(Number(limit) || 60, 1), 1000)]
  );
  return result.rows.reverse();
}

export async function getChatDetails(req, res) {
  try {
    const userId = requireUser(req);
    const { chatId } = req.params;
    if (!validUuid(chatId)) fail(400, "The conversation ID is invalid.");
    const db = getDatabasePool();
    const chat = await getParticipant(db, chatId, userId);
    const result = await db.query(
      `SELECT c.id, c.erand_id, c.status, c.closed_by, c.closed_at,
              c.risk_review_required, c.created_at, c.last_message_at,
              e.reference_code, e.title AS errand_title, cp.disclosure_accepted_at,
              cp.archived_at,
              other.id AS other_profile_id,
              COALESCE(NULLIF(other.display_name, ''), NULLIF(concat_ws(' ', other.first_name, other.last_name), ''), 'ERANDER user') AS other_display_name,
              other.avatar_url
         FROM public.erand_chats c
         JOIN public.erand_chat_participants cp ON cp.chat_id = c.id AND cp.profile_id = $2
         JOIN public.profiles other ON other.id = CASE WHEN c.customer_id = $2 THEN c.erander_id ELSE c.customer_id END
         JOIN public.erands e ON e.id = c.erand_id
        WHERE c.id = $1`,
      [chatId, userId]
    );
    if (!result.rows[0]) fail(404, "This conversation could not be found.");
    const messages = chat.disclosure_accepted_at
      ? await getMessages(db, chatId, { before: req.query.before || null, limit: req.query.limit })
      : [];
    await db.query(
      `UPDATE public.erand_chat_participants SET last_read_at = now()
        WHERE chat_id = $1 AND profile_id = $2 AND disclosure_accepted_at IS NOT NULL`,
      [chatId, userId]
    );
    return res.json({ success: true, data: { chat: result.rows[0], messages, viewerRole: chat.participant_role } });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function acceptChatDisclosure(req, res) {
  try {
    const userId = requireUser(req);
    const { chatId } = req.params;
    const db = getDatabasePool();
    await getParticipant(db, chatId, userId);
    await db.query(
      `UPDATE public.erand_chat_participants SET disclosure_accepted_at = COALESCE(disclosure_accepted_at, now())
        WHERE chat_id = $1 AND profile_id = $2`,
      [chatId, userId]
    );
    await recordEvent(db, chatId, userId, "disclosure_accepted");
    return res.json({ success: true, message: "Chat disclosure accepted." });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function sendChatMessage(req, res) {
  const { chatId } = req.params;
  if (!validUuid(chatId)) return sendError(res, new ChatError(400, "The conversation ID is invalid."));
  const db = getDatabasePool();
  const client = await db.connect();
  let uploadedPath = null;
  try {
    const userId = requireUser(req);
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    const replyTo = req.body?.replyToMessageId || null;
    const image = parseImage(req.body?.image);
    if (!body && !image) fail(400, "Write a message or attach an image.");
    if (body.length > 5000) fail(400, "Messages cannot exceed 5,000 characters.");
    if (replyTo && !validUuid(replyTo)) fail(400, "The reply reference is invalid.");
    await client.query("BEGIN");
    const chat = await getParticipant(client, chatId, userId, { lock: true });
    if (!chat.disclosure_accepted_at) fail(403, "Accept the chat privacy notice before sending messages.");
    if (chat.status !== "open") fail(409, "This conversation is closed. Reopen it before sending a message.");
    if (replyTo) {
      const reply = await client.query(
        `SELECT id FROM public.erand_chat_messages
          WHERE id = $1 AND chat_id = $2 AND message_type = 'text'`,
        [replyTo, chatId]
      );
      if (!reply.rows[0]) fail(400, "You can reply only to a text message in this conversation.");
    }
    const riskFlags = scanRisk(body);
    const messageType = image ? "image" : "text";
    const inserted = await client.query(
      `INSERT INTO public.erand_chat_messages
        (chat_id, sender_id, message_type, body, reply_to_message_id, risk_flags, risk_review_required)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) RETURNING id, created_at`,
      [chatId, userId, messageType, body || null, replyTo, JSON.stringify(riskFlags), riskFlags.length > 0]
    );
    const message = inserted.rows[0];
    if (image) {
      if (!supabaseAdmin) fail(503, "Image sharing is not configured yet. Add SUPABASE_SERVICE_ROLE_KEY to the backend environment.");
      uploadedPath = `${chatId}/${message.id}/${randomUUID()}-${image.filename}`;
      const upload = await supabaseAdmin.storage.from("chat-attachments").upload(uploadedPath, image.data, {
        contentType: image.mimeType,
        cacheControl: "0",
        upsert: false,
      });
      if (upload.error) fail(502, "The image could not be securely uploaded. Please try again.");
      await client.query(
        `INSERT INTO public.erand_chat_attachments
          (chat_id, message_id, original_filename, mime_type, size_bytes, sha256, storage_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [chatId, message.id, image.filename, image.mimeType, image.data.length, image.sha256, uploadedPath]
      );
    }
    await client.query(
      `UPDATE public.erand_chats SET last_message_at = $2,
              risk_review_required = risk_review_required OR $3
        WHERE id = $1`,
      [chatId, message.created_at, riskFlags.length > 0]
    );
    await client.query(
      `UPDATE public.erand_chat_participants SET last_read_at = now()
        WHERE chat_id = $1 AND profile_id = $2`,
      [chatId, userId]
    );
    await client.query("COMMIT");
    const chatRecipientId = chat.customer_id === userId ? chat.erander_id : chat.customer_id;
    notifyUser({
      recipientId: chatRecipientId,
      type: "chat_message",
      title: "You have a new errand message",
      body: "You received a new message in your ERANDER conversation.",
      actionUrl: "/chat",
      entityType: "chat",
      entityId: chatId,
      dedupeKey: `chat_message:${message.id}`,
    }).catch((error) => console.error("Chat notification failed:", error?.message));
    return res.status(201).json({
      success: true,
      data: {
        message: {
          id: message.id, chat_id: chatId, sender_id: userId,
          message_type: messageType, body: body || null,
          reply_to_message_id: replyTo, risk_flags: riskFlags,
          risk_review_required: riskFlags.length > 0, created_at: message.created_at,
          attachment: image ? { original_filename: image.filename, mime_type: image.mimeType, size_bytes: image.data.length } : null,
        },
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (uploadedPath && supabaseAdmin) {
      await supabaseAdmin.storage.from("chat-attachments").remove([uploadedPath]).catch(() => {});
    }
    return sendError(res, error);
  } finally {
    client.release();
  }
}

export async function getChatAttachment(req, res) {
  try {
    const userId = requireUser(req);
    const { attachmentId } = req.params;
    if (!validUuid(attachmentId)) fail(400, "The attachment ID is invalid.");
    const result = await getDatabasePool().query(
      `SELECT a.storage_path, a.mime_type, a.original_filename
         FROM public.erand_chat_attachments a
         JOIN public.erand_chat_participants p ON p.chat_id = a.chat_id AND p.profile_id = $2
        WHERE a.id = $1 AND p.hidden_at IS NULL AND p.disclosure_accepted_at IS NOT NULL`,
      [attachmentId, userId]
    );
    const attachment = result.rows[0];
    if (!attachment) fail(404, "This attachment could not be found.");
    if (!supabaseAdmin) fail(503, "Private chat image storage is not configured.");
    const download = await supabaseAdmin.storage.from("chat-attachments").download(attachment.storage_path);
    if (download.error || !download.data) fail(404, "This attachment could not be retrieved.");
    const buffer = Buffer.from(await download.data.arrayBuffer());
    res.setHeader("Content-Type", attachment.mime_type);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(attachment.original_filename)}`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(buffer);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function reportChat(req, res) {
  try {
    const userId = requireUser(req);
    const { chatId } = req.params;
    const reason = String(req.body?.reasonCode || "");
    const description = typeof req.body?.description === "string" ? req.body.description.trim().slice(0, 2000) : null;
    const messageId = req.body?.messageId || null;
    if (messageId && !validUuid(messageId)) fail(400, "The message reference is invalid.");
    if (!REPORT_REASONS.has(reason)) fail(400, "Choose a valid report reason.");
    const db = getDatabasePool();
    await getParticipant(db, chatId, userId);
    const result = await db.query(
      `INSERT INTO public.erand_chat_reports (chat_id, message_id, reported_by, reason_code, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, status, created_at`,
      [chatId, messageId, userId, reason, description]
    );
    await db.query(`UPDATE public.erand_chats SET risk_review_required = true WHERE id = $1`, [chatId]);
    await recordEvent(db, chatId, userId, "reported", { report_id: result.rows[0].id, reason_code: reason });
    return res.status(201).json({ success: true, data: { report: result.rows[0] }, message: "Your report has been sent to ERANDER for review." });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function closeChat(req, res) {
  try {
    const userId = requireUser(req);
    const { chatId } = req.params;
    const db = getDatabasePool();
    await getParticipant(db, chatId, userId);
    const result = await db.query(
      `UPDATE public.erand_chats SET status = 'closed', closed_by = $2, closed_at = now()
        WHERE id = $1 AND status = 'open' RETURNING id`,
      [chatId, userId]
    );
    if (result.rowCount) await recordEvent(db, chatId, userId, "closed");
    return res.json({ success: true, data: { status: "closed" } });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function reopenChat(req, res) {
  try {
    const userId = requireUser(req);
    const { chatId } = req.params;
    const db = getDatabasePool();
    await getParticipant(db, chatId, userId);
    const result = await db.query(
      `UPDATE public.erand_chats SET status = 'open', closed_by = NULL, closed_at = NULL
        WHERE id = $1 AND status = 'closed' RETURNING id`,
      [chatId]
    );
    if (result.rowCount) await recordEvent(db, chatId, userId, "reopened");
    return res.json({ success: true, data: { status: "open" } });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function archiveChat(req, res) {
  try {
    const userId = requireUser(req);
    const { chatId } = req.params;
    const db = getDatabasePool();
    await getParticipant(db, chatId, userId);
    await db.query(`UPDATE public.erand_chat_participants SET archived_at = now(), hidden_at = NULL WHERE chat_id = $1 AND profile_id = $2`, [chatId, userId]);
    return res.json({ success: true, message: "Conversation archived." });
  } catch (error) {
    return sendError(res, error);
  }
}


export async function unarchiveChat(req, res) {
  try {
    const userId = requireUser(req);
    const { chatId } = req.params;
    const db = getDatabasePool();
    await getParticipant(db, chatId, userId);
    await db.query(`UPDATE public.erand_chat_participants SET archived_at = NULL, hidden_at = NULL WHERE chat_id = $1 AND profile_id = $2`, [chatId, userId]);
    return res.json({ success: true, message: "Conversation restored to your inbox." });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function hideChat(req, res) {
  const userId = requireUser(req);
  const { chatId } = req.params;
  const db = getDatabasePool();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await getParticipant(client, chatId, userId, { lock: true });
    const updated = await client.query(
      `UPDATE public.erand_chat_participants
          SET hidden_at = now(), archived_at = NULL
        WHERE chat_id = $1 AND profile_id = $2 AND hidden_at IS NULL
        RETURNING chat_id`,
      [chatId, userId]
    );
    if (updated.rowCount) {
      await recordEvent(client, chatId, userId, "participant_chat_deleted", {
        scope: "requesting_participant_only",
        other_participant_history_preserved: true,
      });
    }
    await client.query("COMMIT");
    return res.json({ success: true, message: "Conversation deleted from your chat list. The other participant keeps their copy." });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* preserve original error */ }
    return sendError(res, error);
  } finally {
    client.release();
  }
}

export async function updateErrandChatPreference(req, res) {
  try {
    const userId = requireUser(req);
    const { errandId } = req.params;
    if (!validUuid(errandId)) fail(400, "The errand ID is invalid.");
    const allow = req.body?.allowEranderInitiatedChat;
    if (typeof allow !== "boolean") fail(400, "A valid chat preference is required.");
    const result = await getDatabasePool().query(
      `UPDATE public.erands SET allow_erander_initiated_chat = $3
        WHERE id = $1 AND requested_by = $2 AND deleted_at IS NULL RETURNING id, allow_erander_initiated_chat`,
      [errandId, userId, allow]
    );
    if (!result.rows[0]) fail(404, "This errand could not be found for your account.");
    return res.json({ success: true, data: { allowEranderInitiatedChat: result.rows[0].allow_erander_initiated_chat } });
  } catch (error) {
    return sendError(res, error);
  }
}

/* ------------------------------ ADMIN CHAT ------------------------------ */

export async function listAdminChats(req, res) {
  try {
    requireAdmin(req, "chats:read");
    const db = getDatabasePool();
    const search = String(req.query.search || "").trim().slice(0, 100);
    const flaggedOnly = req.query.flagged === "true";
    const status = ["open", "closed"].includes(req.query.status) ? req.query.status : "all";
    const errandId = req.query.errandId ? String(req.query.errandId) : null;
    if (errandId && !validUuid(errandId)) fail(400, "The errand filter is invalid.");
    const page = Math.max(1, Math.min(Number.parseInt(req.query.page, 10) || 1, 100000));
    const pageSize = 50;
    const filterSql = `
      ($1 = '' OR e.title ILIKE '%' || $1 || '%' OR e.reference_code ILIKE '%' || $1 || '%'
        OR cp.display_name ILIKE '%' || $1 || '%' OR ep.display_name ILIKE '%' || $1 || '%'
        OR cp.first_name ILIKE '%' || $1 || '%' OR cp.last_name ILIKE '%' || $1 || '%'
        OR ep.first_name ILIKE '%' || $1 || '%' OR ep.last_name ILIKE '%' || $1 || '%')
      AND (NOT $2 OR c.risk_review_required)
      AND ($3 = 'all' OR c.status = $3)
      AND ($4::uuid IS NULL OR e.id = $4::uuid)`;
    const params = [search, flaggedOnly, status, errandId];
    const countResult = await db.query(
      `SELECT count(*)::int AS total
         FROM public.erand_chats c
         JOIN public.erands e ON e.id = c.erand_id
         JOIN public.profiles cp ON cp.id = c.customer_id
         JOIN public.profiles ep ON ep.id = c.erander_id
        WHERE ${filterSql}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;
    const result = await db.query(
      `SELECT c.id, c.status, c.risk_review_required, c.created_at, c.last_message_at,
              e.id AS erand_id, e.reference_code, e.title AS errand_title,
              c.customer_id, c.erander_id,
              COALESCE(NULLIF(cp.display_name, ''), concat_ws(' ', cp.first_name, cp.last_name)) AS customer_name,
              COALESCE(NULLIF(ep.display_name, ''), concat_ws(' ', ep.first_name, ep.last_name)) AS erander_name,
              (SELECT count(*)::int FROM public.erand_chat_reports r WHERE r.chat_id = c.id AND r.status IN ('open','under_review')) AS open_reports,
              (SELECT count(*)::int FROM public.erand_chat_messages m WHERE m.chat_id = c.id AND m.risk_review_required) AS flagged_messages
         FROM public.erand_chats c
         JOIN public.erands e ON e.id = c.erand_id
         JOIN public.profiles cp ON cp.id = c.customer_id
         JOIN public.profiles ep ON ep.id = c.erander_id
        WHERE ${filterSql}
        ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
        LIMIT $5 OFFSET $6`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    return res.json({
      success: true,
      data: {
        chats: result.rows,
        pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getAdminChatDetails(req, res) {
  try {
    const adminId = requireAdmin(req, "chats:read");
    const { chatId } = req.params;
    if (!validUuid(chatId)) fail(400, "The conversation ID is invalid.");
    const reason = String(req.query.reason || "");
    if (!ADMIN_ACCESS_REASONS.has(reason)) fail(400, "Select a reason before opening a private conversation.");
    const db = getDatabasePool();
    const chatResult = await db.query(
      `SELECT c.id, c.erand_id, c.customer_id, c.erander_id, c.status,
              c.closed_by, c.closed_at, c.risk_review_required, c.created_at,
              c.last_message_at, e.reference_code, e.title AS errand_title,
              COALESCE(NULLIF(cp.display_name, ''), concat_ws(' ', cp.first_name, cp.last_name)) AS customer_name,
              COALESCE(NULLIF(ep.display_name, ''), concat_ws(' ', ep.first_name, ep.last_name)) AS erander_name
         FROM public.erand_chats c JOIN public.erands e ON e.id = c.erand_id
         JOIN public.profiles cp ON cp.id = c.customer_id
         JOIN public.profiles ep ON ep.id = c.erander_id
        WHERE c.id = $1`,
      [chatId]
    );
    const chat = chatResult.rows[0];
    if (!chat) fail(404, "This conversation could not be found.");
    await db.query(
      `INSERT INTO public.audit_logs
        (event_category, actor_id, action, entity_type, entity_id, reason, metadata)
       VALUES ('chat_access', $1, 'viewed_private_conversation', 'chat', $2::text, $3, $4::jsonb)`,
      [adminId, chatId, reason, JSON.stringify({ resource: "messages" })]
    );
    const messages = await getMessages(db, chatId, {
      before: req.query.before || null,
      limit: req.query.limit || 100,
    });
    const reports = await db.query(
      `SELECT r.id, r.message_id, r.reported_by, r.reason_code, r.description,
              r.status, r.reviewed_by, r.reviewed_at, r.resolution_note, r.created_at,
              COALESCE(NULLIF(p.display_name, ''), concat_ws(' ', p.first_name, p.last_name)) AS reporter_name
         FROM public.erand_chat_reports r JOIN public.profiles p ON p.id = r.reported_by
        WHERE r.chat_id = $1 ORDER BY r.created_at DESC`,
      [chatId]
    );
    const events = await db.query(
      `SELECT id, actor_id, event_type, details, created_at
         FROM public.erand_chat_events WHERE chat_id = $1 ORDER BY created_at ASC`,
      [chatId]
    );
    const access = await db.query(
      `SELECT l.id, l.actor_id AS admin_id, l.reason AS access_reason, l.created_at AS accessed_at,
              COALESCE(NULLIF(p.display_name, ''), concat_ws(' ', p.first_name, p.last_name)) AS admin_name
         FROM public.audit_logs l JOIN public.profiles p ON p.id = l.actor_id
        WHERE l.event_category = 'chat_access' AND l.entity_type = 'chat' AND l.entity_id = $1::text
        ORDER BY l.created_at DESC LIMIT 50`,
      [chatId]
    );
    return res.json({ success: true, data: { chat, messages, reports: reports.rows, events: events.rows, accessLogs: access.rows } });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getAdminChatAttachment(req, res) {
  try {
    const adminId = requireAdmin(req, "chats:read");
    const { attachmentId } = req.params;
    if (!validUuid(attachmentId)) fail(400, "The attachment ID is invalid.");
    const reason = String(req.query.reason || "");
    if (!ADMIN_ACCESS_REASONS.has(reason)) fail(400, "Select a reason before viewing a private attachment.");
    const db = getDatabasePool();
    const result = await db.query(
      `SELECT a.storage_path, a.mime_type, a.original_filename, a.chat_id
         FROM public.erand_chat_attachments a WHERE a.id = $1`,
      [attachmentId]
    );
    const attachment = result.rows[0];
    if (!attachment) fail(404, "This attachment could not be found.");
    await db.query(
      `INSERT INTO public.audit_logs
        (event_category, actor_id, action, entity_type, entity_id, reason, metadata)
       VALUES ('chat_access', $1, 'viewed_private_attachment', 'chat', $2::text, $3, $4::jsonb)`,
      [adminId, attachment.chat_id, reason, JSON.stringify({ resource: "attachment", attachment_id: attachmentId })]
    );
    if (!supabaseAdmin) fail(503, "Private chat image storage is not configured.");
    const download = await supabaseAdmin.storage.from("chat-attachments").download(attachment.storage_path);
    if (download.error || !download.data) fail(404, "This attachment could not be retrieved.");
    const buffer = Buffer.from(await download.data.arrayBuffer());
    res.setHeader("Content-Type", attachment.mime_type);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(attachment.original_filename)}`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(buffer);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function listAdminChatReports(req, res) {
  try {
    requireAdmin(req, "chats:read");
    const status = ["active", "all", "open", "under_review", "resolved", "dismissed"].includes(req.query.status) ? req.query.status : "active";
    const result = await getDatabasePool().query(
      `SELECT r.id, r.chat_id, r.message_id, r.reported_by, r.reason_code,
              r.description, r.status, r.created_at, e.reference_code,
              e.title AS errand_title,
              COALESCE(NULLIF(p.display_name, ''), concat_ws(' ', p.first_name, p.last_name)) AS reporter_name
         FROM public.erand_chat_reports r
         JOIN public.erand_chats c ON c.id = r.chat_id
         JOIN public.erands e ON e.id = c.erand_id
         JOIN public.profiles p ON p.id = r.reported_by
        WHERE ($1 = 'all' OR ($1 = 'active' AND r.status IN ('open','under_review')) OR r.status = $1)
        ORDER BY r.created_at DESC LIMIT 200`,
      [status]
    );
    return res.json({ success: true, data: { reports: result.rows } });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function updateAdminChatReport(req, res) {
  let client;
  try {
    const adminId = requireAdmin(req, "chats:manage");
    const { reportId } = req.params;
    if (!validUuid(reportId)) fail(400, "The report ID is invalid.");
    const status = String(req.body?.status || "");
    const note = typeof req.body?.resolutionNote === "string" ? req.body.resolutionNote.trim().slice(0, 2000) : null;
    if (!["under_review", "resolved", "dismissed"].includes(status)) fail(400, "Choose a valid report status.");
    if (["resolved", "dismissed"].includes(status) && !note) fail(400, "Add a resolution note before closing a report.");

    client = await getDatabasePool().connect();
    await client.query("BEGIN");
    const result = await client.query(
      `WITH previous AS (
         SELECT status FROM public.erand_chat_reports WHERE id = $1 FOR UPDATE
       )
       UPDATE public.erand_chat_reports r SET status = $2, reviewed_by = $3,
              reviewed_at = CASE WHEN $2 IN ('resolved','dismissed') THEN now() ELSE NULL END,
              resolution_note = $4
         FROM previous
        WHERE r.id = $1
        RETURNING r.id, r.chat_id, r.status, r.reviewed_at, previous.status AS previous_status`,
      [reportId, status, adminId, note]
    );
    if (!result.rows[0]) fail(404, "This report could not be found.");
    await client.query(
      `INSERT INTO public.audit_logs
        (event_category, actor_id, action, entity_type, entity_id, reason, before_data, after_data, metadata)
       VALUES ('chat_admin_action', $1, 'updated_chat_report', 'chat_report', $2::text, $3, $4::jsonb, $5::jsonb, $6::jsonb)`,
      [
        adminId,
        result.rows[0].id,
        note,
        JSON.stringify({ status: result.rows[0].previous_status }),
        JSON.stringify({ status: result.rows[0].status, reviewed_at: result.rows[0].reviewed_at }),
        JSON.stringify({ chat_id: result.rows[0].chat_id }),
      ]
    );
    await recordEvent(client, result.rows[0].chat_id, adminId, "report_review_updated", {
      report_id: result.rows[0].id,
      status: result.rows[0].status,
      resolution_note: note,
    });
    await client.query("COMMIT");
    return res.json({ success: true, data: { report: result.rows[0] } });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    return sendError(res, error);
  } finally {
    client?.release();
  }
}
