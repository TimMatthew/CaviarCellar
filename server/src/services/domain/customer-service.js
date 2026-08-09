import { customerRepo } from "../../reps/customer-repo.js";

// Customer rules. A customer is identified by phone (unique). On checkout we
// find the existing customer or create one, refreshing their email if a newer
// one was given. Accepts a tx so it participates in the checkout transaction.

export const customerService = {
  async findOrCreate({ name, phone, email }, exec) {
    const existing = await customerRepo.findByPhone(phone, exec);
    if (existing) {
      if (email && email !== existing.email) {
        await customerRepo.updateContact(existing.prof_id, { email }, exec);
      }
      return Number(existing.prof_id);
    }
    const created = await customerRepo.create({ name, phone, email }, exec);
    return Number(created.prof_id);
  },
};
