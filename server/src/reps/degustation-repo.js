import { pool } from "../db/pool.js";

const SELECT = `SELECT d.id, d.user_id, d.date_t, d.guests_amount,
  p.name_t AS customer_name, u.phone_number AS customer_phone,
  u.email AS customer_email
  FROM degustation d
  JOIN user_t u ON u.prof_id = d.user_id
  JOIN profile p ON p.prof_id = d.user_id`;

export const degustationRepo = {
  async create({ userId, date, guestsAmount }, exec = pool) {
    const { rows } = await exec.query(
      `INSERT INTO degustation (user_id, date_t, guests_amount)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, date_t, guests_amount`,
      [userId, date, guestsAmount]
    );
    return rows[0];
  },

  async findById(id, exec = pool) {
    const { rows } = await exec.query(`${SELECT} WHERE d.id = $1`, [id]);
    return rows[0] ?? null;
  },

  async list({ userId, from, limit = 100, offset = 0 } = {}, exec = pool) {
    const clauses = [];
    const params = [];
    if (userId) {
      params.push(userId);
      clauses.push(`d.user_id = $${params.length}`);
    }
    if (from) {
      params.push(from);
      clauses.push(`d.date_t >= $${params.length}`);
    }
    params.push(limit, offset);
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const { rows } = await exec.query(
      `${SELECT} ${where} ORDER BY d.date_t, d.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return rows;
  },
};
