export function toDeliveryEventDto(row) {
  return {
    id: Number(row.event_id),
    status: row.status,
    carrierStatusCode: row.np_status_code,
    description: row.description,
    location: row.location_t,
    createdAt: row.created_at,
  };
}

export function toDeliveryDto(row, events) {
  if (!row) return null;
  const dto = {
    id: Number(row.delivery_id),
    orderId: Number(row.order_id),
    carrier: row.carrier,
    trackingNumber: row.ttn,
    status: row.status,
    recipient: {
      name: row.recipient_name,
      phone: row.recipient_phone,
      cityRef: row.recipient_city_ref,
      warehouseRef: row.recipient_warehouse_ref,
    },
    codAmountUah: row.cod_amount,
    estimatedAt: row.estimated_at,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (events) dto.events = events.map(toDeliveryEventDto);
  return dto;
}
