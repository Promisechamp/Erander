import { getDatabasePool } from "../../config/database.js";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

/**
 * Persist an in-app notification and queue its email in one database statement.
 * Call after the business transaction commits so notification delivery can
 * never invalidate an errand, payment, offer, or chat action.
 */
export async function notifyUser({
  recipientId,
  type,
  title,
  body,
  actionUrl = null,
  entityType = null,
  entityId = null,
  data = {},
  dedupeKey = null,
  email = true,
}) {
  if (!recipientId || !type || !title || !body) return null;

  const database = getDatabasePool();
  let emailActionUrl = null;
  if (actionUrl) {
    try {
      emailActionUrl = new URL(actionUrl, process.env.FRONTEND_URL || "http://localhost:5173").toString();
    } catch {
      emailActionUrl = null;
    }
  }
  const result = await database.query(
    `WITH recipient AS (
       SELECT p.email
         FROM public.profiles p
        WHERE p.id = $1::uuid
        LIMIT 1
     ), inserted AS (
       INSERT INTO public.user_notifications
         (recipient_id, notification_type, title, body, action_url,
          entity_type, entity_id, data, dedupe_key)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::uuid, $8::jsonb, $9)
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING *
     ), queued AS (
       INSERT INTO public.notification_email_outbox
         (notification_id, recipient_id, recipient_email, subject, text_body, html_body)
       SELECT i.id, $1::uuid, r.email, $3, $4,
              '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17202e;line-height:1.6">' ||
              '<div style="max-width:600px;margin:24px auto;padding:28px;border:1px solid #e2e8f0;border-radius:16px">' ||
              '<div style="font-weight:800;color:#14213d;font-size:20px">ERANDER</div>' ||
              '<h2 style="color:#14213d">' || $10 || '</h2><p>' || $11 || '</p>' ||
              CASE WHEN $5::text IS NULL THEN '' ELSE '<p><a style="display:inline-block;padding:12px 18px;background:#35d07f;color:#14213d;text-decoration:none;border-radius:8px;font-weight:700" href="' || $12 || '">View in ERANDER</a></p>' END ||
              '<p style="font-size:12px;color:#64748b">You received this message because of activity on your ERANDER account.</p></div></body></html>'
         FROM inserted i CROSS JOIN recipient r
        WHERE $13::boolean = true AND r.email IS NOT NULL AND length(trim(r.email)) > 3
       RETURNING id
     )
     SELECT (SELECT row_to_json(inserted) FROM inserted) AS notification,
            (SELECT count(*) FROM queued)::integer AS email_queued`,
    [recipientId, type, title, body, actionUrl, entityType, entityId,
      JSON.stringify(data), dedupeKey, escapeHtml(title), escapeHtml(body),
      emailActionUrl, email],
  );

  return result.rows[0]?.notification || null;
}

export async function notifyUsers(recipientIds, notification) {
  const uniqueIds = [...new Set((recipientIds || []).filter(Boolean))];
  return Promise.allSettled(uniqueIds.map((recipientId) =>
    notifyUser({ ...notification, recipientId,
      dedupeKey: notification.dedupeKey ? `${notification.dedupeKey}:${recipientId}` : null,
    })
  ));
}
