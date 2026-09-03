import { z } from "zod";

export const createDegustationSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1).max(120),
    phone: z
      .string()
      .regex(/^\d{8,15}$/, "Phone must use international E.164 digits without +"),
    email: z.string().email().max(255).optional(),
  }),
  date: z.coerce.date().refine((value) => value.getTime() > Date.now(), {
    message: "Degustation must be scheduled in the future",
  }),
  guestsAmount: z.coerce.number().int().positive(),
});

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Date is invalid");

export const degustationAvailabilitySchema = z
  .object({
    from: dateOnlySchema,
    to: dateOnlySchema,
  })
  .superRefine(({ from, to }, context) => {
    const fromTime = Date.parse(`${from}T00:00:00.000Z`);
    const toTime = Date.parse(`${to}T00:00:00.000Z`);
    if (toTime < fromTime) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "The end date must not precede the start date",
      });
      return;
    }
    if (toTime - fromTime > 62 * 24 * 60 * 60 * 1000) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "Availability can be requested for at most 63 days",
      });
    }
  });

export const listDegustationSchema = z.object({
  from: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});
