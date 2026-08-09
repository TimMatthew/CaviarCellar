import { fondy } from "../../integrations/fondy/fondy-client.js";
import { orderService } from "../../services/domain/order-service.js";
import { templates } from "../../integrations/mail/templates.js";
import { fulfillmentService } from "../../services/usecase/fulfillment-service.js";
import { outboxRepo } from "../../reps/outbox-repo.js";

export const paymentController = {
  // Fondy server-to-server callback — the authoritative proof of payment.
  // Verify the signature first; only an approved, still-pending order is paid.
  async fondyCallback(req, res) {
    const result = fondy.verifyCallback(req.body);

    if (!result.valid) {
      return res.status(400).json({ error: { code: "BAD_SIGNATURE", message: "Invalid signature" } });
    }

    if (!result.approved) return res.json({ status: "ok" });

    let order = await orderService.getByFondyRef(result.fondyOrderRef);
    if (!order) return res.json({ status: "ok" });
    if (order.status === "pending") {
      const paid = await orderService.markPaid(order.order_id, {
        fondyPaymentId: result.fondyPaymentId,
      });
      if (paid) {
        await outboxRepo.enqueue({ to: order.customer_email, ...templates.paymentConfirmed(order) });
      }
      order = await orderService.getById(order.order_id);
    }
    if (order.status === "paid") await fulfillmentService.fulfill(order.order_id);
    return res.json({ status: "ok" });
  },
};
