import { pool } from "./pool.js";

/**
 * Run `fn` inside a single all-or-nothing transaction.
 *
 * Grabs a dedicated client from the pool, opens the transaction, and passes the
 * client to `fn` as the transaction handle (`tx`). Every repository call that
 * must be atomic together should be given this same `tx`. Commits if `fn`
 * returns, rolls back if it throws, and always returns the client to the pool.
 *
 * IMPORTANT: keep slow external work (Fondy, Nova Poshta, email) OUTSIDE the
 * callback — do it after `withTransaction` resolves. Holding a pooled connection
 * open across a network call ties up the pool and can time out the DB writes.
 *
 * @example
 *   const order = await withTransaction(async (tx) => {
 *     const o = await orderRepo.insert(tx, data);
 *     await orderItemRepo.insertMany(tx, o.order_id, lines);
 *     await caviarRepo.decrementStock(tx, lines);
 *     return o;
 *   });
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Swallow rollback failure — the original error is the meaningful one.
    }
    throw err;
  } finally {
    client.release();
  }
}
