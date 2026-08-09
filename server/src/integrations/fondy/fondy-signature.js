import crypto from "node:crypto";

// Fondy signature: take all params except `signature` and
// `response_signature_string`, drop empty ones, sort keys alphabetically, join
// the values with "|", prefix the merchant secret key, then SHA1. Used to sign
// our requests and to verify their callbacks.
export function fondySignature(params, secret) {
  const values = Object.keys(params)
    .filter((k) => k !== "signature" && k !== "response_signature_string")
    .filter((k) => params[k] !== "" && params[k] != null)
    .sort()
    .map((k) => params[k]);
  return crypto.createHash("sha1").update([secret, ...values].join("|")).digest("hex");
}
