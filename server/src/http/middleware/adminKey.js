import { config } from "../../config/index.js";
import { UnauthorizedError } from "../../domain/errors.js";

// Interim guard for admin write routes: checks the `x-admin-key` header against
// ADMIN_API_KEY. This is deliberately minimal to get the slice running securely.
// Phase C replaces it with proper login-based auth (admin_t + argon2).
export function requireAdminKey(req, res, next) {
  const key = req.get("x-admin-key");
  if (!key || key !== config.admin.apiKey) {
    return next(new UnauthorizedError("Missing or invalid admin key"));
  }
  next();
}
