const express = require('express');
const router = express.Router();

const Cattle = require('../models/Cattle');
const MilkProduction = require('../models/MilkProduction');
const Feeding = require('../models/Feeding');
const { LIMITS } = require('../constants/domain');
const {
  ok,
  created,
  paginated,
  notFound,
  asyncHandler,
  parsePagination,
  validationMiddleware,
  validateIdParam,
} = require('../middleware');

// GET /api/cattle — paginated list
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, health, breed, search } = req.query;
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: LIMITS.PAGE_SIZE_DEFAULT,
      maxLimit: LIMITS.PAGE_SIZE_MAX,
    });

    const filter = {};
    if (status) filter.current_status = status;
    if (health) filter.health_status = health;
    if (breed) filter.breed = breed;
    if (search) {
      const term = String(search).trim();
      if (term) {
        // Escape regex metacharacters so a search for "GB(1" cannot crash.
        const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [
          { name: new RegExp(safe, 'i') },
          { tag_number: new RegExp(safe, 'i') },
        ];
      }
    }

    // find + count concurrently rather than sequentially.
    const [items, total] = await Promise.all([
      Cattle.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
      Cattle.countDocuments(filter),
    ]);

    return paginated(res, items, { total, page, limit });
  })
);

// GET /api/cattle/:id/summary — profile + recent activity
// Registered before /:id is irrelevant here (distinct paths), but kept adjacent
// to the detail route for readability.
router.get(
  '/:id/summary',
  validateIdParam(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const cattle = await Cattle.findById(id).lean();
    if (!cattle) throw notFound('Cattle');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Totals come from aggregation; only the display rows are fetched.
    const [milkTotals, feedTotals, recentMilk, recentFeeding] = await Promise.all([
      MilkProduction.aggregate([
        { $match: { cattle_id: cattle._id, date_recorded: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: null,
            total_liters: { $sum: '$quantity_liters' },
            average_quality: { $avg: '$quality_score' },
            record_count: { $sum: 1 },
          },
        },
      ]),
      Feeding.aggregate([
        { $match: { cattle_id: cattle._id, date_recorded: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: null,
            total_cost: { $sum: '$total_cost' },
            total_quantity_kg: { $sum: '$quantity_kg' },
            record_count: { $sum: 1 },
          },
        },
      ]),
      MilkProduction.find({ cattle_id: id })
        .sort({ date_recorded: -1 })
        .limit(10)
        .lean(),
      Feeding.find({ cattle_id: id }).sort({ date_recorded: -1 }).limit(10).lean(),
    ]);

    const milk = milkTotals[0] || {
      total_liters: 0,
      average_quality: 0,
      record_count: 0,
    };
    const feed = feedTotals[0] || {
      total_cost: 0,
      total_quantity_kg: 0,
      record_count: 0,
    };

    return ok(res, {
      cattle,
      summary: {
        milk_production: {
          total_liters_30_days: milk.total_liters,
          // Average across the window, not across recorded days only.
          average_daily_liters: milk.total_liters / 30,
          average_quality: milk.average_quality || 0,
          record_count: milk.record_count,
        },
        feeding: {
          total_cost_7_days: feed.total_cost || 0,
          total_quantity_kg_7_days: feed.total_quantity_kg || 0,
          record_count: feed.record_count,
        },
      },
      recent_milk_records: recentMilk,
      recent_feeding_records: recentFeeding,
    });
  })
);

// GET /api/cattle/:id
router.get(
  '/:id',
  validateIdParam(),
  asyncHandler(async (req, res) => {
    const cattle = await Cattle.findById(req.params.id).lean();
    if (!cattle) throw notFound('Cattle');
    return ok(res, cattle);
  })
);

// POST /api/cattle
router.post(
  '/',
  validationMiddleware('cattle'),
  asyncHandler(async (req, res) => {
    // Duplicate tag_number surfaces as a 409 via the central error handler.
    const cattle = await Cattle.create(req.body);
    return created(res, cattle.toJSON(), 'Cattle created');
  })
);

// PUT /api/cattle/:id
router.put(
  '/:id',
  validateIdParam(),
  validationMiddleware('cattle', { partial: true }),
  asyncHandler(async (req, res) => {
    const cattle = await Cattle.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!cattle) throw notFound('Cattle');
    return ok(res, cattle.toJSON(), 'Cattle updated');
  })
);

// DELETE /api/cattle/:id — removes the animal and its production history.
router.delete(
  '/:id',
  validateIdParam(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const cattle = await Cattle.findById(id).lean();
    if (!cattle) throw notFound('Cattle');

    const [milkResult, feedingResult] = await Promise.all([
      MilkProduction.deleteMany({ cattle_id: id }),
      Feeding.deleteMany({ cattle_id: id }),
    ]);
    await Cattle.findByIdAndDelete(id);

    return ok(
      res,
      {
        _id: id,
        deleted_milk_records: milkResult.deletedCount,
        deleted_feeding_records: feedingResult.deletedCount,
      },
      'Cattle and related records deleted'
    );
  })
);

module.exports = router;
