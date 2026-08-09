import { pool } from "../db/pool.js";

export const outboxRepo = {
  async enqueue({ to, subject, text }, exec = pool) {
    if (!to) return null;
    const { rows } = await exec.query(
      `INSERT INTO notification_outbox (recipient, subject, body_text)
       VALUES ($1, $2, $3)
       RETURNING outbox_id, recipient, subject, body_text, attempts, available_at`,
      [to, subject, text]
    );
    return rows[0];
  },

  async listPending({ limit = 25 } = {}, exec = pool) {
    const { rows } = await exec.query(
      `SELECT outbox_id, recipient, subject, body_text, attempts
         FROM notification_outbox
        WHERE sent_at IS NULL AND available_at <= now()
        ORDER BY available_at, outbox_id
        LIMIT $1`,
      [limit]
    );
    return rows;
  },

  async markSent(id, exec = pool) {
    await exec.query(
      `UPDATE notification_outbox SET sent_at = now(), last_error = NULL WHERE outbox_id = $1`,
      [id]
    );
  },

  async markFailed(id, error, delaySeconds, exec = pool) {
    await exec.query(
      `UPDATE notification_outbox
          SET attempts = attempts + 1,
              last_error = $2,
              available_at = now() + ($3 * interval '1 second')
        WHERE outbox_id = $1`,
      [id, String(error).slice(0, 2000), delaySeconds]
    );
  },
};
