import { getDatabasePool } from "../../config/database.js";
import { supabaseAdmin } from "../../config/supabase.js";

const BATCH_SIZE = 50;
const INTERVAL_MS = 6 * 60 * 60 * 1000;
let timer = null;
let running = false;

/**
 * Remove private chat image objects only after the errand's successful payout
 * has aged 30 days and there are no unresolved financial, safety or support holds.
 * Text messages, attachment metadata, reports and append-only chat events remain.
 */
export async function runChatRetentionCleanup() {
  if (!supabaseAdmin || running) return { skipped: true, reason: "storage_admin_unavailable_or_worker_busy" };
  running = true;
  try {
    const pool = getDatabasePool();
    const result = await pool.query(
      `SELECT a.id, a.storage_path, a.chat_id, c.erand_id
         FROM public.erand_chat_attachments a
         JOIN public.erand_chats c ON c.id = a.chat_id
         JOIN public.erand_settlements s
           ON s.erand_id = c.erand_id
          AND s.settlement_type = 'erander_payout'
          AND s.status = 'succeeded'
          AND s.platform_confirmed_at <= now() - interval '30 days'
        WHERE a.storage_deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.erands de WHERE de.id = c.erand_id AND de.status = 'disputed')
          AND NOT EXISTS (
            SELECT 1 FROM public.erand_chat_reports r
             WHERE r.chat_id = c.id
               AND lower(r.status) NOT IN ('resolved', 'closed', 'dismissed', 'rejected')
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.erander_security_deposit_claims sc
             WHERE sc.erand_id = c.erand_id
               AND lower(sc.status) NOT IN ('settled', 'resolved', 'rejected', 'withdrawn', 'cancelled', 'closed')
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.erand_payments p
            JOIN public.erand_refunds rf ON rf.payment_id = p.id
             WHERE p.erand_id = c.erand_id
               AND lower(rf.status) NOT IN ('succeeded', 'successful', 'completed', 'failed', 'rejected', 'cancelled')
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.support_tickets st
             WHERE st.errand_id = c.erand_id
               AND lower(st.status) NOT IN ('resolved', 'closed')
          )
        ORDER BY a.created_at ASC
        LIMIT $1`,
      [BATCH_SIZE]
    );

    let removed = 0;
    let failed = 0;
    for (const attachment of result.rows) {
      const { error } = await supabaseAdmin.storage
        .from("chat-attachments")
        .remove([attachment.storage_path]);
      if (error) {
        failed += 1;
        console.error("Chat image retention storage removal failed:", attachment.id, error.message);
        continue;
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SET LOCAL app.chat_retention_cleanup = 'on'");
        const update = await client.query(
          `UPDATE public.erand_chat_attachments
              SET storage_deleted_at = now(),
                  storage_deleted_reason = 'retention_30_days_after_settlement'
            WHERE id = $1 AND storage_deleted_at IS NULL
            RETURNING id`,
          [attachment.id]
        );
        await client.query("COMMIT");
        if (update.rowCount) removed += 1;
      } catch (error) {
        await client.query("ROLLBACK");
        failed += 1;
        console.error("Chat image retention metadata update failed:", attachment.id, error.message);
      } finally {
        client.release();
      }
    }

    return { examined: result.rows.length, removed, failed };
  } catch (error) {
    console.error("Chat image retention worker failed:", error);
    return { error: true };
  } finally {
    running = false;
  }
}

export function startChatRetentionWorker() {
  if (timer || process.env.ENABLE_CHAT_RETENTION_WORKER === "false") return;
  if (!supabaseAdmin) {
    console.warn("Chat image retention worker not started: SUPABASE_SERVICE_ROLE_KEY is not configured.");
    return;
  }
  void runChatRetentionCleanup();
  timer = setInterval(() => void runChatRetentionCleanup(), INTERVAL_MS);
  timer.unref?.();
}

export function stopChatRetentionWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
