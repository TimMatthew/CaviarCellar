import { withTransaction } from "../../db/withTransaction.js";
import { ValidationError, NotFoundError } from "../../domain/errors.js";
import { degustationRepo } from "../../reps/degustation-repo.js";
import { outboxRepo } from "../../reps/outbox-repo.js";
import { customerService } from "./customer-service.js";
import { templates } from "../../integrations/mail/templates.js";

export const degustationService = {
  async create(input) {
    const date = new Date(input.date);
    if (!Number.isFinite(date.getTime()) || date <= new Date()) {
      throw new ValidationError("Degustation must be scheduled in the future");
    }
    const id = await withTransaction(async (tx) => {
      const userId = await customerService.findOrCreate(input.customer, tx);
      const booking = await degustationRepo.create(
        { userId, date, guestsAmount: input.guestsAmount },
        tx
      );
      const message = templates.degustationBooked({
        ...booking,
        customer_name: input.customer.name,
      });
      await outboxRepo.enqueue({ to: input.customer.email, ...message }, tx);
      return booking.id;
    });
    return this.getById(id);
  },

  async getById(id) {
    const booking = await degustationRepo.findById(id);
    if (!booking) throw new NotFoundError("Degustation", id);
    return booking;
  },

  list(options) {
    return degustationRepo.list(options);
  },
};
