import pg from "pg";
import { config } from "../config/index.js";
import { logger } from "../lib/logger.js";

// One shared pool of reusable connections. Every repository queries through
// this — never open ad-hoc clients. `max` caps concurrent connections so we
// never exhaust PostgreSQL's connection limit under load.
export const pool = new pg.Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  max: config.db.poolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// A pooled client can error while idle (e.g. the DB restarts). Log it rather
// than let it crash the process; the pool will discard and replace the client.
pool.on("error", (err) => {
  logger.error({ err }, "unexpected error on idle PostgreSQL client");
});

// Convenience for request-scoped queries that don't need a transaction.
export function query(text, params) {
  return pool.query(text, params);
}

// Verifies the DB is reachable — used at boot and by a /health route later.
export async function healthcheck() {
  const { rows } = await pool.query("SELECT 1 AS ok");
  return rows[0]?.ok === 1;
}

// Closes the pool cleanly on shutdown.
export async function closePool() {
  await pool.end();
}
