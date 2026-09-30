const express = require('express');
const router = express.Router();

const Cattle = require('../models/Cattle');
const MilkProduction = require('../models/MilkProduction');
const Feeding = require('../models/Feeding');
const Revenue = require('../models/Revenue');
const Settings = require('../models/Settings');
const { LIMITS, ARCHIVED_STATUSES } = require('../constants/domain');
const { incomeExpr } = require('../utils/pricing');
const {
  ok,
  created,
  paginated,
  notFound,
  badRequest,
  ApiError,
  asyncHandler,
  parsePagination,
  validationMiddleware,
  validateIdParam,
} = require('../middleware');
const { cleanClientId, createOnce } = require('../utils/idempotency');

// GET /api/cattle — paginated list
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, health, breed, search, archived } = req.query;
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: LIMITS.PAGE_SIZE_DEFAULT,
      maxLimit: LIMITS.PAGE_SIZE_MAX,
    });

    const filter = {};
    // archived=exclude → working herd, only → the archive, absent/include → all.
    if (archived === 'exclude') filter.current_status = { $nin: ARCHIVED_STATUSES };
    else if (archived === 'only') filter.current_status = { $in: ARCHIVED_STATUSES };
    else if (archived && archived !== 'include') {
      throw badRequest('archived must be one of: include, exclude, only');
    }
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

    const settings = await Settings.getSingleton();

    // Totals come from aggregation; only the display rows are fetched.
    const [
      milkTotals,
      feedTotals,
      recentMilk,
      recentFeeding,
      lifetimeMilk,
      lifetimeFeed,
      saleRevenue,
    ] = await Promise.all([
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
      MilkProduction.aggregate([
        { $match: { cattle_id: cattle._id } },
        {
          $group: {
            _id: null,
            total_liters: { $sum: '$quantity_liters' },
            milk_income: { $sum: incomeExpr(settings.milk_price_per_liter) },
            record_count: { $sum: 1 },
            first_date: { $min: '$date_recorded' },
            last_date: { $max: '$date_recorded' },
          },
        },
      ]),
      Feeding.aggregate([
        { $match: { cattle_id: cattle._id } },
        { $group: { _id: null, total_cost: { $sum: '$total_cost' } } },
      ]),
      Revenue.find({ cattle_id: cattle._id }).sort({ date_recorded: -1 }).lean(),
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
      // Whole-life figures for the cow's card, archived cows included.
      lifetime: (() => {
        const lm = lifetimeMilk[0] || { total_liters: 0, milk_income: 0, record_count: 0 };
        const feedCost = lifetimeFeed[0]?.total_cost || 0;
        const saleIncome = saleRevenue.reduce((sum, r) => sum + r.amount, 0);
        const milkIncome = Math.round(lm.milk_income || 0);
        return {
          total_liters: Math.round((lm.total_liters || 0) * 10) / 10,
          milk_income: milkIncome,
          milk_record_count: lm.record_count,
          first_milk_date: lm.first_date || null,
          last_milk_date: lm.last_date || null,
          feed_cost: feedCost,
          sale_income: saleIncome,
          net: milkIncome + saleIncome - feedCost,
          currency: settings.currency,
        };
      })(),
      sale_revenue: saleRevenue,
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
    const clientId = cleanClientId(req.body.client_id);
    const { record, replayed } = await createOnce(Cattle, clientId, () =>
      Cattle.create({ ...req.body, client_id: clientId })
    );
    if (replayed) return ok(res, record.toJSON(), 'Cattle already saved');
    return created(res, record.toJSON(), 'Cattle created');
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

/**
 * POST /api/cattle/:id/sell — { sale_date, sale_price, buyer?, notes? }
 *
 * Archives the cow as Sold and books the sale as income, linked to the cow so
 * its card shows what it sold for. Its milk history is kept.
 */
router.post(
  '/:id/sell',
  validateIdParam(),
  validationMiddleware('sale'),
  asyncHandler(async (req, res) => {
    const cattle = await Cattle.findById(req.params.id);
    if (!cattle) throw notFound('Cattle');
    if (cattle.current_status === 'Sold') {
      const error = new ApiError(409, 'Conflict', 'This animal is already marked as sold.');
      error.code = 'ALREADY_SOLD';
      throw error;
    }

    const { sale_date, sale_price, buyer, notes } = req.body;
    const revenue = await Revenue.create({
      date_recorded: sale_date,
      source: 'Cattle Sale',
      description: `Sale of ${cattle.name} (${cattle.tag_number})${buyer ? ` to ${buyer}` : ''}`,
      amount: Number(sale_price),
      cattle_id: cattle._id,
      notes,
    });

    try {
      cattle.current_status = 'Sold';
      cattle.sale_date = sale_date;
      cattle.sale_price = Number(sale_price);
      cattle.buyer = buyer;
      await cattle.save();
    } catch (error) {
      // No transactions on a standalone cluster: undo the income by hand.
      await Revenue.deleteOne({ _id: revenue._id });
      throw error;
    }

    return ok(res, { cattle: cattle.toJSON(), revenue: revenue.toJSON() }, 'Cattle marked as sold');
  })
);

/** DELETE /api/cattle/:id/sale — undo a sale recorded by mistake. */
router.delete(
  '/:id/sale',
  validateIdParam(),
  asyncHandler(async (req, res) => {
    const cattle = await Cattle.findById(req.params.id);
    if (!cattle) throw notFound('Cattle');
    if (cattle.current_status !== 'Sold') throw badRequest('This animal is not marked as sold.');

    const removed = await Revenue.deleteMany({ cattle_id: cattle._id, source: 'Cattle Sale' });
    cattle.current_status = 'Active';
    cattle.sale_date = undefined;
    cattle.sale_price = undefined;
    cattle.buyer = undefined;
    await cattle.save();

    return ok(
      res,
      { cattle: cattle.toJSON(), deleted_revenue_records: removed.deletedCount },
      'Sale undone'
    );
  })
);

/**
 * DELETE /api/cattle/:id — only for a cow entered by mistake.
 *
 * A cow with any milk, feeding or sale history is never erased: deleting it
 * would silently rewrite past months' income. Archive it instead (sell, or set
 * the status to Deceased).
 */
router.delete(
  '/:id',
  validateIdParam(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const cattle = await Cattle.findById(id).lean();
    if (!cattle) throw notFound('Cattle');

    const [milk, feeding, revenue] = await Promise.all([
      MilkProduction.countDocuments({ cattle_id: id }),
      Feeding.countDocuments({ cattle_id: id }),
      Revenue.countDocuments({ cattle_id: id }),
    ]);
    if (milk + feeding + revenue > 0) {
      const error = new ApiError(
        409,
        'Conflict',
        'This animal has history. Mark it as sold or deceased to archive it instead.'
      );
      error.code = 'CATTLE_HAS_HISTORY';
      throw error;
    }

    await Cattle.findByIdAndDelete(id);
    return ok(res, { _id: id }, 'Cattle deleted');
  })
);

module.exports = router;
