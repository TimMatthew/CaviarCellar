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
    // Express 5 exposes req.query through a getter without a setter. Defining
    // an own value safely shadows that getter for downstream controllers while
    // retaining the useful "validated input replaces raw input" contract.
    if (source === "query") {
      Object.defineProperty(req, "query", {
        value: result.data,
        configurable: true,
        enumerable: true,
        writable: false,
      });
    } else {
      req[source] = result.data;
    }
    next();
  };
}
