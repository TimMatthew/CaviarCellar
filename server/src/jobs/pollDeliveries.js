import { config } from "../config/index.js";
import { deliveryRepo } from "../reps/delivery-repo.js";
import { novaPoshta } from "../integrations/novaPoshta/novaPoshta-client.js";
import { trackingService } from "../services/usecase/tracking-service.js";
import { logger } from "../lib/logger.js";

export async function pollDeliveries() {
  const deliveries = await deliveryRepo.listInFlight({ limit: config.jobs.trackingBatchSize });
  if (!deliveries.length) return { checked: 0, changed: 0, failed: 0 };

  const statuses = await novaPoshta.trackMany(
    deliveries.map((delivery) => ({ ttn: delivery.ttn, phone: delivery.recipient_phone }))
  );
  const statusesByTtn = new Map(statuses.map((status) => [status.ttn, status]));
  let changed = 0;
  let failed = 0;
  for (let index = 0; index < deliveries.length; index += 1) {
    const delivery = deliveries[index];
    const status = statusesByTtn.get(delivery.ttn) ?? statuses[index];
    if (!status) continue;
    try {
      const result = await trackingService.apply(delivery, status);
      if (result.changed) changed += 1;
    } catch (error) {
      failed += 1;
      logger.error({ err: error, deliveryId: delivery.delivery_id }, "delivery polling item failed");
    }
  }
  logger.info({ checked: deliveries.length, changed, failed }, "delivery polling complete");
  return { checked: deliveries.length, changed, failed };
}
