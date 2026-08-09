import { Router } from "express";
import { asyncHandler } from "./middleware/asyncHandler.js";
import { validate } from "./middleware/validate.js";
import { requireAuth } from "./middleware/auth.js";

import { caviarController } from "./controllers/caviar-controller.js";
import { orderController } from "./controllers/order-controller.js";
import { paymentController } from "./controllers/payment-controller.js";
import { authController } from "./controllers/auth-controller.js";
import { deliveryController } from "./controllers/delivery-controller.js";
import { degustationController } from "./controllers/degustation-controller.js";

import {
  caviarCreateSchema,
  caviarUpdateSchema,
  idParamSchema,
} from "./validators/caviar-schema.js";
import { placeOrderSchema } from "./validators/order-schema.js";
import { loginSchema, registerAdminSchema } from "./validators/auth-schema.js";
import {
  createDegustationSchema,
  listDegustationSchema,
} from "./validators/degustation-schema.js";
import { customerDeliveryQuerySchema } from "./validators/delivery-schema.js";

// All API routes mount under /api (see app.js). Middleware runs left to right:
// guard -> validate -> handler.
export const router = Router();

// ── Auth ──────────────────────────────────────────────────
router.post("/auth/login", validate(loginSchema), asyncHandler(authController.login));
router.post(
  "/auth/register",
  requireAuth,
  validate(registerAdminSchema),
  asyncHandler(authController.register)
);

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
router.get(
  "/orders/:id",
  requireAuth,
  validate(idParamSchema, "params"),
  asyncHandler(orderController.get)
);

// ── Delivery: customer tracking + protected administration ──
router.get(
  "/orders/:id/delivery",
  validate(idParamSchema, "params"),
  validate(customerDeliveryQuerySchema, "query"),
  asyncHandler(deliveryController.getForCustomer)
);
router.get(
  "/deliveries/:id",
  requireAuth,
  validate(idParamSchema, "params"),
  asyncHandler(deliveryController.get)
);
router.post(
  "/orders/:id/fulfill",
  requireAuth,
  validate(idParamSchema, "params"),
  asyncHandler(deliveryController.fulfill)
);
router.post(
  "/deliveries/:id/refresh",
  requireAuth,
  validate(idParamSchema, "params"),
  asyncHandler(deliveryController.refresh)
);
router.get(
  "/deliveries/:id/label",
  requireAuth,
  validate(idParamSchema, "params"),
  asyncHandler(deliveryController.label)
);

// ── Degustations: public booking + protected administration ──
router.post(
  "/degustations",
  validate(createDegustationSchema),
  asyncHandler(degustationController.create)
);
router.get(
  "/degustations",
  requireAuth,
  validate(listDegustationSchema, "query"),
  asyncHandler(degustationController.list)
);
router.get(
  "/degustations/:id",
  requireAuth,
  validate(idParamSchema, "params"),
  asyncHandler(degustationController.get)
);

// ── Payments (Fondy server-to-server webhook) ─────────────
router.post("/payments/fondy/callback", asyncHandler(paymentController.fondyCallback));
