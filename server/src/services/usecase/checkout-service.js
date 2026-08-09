import { withTransaction } from "../../db/withTransaction.js";
import { customerService } from "../domain/customer-service.js";
import { caviarService } from "../domain/caviar-service.js";
import { orderService } from "../domain/order-service.js";
import { fondy } from "../../integrations/fondy/fondy-client.js";
import { sendMail } from "../../integrations/mail/mailer.js";
import { templates } from "../../integrations/mail/templates.js";
import { toOrderDto } from "../../http/dto/order-dto.js";

// The place-order use-case. Owns the transaction boundary: customer + stock
// reservation + order + items commit together or not at all. External work
// (Fondy, email) happens AFTER commit, never inside the transaction.

export const checkoutService = {
  async placeOrder(input) {
    // 1) Transactional core — all-or-nothing.
    const orderId = await withTransaction(async (tx) => {
      const userId = await customerService.findOrCreate(input.customer, tx);
      const { lines, total } = await caviarService.reserveAndPrice(input.items, tx);
      const order = await orderService.create(
        { userId, method: input.paymentMethod, total },
        tx
      );
      await orderService.addItems(order.order_id, lines, tx);
      return order.order_id;
    });

    // 2) Post-commit work. Re-read with customer + items for the response.
    const order = await orderService.getById(orderId);

    if (input.paymentMethod === "prepaid_card") {
      const { checkoutUrl, fondyOrderRef } = await fondy.createCheckout(order);
      await orderService.attachFondyRef(orderId, fondyOrderRef);
      return { order: toOrderDto(order, order.items), checkoutUrl };
    }

    // COD: no online payment; acknowledge the order by email.
    const msg = templates.orderPlacedCod(order);
    await sendMail({ to: order.customer_email, ...msg });
    return { order: toOrderDto(order, order.items) };
  },
};
