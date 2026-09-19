/**
 * Request validation.
 *
 * Rules are derived from `constants/domain.js`, the same module the Mongoose
 * schemas use, so validators and schemas cannot disagree.
 *
 * Every validator supports a `partial` mode for PUT/PATCH: required checks are
 * skipped, but any field that IS present is still fully validated.
 */

const mongoose = require('mongoose');
const {
  BREEDS,
  GENDERS,
  HEALTH_STATUSES,
  CATTLE_STATUSES,
  FEED_TYPES,
  EXPENSE_CATEGORIES,
  REVENUE_SOURCES,
  LIMITS,
} = require('../constants/domain');

// ─── Small reusable checks ───────────────────────────────────────────────────

const isPresent = (value) => value !== undefined && value !== null && value !== '';

const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

function checkString(errors, data, field, { required, max, min, partial }) {
  const value = data[field];

  if (!isPresent(value)) {
    if (required && !partial) {
      errors.push({ field, message: `${field} is required` });
    }
    return;
  }

  if (typeof value !== 'string') {
    errors.push({ field, message: `${field} must be a string` });
    return;
  }

  const length = value.trim().length;
  if (min !== undefined && length < min) {
    errors.push({ field, message: `${field} must be at least ${min} characters` });
  }
  if (max !== undefined && length > max) {
    errors.push({ field, message: `${field} must not exceed ${max} characters` });
  }
}

function checkEnum(errors, data, field, allowed, { required, partial }) {
  const value = data[field];

  if (!isPresent(value)) {
    if (required && !partial) {
      errors.push({ field, message: `${field} is required` });
    }
    return;
  }

  if (!allowed.includes(value)) {
    errors.push({
      field,
      message: `${field} must be one of: ${allowed.join(', ')}`,
    });
  }
}

function checkNumber(errors, data, field, { required, min, max, partial }) {
  const value = data[field];

  if (!isPresent(value)) {
    if (required && !partial) {
      errors.push({ field, message: `${field} is required` });
    }
    return;
  }

  const num = Number(value);
  if (Number.isNaN(num)) {
    errors.push({ field, message: `${field} must be a number` });
    return;
  }
  if (min !== undefined && num < min) {
    errors.push({ field, message: `${field} must be at least ${min}` });
  }
  if (max !== undefined && num > max) {
    errors.push({ field, message: `${field} must not exceed ${max}` });
  }
}

function checkDate(errors, data, field, { required, allowFuture = false, partial }) {
  const value = data[field];

  if (!isPresent(value)) {
    if (required && !partial) {
      errors.push({ field, message: `${field} is required` });
    }
    return;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    errors.push({ field, message: `${field} must be a valid date` });
    return;
  }
  if (!allowFuture && date > endOfToday()) {
    errors.push({ field, message: `${field} cannot be in the future` });
  }
}

function checkObjectId(errors, data, field, { required, partial }) {
  const value = data[field];

  if (!isPresent(value)) {
    if (required && !partial) {
      errors.push({ field, message: `${field} is required` });
    }
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    errors.push({ field, message: `${field} must be a valid id` });
  }
}

const result = (errors) => ({ valid: errors.length === 0, errors });

// ─── Entity validators ───────────────────────────────────────────────────────

const validateCattle = (data, { partial = false } = {}) => {
  const errors = [];
  const opts = { partial };

  checkString(errors, data, 'tag_number', {
    required: true,
    min: LIMITS.TAG_NUMBER_MIN,
    max: LIMITS.TAG_NUMBER_MAX,
    ...opts,
  });
  checkString(errors, data, 'name', { required: true, max: LIMITS.NAME_MAX, ...opts });
  checkEnum(errors, data, 'breed', BREEDS, { required: true, ...opts });
  checkEnum(errors, data, 'gender', GENDERS, { required: true, ...opts });
  checkDate(errors, data, 'date_of_birth', { required: true, ...opts });

  // Optional on create (schemas supply defaults), validated whenever provided.
  checkEnum(errors, data, 'health_status', HEALTH_STATUSES, { ...opts });
  checkEnum(errors, data, 'current_status', CATTLE_STATUSES, { ...opts });
  checkNumber(errors, data, 'weight', { min: 0, max: LIMITS.CATTLE_WEIGHT_MAX, ...opts });
  checkNumber(errors, data, 'purchase_price', { min: 0, ...opts });
  checkDate(errors, data, 'purchase_date', { ...opts });
  checkString(errors, data, 'notes', { max: LIMITS.NOTES_MAX, ...opts });

  return result(errors);
};

const validateMilkProduction = (data, { partial = false } = {}) => {
  const errors = [];
  const opts = { partial };

  checkObjectId(errors, data, 'cattle_id', { required: true, ...opts });
  checkDate(errors, data, 'date_recorded', { required: true, ...opts });
  checkNumber(errors, data, 'quantity_liters', {
    required: true,
    min: 0,
    max: LIMITS.MILK_QUANTITY_MAX,
    ...opts,
  });
  checkNumber(errors, data, 'quality_score', {
    min: LIMITS.QUALITY_SCORE_MIN,
    max: LIMITS.QUALITY_SCORE_MAX,
    ...opts,
  });
  checkString(errors, data, 'notes', { max: LIMITS.NOTES_MAX, ...opts });

  return result(errors);
};

const validateFeeding = (data, { partial = false } = {}) => {
  const errors = [];
  const opts = { partial };

  checkObjectId(errors, data, 'cattle_id', { required: true, ...opts });
  checkDate(errors, data, 'date_recorded', { required: true, ...opts });
  checkEnum(errors, data, 'feed_type', FEED_TYPES, { required: true, ...opts });
  checkNumber(errors, data, 'quantity_kg', {
    required: true,
    min: 0,
    max: LIMITS.FEED_QUANTITY_MAX,
    ...opts,
  });
  checkNumber(errors, data, 'cost_per_unit', { min: 0, ...opts });
  checkString(errors, data, 'supplier', { max: LIMITS.NAME_MAX, ...opts });
  checkString(errors, data, 'notes', { max: LIMITS.NOTES_MAX, ...opts });

  return result(errors);
};

const validateExpense = (data, { partial = false } = {}) => {
  const errors = [];
  const opts = { partial };

  checkEnum(errors, data, 'category', EXPENSE_CATEGORIES, { required: true, ...opts });
  checkString(errors, data, 'description', {
    required: true,
    max: LIMITS.DESCRIPTION_MAX,
    ...opts,
  });
  checkDate(errors, data, 'date_recorded', { required: true, ...opts });
  checkNumber(errors, data, 'quantity', { min: 0, ...opts });
  checkNumber(errors, data, 'cost_per_unit', { min: 0, ...opts });
  checkString(errors, data, 'supplier', { max: LIMITS.NAME_MAX, ...opts });
  checkString(errors, data, 'receipt_number', { max: LIMITS.NAME_MAX, ...opts });
  checkString(errors, data, 'notes', { max: LIMITS.NOTES_MAX, ...opts });

  // Amount may be supplied directly OR derived from quantity × cost_per_unit.
  const hasAmount = isPresent(data.amount);
  const canDerive = isPresent(data.quantity) && isPresent(data.cost_per_unit);

  if (hasAmount) {
    checkNumber(errors, data, 'amount', { min: 0, ...opts });
  } else if (!canDerive && !partial) {
    errors.push({
      field: 'amount',
      message: 'Provide amount, or both quantity and cost_per_unit',
    });
  }

  return result(errors);
};

const validateRevenue = (data, { partial = false } = {}) => {
  const errors = [];
  const opts = { partial };

  checkEnum(errors, data, 'source', REVENUE_SOURCES, { required: true, ...opts });
  checkString(errors, data, 'description', {
    required: true,
    max: LIMITS.DESCRIPTION_MAX,
    ...opts,
  });
  checkNumber(errors, data, 'amount', { required: true, min: 0, ...opts });
  checkDate(errors, data, 'date_recorded', { required: true, ...opts });
  checkString(errors, data, 'notes', { max: LIMITS.NOTES_MAX, ...opts });

  return result(errors);
};

const validateSettings = (data, { partial = true } = {}) => {
  const errors = [];
  checkNumber(errors, data, 'milk_price_per_liter', { min: 0, partial });
  checkString(errors, data, 'currency', { min: 1, max: 10, partial });
  return result(errors);
};

const VALIDATORS = {
  cattle: validateCattle,
  milkProduction: validateMilkProduction,
  feeding: validateFeeding,
  expense: validateExpense,
  revenue: validateRevenue,
  settings: validateSettings,
};

// ─── Express middleware ──────────────────────────────────────────────────────

/**
 * @param {string} schema  key of VALIDATORS
 * @param {{ partial?: boolean }} options  pass `{ partial: true }` for PUT/PATCH
 */
const validationMiddleware = (schema, options = {}) => {
  const validator = VALIDATORS[schema];

  return (req, res, next) => {
    if (!validator) return next();

    const { valid, errors } = validator(req.body || {}, options);
    if (valid) return next();

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors,
      timestamp: new Date().toISOString(),
    });
  };
};

/** Rejects malformed :id params before they reach Mongoose. */
const validateIdParam = (paramName = 'id') => (req, res, next) => {
  const value = req.params[paramName];
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format',
      errors: [{ field: paramName, message: 'Must be a valid id' }],
      timestamp: new Date().toISOString(),
    });
  }
  return next();
};

// ─── Centralized error handler ───────────────────────────────────────────────

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors,
      timestamp: new Date().toISOString(),
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || { field: 1 })[0];
    // The milk unique index is compound, so report something actionable.
    const message = field === 'cattle_id' || field === 'date_recorded'
      ? 'A record already exists for this animal on this date'
      : `${field} already exists`;

    return res.status(409).json({
      success: false,
      error: 'Conflict',
      message,
      timestamp: new Date().toISOString(),
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format',
      timestamp: new Date().toISOString(),
    });
  }

  const status = err.status || 500;

  // Deliberate ApiErrors (404/400/409) are normal control flow, not incidents —
  // only log what we did not anticipate.
  if (!err.expose || status >= 500) {
    console.error('Unhandled error:', err);
  }

  return res.status(status).json({
    success: false,
    error: err.expose && err.error ? err.error : 'Internal Server Error',
    ...(err.expose && err.message && { message: err.message }),
    ...(!err.expose &&
      process.env.NODE_ENV === 'development' && { message: err.message }),
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  validateCattle,
  validateMilkProduction,
  validateFeeding,
  validateExpense,
  validateRevenue,
  validateSettings,
  validationMiddleware,
  validateIdParam,
  errorHandler,
};
