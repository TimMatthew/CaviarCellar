import { z } from "zod";

export const deliveryDestinationSchema = z.object({
  recipientName: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(
      /^(?:[\p{Script=Cyrillic}'’\- ]+|[\p{Script=Latin}'’\- ]+)$/u,
      "Recipient name must use either Latin or Ukrainian/Cyrillic letters without mixing scripts"
    ),
    // .refine(
    //   (name) => {
    //     const parts = name.split(/\s+/).filter(Boolean);
    //     return parts.length >= 2 && parts.every((part) => part.replace(/['’\-]/g, "").length >= 2);
    //   },
    //   "Enter at least surname and first name without initials"
    // ),
  recipientPhone: z.string().regex(/^380\d{9}$/, "Phone must use 380XXXXXXXXX format"),
  cityRef: z.string().uuid(),
  warehouseRef: z.string().uuid(),
});

export const customerDeliveryQuerySchema = z.object({
  phone: z.string().regex(/^380\d{9}$/, "Phone must use 380XXXXXXXXX format"),
});
