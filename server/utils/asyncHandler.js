/**
 * asyncHandler.js
 * A small wrapper to avoid writing try/catch repeatedly in every async controller.
 * Any rejected Promise goes directly to the Express error middleware.
 */

// fn = original controller function (req, res, next)
export const asyncHandler = (fn) => (req, res, next) =>
  // Promise.resolve converts sync errors to Promises as well
  Promise.resolve(fn(req, res, next)).catch(next); // calls next(err) if error occurs
