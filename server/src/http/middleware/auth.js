import { verifyToken } from "../../lib/token.js";
import { UnauthorizedError } from "../../domain/errors.js";

// Guards admin routes. Expects `Authorization: Bearer <token>` from a prior
// login. Validates the token (signature + expiry) and attaches the admin
// identity to req.admin. Replaces the interim x-admin-key guard.
export function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(new UnauthorizedError("Missing bearer token"));
  }
  try {
    req.admin = verifyToken(token); // { sub, username, iat, exp }
    next();
  } catch (err) {
    next(err);
  }
}
