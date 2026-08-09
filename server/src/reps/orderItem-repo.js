import { pool } from "../db/pool.js";

// Order lines. insertMany runs inside the checkout transaction (pass tx).

export const orderItemRepo = {
  async insertMany(orderId, lines, exec = pool) {
    for (const line of lines) {
      await exec.query(
        `INSERT INTO order_item (order_id, cav_id, cav_price_snapshot, cav_amount)
         VALUES ($1, $2, $3, $4)`,
        [orderId, line.caviarId, line.unitPrice, line.qty]
      );
    }
  },

  async findByOrder(orderId, exec = pool) {
    const { rows } = await exec.query(
      `SELECT oi.order_item_id, oi.cav_id, oi.cav_price_snapshot, oi.cav_amount, c.title
         FROM order_item oi
         JOIN caviar c ON c.caviar_id = oi.cav_id
        WHERE oi.order_id = $1
        ORDER BY oi.order_item_id`,
      [orderId]
    );
    return rows;
  },
};
