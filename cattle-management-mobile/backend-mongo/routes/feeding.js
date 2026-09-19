const express = require('express');
const router = express.Router();

const Feeding = require('../models/Feeding');
const Cattle = require('../models/Cattle');
const { LIMITS } = require('../constants/domain');
const {
  ok,
  created,
  paginated,
  notFound,
  asyncHandler,
  parsePagination,
  parseDateRange,
  validationMiddleware,
  validateIdParam,
} = require('../middleware');

// GET /api/feeding — paginated list
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { cattle_id, feed_type } = req.query;
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: LIMITS.PAGE_SIZE_DEFAULT,
      maxLimit: LIMITS.PAGE_SIZE_MAX,
    });

    const filter = {};
    if (cattle_id) filter.cattle_id = cattle_id;
    // Exact match against the enum rather than an unanchored regex.
    if (feed_type) filter.feed_type = feed_type;

    const dateRange = parseDateRange(req.query);
    if (dateRange) filter.date_recorded = dateRange;

    const [items, total] = await Promise.all([
      Feeding.find(filter)
        .populate('cattle_id', 'tag_number name breed')
        .sort({ date_recorded: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Feeding.countDocuments(filter),
    ]);

    return paginated(res, items, { total, page, limit });
  })
);

// GET /api/feeding/summary/stats — must precede /:id
router.get(
  '/summary/stats',
  asyncHandler(async (req, res) => {
    const days = Math.max(1, Number.parseInt(req.query.days, 10) || 30);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const match = { $match: { date_recorded: { $gte: startDate } } };

    const [totals, byFeedType, daily] = await Promise.all([
      Feeding.aggregate([
        match,
        {
          $group: {
            _id: null,
            total_quantity: { $sum: '$quantity_kg' },
            total_cost: { $sum: '$total_cost' },
            average_cost_per_unit: { $avg: '$cost_per_unit' },
            record_count: { $sum: 1 },
          },
        },
      ]),
      Feeding.aggregate([
        match,
        {
          $group: {
            _id: '$feed_type',
            total_quantity: { $sum: '$quantity_kg' },
            total_cost: { $sum: '$total_cost' },
            average_cost: { $avg: '$cost_per_unit' },
            record_count: { $sum: 1 },
          },
        },
        { $sort: { total_cost: -1 } },
      ]),
      Feeding.aggregate([
        match,
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$date_recorded',
                timezone: 'UTC',
              },
            },
            daily_quantity: { $sum: '$quantity_kg' },
            daily_cost: { $sum: '$total_cost' },
            record_count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return ok(res, {
      summary: totals[0] || {
        total_quantity: 0,
        total_cost: 0,
        average_cost_per_unit: 0,
        record_count: 0,
      },
      feed_type_breakdown: byFeedType,
      daily_feeding: daily,
      period_days: days,
    });
  })
);

// GET /api/feeding/:id
router.get(
  '/:id',
  validateIdParam(),
  asyncHandler(async (req, res) => {
    const record = await Feeding.findById(req.params.id)
      .populate('cattle_id', 'tag_number name breed')
      .lean();

    if (!record) throw notFound('Feeding record');
    return ok(res, record);
  })
);

// POST /api/feeding
router.post(
  '/',
  validationMiddleware('feeding'),
  asyncHandler(async (req, res) => {
    const {
      cattle_id,
      date_recorded,
      feed_type,
      quantity_kg,
      cost_per_unit,
      supplier,
      notes,
    } = req.body;

    const cattleExists = await Cattle.exists({ _id: cattle_id });
    if (!cattleExists) throw notFound('Cattle');

    // total_cost is derived by the model's pre-save hook.
    const record = await Feeding.create({
      cattle_id,
      date_recorded,
      feed_type,
      quantity_kg,
      cost_per_unit,
      supplier,
      notes,
    });

    await record.populate('cattle_id', 'tag_number name breed');
    return created(res, record.toJSON(), 'Feeding record created');
  })
);

// PUT /api/feeding/:id
router.put(
  '/:id',
  validateIdParam(),
  validationMiddleware('feeding', { partial: true }),
  asyncHandler(async (req, res) => {
    const existing = await Feeding.findById(req.params.id).lean();
    if (!existing) throw notFound('Feeding record');

    // Merge with the stored row so a partial edit still recomputes total_cost
    // from the correct quantity and unit cost.
    const merged = { ...existing, ...req.body };
    const update = { ...req.body };

    const total_cost = Feeding.deriveTotalCost(merged);
    if (total_cost !== undefined) update.total_cost = total_cost;

    const record = await Feeding.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).populate('cattle_id', 'tag_number name breed');

    return ok(res, record.toJSON(), 'Feeding record updated');
  })
);

// DELETE /api/feeding/:id
router.delete(
  '/:id',
  validateIdParam(),
  asyncHandler(async (req, res) => {
    const record = await Feeding.findByIdAndDelete(req.params.id).lean();
    if (!record) throw notFound('Feeding record');
    return ok(res, { _id: req.params.id }, 'Feeding record deleted');
  })
);

module.exports = router;
