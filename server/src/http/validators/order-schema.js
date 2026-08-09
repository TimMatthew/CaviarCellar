import { z } from "zod";

// Validates the place-order request. The client sends who they are, how they'll
// pay, and what they want — but NOT prices (the server prices from the DB).
export const placeOrderSchema = z.object({
  customer: z.object({
    name: z.string().min(1).max(120),
    phone: z.string().min(5).max(20),
    email: z.string().email().max(255).optional(),
  }),
  paymentMethod: z.enum(["prepaid_card", "cod"]),
  items: z
    .array(
      z.object({
        caviarId: z.coerce.number().int().positive(),
        qty: z.coerce.number().int().positive(),
      })
    )
    .min(1),
});
