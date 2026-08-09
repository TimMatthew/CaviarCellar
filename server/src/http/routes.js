import { Router } from "express";
import { asyncHandler } from "./middleware/asyncHandler.js";
import { validate } from "./middleware/validate.js";
import { requireAuth } from "./middleware/auth.js";

import { caviarController } from "./controllers/caviar-controller.js";
import { orderController } from "./controllers/order-controller.js";
import { paymentController } from "./controllers/payment-controller.js";
import { authController } from "./controllers/auth-controller.js";

import {
  caviarCreateSchema,
  caviarUpdateSchema,
  idParamSchema,
} from "./validators/caviar-schema.js";
import { placeOrderSchema } from "./validators/order-schema.js";
import { loginSchema } from "./validators/auth-schema.js";

// All API routes mount under /api (see app.js). Middleware runs left to right:
// guard -> validate -> handler.
export const router = Router();

// ── Auth ──────────────────────────────────────────────────
router.post("/auth/login", validate(loginSchema), asyncHandler(authController.login));

// ── Caviar: public reads ──────────────────────────────────
router.get("/caviar", asyncHandler(caviarController.list));
router.get(
  "/caviar/:id",
  validate(idParamSchema, "params"),
  asyncHandler(caviarController.get)
);

// ── Caviar: admin writes (require a logged-in admin via JWT) ──
router.post(
  "/caviar",
  requireAuth,
  validate(caviarCreateSchema),
  asyncHandler(caviarController.create)
);
router.put(
  "/caviar/:id",
  requireAuth,
  validate(idParamSchema, "params"),
  validate(caviarUpdateSchema),
  asyncHandler(caviarController.update)
);
router.delete(
  "/caviar/:id",
  requireAuth,
  validate(idParamSchema, "params"),
  asyncHandler(caviarController.remove)
);

// ── Orders (public: customers place and view their order) ──
router.post("/orders", validate(placeOrderSchema), asyncHandler(orderController.create));
router.get("/orders", requireAuth, asyncHandler(orderController.list));
router.get("/orders/:id", validate(idParamSchema, "params"), asyncHandler(orderController.get));
router.get(
  "/orders/:id",
  validate(idParamSchema, "params"),
  asyncHandler(orderController.get)
);


// ── Payments (Fondy server-to-server webhook) ─────────────
router.post("/payments/fondy/callback", asyncHandler(paymentController.fondyCallback));
