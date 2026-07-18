/**
 * MILK PRODUCTION API ROUTES
 * 
 * Endpoints:
 * - GET  /api/milk/cattle/:cattle_id/month/:yyyy-mm - Monthly data per cow
 * - GET  /api/milk/day/:date                         - All cows for one day
 * - GET  /api/milk/month/:yyyy-mm                    - All cows for month
 * - POST /api/milk/record                            - Create new record
 * - PUT  /api/milk/:id                               - Update record
 * - DELETE /api/milk/:id                             - Delete record
 * 
 * Reference: LAYER_2_API_SPECIFICATION.md section 3
 */

const express = require('express');
const router = express.Router();
const MilkProduction = require('../models/MilkProduction');
const Cattle = require('../models/Cattle');
const { asyncHandler, sendResponse, successResponse, notFound, badRequest, internalServerError, validationMiddleware } = require('../middleware');

// ============================================================================
// Helper: Parse yyyy-mm to Date range
// ============================================================================
const getMonthRange = (yearMonth) => {
  const [year, month] = yearMonth.split('-');
  if (!year || !month || isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return null;
  }
  const startDate = new Date(`${year}-${month}-01T00:00:00Z`);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  return { startDate, endDate };
};

// ============================================================================
// GET /api/milk/cattle/:cattle_id/month/:yyyy-mm - Monthly data per cow
// ============================================================================
router.get('/cattle/:cattle_id/month/:yyyy-mm', asyncHandler(async (req, res) => {
  try {
    const { cattle_id } = req.params;
    
    // Validate ObjectId
    if (!cattle_id.match(/^[0-9a-fA-F]{24}$/)) {
      const response = badRequest('Invalid cattle ID format');
      return sendResponse(res, response);
    }

    // Parse date range
    const dateRange = getMonthRange(req.params['yyyy-mm']);
    if (!dateRange) {
      const response = badRequest('Invalid date format (use yyyy-mm)');
      return sendResponse(res, response);
    }

    // Get cattle info
    const cattle = await Cattle.findById(cattle_id).lean();
    if (!cattle) {
      const response = notFound('Cattle');
      return sendResponse(res, response);
    }

    // Get records for month
    const records = await MilkProduction.find({
      cattle_id,
      date_recorded: { $gte: dateRange.startDate, $lt: dateRange.endDate },
    })
      .sort({ date_recorded: 1 })
      .lean();

    // Calculate aggregates
    const total_liters = records.reduce((sum, r) => sum + r.quantity_liters, 0);
    const average_per_day = records.length > 0 ? total_liters / records.length : 0;

    const response = successResponse({
      cattle_id,
      cattle_tag: cattle.tag_number,
      cattle_name: cattle.name,
      year_month: req.params['yyyy-mm'],
      total_liters: parseFloat(total_liters.toFixed(2)),
      average_per_day: parseFloat(average_per_day.toFixed(2)),
      record_count: records.length,
      records,
    });

    sendResponse(res, response);
  } catch (error) {
    const response = internalServerError(error.message);
    sendResponse(res, response);
  }
}));

// ============================================================================
// GET /api/milk/day/:date - All cows for one day
// ============================================================================
router.get('/day/:date', asyncHandler(async (req, res) => {
  try {
    const dateStr = req.params.date; // Format: yyyy-mm-dd
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(dateStr)) {
      const response = badRequest('Invalid date format (use yyyy-mm-dd)');
      return sendResponse(res, response);
    }

    // Parse date
    const startDate = new Date(`${dateStr}T00:00:00Z`);
    const endDate = new Date(`${dateStr}T23:59:59Z`);

    if (isNaN(startDate.getTime())) {
      const response = badRequest('Invalid date');
      return sendResponse(res, response);
    }

    // Query records for day
    const records = await MilkProduction.find({
      date_recorded: { $gte: startDate, $lte: endDate },
    })
      .sort({ cattle_tag: 1 })
      .lean();

    // Calculate aggregates
    const total_liters = records.reduce((sum, r) => sum + r.quantity_liters, 0);
    const average_per_cow = records.length > 0 ? total_liters / records.length : 0;

    const response = successResponse({
      date: dateStr,
      total_liters: parseFloat(total_liters.toFixed(2)),
      records_count: records.length,
      average_per_cow: parseFloat(average_per_cow.toFixed(2)),
      records,
    });

    sendResponse(res, response);
  } catch (error) {
    const response = internalServerError(error.message);
    sendResponse(res, response);
  }
}));

// ============================================================================
// GET /api/milk/month/:yyyy-mm - All cows for month
// ============================================================================
router.get('/month/:yyyy-mm', asyncHandler(async (req, res) => {
  try {
    const yearMonth = req.params['yyyy-mm'];
    const dateRange = getMonthRange(yearMonth);

    if (!dateRange) {
      const response = badRequest('Invalid date format (use yyyy-mm)');
      return sendResponse(res, response);
    }

    // Query all records for month
    const records = await MilkProduction.find({
      date_recorded: { $gte: dateRange.startDate, $lt: dateRange.endDate },
    })
      .sort({ cattle_tag: 1, date_recorded: 1 })
      .lean();

    // Group by cattle
    const byCoW = {};
    records.forEach((record) => {
      const tag = record.cattle_tag;
      if (!byCoW[tag]) {
        byCoW[tag] = {
          total: 0,
          average: 0,
          records_count: 0,
        };
      }
      byCoW[tag].total += record.quantity_liters;
      byCoW[tag].records_count += 1;
    });

    // Calculate averages
    Object.keys(byCoW).forEach((tag) => {
      byCoW[tag].total = parseFloat(byCoW[tag].total.toFixed(2));
      byCoW[tag].average = parseFloat(
        (byCoW[tag].total / byCoW[tag].records_count).toFixed(2)
      );
    });

    // Overall totals
    const total_liters = records.reduce((sum, r) => sum + r.quantity_liters, 0);
    const cows_count = Object.keys(byCoW).length;
    const average_per_cow =
      cows_count > 0 ? total_liters / records.length : 0;

    const response = successResponse({
      year_month: yearMonth,
      total_liters: parseFloat(total_liters.toFixed(2)),
      average_per_cow: parseFloat(average_per_cow.toFixed(2)),
      cows_count,
      by_cow: byCoW,
    });

    sendResponse(res, response);
  } catch (error) {
    const response = internalServerError(error.message);
    sendResponse(res, response);
  }
}));

// ============================================================================
// POST /api/milk/record - Create new record
// ============================================================================
router.post('/record', validationMiddleware('milkProduction'), asyncHandler(async (req, res) => {
  try {
    const { cattle_id, date_recorded, quantity_liters } = req.body;

    // Verify cattle exists
    const cattle = await Cattle.findById(cattle_id).lean();
    if (!cattle) {
      const response = notFound('Cattle');
      return sendResponse(res, response);
    }

    // Check for duplicate record for same date
    const existing = await MilkProduction.findOne({
      cattle_id,
      date_recorded: new Date(date_recorded),
    });
    if (existing) {
      const response = {
        statusCode: 409,
        body: {
          success: false,
          error: 'Conflict',
          message: 'Record already exists for this date and cattle',
          timestamp: new Date().toISOString(),
        },
      };
      return sendResponse(res, response);
    }

    // Create record with denormalized cattle_tag
    const record = new MilkProduction({
      ...req.body,
      cattle_tag: cattle.tag_number,
    });
    await record.save();

    const response = successResponse(
      record,
      'Milk record created successfully',
      201
    );
    sendResponse(res, response);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((e) => ({
        field: e.path,
        message: e.message,
      }));
      const response = badRequest('Validation failed', errors);
      return sendResponse(res, response);
    }
    const response = internalServerError(error.message);
    sendResponse(res, response);
  }
}));

// ============================================================================
// PUT /api/milk/:id - Update record
// ============================================================================
router.put('/:id', validationMiddleware('milkProduction'), asyncHandler(async (req, res) => {
  try {
    // Don't allow changing cattle_id or date_recorded to avoid duplicates
    const updateData = { ...req.body };
    delete updateData.cattle_id;
    delete updateData.date_recorded;
    updateData.updated_at = new Date();

    const record = await MilkProduction.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!record) {
      const response = notFound('Milk record');
      return sendResponse(res, response);
    }

    const response = successResponse(
      record,
      'Milk record updated successfully'
    );
    sendResponse(res, response);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      const response = badRequest('Invalid record ID format');
      return sendResponse(res, response);
    }
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((e) => ({
        field: e.path,
        message: e.message,
      }));
      const response = badRequest('Validation failed', errors);
      return sendResponse(res, response);
    }
    const response = internalServerError(error.message);
    sendResponse(res, response);
  }
}));

// ============================================================================
// DELETE /api/milk/:id - Delete record
// ============================================================================
router.delete('/:id', asyncHandler(async (req, res) => {
  try {
    const record = await MilkProduction.findByIdAndDelete(req.params.id);

    if (!record) {
      const response = notFound('Milk record');
      return sendResponse(res, response);
    }

    const response = successResponse(
      record,
      'Milk record deleted successfully'
    );
    sendResponse(res, response);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      const response = badRequest('Invalid record ID format');
      return sendResponse(res, response);
    }
    const response = internalServerError(error.message);
    sendResponse(res, response);
  }
}));

module.exports = router;
