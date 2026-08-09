export function toDegustationDto(row) {
  return {
    id: Number(row.id),
    date: row.date_t,
    guestsAmount: row.guests_amount,
    customer: row.customer_name
      ? {
          id: Number(row.user_id),
          name: row.customer_name,
          phone: row.customer_phone,
          email: row.customer_email,
        }
      : undefined,
  };
}

export function toDegustationDtoList(rows) {
  return rows.map(toDegustationDto);
}
