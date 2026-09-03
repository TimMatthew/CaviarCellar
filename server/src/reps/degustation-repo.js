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

  async availability({ from, to }, exec = pool) {
    const { rows } = await exec.query(
      `WITH days AS (
         SELECT generate_series($1::date, $2::date, interval '1 day')::date AS day
       ),
       slots AS (
         SELECT days.day,
                local_slot.starts_at AS local_start,
                local_slot.starts_at AT TIME ZONE 'Europe/Kyiv' AS starts_at
           FROM days
           CROSS JOIN LATERAL generate_series(
             days.day::timestamp + time '10:00',
             days.day::timestamp + time '20:40',
             interval '20 minutes'
           ) AS local_slot(starts_at)
       )
       SELECT to_char(slots.day, 'YYYY-MM-DD') AS date,
              COALESCE(
                json_agg(
                  json_build_object(
                    'start', slots.starts_at,
                    'label', to_char(slots.local_start, 'HH24:MI') ||
                             ' – ' ||
                             to_char(slots.local_start + interval '20 minutes', 'HH24:MI')
                  )
                  ORDER BY slots.starts_at
                ) FILTER (WHERE d.id IS NULL AND slots.starts_at > now()),
                '[]'::json
              ) AS slots
         FROM slots
         LEFT JOIN degustation d ON d.date_t = slots.starts_at
        GROUP BY slots.day
        ORDER BY slots.day`,
      [from, to]
    );

    return rows.map((row) => ({
      date: row.date,
      available: row.slots.length > 0,
      slots: row.slots,
    }));
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
