import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1),
});

export const registerAdminSchema = z.object({
  name: z.string().trim().min(1).max(120),
  username: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/, "Username may contain letters, numbers, dot, underscore and hyphen"),
  password: z
    .string()
    .min(12, "Password must contain at least 12 characters")
    .max(128),
});
