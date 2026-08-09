import { pool } from "../db/pool.js";

const COLUMNS = `delivery_id, order_id, carrier, ttn, recipient_name,
  recipient_phone, recipient_city_ref, recipient_warehouse_ref, cod_amount,
  status, estimated_at, shipped_at, delivered_at, created_at, updated_at`;

export const deliveryRepo = {
  async create(data, exec = pool) {
    const { rows } = await exec.query(
      `INSERT INTO delivery
         (order_id, carrier, recipient_name, recipient_phone,
          recipient_city_ref, recipient_warehouse_ref, cod_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       ON CONFLICT (order_id) DO NOTHING
       RETURNING ${COLUMNS}`,
      [
        data.orderId,
        data.carrier ?? "nova_poshta",
        data.recipientName,
        data.recipientPhone,
        data.cityRef,
        data.warehouseRef,
        data.codAmount ?? null,
      ]
    );
    return rows[0] ?? null;
  },

  async findById(id, exec = pool) {
    const { rows } = await exec.query(
      `SELECT ${COLUMNS} FROM delivery WHERE delivery_id = $1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async findByIdForUpdate(id, exec = pool) {
    const { rows } = await exec.query(
      `SELECT ${COLUMNS} FROM delivery WHERE delivery_id = $1 FOR UPDATE`,
      [id]
    );
    return rows[0] ?? null;
  },

  async findByOrderId(orderId, exec = pool) {
    const { rows } = await exec.query(
      `SELECT ${COLUMNS} FROM delivery WHERE order_id = $1`,
      [orderId]
    );
    return rows[0] ?? null;
  },

  async findByTtn(ttn, exec = pool) {
    const { rows } = await exec.query(`SELECT ${COLUMNS} FROM delivery WHERE ttn = $1`, [ttn]);
    return rows[0] ?? null;
  },

  async listInFlight({ limit = 100 } = {}, exec = pool) {
    const { rows } = await exec.query(
      `SELECT ${COLUMNS}
         FROM delivery
        WHERE ttn IS NOT NULL
          AND status IN ('pending','processing','shipped','in_transit')
        ORDER BY updated_at, delivery_id
        LIMIT $1`,
      [limit]
    );
    return rows;
  },

  async attachShipment(deliveryId, { ttn, estimatedAt }, exec = pool) {
    const { rows } = await exec.query(
      `UPDATE delivery
          SET ttn = $2,
              estimated_at = COALESCE($3, estimated_at),
              status = CASE WHEN status = 'pending' THEN 'processing' ELSE status END,
              updated_at = now()
        WHERE delivery_id = $1 AND ttn IS NULL
       RETURNING ${COLUMNS}`,
      [deliveryId, ttn, estimatedAt ?? null]
    );
    return rows[0] ?? null;
  },

  // A short database lease prevents two HTTP/webhook retries from creating two
  // Nova Poshta documents for the same order. Failed attempts become eligible
  // for another try after five minutes.
  async claimForFulfillment(deliveryId, exec = pool) {
    const { rows } = await exec.query(
      `UPDATE delivery
          SET status = 'processing', updated_at = now()
        WHERE delivery_id = $1
          AND ttn IS NULL
          AND (status = 'pending' OR updated_at < now() - interval '5 minutes')
       RETURNING ${COLUMNS}`,
      [deliveryId]
    );
    return rows[0] ?? null;
  },

  async releaseFulfillmentClaim(deliveryId, exec = pool) {
    const { rows } = await exec.query(
      `UPDATE delivery
          SET status = 'pending', updated_at = now()
        WHERE delivery_id = $1 AND ttn IS NULL AND status = 'processing'
       RETURNING ${COLUMNS}`,
      [deliveryId]
    );
    return rows[0] ?? null;
  },

  async deleteUnfulfilled(deliveryId, exec = pool) {
    const { rows } = await exec.query(
      `DELETE FROM delivery
        WHERE delivery_id = $1
          AND ttn IS NULL
       RETURNING ${COLUMNS}`,
      [deliveryId]
    );
    return rows[0] ?? null;
  },

  async updateStatus(deliveryId, status, { estimatedAt } = {}, exec = pool) {
    const { rows } = await exec.query(
      `UPDATE delivery
          SET status = $2::varchar(16),
              estimated_at = COALESCE($3::timestamptz, estimated_at),
              shipped_at = CASE
                WHEN $2::varchar(16) IN ('shipped','in_transit','delivered')
                  THEN COALESCE(shipped_at, now())
                ELSE shipped_at END,
              delivered_at = CASE
                WHEN $2::varchar(16) = 'delivered' THEN COALESCE(delivered_at, now())
                ELSE delivered_at END,
              updated_at = now()
        WHERE delivery_id = $1
       RETURNING ${COLUMNS}`,
      [deliveryId, status, estimatedAt ?? null]
    );
    return rows[0] ?? null;
  },
};
