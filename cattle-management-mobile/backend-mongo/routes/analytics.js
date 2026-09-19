const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Cattle = require('../models/Cattle');
const MilkProduction = require('../models/MilkProduction');
const Feeding = require('../models/Feeding');
const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');
const Settings = require('../models/Settings');
const {
  ok,
  badRequest,
  asyncHandler,
} = require('../middleware');
const {
  isValidMonth,
  utcMonthRange,
  daysAgo,
  round1,
  roundInt,
} = require('../utils/dates');

/**
 * GET /api/analytics/dashboard
 *
 * The single source of truth for the home screen. Everything is aggregated in
 * the database, so the app no longer downloads records to add them up — which
 * was both slow and silently capped by pagination.
 *
 * Revenue is modelled the same way as on the Financial screen:
 *   milk revenue (derived) + other revenue (recorded) − expenses = net profit
 * so the two screens can never disagree.
 */
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const days = Math.max(1, Number.parseInt(req.query.days, 10) || 30);
    const startDate = daysAgo(days);
    const periodMatch = { $match: { date_recorded: { $gte: startDate } } };

    const [
      cattleStats,
      milkStats,
      expenseStats,
      revenueStats,
      feedingStats,
      settings,
    ] = await Promise.all([
      Cattle.aggregate([
        {
          $group: {
            _id: null,
            total_cattle: { $sum: 1 },
            active_cattle: {
              $sum: { $cond: [{ $eq: ['$current_status', 'Active'] }, 1, 0] },
            },
            healthy_cattle: {
              $sum: { $cond: [{ $eq: ['$health_status', 'Healthy'] }, 1, 0] },
            },
            pregnant_cattle: {
              $sum: { $cond: [{ $eq: ['$health_status', 'Pregnant'] }, 1, 0] },
            },
          },
        },
      ]),
      MilkProduction.aggregate([
        periodMatch,
        {
          $group: {
            _id: null,
            total_milk: { $sum: '$quantity_liters' },
            average_quality: { $avg: '$quality_score' },
            production_records: { $sum: 1 },
            // Distinct recording days give a truthful daily average.
            recording_days: { $addToSet: '$date_recorded' },
          },
        },
        {
          $project: {
            total_milk: 1,
            average_quality: 1,
            production_records: 1,
            recording_day_count: { $size: '$recording_days' },
          },
        },
      ]),
      Expense.aggregate([
        periodMatch,
        { $group: { _id: null, total_expenses: { $sum: '$amount' } } },
      ]),
      Revenue.aggregate([
        periodMatch,
        { $group: { _id: null, total_other_revenue: { $sum: '$amount' } } },
      ]),
      Feeding.aggregate([
        periodMatch,
        {
          $group: {
            _id: null,
            total_feed_cost: { $sum: '$total_cost' },
            total_feed_quantity: { $sum: '$quantity_kg' },
          },
        },
      ]),
      Settings.getSingleton(),
    ]);

    const cattle = cattleStats[0] || {
      total_cattle: 0,
      active_cattle: 0,
      healthy_cattle: 0,
      pregnant_cattle: 0,
    };
    const milk = milkStats[0] || {
      total_milk: 0,
      average_quality: 0,
      production_records: 0,
      recording_day_count: 0,
    };

    const milkPrice = settings.milk_price_per_liter;
    const totalMilk = milk.total_milk || 0;

    const milk_revenue = roundInt(totalMilk * milkPrice);
    const other_revenue = revenueStats[0]?.total_other_revenue || 0;
    const total_expenses = expenseStats[0]?.total_expenses || 0;
    const total_revenue = milk_revenue + other_revenue;

    return ok(res, {
      cattle,
      milk_production: {
        total_liters: round1(totalMilk),
        average_quality: milk.average_quality || 0,
        production_records: milk.production_records,
        // Averaged over the requested window, matching the "last N days" label.
        average_daily_liters: round1(totalMilk / days),
        recording_days: milk.recording_day_count,
      },
      financial: {
        milk_revenue,
        other_revenue,
        total_revenue,
        total_expenses,
        net_profit: total_revenue - total_expenses,
        milk_price_per_liter: milkPrice,
        currency: settings.currency,
      },
      feeding: feedingStats[0] || { total_feed_cost: 0, total_feed_quantity: 0 },
      period_days: days,
    });
  })
);

// GET /api/analytics/milk-production-trends
router.get(
  '/milk-production-trends',
  asyncHandler(async (req, res) => {
    const days = Math.max(1, Number.parseInt(req.query.days, 10) || 30);
    const { cattle_id } = req.query;

    const match = { date_recorded: { $gte: daysAgo(days) } };
    if (cattle_id) {
      if (!mongoose.Types.ObjectId.isValid(cattle_id)) {
        throw badRequest('cattle_id must be a valid id');
      }
      // Must be an ObjectId — a raw string never matches inside $match.
      match.cattle_id = new mongoose.Types.ObjectId(cattle_id);
    }

    const [dailyTrends, cattlePerformance] = await Promise.all([
      MilkProduction.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$date_recorded',
                timezone: 'UTC',
              },
            },
            total_quantity: { $sum: '$quantity_liters' },
            average_quality: { $avg: '$quality_score' },
            record_count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      MilkProduction.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$cattle_id',
            total_quantity: { $sum: '$quantity_liters' },
            average_quantity: { $avg: '$quantity_liters' },
            average_quality: { $avg: '$quality_score' },
            record_count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: Cattle.collection.name,
            localField: '_id',
            foreignField: '_id',
            as: 'cattle_info',
          },
        },
        { $unwind: { path: '$cattle_info', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            cattle_id: '$_id',
            tag_number: { $ifNull: ['$cattle_info.tag_number', '—'] },
            name: { $ifNull: ['$cattle_info.name', 'Unknown'] },
            breed: '$cattle_info.breed',
            total_quantity: 1,
            average_quantity: 1,
            average_quality: 1,
            record_count: 1,
          },
        },
        { $sort: { total_quantity: -1 } },
      ]),
    ]);

    return ok(res, {
      daily_trends: dailyTrends,
      cattle_performance: cattlePerformance,
      period_days: days,
    });
  })
);

// GET /api/analytics/feeding-analysis
router.get(
  '/feeding-analysis',
  asyncHandler(async (req, res) => {
    const days = Math.max(1, Number.parseInt(req.query.days, 10) || 30);
    const match = { $match: { date_recorded: { $gte: daysAgo(days) } } };

    const [feedTypeCosts, dailyFeedingCosts] = await Promise.all([
      Feeding.aggregate([
        match,
        {
          $group: {
            _id: '$feed_type',
            total_cost: { $sum: '$total_cost' },
            total_quantity: { $sum: '$quantity_kg' },
            average_cost_per_unit: { $avg: '$cost_per_unit' },
            usage_count: { $sum: 1 },
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
            daily_cost: { $sum: '$total_cost' },
            daily_quantity: { $sum: '$quantity_kg' },
            feed_sessions: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return ok(res, {
      feed_type_costs: feedTypeCosts,
      daily_feeding_costs: dailyFeedingCosts,
      period_days: days,
    });
  })
);

/**
 * GET /api/analytics/monthly-income?month=YYYY-MM
 * Per-cow milk production converted to income at the farm's current price.
 */
router.get(
  '/monthly-income',
  asyncHandler(async (req, res) => {
    const { month } = req.query;
    if (!isValidMonth(month)) {
      throw badRequest('month query param required in YYYY-MM format');
    }

    const { start, end } = utcMonthRange(month);
    const settings = await Settings.getSingleton();
    const milkPrice = settings.milk_price_per_liter;

    const perCow = await MilkProduction.aggregate([
      { $match: { date_recorded: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: '$cattle_id',
          total_liters: { $sum: '$quantity_liters' },
          record_count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          // Mongoose pluralizes the model name, so this must come from the model.
          // Hardcoding 'cattle' made every cow render as "Unknown" here.
          from: Cattle.collection.name,
          localField: '_id',
          foreignField: '_id',
          as: 'cattle_info',
        },
      },
      // NOTE: the option is `preserveNullAndEmptyArrays`; the previous misspelling
      // silently dropped rows whose cattle record was missing.
      { $unwind: { path: '$cattle_info', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          cattle_id: '$_id',
          name: { $ifNull: ['$cattle_info.name', 'Unknown'] },
          tag: { $ifNull: ['$cattle_info.tag_number', '—'] },
          total_liters: 1,
          record_count: 1,
        },
      },
      { $sort: { total_liters: -1 } },
    ]);

    const cows = perCow.map((c) => ({
      cattle_id: String(c.cattle_id),
      name: c.name,
      tag: c.tag,
      total_liters: round1(c.total_liters),
      income: roundInt(c.total_liters * milkPrice),
      record_count: c.record_count,
    }));

    const total_liters = cows.reduce((sum, c) => sum + c.total_liters, 0);
    const total_income = roundInt(total_liters * milkPrice);

    return ok(res, {
      month,
      milk_price_per_liter: milkPrice,
      currency: settings.currency,
      cows,
      total_liters: round1(total_liters),
      total_income,
      average_per_head: cows.length > 0 ? roundInt(total_income / cows.length) : 0,
    });
  })
);

module.exports = router;
