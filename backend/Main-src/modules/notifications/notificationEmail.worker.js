import nodemailer from "nodemailer";
import { getDatabasePool } from "../../config/database.js";

let timer = null;
let running = false;
let transporter = null;

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass || !process.env.EMAIL_FROM) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
  }
  return transporter;
}

export async function processNotificationEmails(batchSize = 10) {
  if (running) return;
  const mailer = getTransporter();
  if (!mailer) return;
  running = true;
  const db = getDatabasePool();
  try {
    const claimed = await db.query(
      `WITH candidates AS (
         SELECT id FROM public.notification_email_outbox
          WHERE (status IN ('pending', 'failed') OR (status = 'processing' AND updated_at < now() - interval '10 minutes'))
            AND next_attempt_at <= now() AND attempts < 8
          ORDER BY created_at
          FOR UPDATE SKIP LOCKED LIMIT $1
       )
       UPDATE public.notification_email_outbox o
          SET status = 'processing', attempts = attempts + 1, updated_at = now()
         FROM candidates c WHERE o.id = c.id
       RETURNING o.*`, [batchSize]
    );

    for (const message of claimed.rows) {
      try {
        await mailer.sendMail({
          from: process.env.EMAIL_FROM,
          to: message.recipient_email,
          subject: message.subject,
          text: message.text_body,
          html: message.html_body,
        });
        await db.query(
          `UPDATE public.notification_email_outbox
              SET status = 'sent', sent_at = now(), last_error = NULL, updated_at = now()
            WHERE id = $1`, [message.id]
        );
      } catch (error) {
        const attempts = Number(message.attempts || 1);
        const terminal = attempts >= 8;
        const delayMinutes = Math.min(60, 2 ** Math.min(attempts, 6));
        await db.query(
          `UPDATE public.notification_email_outbox
              SET status = $2,
                  next_attempt_at = now() + ($3::text || ' minutes')::interval,
                  last_error = $4, updated_at = now()
            WHERE id = $1`,
          [message.id, terminal ? "failed" : "pending", delayMinutes,
            String(error?.message || "Email delivery failed").slice(0, 1000)]
        );
      }
    }
  } catch (error) {
    console.error("ERANDER notification email worker failed:", error?.message || error);
  } finally {
    running = false;
  }
}

export function startNotificationEmailWorker() {
  if (timer) return;
  // Process immediately, then poll. Missing SMTP configuration leaves the
  // durable outbox untouched until credentials are configured.
  processNotificationEmails().catch(() => {});
  timer = setInterval(() => processNotificationEmails().catch(() => {}), 30000);
  timer.unref?.();
}

export function stopNotificationEmailWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
