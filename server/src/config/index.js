import "dotenv/config";
import { z } from "zod";

// Single source of truth for configuration. Validates process.env at boot and
// exposes one frozen, grouped object so nothing downstream touches process.env.
// Integration secrets (Fondy / NP / SMTP / AUTH) are optional here so the server
// boots during early phases with only the DB block — each is checked at
// point-of-use by its adapter (e.g. Fondy for prepaid, AUTH_SECRET for login).
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  BASE_URL: z.string().url().default("http://localhost:3000"),
  WEB_DIR: z.string().default("../.."),

  // Database — required
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().min(1, "DB_USER is required"),
  DB_PASSWORD: z.string().min(1, "DB_PASSWORD is required"),
  DB_NAME: z.string().min(1, "DB_NAME is required"),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),

  // Admin interim key (still used if you keep the x-admin-key guard anywhere)
  ADMIN_API_KEY: z.string().min(16, "ADMIN_API_KEY must be at least 16 chars"),

  // Admin login token signing secret — required once admin login is used
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 chars").optional(),

  // Integrations — optional until their phase
  FONDY_MERCHANT_ID: z.string().optional(),
  FONDY_SECRET_KEY: z.string().optional(),
  CHECKOUT_RETURN_URL: z.string().url().optional(),
  NP_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

const env = parsed.data;

export const config = Object.freeze({
  env: env.NODE_ENV,
  isProd: env.NODE_ENV === "production",
  logLevel: env.LOG_LEVEL,
  server: {
    port: env.PORT,
    baseUrl: env.BASE_URL,
    webDir: env.WEB_DIR,
  },
  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    name: env.DB_NAME,
    poolMax: env.DB_POOL_MAX,
  },
  admin: {
    apiKey: env.ADMIN_API_KEY,
  },
  auth: {
    secret: env.AUTH_SECRET,
  },
  fondy: {
    merchantId: env.FONDY_MERCHANT_ID,
    secretKey: env.FONDY_SECRET_KEY,
    returnUrl: env.CHECKOUT_RETURN_URL,
  },
  novaPoshta: {
    apiKey: env.NP_API_KEY,
  },
  mail: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.MAIL_FROM,
  },
});