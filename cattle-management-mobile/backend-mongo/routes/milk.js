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
const { priceOn } = require('../utils/pricing');
const { cleanClientId, createOnce } = require('../utils/idempotency');
const { ApiError } = require('../middleware');

const POPULATE = ['cattle_id', 'tag_number name breed'];

/**
 * The day's total is the morning + evening sum whenever either is recorded;
 * otherwise the total as given. Rounded to 0.01 so 8.1 + 6.2 stores 14.3.
 */
function resolveQuantity({ morning_liters, evening_liters, quantity_liters }) {
  if (morning_liters == null && evening_liters == null) return quantity_liters;
  return Math.round(((Number(morning_liters) || 0) + (Number(evening_liters) || 0)) * 100) / 100;
}

/** 409 carrying the server's record, so the app can offer to keep, replace or add. */
function milkConflict(code, message, existing) {
  const error = new ApiError(409, 'Conflict', message);
  error.code = code;
  error.data = existing;
  return error;
}

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

    // null = no record that day, so a real 0 L day stays visible as 0.
    const daily_totals = Array(daysInMonth).fill(null);

    const cows = rows.map((row) => {
      const daily = Array(daysInMonth).fill(null);

      for (const { day, liters } of row.days) {
        if (day >= 1 && day <= daysInMonth) {
          daily[day - 1] = round1(liters);
          daily_totals[day - 1] = (daily_totals[day - 1] || 0) + liters;
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
      daily_totals: daily_totals.map((v) => (v === null ? null : round1(v))),
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
    const { cattle_id, date_recorded, morning_liters, evening_liters, quality_score, notes } =
      req.body;
    const clientId = cleanClientId(req.body.client_id);

    const cattleExists = await Cattle.exists({ _id: cattle_id });
    if (!cattleExists) throw notFound('Cattle');

    const { record, replayed } = await createOnce(MilkProduction, clientId, async () => {
      // One record per cow per day. Answer a clash with the existing record so
      // the app can ask whether to keep it, replace it or add the two together.
      const existing = await MilkProduction.findOne({
        cattle_id,
        date_recorded: MilkProduction.startOfUtcDay(date_recorded),
      })
        .populate(...POPULATE)
        .lean();
      if (existing) {
        throw milkConflict(
          'MILK_DAY_EXISTS',
          'A record already exists for this animal on this date',
          existing
        );
      }

      return MilkProduction.create({
        cattle_id,
        date_recorded,
        morning_liters,
        evening_liters,
        quantity_liters: resolveQuantity(req.body),
        quality_score,
        notes,
        client_id: clientId,
        // Valued at the price in force that day, and kept even if the price changes.
        price_per_liter: await priceOn(date_recorded),
      });
    });

    await record.populate(...POPULATE);
    // A replayed retry is not a new record: 200, same body as the first time.
    if (replayed) return ok(res, record.toJSON(), 'Milk record already saved');
    return created(res, record.toJSON(), 'Milk record created');
  })
);

// PUT /api/milk/:id
router.put(
  '/:id',
  validateIdParam(),
  validationMiddleware('milkProduction', { partial: true }),
  asyncHandler(async (req, res) => {
    // The price is server-controlled; a moved date takes that day's price.
    // eslint-disable-next-line no-unused-vars
    const { price_per_liter, expected_updated_at, ...update } = req.body;

    const existing = await MilkProduction.findById(req.params.id).populate(...POPULATE).lean();
    if (!existing) throw notFound('Milk production record');

    // Edited somewhere else since this phone loaded it: ask, don't overwrite.
    if (
      expected_updated_at &&
      new Date(expected_updated_at).getTime() !== new Date(existing.updated_at).getTime()
    ) {
      throw milkConflict(
        'MILK_CHANGED',
        'This record was changed on another device since you opened it',
        existing
      );
    }

    if (update.date_recorded) update.price_per_liter = await priceOn(update.date_recorded);
    if (['morning_liters', 'evening_liters', 'quantity_liters'].some((k) => k in update)) {
      update.quantity_liters = resolveQuantity({ ...existing, ...update });
    }

    const record = await MilkProduction.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).populate(...POPULATE);

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
