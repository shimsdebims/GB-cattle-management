const express = require('express');
const router = express.Router();

const MilkProduction = require('../models/MilkProduction');
const Cattle = require('../models/Cattle');
const { LIMITS } = require('../constants/domain');
const {
  ok,
  created,
  paginated,
  notFound,
  badRequest,
  asyncHandler,
  parsePagination,
  parseDateRange,
  validationMiddleware,
  validateIdParam,
} = require('../middleware');
const { isValidMonth, utcMonthRange, daysAgo, round1 } = require('../utils/dates');

// ─── Collection routes ───────────────────────────────────────────────────────

// GET /api/milk — paginated list
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { cattle_id } = req.query;
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: LIMITS.PAGE_SIZE_DEFAULT,
      maxLimit: LIMITS.PAGE_SIZE_MAX,
    });

    const filter = {};
    if (cattle_id) filter.cattle_id = cattle_id;

    const dateRange = parseDateRange(req.query);
    if (dateRange) filter.date_recorded = dateRange;

    const [items, total] = await Promise.all([
      MilkProduction.find(filter)
        .populate('cattle_id', 'tag_number name breed')
        .sort({ date_recorded: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MilkProduction.countDocuments(filter),
    ]);

    return paginated(res, items, { total, page, limit });
  })
);

/**
 * GET /api/milk/monthly-grid?month=YYYY-MM
 *
 * Cow rows × day columns, matching the farm's spreadsheet layout.
 * Grouping happens in the database; only the (cows × days) result crosses the
 * wire, so a month with tens of thousands of records stays cheap.
 *
 * MUST be declared before `/:id` or Express treats "monthly-grid" as an id.
 */
router.get(
  '/monthly-grid',
  asyncHandler(async (req, res) => {
    const { month } = req.query;
    if (!isValidMonth(month)) {
      throw badRequest('month query param required in YYYY-MM format');
    }

    const { start, end, daysInMonth } = utcMonthRange(month);

    const rows = await MilkProduction.aggregate([
      { $match: { date_recorded: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: {
            cattle_id: '$cattle_id',
            day: { $dayOfMonth: { date: '$date_recorded', timezone: 'UTC' } },
          },
          liters: { $sum: '$quantity_liters' },
        },
      },
      {
        $group: {
          _id: '$_id.cattle_id',
          days: { $push: { day: '$_id.day', liters: '$liters' } },
          total: { $sum: '$liters' },
          recorded_days: { $sum: 1 },
        },
      },
      {
        $lookup: {
          // Derived from the model, never hardcoded: Mongoose pluralizes
          // "Cattle" to "cattles", so a literal 'cattle' matches nothing and
          // every cow silently renders as "Unknown".
          from: Cattle.collection.name,
          localField: '_id',
          foreignField: '_id',
          as: 'cattle',
        },
      },
      { $unwind: { path: '$cattle', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          days: 1,
          total: 1,
          recorded_days: 1,
          name: { $ifNull: ['$cattle.name', 'Unknown'] },
          tag: { $ifNull: ['$cattle.tag_number', '—'] },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const daily_totals = Array(daysInMonth).fill(0);

    const cows = rows.map((row) => {
      const daily = Array(daysInMonth).fill(0);

      for (const { day, liters } of row.days) {
        if (day >= 1 && day <= daysInMonth) {
          daily[day - 1] = round1(liters);
          daily_totals[day - 1] += liters;
        }
      }

      return {
        cattle_id: String(row._id),
        name: row.name,
        tag: row.tag,
        daily,
        total: round1(row.total),
        // Average over days actually recorded, so a cow milked 10 of 31 days
        // is not penalised.
        average: row.recorded_days > 0 ? round1(row.total / row.recorded_days) : 0,
      };
    });

    const grand_total = round1(daily_totals.reduce((sum, v) => sum + v, 0));

    return ok(res, {
      month,
      days_in_month: daysInMonth,
      cows,
      daily_totals: daily_totals.map(round1),
      grand_total,
    });
  })
);

// GET /api/milk/summary/stats — must also precede /:id
router.get(
  '/summary/stats',
  asyncHandler(async (req, res) => {
    const days = Math.max(1, Number.parseInt(req.query.days, 10) || 30);
    const startDate = daysAgo(days);

    const [totals, daily] = await Promise.all([
      MilkProduction.aggregate([
        { $match: { date_recorded: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            total_quantity: { $sum: '$quantity_liters' },
            average_quantity: { $avg: '$quantity_liters' },
            average_quality: { $avg: '$quality_score' },
            record_count: { $sum: 1 },
          },
        },
      ]),
      MilkProduction.aggregate([
        { $match: { date_recorded: { $gte: startDate } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$date_recorded',
                timezone: 'UTC',
              },
            },
            daily_quantity: { $sum: '$quantity_liters' },
            daily_average_quality: { $avg: '$quality_score' },
            record_count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return ok(res, {
      summary: totals[0] || {
        total_quantity: 0,
        average_quantity: 0,
        average_quality: 0,
        record_count: 0,
      },
      daily_production: daily,
      period_days: days,
    });
  })
);

// ─── Item routes ─────────────────────────────────────────────────────────────

// GET /api/milk/:id
router.get(
  '/:id',
  validateIdParam(),
  asyncHandler(async (req, res) => {
    const record = await MilkProduction.findById(req.params.id)
      .populate('cattle_id', 'tag_number name breed')
      .lean();

    if (!record) throw notFound('Milk production record');
    return ok(res, record);
  })
);

// POST /api/milk
router.post(
  '/',
  validationMiddleware('milkProduction'),
  asyncHandler(async (req, res) => {
    const { cattle_id, date_recorded, quantity_liters, quality_score, notes } = req.body;

    const cattleExists = await Cattle.exists({ _id: cattle_id });
    if (!cattleExists) throw notFound('Cattle');

    // A duplicate (cattle_id, date_recorded) is rejected by the unique index and
    // rendered as a 409 by the central error handler.
    const record = await MilkProduction.create({
      cattle_id,
      date_recorded,
      quantity_liters,
      quality_score,
      notes,
    });

    await record.populate('cattle_id', 'tag_number name breed');
    return created(res, record.toJSON(), 'Milk record created');
  })
);

// PUT /api/milk/:id
router.put(
  '/:id',
  validateIdParam(),
  validationMiddleware('milkProduction', { partial: true }),
  asyncHandler(async (req, res) => {
    const record = await MilkProduction.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('cattle_id', 'tag_number name breed');

    if (!record) throw notFound('Milk production record');
    return ok(res, record.toJSON(), 'Milk record updated');
  })
);

// DELETE /api/milk/:id
router.delete(
  '/:id',
  validateIdParam(),
  asyncHandler(async (req, res) => {
    const record = await MilkProduction.findByIdAndDelete(req.params.id).lean();
    if (!record) throw notFound('Milk production record');
    return ok(res, { _id: req.params.id }, 'Milk record deleted');
  })
);

module.exports = router;
