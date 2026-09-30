/**
 * Milk price resolution.
 *
 * Rule: a milk record is valued at the price in force on its own date, and that
 * price is stored on the record. Changing the price therefore only touches the
 * records inside the changed window, never the rest of the history.
 */
const MilkPrice = require('../models/MilkPrice');
const MilkProduction = require('../models/MilkProduction');
const Settings = require('../models/Settings');
const { DEFAULTS } = require('../constants/domain');
const { startOfUtcDay } = require('./dates');

// The baseline entry covers every date before the first explicit change.
const BASELINE_DATE = new Date(Date.UTC(1970, 0, 1));

/**
 * Pure lookup, unit-testable without a database.
 * @param {{effective_from: Date|string, price_per_liter: number}[]} prices any order
 * @param {Date|string} date
 * @param {number} fallback used when no entry starts on or before `date`
 */
function resolvePrice(prices, date, fallback) {
  const t = startOfUtcDay(date).getTime();
  let best = null;
  for (const p of prices) {
    const from = startOfUtcDay(p.effective_from).getTime();
    if (from <= t && (best === null || from > startOfUtcDay(best.effective_from).getTime())) {
      best = p;
    }
  }
  return best ? best.price_per_liter : fallback;
}

/** Current farm price without creating anything (read paths must not write). */
async function currentSettingsPrice() {
  const settings = await Settings.findOne().lean();
  return settings ? settings.milk_price_per_liter : DEFAULTS.MILK_PRICE_PER_LITER;
}

/** Price in force on `date`. */
async function priceOn(date) {
  const day = startOfUtcDay(date);
  const entry = await MilkPrice.findOne({ effective_from: { $lte: day } })
    .sort({ effective_from: -1 })
    .lean();
  if (entry) return entry.price_per_liter;
  return currentSettingsPrice();
}

/**
 * Makes the history explicit before its first change: a baseline entry at the
 * current price, and a stored price on every record that lacks one. Without
 * this, the first price change would silently revalue all older records.
 */
async function ensurePriceHistory() {
  if ((await MilkPrice.estimatedDocumentCount()) === 0) {
    const price = await currentSettingsPrice();
    await MilkPrice.updateOne(
      { effective_from: BASELINE_DATE },
      { $setOnInsert: { price_per_liter: price, notes: 'Baseline' } },
      { upsert: true }
    );
  }

  const unpriced = await MilkProduction.find({ price_per_liter: { $exists: false } })
    .select('_id date_recorded')
    .lean();
  if (unpriced.length === 0) return 0;

  const prices = await MilkPrice.find().lean();
  const fallback = await currentSettingsPrice();
  await MilkProduction.bulkWrite(
    unpriced.map((r) => ({
      updateOne: {
        filter: { _id: r._id },
        update: { $set: { price_per_liter: resolvePrice(prices, r.date_recorded, fallback) } },
      },
    }))
  );
  return unpriced.length;
}

/**
 * Re-values milk records whose date falls in the window governed by the entry
 * starting at `from` (up to the next entry). Returns the number updated.
 */
async function revalueWindow(from) {
  const start = startOfUtcDay(from);
  const next = await MilkPrice.findOne({ effective_from: { $gt: start } })
    .sort({ effective_from: 1 })
    .lean();
  const price = await priceOn(start);

  const range = { $gte: start };
  if (next) range.$lt = next.effective_from;

  const result = await MilkProduction.updateMany(
    { date_recorded: range },
    { $set: { price_per_liter: price } }
  );
  return result.modifiedCount;
}

/** Keeps Settings.milk_price_per_liter equal to the price in force today. */
async function syncCurrentPrice() {
  const settings = await Settings.getSingleton();
  const today = await priceOn(new Date());
  if (settings.milk_price_per_liter !== today) {
    settings.milk_price_per_liter = today;
    await settings.save();
  }
  return settings;
}

/**
 * Mongo expression for a record's income: litres × its stored price, or the
 * current price for records written before prices were stored.
 */
const incomeExpr = (fallbackPrice) => ({
  $multiply: ['$quantity_liters', { $ifNull: ['$price_per_liter', fallbackPrice] }],
});

module.exports = {
  BASELINE_DATE,
  resolvePrice,
  priceOn,
  currentSettingsPrice,
  ensurePriceHistory,
  revalueWindow,
  syncCurrentPrice,
  incomeExpr,
};
