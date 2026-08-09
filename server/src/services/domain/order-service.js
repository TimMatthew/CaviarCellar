import { orderRepo } from "../../reps/order-repo.js";
import { orderItemRepo } from "../../reps/orderItem-repo.js";
import { NotFoundError } from "../../domain/errors.js";
import { assertTransition } from "../../domain/orderStateMachine.js";

// Order rules. The transactional writes (create, addItems) accept a tx and are
// driven by the checkout use-case. Status changes go through the state machine.

export const orderService = {
  create({ userId, method, total }, tx) {
    return orderRepo.insert({ userId, method, total }, tx);
  },

  addItems(orderId, lines, tx) {
    return orderItemRepo.insertMany(orderId, lines, tx);
  },

  list({ status, limit, offset } = {}) {
    return orderRepo.findAll({ status, limit, offset });
  },

  async getById(id) {
    const order = await orderRepo.findById(id);
    if (!order) throw new NotFoundError("Order", id);
    order.items = await orderItemRepo.findByOrder(id);
    return order;
  },

  getByFondyRef(ref) {
    return orderRepo.findByFondyRef(ref);
  },

  attachFondyRef(id, ref) {
    return orderRepo.attachFondyRef(id, ref);
  },

  // Idempotent — returns the updated row, or null if the order wasn't pending
  // (already paid). The payment webhook relies on this to survive duplicate
  // deliveries without double-processing.
  markPaid(id, { fondyPaymentId } = {}) {
    return orderRepo.markPaid(id, { fondyPaymentId });
  },

  // Explicit, guarded status change (e.g. cancelling). Throws on an illegal move.
  async transitionTo(id, toStatus) {
    const order = await orderRepo.findById(id);
    if (!order) throw new NotFoundError("Order", id);
    assertTransition(order.status, toStatus);
    await orderRepo.setStatus(id, toStatus);
    return { ...order, status: toStatus };
  },
};
