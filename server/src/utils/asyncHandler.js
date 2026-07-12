// ============================================================
// src/utils/asyncHandler.js
// Somossha: Express 4 async function er reject automatic dhore na.
//   router.post('/x', async (req,res) => { throw new Error('boom') })
//   -> server HANG kore jabe, response-i ashbe na.
//
// Shomadhan: prottek async controller ke ei wrapper diye moro.
//   .catch(next) automatic errorHandler e pathiye dey.
//
// Etar bikolpo: prottek controller e try/catch likha — 10 ta route mane
// 10 bar same boilerplate. Ekbar likhe reuse kora-i DRY.
// ============================================================

const asyncHandler = (fn) => (req, res, next) => {
  // fn(...) ekta Promise return kore. Promise.resolve() diye wrap kori
  // jate sync function dileo bhangbe na.
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
