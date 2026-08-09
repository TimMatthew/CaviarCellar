import { caviarRepo } from "../../reps/caviar-repo.js";
import { NotFoundError } from "../../domain/errors.js";

// Business rules + CRUD for one aggregate (caviar). Sits between the controller
// and the repository: the controller stays HTTP-only, the repository stays
// SQL-only, and the "what does it mean when a row is missing" decision lives
// here (throw NotFoundError -> 404). For simple CRUD the rules are thin; that's
// expected — the layer earns its keep as soon as logic grows.

export const caviarService = {
  list({ inStockOnly = false } = {}) {
    return caviarRepo.findAll({ inStockOnly });
  },

  async getById(id) {
    const row = await caviarRepo.findById(id);
    if (!row) throw new NotFoundError("Caviar", id);
    return row;
  },

  create(data) {
    return caviarRepo.insert(data);
  },

  async update(id, data) {
    const row = await caviarRepo.update(id, data);
    if (!row) throw new NotFoundError("Caviar", id);
    return row;
  },

  async remove(id) {
    const ok = await caviarRepo.remove(id);
    if (!ok) throw new NotFoundError("Caviar", id);
  },

  // Reserve stock and snapshot prices for a set of cart items, atomically.
  // MUST run inside a transaction (pass tx) — the whole checkout is all-or-
  // nothing. Prices come from the DB, never from the client. Throws NotFound
  // for an unknown product and Conflict when stock is insufficient.
  async reserveAndPrice(items, tx) {
    const lines = [];
    let total = 0;
    for (const item of items) {
      const caviar = await caviarRepo.findById(item.caviarId, tx);
      if (!caviar) throw new NotFoundError("Caviar", item.caviarId);
      const reserved = await caviarRepo.decrementStock(item.caviarId, item.qty, tx);
      if (!reserved) throw new ConflictError(`Insufficient stock for "${caviar.title}"`);
      const unitPrice = caviar.price_uah;
      total += unitPrice * item.qty;
      lines.push({ caviarId: Number(caviar.caviar_id), qty: item.qty, unitPrice });
    }
    return { lines, total };
  },
};
