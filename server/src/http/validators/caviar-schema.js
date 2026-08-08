import { z } from "zod";

// Request schemas for caviar. Field names are the API's camelCase; the DTO/repo
// map them to snake_case columns. Constraints mirror the DB CHECKs so bad input
// is rejected at the edge (400) before it ever reaches a query.

export const caviarCreateSchema = z.object({
  title: z.string().min(1).max(150),
  manufacturerCountry: z.string().max(100).optional(),
  fish: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  netWeightGrams: z.coerce.number().int().positive().optional(),
  priceUah: z.coerce.number().int().nonnegative(),
  amount: z.coerce.number().int().nonnegative().default(0),
  relImagePath: z.string().max(255).optional(),
});

// Update is a partial of create — any subset of fields may be sent.
export const caviarUpdateSchema = caviarCreateSchema.partial();

// Path parameter :id -> a positive integer.
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
