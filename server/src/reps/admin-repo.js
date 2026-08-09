import { pool } from "../db/pool.js";

// Data access for administrators (admin_t + profile). `username` is added by
// migration 006 as the login identifier. password_t holds an argon2 HASH.

export const adminRepo = {
  async findByUsername(username, exec = pool) {
    const { rows } = await exec.query(
      `SELECT a.prof_id, a.username, a.password_t, p.name_t
         FROM admin_t a
         JOIN profile p ON p.prof_id = a.prof_id
        WHERE a.username = $1`,
      [username]
    );
    return rows[0] ?? null;
  },

  async create({ name, username, passwordHash }, exec = pool) {
    const { rows } = await exec.query(
      `INSERT INTO profile (name_t) VALUES ($1) RETURNING prof_id`,
      [name]
    );
    const profId = rows[0].prof_id;
    await exec.query(
      `INSERT INTO admin_t (prof_id, username, password_t) VALUES ($1, $2, $3)`,
      [profId, username, passwordHash]
    );
    return { prof_id: profId, username, name_t: name };
  },
};
