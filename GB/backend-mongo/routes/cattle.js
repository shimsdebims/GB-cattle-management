/**
 * CATTLE API ROUTES
 * 
 * Endpoints:
 * - GET  /api/cattle               - List all cattle
 * - GET  /api/cattle/:id           - Get single cattle
 * - POST /api/cattle               - Create cattle
 * - PUT  /api/cattle/:id           - Update cattle
 * - DELETE /api/cattle/:id         - Delete cattle
 * 
 * Reference: LAYER_2_API_SPECIFICATION.md section 2
 */

const express = require('express');
const router = express.Router();
const Cattle = require('../models/Cattle');
const { asyncHandler, sendResponse, successResponse, notFound, badRequest, internalServerError, validationMiddleware } = require('../middleware');

// ============================================================================
// GET /api/cattle - List all cattle
// ============================================================================
router.get('/', asyncHandler(async (req, res) => {
  try {
    const { status, health_status, sort = '-updated_at', limit = 50, page = 1 } = req.query;

    // Build filter
    const filter = {};
    if (status && ['Active', 'Sold', 'Deceased'].includes(status)) {
      filter.status = status;
    }
    if (health_status && ['Healthy', 'Sick', 'Resting'].includes(health_status)) {
      filter.health_status = health_status;
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Query
    const cattle = await Cattle.find(filter)
      .sort(sort)
      .limit(limitNum)
      .skip(skip)
      .lean();

    const total = await Cattle.countDocuments(filter);

    const response = successResponse(
      {
        items: cattle,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
          has_next: pageNum < Math.ceil(total / limitNum),
          has_previous: pageNum > 1,
        },
      },
      null,
      200
    );

    sendResponse(res, response);
  } catch (error) {
    const response = internalServerError(error.message);
    sendResponse(res, response);
  }
}));

// ============================================================================
// GET /api/cattle/:id - Get single cattle
// ============================================================================
router.get('/:id', asyncHandler(async (req, res) => {
  try {
    const cattle = await Cattle.findById(req.params.id).lean();

    if (!cattle) {
      const response = notFound('Cattle');
      return sendResponse(res, response);
    }

    const response = successResponse(cattle);
    sendResponse(res, response);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      const response = badRequest('Invalid cattle ID format');
      return sendResponse(res, response);
    }
    const response = internalServerError(error.message);
    sendResponse(res, response);
  }
}));

// ============================================================================
// POST /api/cattle - Create cattle
// ============================================================================
router.post('/', validationMiddleware('cattle'), asyncHandler(async (req, res) => {
  try {
    // Check for duplicate tag_number
    const existing = await Cattle.findOne({ tag_number: req.body.tag_number });
    if (existing) {
      const response = {
        statusCode: 409,
        body: {
          success: false,
          error: 'Conflict',
          message: 'tag_number already exists',
          timestamp: new Date().toISOString(),
        },
      };
      return sendResponse(res, response);
    }

    const cattle = new Cattle(req.body);
    await cattle.save();

    const response = successResponse(cattle, 'Cattle created successfully', 201);
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
// PUT /api/cattle/:id - Update cattle
// ============================================================================
router.put('/:id', validationMiddleware('cattle'), asyncHandler(async (req, res) => {
  try {
    // Don't allow changing tag_number to avoid duplicate issues
    if (req.body.tag_number) {
      delete req.body.tag_number;
    }

    const cattle = await Cattle.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updated_at: new Date() },
      { new: true, runValidators: true }
    );

    if (!cattle) {
      const response = notFound('Cattle');
      return sendResponse(res, response);
    }

    const response = successResponse(cattle, 'Cattle updated successfully');
    sendResponse(res, response);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      const response = badRequest('Invalid cattle ID format');
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
// DELETE /api/cattle/:id - Delete cattle (soft delete via status)
// ============================================================================
router.delete('/:id', asyncHandler(async (req, res) => {
  try {
    // Soft delete: mark as Deceased
    const cattle = await Cattle.findByIdAndUpdate(
      req.params.id,
      { status: 'Deceased', updated_at: new Date() },
      { new: true }
    );

    if (!cattle) {
      const response = notFound('Cattle');
      return sendResponse(res, response);
    }

    const response = successResponse(cattle, 'Cattle deleted successfully');
    sendResponse(res, response);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      const response = badRequest('Invalid cattle ID format');
      return sendResponse(res, response);
    }
    const response = internalServerError(error.message);
    sendResponse(res, response);
  }
}));

module.exports = router;
