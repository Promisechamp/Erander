import { getDatabasePool } from "../../config/database.js";

function validUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function listNotifications(req, res, next) {
  try {
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const before = req.query.before && validUuid(req.query.before) ? req.query.before : null;
    const db = getDatabasePool();
    const [items, count] = await Promise.all([
      db.query(
        `SELECT id, notification_type, title, body, action_url, entity_type,
                entity_id, data, read_at, created_at
           FROM public.user_notifications
          WHERE recipient_id = $1::uuid
            AND ($2::uuid IS NULL OR created_at < (SELECT created_at FROM public.user_notifications WHERE id = $2::uuid AND recipient_id = $1::uuid))
          ORDER BY created_at DESC LIMIT $3`, [req.user.id, before, limit]
      ),
      db.query(`SELECT count(*)::integer AS unread_count FROM public.user_notifications WHERE recipient_id = $1::uuid AND read_at IS NULL`, [req.user.id]),
    ]);
    return res.json({ success: true, data: { notifications: items.rows, unreadCount: count.rows[0]?.unread_count || 0 } });
  } catch (error) { next(error); }
}

export async function markNotificationRead(req, res, next) {
  try {
    const { notificationId } = req.params;
    if (!validUuid(notificationId)) return res.status(400).json({ success: false, message: "The notification ID is invalid." });
    const result = await getDatabasePool().query(
      `UPDATE public.user_notifications SET read_at = COALESCE(read_at, now())
        WHERE id = $1::uuid AND recipient_id = $2::uuid
        RETURNING id, read_at`, [notificationId, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Notification not found." });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) { next(error); }
}

export async function markAllNotificationsRead(req, res, next) {
  try {
    const result = await getDatabasePool().query(
      `UPDATE public.user_notifications SET read_at = now()
        WHERE recipient_id = $1::uuid AND read_at IS NULL`, [req.user.id]
    );
    return res.json({ success: true, data: { updated: result.rowCount } });
  } catch (error) { next(error); }
}
