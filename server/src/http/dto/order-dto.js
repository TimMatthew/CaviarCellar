// Maps an order row (joined with its customer, and optionally its items) to the
// API shape. Hides column names and internal fields (fondy refs, user_id).

export function toOrderDto(row, items) {
  if (!row) return null;
  const dto = {
    id: Number(row.order_id),
    status: row.status,
    paymentMethod: row.method_t,
    totalUah: row.total_price,
    paidAt: row.paid_at ?? null,
    createdAt: row.created_at,
    customer: {
      name: row.customer_name,
      phone: row.customer_phone,
      email: row.customer_email,
    },
  };
  if (items) {
    dto.items = items.map((i) => ({
      caviarId: Number(i.cav_id),
      title: i.title,
      unitPriceUah: i.cav_price_snapshot,
      qty: i.cav_amount,
    }));
  }
  return dto;
}

export function toOrderDtoList(rows) {
  return rows.map((row) => toOrderDto(row));
}
