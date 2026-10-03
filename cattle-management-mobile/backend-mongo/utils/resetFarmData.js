/**
 * Empties the farm's records before go-live: every cow, milk, feeding,
 * expense and revenue record and the milk-price history.
 *
 * Kept: user accounts (his login) and the settings document (currency, the
 * current price as a starting point). Run only through scripts/reset-farm-data.js,
 * which takes a backup first and needs an explicit confirmation.
 */
const Cattle = require('../models/Cattle');
const MilkProduction = require('../models/MilkProduction');
const Feeding = require('../models/Feeding');
const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');
const MilkPrice = require('../models/MilkPrice');

// Models, not collection-name strings: Mongoose pluralises "Cattle" to "cattles".
const FARM_MODELS = [Cattle, MilkProduction, Feeding, Expense, Revenue, MilkPrice];

/** Document counts per collection that a reset would empty. */
async function countFarmData() {
  const counts = {};
  for (const Model of FARM_MODELS) {
    counts[Model.collection.name] = await Model.countDocuments();
  }
  return counts;
}

/** Deletes them. Returns the number removed per collection. */
async function resetFarmData() {
  const removed = {};
  for (const Model of FARM_MODELS) {
    removed[Model.collection.name] = (await Model.deleteMany({})).deletedCount;
  }
  return removed;
}

module.exports = { FARM_MODELS, countFarmData, resetFarmData };
