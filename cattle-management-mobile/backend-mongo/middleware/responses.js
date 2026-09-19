/**
 * One response envelope for the whole API.
 *
 *   Single:  { success: true, data: {...}, timestamp }
 *   List:    { success: true, data: [...], pagination: {...}, timestamp }
 *   Error:   { success: false, error, message?, errors?, timestamp }
 *
 * `data` always holds the payload, so the mobile client reads `res.data.data`
 * everywhere with no special cases.
 */

// ─── Success ─────────────────────────────────────────────────────────────────

const ok = (res, data, message) =>
  res.status(200).json({
    success: true,
    data,
    ...(message && { message }),
    timestamp: new Date().toISOString(),
  });

const created = (res, data, message) =>
  res.status(201).json({
    success: true,
    data,
    ...(message && { message }),
    timestamp: new Date().toISOString(),
  });

const paginated = (res, items, { total, page, limit }) => {
  const pages = limit > 0 ? Math.ceil(total / limit) : 0;
  return res.status(200).json({
    success: true,
    data: items,
    pagination: {
      total,
      page,
      limit,
      pages,
      has_next: page < pages,
      has_previous: page > 1,
    },
    timestamp: new Date().toISOString(),
  });
};

// ─── Errors ──────────────────────────────────────────────────────────────────

/**
 * Throw these from inside `asyncHandler` and the central errorHandler will
 * render them. Keeps routes free of res.status(...).json(...) noise.
 */
class ApiError extends Error {
  constructor(status, error, message) {
    super(message || error);
    this.status = status;
    this.error = error;
    this.expose = true;
  }
}

const notFound = (resource) => new ApiError(404, 'Not Found', `${resource} not found`);
const badRequest = (message) => new ApiError(400, 'Bad Request', message);
const conflict = (message) => new ApiError(409, 'Conflict', message);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Wraps an async route so rejected promises reach the error handler. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Parses and clamps pagination query params.
 * Guards against `limit=999999` scans and non-numeric input.
 */
const parsePagination = (query, { defaultLimit, maxLimit }) => {
  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const requested = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : defaultLimit;
  const limit = Math.min(requested, maxLimit);

  return { page, limit, skip: (page - 1) * limit };
};

/** Builds an inclusive-start/exclusive-end date filter, or null if unbounded. */
const parseDateRange = ({ date_from, date_to }) => {
  const filter = {};
  if (date_from) filter.$gte = new Date(date_from);
  if (date_to) filter.$lte = new Date(date_to);
  return Object.keys(filter).length > 0 ? filter : null;
};

module.exports = {
  ok,
  created,
  paginated,
  ApiError,
  notFound,
  badRequest,
  conflict,
  asyncHandler,
  parsePagination,
  parseDateRange,
};
