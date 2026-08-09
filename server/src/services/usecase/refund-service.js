import { withTransaction } from "../../db/withTransaction.js";
import { ConflictError, NotFoundError } from "../../domain/errors.js";
import { refundRepo } from "../../reps/refund-repo.js";
import { orderRepo } from "../../reps/order-repo.js";
import { fondy } from "../../integrations/fondy/fondy-client.js";
import { assertTransition } from "../../domain/orderStateMachine.js";

export const refundService = {
  async refundUncollected(orderId) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw new NotFoundError("Order", orderId);
    if (order.method_t !== "prepaid_card" || order.status !== "paid") {
      throw new ConflictError("Only a paid prepaid order can be refunded");
    }
    if (!order.fondy_order_ref || !order.fondy_payment_id) {
      throw new ConflictError("Order has no confirmed Fondy payment reference");
    }

    let refund = await refundRepo.findByOrderId(orderId);
    if (refund?.status === "done") return refund;
    if (refund?.status === "failed") {
      refund = await refundRepo.retry(refund.refund_id);
    }
    if (!refund) {
      refund = await refundRepo.create({ orderId, amount: order.total_price });
      if (!refund) refund = await refundRepo.findByOrderId(orderId);
    }

    try {
      const result = await fondy.reverse(order);
      return withTransaction(async (tx) => {
        const current = await orderRepo.findById(orderId, tx);
        if (current.status === "paid") {
          assertTransition(current.status, "refunded");
          await orderRepo.setStatus(orderId, "refunded", tx);
        }
        return refundRepo.markDone(refund.refund_id, result.reverseRef, tx);
      });
    } catch (error) {
      await refundRepo.markFailed(refund.refund_id, error.message);
      throw error;
    }
  },
};
