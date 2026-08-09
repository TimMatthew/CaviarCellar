import { ConflictError, ValidationError } from "./errors.js";

const NEXT = Object.freeze({
  pending: ["processing", "shipped", "in_transit", "delivered", "returned", "cancelled"],
  processing: ["shipped", "in_transit", "delivered", "returned", "cancelled"],
  shipped: ["in_transit", "delivered", "returned", "cancelled"],
  in_transit: ["delivered", "returned", "cancelled"],
  delivered: [],
  returned: [],
  cancelled: [],
});

export const DELIVERY_STATUSES = Object.freeze(Object.keys(NEXT));

export function isDeliveryStatus(status) {
  return Object.hasOwn(NEXT, status);
}

// Returns false for an unchanged status so callers can skip duplicate events
// and all associated side effects. Returns true for a legal new transition.
export function assertDeliveryTransition(from, to) {
  if (!isDeliveryStatus(from) || !isDeliveryStatus(to)) {
    throw new ValidationError("Unknown delivery status", { from, to });
  }
  if (from === to) return false;
  if (!NEXT[from].includes(to)) {
    throw new ConflictError(`Illegal delivery status transition: ${from} -> ${to}`);
  }
  return true;
}
