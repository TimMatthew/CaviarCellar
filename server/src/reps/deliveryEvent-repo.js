import { pool } from "../db/pool.js";

const COLUMNS = `event_id, delivery_id, status, np_status_code,
                 description, location_t, created_at`;

export const deliveryEventRepo = {
  async append(data, exec = pool) {
    const { rows } = await exec.query(
      `INSERT INTO delivery_event
         (delivery_id, status, np_status_code, description, location_t)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${COLUMNS}`,
      [
        data.deliveryId,
        data.status,
        data.npStatusCode ?? null,
        data.description ?? null,
        data.location ?? null,
      ]
    );
    return rows[0];
  },

  async listByDelivery(deliveryId, exec = pool) {
    const { rows } = await exec.query(
      `SELECT ${COLUMNS}
         FROM delivery_event
        WHERE delivery_id = $1
        ORDER BY created_at, event_id`,
      [deliveryId]
    );
    return rows;
  },

  async latest(deliveryId, exec = pool) {
    const { rows } = await exec.query(
      `SELECT ${COLUMNS}
         FROM delivery_event
        WHERE delivery_id = $1
        ORDER BY created_at DESC, event_id DESC
        LIMIT 1`,
      [deliveryId]
    );
    return rows[0] ?? null;
  },

  async exists(deliveryId, { status, npStatusCode }, exec = pool) {
    const { rowCount } = await exec.query(
      `SELECT 1 FROM delivery_event
        WHERE delivery_id = $1
          AND status = $2
          AND np_status_code IS NOT DISTINCT FROM $3
        LIMIT 1`,
      [deliveryId, status, npStatusCode ?? null]
    );
    return rowCount > 0;
  },
};
