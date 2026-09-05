/**
 * Middleware Index
 * Central export for all middleware modules
 */

const {
  validateCattle,
  validateMilkProduction,
  validateExpense,
  validateRevenue,
  validationMiddleware,
  errorHandler,
} = require('./validation');

const {
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
} = require('./responses');

module.exports = {
  // Validation
  validateCattle,
  validateMilkProduction,
  validateExpense,
  validateRevenue,
  validationMiddleware,
  errorHandler,

  // Response helpers
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
