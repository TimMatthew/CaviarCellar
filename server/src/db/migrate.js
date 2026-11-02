import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closePool, pool } from "./pool.js";

const migrationDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "migrations"
);

// Two application-specific 32-bit keys identify this session-level PostgreSQL
// advisory lock. Only one migrator using these keys can run at a time.
const advisoryLockKeys = [1130456681, 1130728556];
const lockWaitMs = 60_000;
const lockPollMs = 1_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSql(source) {
  return source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

function checksum(source) {
  return createHash("sha256").update(source, "utf8").digest("hex");
}

// Existing migrations were authored as standalone scripts and contain their
// own BEGIN/COMMIT lines. The runner must own that transaction so the schema
// change and applied_migration insert are atomic. Future migrations may omit
// transaction markers entirely. Other transaction-control layouts are rejected
// instead of being executed with ambiguous commit behavior.
function removeStandaloneTransactionWrapper(source, filename) {
  const lines = source.split("\n");
  const controls = [];

  for (let index = 0; index < lines.length; index += 1) {
    const statement = lines[index]
      .replace(/--.*$/, "")
      .trim()
      .toUpperCase();

    if (["BEGIN;", "COMMIT;", "ROLLBACK;"].includes(statement)) {
      controls.push({ index, statement });
    }
  }

  if (controls.length === 0) return source;

  if (
    controls.length !== 2 ||
    controls[0].statement !== "BEGIN;" ||
    controls[1].statement !== "COMMIT;"
  ) {
    throw new Error(
      `${filename} has unsupported transaction control; use one outer BEGIN/COMMIT pair or no transaction statements`
    );
  }

  lines[controls[0].index] = "-- BEGIN managed by migration runner";
  lines[controls[1].index] = "-- COMMIT managed by migration runner";
  return lines.join("\n");
}

async function loadMigrations() {
  const entries = await readdir(migrationDirectory, { withFileTypes: true });
  const migrations = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".sql")) continue;

    const match = /^(\d+)[_-].+\.sql$/i.exec(entry.name);
    if (!match) {
      throw new Error(
        `Invalid migration filename ${entry.name}; expected a numeric prefix such as 010_description.sql`
      );
    }

    const version = Number(match[1]);
    if (!Number.isSafeInteger(version) || version <= 0) {
      throw new Error(`Invalid migration version in ${entry.name}`);
    }

    const source = normalizeSql(
      await readFile(path.join(migrationDirectory, entry.name), "utf8")
    );

    migrations.push({
      version,
      filename: entry.name,
      checksum: checksum(source),
      sql: removeStandaloneTransactionWrapper(source, entry.name),
    });
  }

  migrations.sort(
    (left, right) => left.version - right.version || left.filename.localeCompare(right.filename)
  );

  for (let index = 1; index < migrations.length; index += 1) {
    if (migrations[index - 1].version === migrations[index].version) {
      throw new Error(
        `Duplicate migration version ${migrations[index].version}: ` +
          `${migrations[index - 1].filename}, ${migrations[index].filename}`
      );
    }
  }

  if (migrations.length === 0) {
    throw new Error(`No migration files found in ${migrationDirectory}`);
  }

  return migrations;
}

async function acquireMigrationLock(client) {
  const deadline = Date.now() + lockWaitMs;

  while (true) {
    const { rows } = await client.query(
      "SELECT pg_try_advisory_lock($1, $2) AS locked",
      advisoryLockKeys
    );

    if (rows[0]?.locked === true) return;
    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out after ${lockWaitMs} ms waiting for another migration process`
      );
    }

    await sleep(lockPollMs);
  }
}

async function releaseMigrationLock(client) {
  const { rows } = await client.query(
    "SELECT pg_advisory_unlock($1, $2) AS unlocked",
    advisoryLockKeys
  );

  if (rows[0]?.unlocked !== true) {
    console.warn("Migration advisory lock was not held when release was requested");
  }
}

async function ensureLedger(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS applied_migration (
      version     integer PRIMARY KEY,
      filename    text NOT NULL UNIQUE,
      checksum    char(64) NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function readAppliedMigrations(client) {
  const { rows } = await client.query(`
    SELECT version, filename, checksum, applied_at
    FROM applied_migration
    ORDER BY version
  `);

  return rows.map((row) => ({
    version: Number(row.version),
    filename: row.filename,
    checksum: row.checksum.trim(),
    appliedAt: row.applied_at,
  }));
}

function verifyHistory(migrations, applied) {
  const filesByVersion = new Map(migrations.map((migration) => [migration.version, migration]));
  const appliedByVersion = new Map(applied.map((migration) => [migration.version, migration]));

  for (const record of applied) {
    const file = filesByVersion.get(record.version);
    if (!file) {
      throw new Error(
        `Applied migration ${record.version} (${record.filename}) is missing from the repository`
      );
    }
    if (file.filename !== record.filename) {
      throw new Error(
        `Migration ${record.version} was renamed from ${record.filename} to ${file.filename}`
      );
    }
    if (file.checksum !== record.checksum) {
      throw new Error(
        `Checksum mismatch for applied migration ${record.filename}; applied migrations must not be edited`
      );
    }
  }

  return appliedByVersion;
}

async function applyMigration(client, migration) {
  const startedAt = Date.now();
  await client.query("BEGIN");

  try {
    await client.query(migration.sql);
    await client.query(
      `INSERT INTO applied_migration (version, filename, checksum)
       VALUES ($1, $2, $3)`,
      [migration.version, migration.filename, migration.checksum]
    );
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original migration error; a broken connection releases
      // both the transaction and the session advisory lock automatically.
    }
    throw new Error(`Migration ${migration.filename} failed: ${error.message}`, {
      cause: error,
    });
  }

  console.log(`Applied ${migration.filename} (${Date.now() - startedAt} ms)`);
}

async function migrate() {
  const migrations = await loadMigrations();
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await acquireMigrationLock(client);
    lockAcquired = true;
    await ensureLedger(client);

    const applied = await readAppliedMigrations(client);
    const appliedByVersion = verifyHistory(migrations, applied);
    const pending = migrations.filter(
      (migration) => !appliedByVersion.has(migration.version)
    );

    if (pending.length === 0) {
      console.log(`Database is up to date (${applied.length} migrations applied)`);
      return;
    }

    for (const migration of pending) {
      await applyMigration(client, migration);
    }

    console.log(`Migration complete (${pending.length} applied, ${migrations.length} total)`);
  } finally {
    if (lockAcquired) {
      try {
        await releaseMigrationLock(client);
      } catch (error) {
        console.warn(`Could not release migration advisory lock: ${error.message}`);
      }
    }
    client.release();
  }
}

try {
  await migrate();
} catch (error) {
  console.error(error.message);
  if (error.cause?.code) console.error(`PostgreSQL error code: ${error.cause.code}`);
  process.exitCode = 1;
} finally {
  await closePool();
}
