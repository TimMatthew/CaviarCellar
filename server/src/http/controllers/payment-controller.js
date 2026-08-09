import { fondy } from "../../integrations/fondy/fondy-client.js";
import { orderService } from "../../services/domain/order-service.js";
import { sendMail } from "../../integrations/mail/mailer.js";
import { templates } from "../../integrations/mail/templates.js";
import { logger } from "../../lib/logger.js";

export const paymentController = {
  // Fondy server-to-server callback — the authoritative proof of payment.
  // Verify the signature first; only an approved, still-pending order is paid.
  async fondyCallback(req, res) {
    const result = fondy.verifyCallback(req.body);

    if (!result.valid) {
      return res.status(400).json({ error: { code: "BAD_SIGNATURE", message: "Invalid signature" } });
    }

    // Ack immediately so Fondy stops retrying; the work below must not fail the ack.
    res.json({ status: "ok" });
    if (!result.approved) return;

    try {
      const order = await orderService.getByFondyRef(result.fondyOrderRef);
      if (!order || order.status !== "pending") return; // unknown or already handled

      const paid = await orderService.markPaid(order.order_id, {
        fondyPaymentId: result.fondyPaymentId,
      });
      if (!paid) return; // lost the race — another delivery already paid it

      const msg = templates.paymentConfirmed(order);
      await sendMail({ to: order.customer_email, ...msg });
      // Phase D: trigger fulfillment (create the Nova Poshta shipment) here.
    } catch (err) {
      logger.error({ err, ref: result.fondyOrderRef }, "fondy callback processing failed");
    }
  },
};
