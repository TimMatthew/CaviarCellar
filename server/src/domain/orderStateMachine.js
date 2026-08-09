import { ConflictError } from "./errors.js";

// The only legal order status transitions. Any code that changes an order's
// status calls assertTransition first, so an order can never move backward
// (paid -> pending) or sideways (refunded -> paid). One definition, used by
// checkout, the payment webhook, and refunds alike.
const NEXT = {
  pending: ["paid", "cancelled"],
  paid: ["refunded"],
  cancelled: [],
  refunded: [],
};

export const ORDER_STATUSES = Object.keys(NEXT);

export function assertTransition(from, to) {
  const allowed = NEXT[from] ?? [];
  if (!allowed.includes(to)) {
    throw new ConflictError(`Illegal order status transition: ${from} -> ${to}`);
  }
}
