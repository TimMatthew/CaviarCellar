import { ValidationError } from "../../domain/errors.js";

// Runs a zod schema against one part of the request (body | params | query) and
// replaces that part with the parsed, coerced, typed value. On failure it hands
// a ValidationError to the error middleware (400). Raw client input never
// reaches a service unvalidated.
export function validate(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(
        new ValidationError("Invalid request", result.error.flatten().fieldErrors)
      );
    }
    req[source] = result.data;
    next();
  };
}
