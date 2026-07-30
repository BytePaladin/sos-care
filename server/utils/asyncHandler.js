/**
 * asyncHandler.js
 * প্রতিটি async controller-এ বার বার try/catch লেখা এড়ানোর জন্য ছোট wrapper.
 * কোনো Promise reject হলে সেটা সরাসরি Express error middleware-এ চলে যাবে.
 */

// fn = আসল controller function (req, res, next)
export const asyncHandler = (fn) => (req, res, next) =>
  // Promise.resolve দিয়ে sync error গুলোকেও Promise-এ রূপান্তর করা হচ্ছে
  Promise.resolve(fn(req, res, next)).catch(next); // error হলে next(err) কল হবে
