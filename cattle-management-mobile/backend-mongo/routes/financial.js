const express = require('express');
const router = express.Router();

const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');
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

/**
 * An expense amount can be given directly or derived from quantity × unit cost.
 * When both parts are present the derived value wins, so the stored amount can
 * never contradict the line-item breakdown shown in the UI.
 */
function resolveAmount(body, fallback) {
  const quantity = body.quantity !== undefined ? Number(body.quantity) : undefined;
  const costPerUnit =
    body.cost_per_unit !== undefined ? Number(body.cost_per_unit) : undefined;

  if (quantity !== undefined && costPerUnit !== undefined) {
    return quantity * costPerUnit;
  }
  if (body.amount !== undefined) return Number(body.amount);
  return fallback;
}

function buildListFilter(query, { enumField, value }) {
  const filter = {};
  if (value) filter[enumField] = value;

  const dateRange = parseDateRange(query);
  if (dateRange) filter.date_recorded = dateRange;

  return filter;
}

// ─── Expenses ────────────────────────────────────────────────────────────────

router.get(
  '/expenses',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: LIMITS.PAGE_SIZE_DEFAULT,
      maxLimit: LIMITS.PAGE_SIZE_MAX,
    });

    const filter = buildListFilter(req.query, {
      enumField: 'category',
      value: req.query.category,
    });

    const [items, total] = await Promise.all([
      Expense.find(filter).sort({ date_recorded: -1 }).skip(skip).limit(limit).lean(),
      Expense.countDocuments(filter),
    ]);

    return paginated(res, items, { total, page, limit });
  })
);

router.get(
  '/expenses/:id',
  validateIdParam(),
  asyncHandler(async (req, res) => {
    const expense = await Expense.findById(req.params.id).lean();
    if (!expense) throw notFound('Expense');
    return ok(res, expense);
  })
);

router.post(
  '/expenses',
  validationMiddleware('expense'),
  asyncHandler(async (req, res) => {
    const expense = await Expense.create({
      ...req.body,
      amount: resolveAmount(req.body),
    });
    return created(res, expense.toJSON(), 'Expense created');
  })
);

router.put(
  '/expenses/:id',
  validateIdParam(),
  validationMiddleware('expense', { partial: true }),
  asyncHandler(async (req, res) => {
    const existing = await Expense.findById(req.params.id).lean();
    if (!existing) throw notFound('Expense');

    // Merge with the stored row so a partial edit still recomputes correctly.
    const merged = { ...existing, ...req.body };
    const update = { ...req.body, amount: resolveAmount(merged, existing.amount) };

    const expense = await Expense.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });

    return ok(res, expense.toJSON(), 'Expense updated');
  })
);

router.delete(
  '/expenses/:id',
  validateIdParam(),
  asyncHandler(async (req, res) => {
    const expense = await Expense.findByIdAndDelete(req.params.id).lean();
    if (!expense) throw notFound('Expense');
    return ok(res, { _id: req.params.id }, 'Expense deleted');
  })
);

// ─── Revenue (non-milk only) ─────────────────────────────────────────────────

router.get(
  '/revenue',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: LIMITS.PAGE_SIZE_DEFAULT,
      maxLimit: LIMITS.PAGE_SIZE_MAX,
    });

    const filter = buildListFilter(req.query, {
      enumField: 'source',
      value: req.query.source,
    });

    const [items, total] = await Promise.all([
      Revenue.find(filter).sort({ date_recorded: -1 }).skip(skip).limit(limit).lean(),
      Revenue.countDocuments(filter),
    ]);

    return paginated(res, items, { total, page, limit });
  })
);

router.get(
  '/revenue/:id',
  validateIdParam(),
  asyncHandler(async (req, res) => {
    const revenue = await Revenue.findById(req.params.id).lean();
    if (!revenue) throw notFound('Revenue record');
    return ok(res, revenue);
  })
);

router.post(
  '/revenue',
  validationMiddleware('revenue'),
  asyncHandler(async (req, res) => {
    const revenue = await Revenue.create(req.body);
    return created(res, revenue.toJSON(), 'Revenue created');
  })
);

router.put(
  '/revenue/:id',
  validateIdParam(),
  validationMiddleware('revenue', { partial: true }),
  asyncHandler(async (req, res) => {
    const revenue = await Revenue.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!revenue) throw notFound('Revenue record');
    return ok(res, revenue.toJSON(), 'Revenue updated');
  })
);

router.delete(
  '/revenue/:id',
  validateIdParam(),
  asyncHandler(async (req, res) => {
    const revenue = await Revenue.findByIdAndDelete(req.params.id).lean();
    if (!revenue) throw notFound('Revenue record');
    return ok(res, { _id: req.params.id }, 'Revenue deleted');
  })
);

// ─── Summary & trends ────────────────────────────────────────────────────────

/**
 * GET /api/financial/summary
 *
 * Accepts either an explicit `date_from`/`date_to` window or a rolling `days`
 * count. Note this covers manual revenue only — milk income lives in
 * /api/analytics/monthly-income because it is derived, not recorded.
 */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const dateRange = parseDateRange(req.query);

    let range = dateRange;
    if (!range) {
      const days = Math.max(1, Number.parseInt(req.query.days, 10) || 30);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      range = { $gte: startDate };
    }

    const match = { $match: { date_recorded: range } };

    const [expenseTotals, revenueTotals, byCategory, bySource] = await Promise.all([
      Expense.aggregate([
        match,
        {
          $group: {
            _id: null,
            total_expenses: { $sum: '$amount' },
            expense_count: { $sum: 1 },
          },
        },
      ]),
      Revenue.aggregate([
        match,
        {
          $group: {
            _id: null,
            total_revenue: { $sum: '$amount' },
            revenue_count: { $sum: 1 },
          },
        },
      ]),
      Expense.aggregate([
        match,
        {
          $group: { _id: '$category', total_amount: { $sum: '$amount' }, count: { $sum: 1 } },
        },
        { $sort: { total_amount: -1 } },
      ]),
      Revenue.aggregate([
        match,
        {
          $group: { _id: '$source', total_amount: { $sum: '$amount' }, count: { $sum: 1 } },
        },
        { $sort: { total_amount: -1 } },
      ]),
    ]);

    const total_expenses = expenseTotals[0]?.total_expenses || 0;
    const total_revenue = revenueTotals[0]?.total_revenue || 0;

    return ok(res, {
      summary: {
        total_revenue,
        total_expenses,
        net_profit: total_revenue - total_expenses,
        revenue_count: revenueTotals[0]?.revenue_count || 0,
        expense_count: expenseTotals[0]?.expense_count || 0,
      },
      expense_by_category: byCategory,
      revenue_by_source: bySource,
    });
  })
);

router.get(
  '/trends',
  asyncHandler(async (req, res) => {
    const days = Math.max(1, Number.parseInt(req.query.days, 10) || 30);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const groupByDay = (amountField) => [
      { $match: { date_recorded: { $gte: startDate } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$date_recorded', timezone: 'UTC' },
          },
          [amountField]: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const [dailyExpenses, dailyRevenue] = await Promise.all([
      Expense.aggregate(groupByDay('daily_expenses')),
      Revenue.aggregate(groupByDay('daily_revenue')),
    ]);

    return ok(res, {
      daily_expenses: dailyExpenses,
      daily_revenue: dailyRevenue,
      period_days: days,
    });
  })
);

module.exports = router;
