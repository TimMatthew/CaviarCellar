import crypto from "node:crypto";
import { config } from "../config/index.js";
import { UnauthorizedError } from "../domain/errors.js";

// Minimal HS256 JWT using node's built-in crypto — no extra dependency. Signs a
// compact token for admin sessions and verifies it (signature + expiry). Swap
// for the `jsonwebtoken` library later if you want its extra features.

function secret() {
  if (!config.auth.secret) {
    throw new Error("AUTH_SECRET is not configured — admin login is unavailable");
  }
  return config.auth.secret;
}

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

export function signToken(payload, { expiresInSec = 60 * 60 * 8 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url({ alg: "HS256", typ: "JWT" });
  const body = b64url({ ...payload, iat: now, exp: now + expiresInSec });
  const data = `${header}.${body}`;
  const sig = crypto.createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== "string") throw new UnauthorizedError("Missing token");
  const parts = token.split(".");
  if (parts.length !== 3) throw new UnauthorizedError("Malformed token");

  const [header, body, sig] = parts;
  const expected = crypto
    .createHmac("sha256", secret())
    .update(`${header}.${body}`)
    .digest("base64url");

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new UnauthorizedError("Invalid token");
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    throw new UnauthorizedError("Invalid token");
  }

  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
    throw new UnauthorizedError("Token expired");
  }
  return payload;
}
