// Maps a caviar DB row to the API shape the client sees. Keeps snake_case column
// names (and any internal quirks) out of the public contract, so the schema can
// change without breaking API consumers. Note: `caviar_id` is a bigint, which
// node-postgres returns as a string — we coerce it to a number here.

export function toCaviarDto(row) {
  if (!row) return null;
  return {
    id: Number(row.caviar_id),
    title: row.title,
    manufacturerCountry: row.manufacturer_country,
    fish: row.fish,
    description: row.description,
    netWeightGrams: row.net_weight_grams,
    priceUah: row.price_uah,
    amount: row.amount,
    imagePath: row.rel_image_path,
    inStock: row.amount > 0,
  };
}

export function toCaviarDtoList(rows) {
  return rows.map(toCaviarDto);
}
