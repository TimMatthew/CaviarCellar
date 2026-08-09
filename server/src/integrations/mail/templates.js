// Notification message bodies. Kept separate from the transport so wording
// changes don't touch the mailer. Amounts are in UAH (order.total_price).

export const templates = {
  paymentConfirmed(order) {
    return {
      subject: `Оплату отримано — замовлення №${order.order_id}`,
      text:
        `Дякуємо! Ми отримали вашу оплату на суму ${order.total_price} грн.\n` +
        `Готуємо ваше замовлення до відправлення.`,
    };
  },

  orderPlacedCod(order) {
    return {
      subject: `Замовлення №${order.order_id} прийнято`,
      text:
        `Ваше замовлення на суму ${order.total_price} грн прийнято.\n` +
        `Оплата при отриманні (післяплата) у відділенні Нової Пошти.`,
    };
  },
};
