import { ZodError } from "zod";
import { AppError, ValidationError } from "../../domain/errors.js";
import { logger } from "../../lib/logger.js";

// The single place request errors become HTTP responses. Registered LAST in the
// app. Controllers and services just throw typed errors; this maps them to a
// status + clean JSON body, and never leaks internals for unexpected failures.
// (Four args — Express identifies error middleware by arity, so `next` stays.)
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let error = err;

  // A zod error that reached here (not caught by validate) -> 400.
  if (err instanceof ZodError) {
    error = new ValidationError("Invalid request", err.flatten().fieldErrors);
  }

  if (error instanceof AppError) {
    if (!error.expected) {
      logger.error({ err: error, path: req.path }, "unexpected application error");
    }
    return res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
  }

  // Anything else is an unhandled bug — log it, return a generic 500.
  logger.error({ err, path: req.path }, "unhandled error");
  return res.status(500).json({
    error: { code: "INTERNAL", message: "Internal server error" },
  });
}
