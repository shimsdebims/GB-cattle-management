const express = require('express');
const router = express.Router();

const Settings = require('../models/Settings');
const MilkPrice = require('../models/MilkPrice');
const {
  ok,
  asyncHandler,
  badRequest,
  notFound,
  validationMiddleware,
  validateIdParam,
} = require('../middleware');
const { startOfUtcDay } = require('../utils/dates');
const {
  BASELINE_DATE,
  ensurePriceHistory,
  revalueWindow,
  syncCurrentPrice,
} = require('../utils/pricing');

const toDay = (value) => {
  const date = startOfUtcDay(value);
  if (Number.isNaN(date.getTime())) throw badRequest('effective_from must be a valid date');
  return date;
};

// GET /api/settings — creates the singleton on first call
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const settings = await Settings.getSingleton();
    return ok(res, settings.toJSON());
  })
);

/**
 * PUT /api/settings
 *
 * `milk_price_per_liter` + optional `effective_from` (YYYY-MM-DD, default today)
 * records a price change from that date on. Only milk days inside the new
 * price's window are revalued; everything before keeps the price it earned.
 */
router.put(
  '/',
  validationMiddleware('settings'),
  asyncHandler(async (req, res) => {
    const { milk_price_per_liter, currency, effective_from } = req.body;

    const settings = await Settings.getSingleton();
    if (currency !== undefined) {
      settings.currency = String(currency).trim();
      await settings.save();
    }

    let revalued = 0;
    if (milk_price_per_liter !== undefined) {
      const from = toDay(effective_from || new Date());
      // Pin the old price on the past before anything moves.
      await ensurePriceHistory();
      await MilkPrice.updateOne(
        { effective_from: from },
        { $set: { price_per_liter: Number(milk_price_per_liter) } },
        { upsert: true }
      );
      revalued = await revalueWindow(from);
    }

    const current = await syncCurrentPrice();
    return ok(res, { ...current.toJSON(), revalued_records: revalued }, 'Settings updated');
  })
);

// GET /api/settings/milk-prices — the full price history, newest first
router.get(
  '/milk-prices',
  asyncHandler(async (req, res) => {
    await ensurePriceHistory();
    const prices = await MilkPrice.find().sort({ effective_from: -1 }).lean();
    return ok(res, prices);
  })
);

// DELETE /api/settings/milk-prices/:id — undo a mistaken change
router.delete(
  '/milk-prices/:id',
  validateIdParam(),
  asyncHandler(async (req, res) => {
    const entry = await MilkPrice.findById(req.params.id).lean();
    if (!entry) throw notFound('Milk price');
    if (entry.effective_from.getTime() === BASELINE_DATE.getTime()) {
      throw badRequest('The baseline price cannot be deleted; change it instead.');
    }

    await MilkPrice.deleteOne({ _id: entry._id });
    // The window now belongs to the previous entry: revalue it at that price.
    const previous = await MilkPrice.findOne({ effective_from: { $lt: entry.effective_from } })
      .sort({ effective_from: -1 })
      .lean();
    const revalued = previous ? await revalueWindow(previous.effective_from) : 0;
    await syncCurrentPrice();

    return ok(res, { _id: req.params.id, revalued_records: revalued }, 'Milk price removed');
  })
);

module.exports = router;
