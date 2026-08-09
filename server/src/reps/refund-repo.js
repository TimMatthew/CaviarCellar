import { pool } from "../db/pool.js";

const COLUMNS = `refund_id, order_id, amount, reason, fondy_reverse_ref,
                 status, created_at`;

export const refundRepo = {
  async create({ orderId, amount, reason = "not_collected" }, exec = pool) {
    const { rows } = await exec.query(
      `INSERT INTO refund (order_id, amount, reason)
       VALUES ($1, $2, $3)
       ON CONFLICT (order_id) DO NOTHING
       RETURNING ${COLUMNS}`,
      [orderId, amount, reason]
    );
    return rows[0] ?? null;
  },

  async findByOrderId(orderId, exec = pool) {
    const { rows } = await exec.query(`SELECT ${COLUMNS} FROM refund WHERE order_id = $1`, [orderId]);
    return rows[0] ?? null;
  },

  async markDone(refundId, reverseRef, exec = pool) {
    const { rows } = await exec.query(
      `UPDATE refund SET status = 'done', fondy_reverse_ref = $2
        WHERE refund_id = $1 AND status = 'pending'
       RETURNING ${COLUMNS}`,
      [refundId, reverseRef]
    );
    return rows[0] ?? null;
  },

  async retry(refundId, exec = pool) {
    const { rows } = await exec.query(
      `UPDATE refund SET status = 'pending'
        WHERE refund_id = $1 AND status = 'failed'
       RETURNING ${COLUMNS}`,
      [refundId]
    );
    return rows[0] ?? null;
  },

  async markFailed(refundId, message, exec = pool) {
    const { rows } = await exec.query(
      `UPDATE refund SET status = 'failed'
        WHERE refund_id = $1 AND status = 'pending'
       RETURNING ${COLUMNS}`,
      [refundId]
    );
    return rows[0] ?? null;
  },
};
