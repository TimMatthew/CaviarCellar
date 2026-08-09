import { withTransaction } from "../../db/withTransaction.js";
import { NotFoundError } from "../../domain/errors.js";
import { assertDeliveryTransition } from "../../domain/deliveryStateMachine.js";
import { deliveryRepo } from "../../reps/delivery-repo.js";
import { deliveryEventRepo } from "../../reps/deliveryEvent-repo.js";
import { outboxRepo } from "../../reps/outbox-repo.js";
import { orderRepo } from "../../reps/order-repo.js";
import { novaPoshta } from "../../integrations/novaPoshta/novaPoshta-client.js";
import { templates } from "../../integrations/mail/templates.js";
import { refundService } from "./refund-service.js";

async function applySideEffects(delivery, order, status) {
  if (status === "delivered" && order.method_t === "cod") {
    await orderRepo.markPaid(order.order_id);
  }
  if (status === "returned") {
    if (order.method_t === "prepaid_card" && order.status === "paid") {
      await refundService.refundUncollected(order.order_id);
    } else if (order.method_t === "cod" && order.status === "pending") {
      await orderRepo.setStatus(order.order_id, "cancelled");
    }
  }
  if (status === "cancelled") {
    if (order.method_t === "prepaid_card" && order.status === "paid") {
      await refundService.refundUncollected(order.order_id);
    } else if (order.status === "pending") {
      await orderRepo.setStatus(order.order_id, "cancelled");
    }
  }
}

export const trackingService = {
  async refresh(deliveryId) {
    const delivery = await deliveryRepo.findById(deliveryId);
    if (!delivery) throw new NotFoundError("Delivery", deliveryId);
    if (!delivery.ttn) return { delivery, changed: false };
    const tracking = await novaPoshta.track(delivery.ttn, delivery.recipient_phone);
    if (!tracking) return { delivery, changed: false };
    return this.apply(delivery, tracking);
  },

  async apply(delivery, tracking) {
    const order = await orderRepo.findById(delivery.order_id);
    if (!order) throw new NotFoundError("Order", delivery.order_id);
    const result = await withTransaction(async (tx) => {
      const current = await deliveryRepo.findByIdForUpdate(delivery.delivery_id, tx);
      if (!current) throw new NotFoundError("Delivery", delivery.delivery_id);
      const changed = assertDeliveryTransition(current.status, tracking.status);
      if (!changed) return { row: current, changed: false };
      const duplicate = await deliveryEventRepo.exists(
        delivery.delivery_id,
        { status: tracking.status, npStatusCode: tracking.statusCode },
        tx
      );
      if (duplicate) return { row: current, changed: false };
      const row = await deliveryRepo.updateStatus(
        delivery.delivery_id,
        tracking.status,
        { estimatedAt: tracking.estimatedAt },
        tx
      );
      await deliveryEventRepo.append(
        {
          deliveryId: delivery.delivery_id,
          status: tracking.status,
          npStatusCode: tracking.statusCode,
          description: tracking.description,
          location: tracking.location,
        },
        tx
      );
      if (tracking.status === "shipped") {
        await outboxRepo.enqueue({ to: order.customer_email, ...templates.shipped(order, row) }, tx);
      }
      if (tracking.status === "delivered") {
        await outboxRepo.enqueue({ to: order.customer_email, ...templates.delivered(order, row) }, tx);
      }
      return { row, changed: true };
    });
    // Terminal side effects are idempotent and are reconciled even when the
    // carrier repeats an unchanged status after an earlier side-effect failure.
    if (result.changed || ["delivered", "returned", "cancelled"].includes(tracking.status)) {
      await applySideEffects(result.row, order, tracking.status);
    }
    return { delivery: result.row, changed: result.changed };
  },
};
