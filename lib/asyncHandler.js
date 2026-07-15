// Express 4 doesn't forward rejected promises from async handlers to next() automatically.
// Wrapping every route in this ensures a thrown/rejected DB error reaches the error
// middleware (500 page) instead of silently hanging the request.
module.exports = function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
};
