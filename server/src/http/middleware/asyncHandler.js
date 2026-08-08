// Wraps an async route handler so a rejected promise reaches Express's error
// middleware. Express 4 doesn't forward async errors on its own, so without this
// a thrown NotFoundError inside an `async` controller would hang the request.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
