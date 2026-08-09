import { z } from "zod";

export const createDegustationSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().regex(/^380\d{9}$/, "Phone must use 380XXXXXXXXX format"),
    email: z.string().email().max(255).optional(),
  }),
  date: z.coerce.date().refine((value) => value.getTime() > Date.now(), {
    message: "Degustation must be scheduled in the future",
  }),
  guestsAmount: z.coerce.number().int().positive(),
});

export const listDegustationSchema = z.object({
  from: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});
