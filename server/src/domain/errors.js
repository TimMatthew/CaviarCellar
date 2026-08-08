// Typed error hierarchy. Services and domain rules throw these instead of raw
// Error, so one piece of middleware (Phase B) can map them to HTTP status codes
// consistently. `status` drives the HTTP response; `expected` distinguishes
// operational errors (safe to show the client) from unexpected bugs (log + 500).

export class AppError extends Error {
  constructor(message, { status = 500, code = "INTERNAL", details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
    this.expected = status < 500; // operational vs. programmer error
    Error.captureStackTrace?.(this, this.constructor);
  }
}

// 400 — request data failed validation.
export class ValidationError extends AppError {
  constructor(message = "Validation failed", details) {
    super(message, { status: 400, code: "VALIDATION", details });
  }
}

// 401 — missing or invalid credentials.
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, { status: 401, code: "UNAUTHORIZED" });
  }
}

// 403 — authenticated but not allowed.
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, { status: 403, code: "FORBIDDEN" });
  }
}

// 404 — resource does not exist.
export class NotFoundError extends AppError {
  constructor(resource = "Resource", id) {
    super(`${resource}${id != null ? ` ${id}` : ""} not found`, {
      status: 404,
      code: "NOT_FOUND",
    });
  }
}

// 409 — the request conflicts with current state (e.g. illegal status change,
// out-of-stock, duplicate).
export class ConflictError extends AppError {
  constructor(message = "Conflict", details) {
    super(message, { status: 409, code: "CONFLICT", details });
  }
}

// 502 — a payment operation failed (Fondy).
export class PaymentError extends AppError {
  constructor(message = "Payment failed", details) {
    super(message, { status: 502, code: "PAYMENT", details });
  }
}

// 502 — an upstream integration failed (Nova Poshta, SMTP).
export class IntegrationError extends AppError {
  constructor(message = "Upstream service failed", details) {
    super(message, { status: 502, code: "INTEGRATION", details });
  }
}
