/**
 * LAYER 2C: Response & Error Helper Utilities
 * 
 * Provides consistent API response format across all endpoints
 * Reference: LAYER_2_API_SPECIFICATION.md section 10 (Error Handling)
 */

/**
 * Success Response (200, 201, etc.)
 */
const successResponse = (data, message = null, statusCode = 200) => {
  return {
    statusCode,
    body: {
      success: true,
      data,
      ...(message && { message }),
      timestamp: new Date().toISOString(),
    },
  };
};

/**
 * Error Response (400, 401, 404, 500, etc.)
 */
const errorResponse = (statusCode, error, message = null, details = null) => {
  return {
    statusCode,
    body: {
      success: false,
      error,
      ...(message && { message }),
      ...(details && { details }),
      timestamp: new Date().toISOString(),
    },
  };
};

/**
 * Paginated Response
 */
const paginatedResponse = (items, total, page, limit) => {
  const pages = Math.ceil(total / limit);
  return {
    statusCode: 200,
    body: {
      success: true,
      data: items,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages,
        has_next: page < pages,
        has_previous: page > 1,
      },
      timestamp: new Date().toISOString(),
    },
  };
};

/**
 * Specific Error Types
 */

const notFound = (resource) => {
  return errorResponse(404, 'Not Found', `${resource} not found`);
};

const badRequest = (message, errors = null) => {
  return errorResponse(400, 'Bad Request', message, errors);
};

const unauthorized = (message = 'Unauthorized') => {
  return errorResponse(401, 'Unauthorized', message);
};

const forbidden = (message = 'Forbidden') => {
  return errorResponse(403, 'Forbidden', message);
};

const conflict = (message) => {
  return errorResponse(409, 'Conflict', message);
};

const unprocessableEntity = (message, errors = null) => {
  return errorResponse(422, 'Unprocessable Entity', message, errors);
};

const internalServerError = (message = 'Internal server error') => {
  return errorResponse(500, 'Internal Server Error', message);
};

/**
 * Express Helper - Sends response
 */
const sendResponse = (res, response) => {
  res.status(response.statusCode).json(response.body);
};

/**
 * Async Error Handler Wrapper
 * Wraps route handler to catch errors and pass to error handler
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
  notFound,
  badRequest,
  unauthorized,
  forbidden,
  conflict,
  unprocessableEntity,
  internalServerError,
  sendResponse,
  asyncHandler,
};
