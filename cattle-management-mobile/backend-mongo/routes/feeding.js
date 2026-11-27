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
  badRequest,
} = require('../middleware');
const { isValidMonth, utcMonthRange, round1 } = require('../utils/dates');
const { cleanClientId, createOnce } = require('../utils/idempotency');

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

/**
 * GET /api/feeding/monthly-grid?month=YYYY-MM
 *
 * Cow rows × day columns for one month, like the milk sheet, in both kg and
 * FBu. Answers every question at once:
 *   one cell          → one cow, one day
 *   a row's total     → one cow, the whole month
 *   the bottom row    → all cows, one day
 *   the corner        → all cows, the whole month
 * plus a per-feed-type breakdown for the month.
 *
 * Arrays use null for "nothing recorded that day", so a real 0 stays visible.
 * MUST be declared before `/:id`.
 */
router.get(
  '/monthly-grid',
  asyncHandler(async (req, res) => {
    const { month } = req.query;
    if (!isValidMonth(month)) {
      throw badRequest('month query param required in YYYY-MM format');
    }

    const { start, end, daysInMonth } = utcMonthRange(month);
    const match = { $match: { date_recorded: { $gte: start, $lt: end } } };
    const cost = { $ifNull: ['$total_cost', 0] };

    const [rows, byType] = await Promise.all([
      Feeding.aggregate([
        match,
        {
          $group: {
            _id: {
              cattle_id: '$cattle_id',
              day: { $dayOfMonth: { date: '$date_recorded', timezone: 'UTC' } },
            },
            kg: { $sum: '$quantity_kg' },
            cost: { $sum: cost },
          },
        },
        {
          $group: {
            _id: '$_id.cattle_id',
            days: { $push: { day: '$_id.day', kg: '$kg', cost: '$cost' } },
            total_kg: { $sum: '$kg' },
            total_cost: { $sum: '$cost' },
            fed_days: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: Cattle.collection.name,
            localField: '_id',
            foreignField: '_id',
            as: 'cattle',
          },
        },
        { $unwind: { path: '$cattle', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            days: 1,
            total_kg: 1,
            total_cost: 1,
            fed_days: 1,
            name: { $ifNull: ['$cattle.name', 'Unknown'] },
            tag: { $ifNull: ['$cattle.tag_number', '—'] },
          },
        },
        { $sort: { total_kg: -1, tag: 1 } },
      ]),
      Feeding.aggregate([
        match,
        {
          $group: {
            _id: '$feed_type',
            total_kg: { $sum: '$quantity_kg' },
            total_cost: { $sum: cost },
          },
        },
        { $sort: { total_kg: -1 } },
      ]),
    ]);

    const daily_kg = Array(daysInMonth).fill(null);
    const daily_cost = Array(daysInMonth).fill(null);

    const cows = rows.map((row) => {
      const kg = Array(daysInMonth).fill(null);
      const fbu = Array(daysInMonth).fill(null);
      for (const d of row.days) {
        if (d.day < 1 || d.day > daysInMonth) continue;
        const i = d.day - 1;
        kg[i] = round1(d.kg);
        fbu[i] = Math.round(d.cost);
        daily_kg[i] = (daily_kg[i] || 0) + d.kg;
        daily_cost[i] = (daily_cost[i] || 0) + d.cost;
      }
      return {
        cattle_id: String(row._id),
        name: row.name,
        tag: row.tag,
        daily_kg: kg,
        daily_cost: fbu,
        total_kg: round1(row.total_kg),
        total_cost: Math.round(row.total_cost),
        fed_days: row.fed_days,
        // Average over days actually fed.
        average_kg: row.fed_days > 0 ? round1(row.total_kg / row.fed_days) : 0,
      };
    });

    const sum = (list) => list.reduce((acc, v) => acc + (v || 0), 0);

    return ok(res, {
      month,
      days_in_month: daysInMonth,
      cows,
      daily_totals_kg: daily_kg.map((v) => (v === null ? null : round1(v))),
      daily_totals_cost: daily_cost.map((v) => (v === null ? null : Math.round(v))),
      grand_total_kg: round1(sum(daily_kg)),
      grand_total_cost: Math.round(sum(daily_cost)),
      fed_days: daily_kg.filter((v) => v !== null).length,
      by_feed_type: byType.map((t) => ({
        feed_type: t._id,
        total_kg: round1(t.total_kg),
        total_cost: Math.round(t.total_cost),
      })),
    });
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
    const clientId = cleanClientId(req.body.client_id);
    const { record, replayed } = await createOnce(Feeding, clientId, () =>
      Feeding.create({
        cattle_id,
        date_recorded,
        feed_type,
        quantity_kg,
        cost_per_unit,
        supplier,
        notes,
        client_id: clientId,
      })
    );

    await record.populate('cattle_id', 'tag_number name breed');
    if (replayed) return ok(res, record.toJSON(), 'Feeding record already saved');
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
