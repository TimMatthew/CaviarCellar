import { pool } from "../db/pool.js";

// Data access for the `caviar` table. SQL only — no business rules. Every method
// takes an optional executor as its LAST arg (the pool by default); a use-case
// service in a transaction passes its `tx` client instead so several repo calls
// share one transaction. All queries are parameterized (no string interpolation
// of user input) to prevent SQL injection.

const COLUMNS = `caviar_id, title, manufacturer_country, fish, description,
                 net_weight_grams, price_uah, amount, rel_image_path`;

export const caviarRepo = {
  async findAll({ inStockOnly = false } = {}, exec = pool) {
    const where = inStockOnly ? "WHERE amount > 0" : "";
    const { rows } = await exec.query(
      `SELECT ${COLUMNS} FROM caviar ${where} ORDER BY caviar_id`
    );
    return rows;
  },

  async findById(id, exec = pool) {
    const { rows } = await exec.query(
      `SELECT ${COLUMNS} FROM caviar WHERE caviar_id = $1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async insert(data, exec = pool) {
    const { rows } = await exec.query(
      `INSERT INTO caviar
         (title, manufacturer_country, fish, description,
          net_weight_grams, price_uah, amount, rel_image_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${COLUMNS}`,
      [
        data.title,
        data.manufacturerCountry ?? null,
        data.fish ?? null,
        data.description ?? null,
        data.netWeightGrams ?? null,
        data.priceUah,
        data.amount ?? 0,
        data.relImagePath ?? null,
      ]
    );
    return rows[0];
  },

  // Partial update: COALESCE keeps the existing value for any field not provided
  // (undefined -> null -> old value). NOT-NULL columns are therefore never nulled.
  async update(id, data, exec = pool) {
    const { rows } = await exec.query(
      `UPDATE caviar SET
         title                = COALESCE($2, title),
         manufacturer_country = COALESCE($3, manufacturer_country),
         fish                 = COALESCE($4, fish),
         description          = COALESCE($5, description),
         net_weight_grams     = COALESCE($6, net_weight_grams),
         price_uah            = COALESCE($7, price_uah),
         amount               = COALESCE($8, amount),
         rel_image_path       = COALESCE($9, rel_image_path)
       WHERE caviar_id = $1
       RETURNING ${COLUMNS}`,
      [
        id,
        data.title ?? null,
        data.manufacturerCountry ?? null,
        data.fish ?? null,
        data.description ?? null,
        data.netWeightGrams ?? null,
        data.priceUah ?? null,
        data.amount ?? null,
        data.relImagePath ?? null,
      ]
    );
    return rows[0] ?? null;
  },

  async remove(id, exec = pool) {
    const { rowCount } = await exec.query(
      `DELETE FROM caviar WHERE caviar_id = $1`,
      [id]
    );
    return rowCount > 0;
  },

    // Atomically reserve stock: decrement only if enough is on hand. The
  // `amount >= $2` guard makes the check-and-decrement a single race-free step.
  // Returns the updated row, or null if there wasn't enough stock.
  async decrementStock(caviarId, qty, exec = pool) {
    const { rows } = await exec.query(
      `UPDATE caviar SET amount = amount - $2
        WHERE caviar_id = $1 AND amount >= $2
        RETURNING caviar_id, amount`,
      [caviarId, qty]
    );
    return rows[0] ?? null;
  },
};