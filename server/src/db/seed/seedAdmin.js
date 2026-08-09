import argon2 from "argon2";
import { pool, closePool } from "../pool.js";

// Bootstraps an admin account. There's no admin yet to create others, so run
// this once to create the first one:
//   node src/db/seed/seedAdmin.js <username> <password> [displayName]

const [, , username, password, name = "Admin"] = process.argv;

if (!username || !password) {
  console.error("Usage: node src/db/seed/seedAdmin.js <username> <password> [displayName]");
  process.exit(1);
}

const hash = await argon2.hash(password);
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const { rows } = await client.query(
    `INSERT INTO profile (name_t) VALUES ($1) RETURNING prof_id`,
    [name]
  );
  const profId = rows[0].prof_id;
  await client.query(
    `INSERT INTO admin_t (prof_id, username, password_t) VALUES ($1, $2, $3)`,
    [profId, username, hash]
  );
  await client.query("COMMIT");
  console.log(`Admin created: ${username} (prof_id ${profId})`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Failed to create admin:", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await closePool();
}
