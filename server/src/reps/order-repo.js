import { pool } from "../db/pool.js";

// Data access for the order header. Reads join the customer (user_t + profile)
// so the DTO and notification emails have name/phone/email without extra queries.

const SELECT_WITH_CUSTOMER = `
  SELECT o.order_id, o.user_id, o.total_price, o.status, o.method_t,
         o.paid_at, o.created_at, o.fondy_order_ref, o.fondy_payment_id,
         -- ======================================================================
         -- FONDY USD TEST CONVERSION
         o.fondy_currency, o.fondy_amount_minor,
         -- ======================================================================
         u.phone_number AS customer_phone,
         u.email        AS customer_email,
         p.name_t       AS customer_name
    FROM order_t o
    JOIN user_t  u ON u.prof_id = o.user_id
    JOIN profile p ON p.prof_id = o.user_id`;

export const orderRepo = {
  async insert({ userId, method, total }, exec = pool) {
    const { rows } = await exec.query(
      `INSERT INTO order_t (user_id, total_price, status, method_t)
       VALUES ($1, $2, 'pending', $3)
       RETURNING order_id, user_id, total_price, status, method_t, paid_at, created_at`,
      [userId, total, method]
    );
    return rows[0];
  },

  async findAll({ status, limit = 100, offset = 0 } = {}, exec = pool) {
    const where = status ? "WHERE o.status = $3" : "";
    const params = status ? [limit, offset, status] : [limit, offset];
    const { rows } = await exec.query(
      `${SELECT_WITH_CUSTOMER} ${where}
       ORDER BY o.order_id DESC
       LIMIT $1 OFFSET $2`,
      params
    );
    return rows;
  },

  async findById(id, exec = pool) {
    const { rows } = await exec.query(`${SELECT_WITH_CUSTOMER} WHERE o.order_id = $1`, [id]);
    return rows[0] ?? null;
  },

  async findByFondyRef(ref, exec = pool) {
    const { rows } = await exec.query(`${SELECT_WITH_CUSTOMER} WHERE o.fondy_order_ref = $1`, [ref]);
    return rows[0] ?? null;
  },

  // ==============================================================================
  // FONDY USD TEST CONVERSION
  async attachFondyPayment(
    id,
    { fondyOrderRef, fondyCurrency, fondyAmountMinor },
    exec = pool
  ) {
    const { rows } = await exec.query(
      `UPDATE order_t
          SET fondy_order_ref = $2,
              fondy_currency = $3,
              fondy_amount_minor = $4
        WHERE order_id = $1
       RETURNING order_id, fondy_order_ref, fondy_currency, fondy_amount_minor`,
      [id, fondyOrderRef, fondyCurrency, fondyAmountMinor]
    );
    return rows[0] ?? null;
  },
  // ==============================================================================

  // Idempotent: only flips a PENDING order to paid. Returns the row on success,
  // or null if it wasn't pending (already handled) — the guard against double
  // processing of a webhook that fires twice.
  async markPaid(id, { fondyPaymentId } = {}, exec = pool) {
    const { rows } = await exec.query(
      `UPDATE order_t
          SET status = 'paid', paid_at = now(),
              fondy_payment_id = COALESCE($2, fondy_payment_id)
        WHERE order_id = $1 AND status = 'pending'
        RETURNING order_id, status`,
      [id, fondyPaymentId ?? null]
    );
    return rows[0] ?? null;
  },

  async setStatus(id, status, exec = pool) {
    await exec.query(`UPDATE order_t SET status = $2 WHERE order_id = $1`, [id, status]);
  },
};
