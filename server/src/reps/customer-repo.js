import { pool } from "../db/pool.js";

// Data access for a customer, which is the profile + user_t identity pair.
// Creating a customer writes both rows; callers in a transaction pass their tx.

export const customerRepo = {
  async findByPhone(phone, exec = pool) {
    const { rows } = await exec.query(
      `SELECT u.prof_id, u.phone_number, u.email, p.name_t
         FROM user_t u
         JOIN profile p ON p.prof_id = u.prof_id
        WHERE u.phone_number = $1`,
      [phone]
    );
    return rows[0] ?? null;
  },

  async create({ name, phone, email }, exec = pool) {
    const { rows } = await exec.query(
      `INSERT INTO profile (name_t) VALUES ($1) RETURNING prof_id`,
      [name]
    );
    const profId = rows[0].prof_id;
    await exec.query(
      `INSERT INTO user_t (prof_id, phone_number, email) VALUES ($1, $2, $3)`,
      [profId, phone, email ?? null]
    );
    return { prof_id: profId, phone_number: phone, email: email ?? null, name_t: name };
  },

  async updateContact(profId, { email }, exec = pool) {
    await exec.query(
      `UPDATE user_t SET email = COALESCE($2, email) WHERE prof_id = $1`,
      [profId, email ?? null]
    );
  },
};
