import { readFile } from "node:fs/promises";
import { closePool, pool } from "../pool.js";

const seedFile = new URL("./seed_caviar.sql", import.meta.url);

try {
  const sql = await readFile(seedFile, "utf8");
  await pool.query(sql);

  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM caviar"
  );
  console.log(`Catalogue seed complete (${rows[0].count} products total)`);
} catch (err) {
  console.error("Failed to seed catalogue:", err.message);
  process.exitCode = 1;
} finally {
  await closePool();
}
