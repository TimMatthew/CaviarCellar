import { Router } from "express";
import { caviarController } from "./controllers/caviar.controller.js";
import { validate } from "./middleware/validate.js";
import { requireAdminKey } from "./middleware/adminKey.js";
import {
  caviarCreateSchema,
  caviarUpdateSchema,
  idParamSchema,
} from "./validators/caviar.schema.js";
import { asyncHandler } from "../lib/asyncHandler.js";

// All API routes mount under /api (see app.js). Middleware runs left to right:
// guard -> validate -> handler. As later phases add controllers, register them
// here the same way.
export const router = Router();

// ── Caviar: public reads ──────────────────────────────────
router.get("/caviar", asyncHandler(caviarController.list));

router.get(
  "/caviar/:id",
  validate(idParamSchema, "params"),
  asyncHandler(caviarController.get)
);

// ── Caviar: admin writes (interim x-admin-key; Phase C -> login auth) ──
router.post(
  "/caviar",
  requireAdminKey,
  validate(caviarCreateSchema),
  asyncHandler(caviarController.create)
);

router.put(
  "/caviar/:id",
  requireAdminKey,
  validate(idParamSchema, "params"),
  validate(caviarUpdateSchema),
  asyncHandler(caviarController.update)
);

router.delete(
  "/caviar/:id",
  requireAdminKey,
  validate(idParamSchema, "params"),
  asyncHandler(caviarController.remove)
);
