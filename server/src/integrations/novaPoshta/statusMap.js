// Nova Poshta StatusCode values are normalized at the adapter boundary so the
// rest of the application only knows its seven delivery states.
const STATUS_MAP = new Map([
  ["1", "processing"],
  ["2", "cancelled"],
  ["3", "cancelled"],
  ["4", "shipped"],
  ["5", "in_transit"],
  ["6", "in_transit"],
  ["7", "in_transit"],
  ["8", "in_transit"],
  ["9", "delivered"],
  ["10", "delivered"],
  ["11", "delivered"],
  ["12", "delivered"],
  ["41", "in_transit"],
  ["101", "returned"],
  ["102", "returned"],
  ["103", "returned"],
  ["104", "returned"],
  ["105", "returned"],
  ["106", "delivered"],
]);

export function mapNovaPoshtaStatus(code) {
  return STATUS_MAP.get(String(code)) ?? "processing";
}
