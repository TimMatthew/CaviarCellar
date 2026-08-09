import { NotFoundError } from "../../domain/errors.js";
import { deliveryRepo } from "../../reps/delivery-repo.js";
import { deliveryEventRepo } from "../../reps/deliveryEvent-repo.js";
import { orderRepo } from "../../reps/order-repo.js";
import { fulfillmentService } from "../../services/usecase/fulfillment-service.js";
import { trackingService } from "../../services/usecase/tracking-service.js";
import { novaPoshta } from "../../integrations/novaPoshta/novaPoshta-client.js";
import { toDeliveryDto } from "../dto/delivery-dto.js";

async function loadWithEvents(delivery) {
  if (!delivery) return null;
  const events = await deliveryEventRepo.listByDelivery(delivery.delivery_id);
  return toDeliveryDto(delivery, events);
}

export const deliveryController = {
  async getForCustomer(req, res) {
    const order = await orderRepo.findById(req.params.id);
    if (!order || order.customer_phone !== req.query.phone) {
      throw new NotFoundError("Delivery for order", req.params.id);
    }
    const delivery = await deliveryRepo.findByOrderId(req.params.id);
    if (!delivery) throw new NotFoundError("Delivery for order", req.params.id);
    res.json(await loadWithEvents(delivery));
  },

  async get(req, res) {
    const delivery = await deliveryRepo.findById(req.params.id);
    if (!delivery) throw new NotFoundError("Delivery", req.params.id);
    res.json(await loadWithEvents(delivery));
  },

  async fulfill(req, res) {
    const delivery = await fulfillmentService.fulfill(req.params.id);
    res.json(await loadWithEvents(delivery));
  },

  async refresh(req, res) {
    const result = await trackingService.refresh(req.params.id);
    res.json({ changed: result.changed, delivery: await loadWithEvents(result.delivery) });
  },

  async label(req, res) {
    const delivery = await deliveryRepo.findById(req.params.id);
    if (!delivery?.ttn) throw new NotFoundError("Shipped delivery", req.params.id);
    res.json({ url: novaPoshta.labelUrl(delivery.ttn) });
  },
};
