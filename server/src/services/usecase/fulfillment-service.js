import { withTransaction } from "../../db/withTransaction.js";
import { ConflictError, NotFoundError } from "../../domain/errors.js";
import { deliveryRepo } from "../../reps/delivery-repo.js";
import { deliveryEventRepo } from "../../reps/deliveryEvent-repo.js";
import { outboxRepo } from "../../reps/outbox-repo.js";
import { orderService } from "../domain/order-service.js";
import { novaPoshta } from "../../integrations/novaPoshta/novaPoshta-client.js";
import { templates } from "../../integrations/mail/templates.js";

export const fulfillmentService = {
  prepare(orderId, destination, codAmount, tx) {
    return deliveryRepo.create(
      {
        orderId,
        recipientName: destination.recipientName,
        recipientPhone: destination.recipientPhone,
        cityRef: destination.cityRef,
        warehouseRef: destination.warehouseRef,
        codAmount,
      },
      tx
    );
  },

  async fulfill(orderId) {
    const order = await orderService.getById(orderId);
    if (order.method_t === "prepaid_card" && order.status !== "paid") {
      throw new ConflictError("Prepaid order must be paid before fulfillment");
    }
    if (order.method_t === "cod" && order.status !== "pending") {
      throw new ConflictError("COD order is not ready for fulfillment");
    }
    const delivery = await deliveryRepo.findByOrderId(orderId);
    if (!delivery) throw new NotFoundError("Delivery for order", orderId);
    if (delivery.ttn) return delivery;

    const claimed = await deliveryRepo.claimForFulfillment(delivery.delivery_id);
    if (!claimed) return deliveryRepo.findById(delivery.delivery_id);

    let shipment;
    try {
      shipment = await novaPoshta.createShipment({ order, delivery: claimed });
    } catch (error) {
      // A rejected shipment is not a delivery. Remove only the unfulfilled
      // preparation row; the TTN guard protects a shipment completed by any
      // concurrent request from compensating deletion.
      await deliveryRepo.deleteUnfulfilled(delivery.delivery_id);
      throw error;
    }
    return withTransaction(async (tx) => {
      const attached = await deliveryRepo.attachShipment(delivery.delivery_id, shipment, tx);
      if (!attached) return deliveryRepo.findById(delivery.delivery_id, tx);
      await deliveryEventRepo.append(
        {
          deliveryId: attached.delivery_id,
          status: attached.status,
          description: "Nova Poshta shipment created",
        },
        tx
      );
      await outboxRepo.enqueue(
        { to: order.customer_email, ...templates.shipmentCreated(order, attached) },
        tx
      );
      return attached;
    });
  },
};
