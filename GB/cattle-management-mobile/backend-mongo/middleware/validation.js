/**
 * LAYER 2B: Validation Middleware
 * 
 * Validates incoming requests against Layer 1 schema rules
 * Uses Mongoose validation + custom checks
 * 
 * Reference: LAYER_1_DATA_MODEL.md section 5 (Validation Rules)
 */

/**
 * Cattle Validation
 */
const validateCattle = (data) => {
  const errors = [];

  if (!data.tag_number) {
    errors.push({ field: 'tag_number', message: 'Tag number is required' });
  } else if (data.tag_number.length < 5 || data.tag_number.length > 20) {
    errors.push({
      field: 'tag_number',
      message: 'Tag number must be 5-20 characters',
    });
  }

  if (!data.name || data.name.length > 100) {
    errors.push({ field: 'name', message: 'Name is required and must not exceed 100 characters' });
  }

  if (!data.breed || data.breed.length > 50) {
    errors.push({ field: 'breed', message: 'Breed is required and must not exceed 50 characters' });
  }

  if (!data.gender || !['Male', 'Female'].includes(data.gender)) {
    errors.push({
      field: 'gender',
      message: 'Gender must be Male or Female',
    });
  }

  if (!data.date_of_birth) {
    errors.push({ field: 'date_of_birth', message: 'Date of birth is required' });
  } else {
    const dob = new Date(data.date_of_birth);
    if (dob > new Date()) {
      errors.push({
        field: 'date_of_birth',
        message: 'Date of birth cannot be in the future',
      });
    }
  }

  if (!['Active', 'Sold', 'Deceased'].includes(data.status)) {
    errors.push({
      field: 'status',
      message: 'Status must be Active, Sold, or Deceased',
    });
  }

  if (data.health_status && !['Healthy', 'Sick', 'Resting'].includes(data.health_status)) {
    errors.push({
      field: 'health_status',
      message: 'Health status must be Healthy, Sick, or Resting',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Milk Production Validation
 */
const validateMilkProduction = (data) => {
  const errors = [];

  if (!data.cattle_id) {
    errors.push({ field: 'cattle_id', message: 'Cattle ID is required' });
  }

  if (!data.cattle_tag) {
    errors.push({
      field: 'cattle_tag',
      message: 'Cattle tag is required (denormalized)',
    });
  }

  if (!data.date_recorded) {
    errors.push({ field: 'date_recorded', message: 'Date recorded is required' });
  } else {
    const recordDate = new Date(data.date_recorded);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (recordDate > today) {
      errors.push({
        field: 'date_recorded',
        message: 'Date cannot be in the future',
      });
    }
  }

  if (!data.quantity_liters || isNaN(data.quantity_liters)) {
    errors.push({
      field: 'quantity_liters',
      message: 'Quantity in liters is required and must be a number',
    });
  } else if (data.quantity_liters <= 0) {
    errors.push({
      field: 'quantity_liters',
      message: 'Quantity must be greater than 0',
    });
  } else if (data.quantity_liters > 50) {
    errors.push({
      field: 'quantity_liters',
      message: 'Quantity must not exceed 50 liters',
    });
  }

  if (data.quality_score !== undefined) {
    if (isNaN(data.quality_score)) {
      errors.push({
        field: 'quality_score',
        message: 'Quality score must be a number',
      });
    } else if (data.quality_score < 1 || data.quality_score > 5) {
      errors.push({
        field: 'quality_score',
        message: 'Quality score must be between 1 and 5',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Expense Validation
 */
const validateExpense = (data) => {
  const errors = [];
  const validCategories = ['Feed', 'Staff', 'Medical', 'Tax', 'Insurance', 'Other'];

  if (!data.category || !validCategories.includes(data.category)) {
    errors.push({
      field: 'category',
      message: `Category must be one of: ${validCategories.join(', ')}`,
    });
  }

  if (!data.description || data.description.length > 200) {
    errors.push({
      field: 'description',
      message: 'Description is required and must not exceed 200 characters',
    });
  }

  if (!data.amount || isNaN(data.amount)) {
    errors.push({
      field: 'amount',
      message: 'Amount is required and must be a number',
    });
  } else if (data.amount <= 0) {
    errors.push({
      field: 'amount',
      message: 'Amount must be greater than 0',
    });
  }

  if (!data.date_recorded) {
    errors.push({ field: 'date_recorded', message: 'Date recorded is required' });
  } else {
    const recordDate = new Date(data.date_recorded);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (recordDate > today) {
      errors.push({
        field: 'date_recorded',
        message: 'Date cannot be in the future',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Revenue Validation
 */
const validateRevenue = (data) => {
  const errors = [];
  const validSources = ['Milk', 'Cattle_Sale', 'Subsidy', 'Other'];

  if (!data.source || !validSources.includes(data.source)) {
    errors.push({
      field: 'source',
      message: `Source must be one of: ${validSources.join(', ')}`,
    });
  }

  if (!data.description || data.description.length > 200) {
    errors.push({
      field: 'description',
      message: 'Description is required and must not exceed 200 characters',
    });
  }

  if (!data.amount || isNaN(data.amount)) {
    errors.push({
      field: 'amount',
      message: 'Amount is required and must be a number',
    });
  } else if (data.amount <= 0) {
    errors.push({
      field: 'amount',
      message: 'Amount must be greater than 0',
    });
  }

  if (!data.date_recorded) {
    errors.push({ field: 'date_recorded', message: 'Date recorded is required' });
  } else {
    const recordDate = new Date(data.date_recorded);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (recordDate > today) {
      errors.push({
        field: 'date_recorded',
        message: 'Date cannot be in the future',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Express Middleware - Returns 400 if validation fails
 */
const validationMiddleware = (schema) => {
  return (req, res, next) => {
    let result;

    switch (schema) {
      case 'cattle':
        result = validateCattle(req.body);
        break;
      case 'milk':
        result = validateMilkProduction(req.body);
        break;
      case 'expense':
        result = validateExpense(req.body);
        break;
      case 'revenue':
        result = validateRevenue(req.body);
        break;
      default:
        return next();
    }

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: result.errors,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};

/**
 * Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
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

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      success: false,
      error: 'Conflict',
      message: `${field} already exists`,
      timestamp: new Date().toISOString(),
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format',
      timestamp: new Date().toISOString(),
    });
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  validateCattle,
  validateMilkProduction,
  validateExpense,
  validateRevenue,
  validationMiddleware,
  errorHandler,
};
