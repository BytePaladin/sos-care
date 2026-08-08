/**
 * pagination.js
 * --------------------------------------------------------------------------
 * Week 5: shared pagination parsing and metadata.
 *
 * Backwards compatibility note — this matters:
 * `GET /api/triage/patients` currently returns a bare JSON array, and the
 * dashboard reads it as one. Wrapping every response in { data, meta } would
 * break the frontend on the day it was deployed.
 *
 * So pagination here is *opt-in*: the envelope is only returned when the
 * caller explicitly asks by sending ?page=. Without it the endpoint behaves
 * exactly as before. The page metadata is additionally exposed through
 * response headers, so even a legacy caller can read the totals.
 * --------------------------------------------------------------------------
 */

const DEFAULT_PAGE_SIZE = 25; // sensible default for a dashboard table
const MAX_PAGE_SIZE = 100; // hard ceiling so one request cannot pull everything

/**
 * Reads page/limit from the query string and returns safe values.
 * @param {object} query — req.query
 */
export const parsePagination = (query = {}) => {
  const wantsPagination = query.page !== undefined; // the opt-in signal

  // Number('abc') is NaN and Number('') is 0, so both are handled by the || 1
  const rawPage = Number.parseInt(query.page, 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const rawLimit = Number.parseInt(query.limit, 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;

  return {
    wantsPagination,
    page,
    limit,
    skip: (page - 1) * limit, // how many documents to step over
  };
};

/**
 * Builds the metadata block returned alongside a paginated result.
 * @param {number} totalItems — total matching documents, before paging
 * @param {{page:number, limit:number}} opts
 */
export const buildPageMeta = (totalItems, { page, limit }) => {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1 && totalItems > 0,
  };
};

/**
 * Writes the page metadata into response headers.
 * This is what lets a caller that did not ask for the envelope still discover
 * how many records exist in total.
 */
export const setPageHeaders = (res, meta) => {
  res.set('X-Total-Count', String(meta.totalItems));
  res.set('X-Page', String(meta.page));
  res.set('X-Page-Size', String(meta.limit));
  res.set('X-Total-Pages', String(meta.totalPages));
};
