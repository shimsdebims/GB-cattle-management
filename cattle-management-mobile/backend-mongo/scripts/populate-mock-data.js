/**
 * Seeds a realistic dataset for local development.
 *
 * Deliberately generates more than one page of records (see MILK_DAYS) so the
 * dashboard and monthly aggregations are exercised beyond the pagination limit.
 *
 * Usage:  npm run populate
 *         npm run populate -- --cows=30 --days=90
 */
require('dotenv').config();

const db = require('../db');
const Cattle = require('../models/Cattle');
const MilkProduction = require('../models/MilkProduction');
const Feeding = require('../models/Feeding');
const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');
const Settings = require('../models/Settings');

const {
  BREEDS,
  HEALTH_STATUSES,
  FEED_TYPES,
  EXPENSE_CATEGORIES,
  REVENUE_SOURCES,
  CATTLE_LOCATIONS,
} = require('../constants/domain');
const { startOfUtcDay } = require('../utils/dates');

// ─── Config ──────────────────────────────────────────────────────────────────

function readArg(name, fallback) {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!match) return fallback;
  const value = Number.parseInt(match.split('=')[1], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const COW_COUNT = readArg('cows', 20);
const MILK_DAYS = readArg('days', 60);
const FEEDING_DAYS = 30;
const EXPENSE_COUNT = 60;
const REVENUE_COUNT = 12;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randFloat = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const round1 = (n) => Math.round(n * 10) / 10;

/** UTC-midnight date `daysBack` days before today. */
function dayOffset(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return startOfUtcDay(d);
}

const COW_NAMES = [
  'Daisy', 'Bella', 'Luna', 'Rosie', 'Molly', 'Ruby', 'Stella', 'Coco',
  'Penny', 'Ginger', 'Nala', 'Maya', 'Zuri', 'Amara', 'Imena', 'Keza',
  'Iragi', 'Shani', 'Neza', 'Tosha',
];

const SUPPLIERS = [
  'Farm Supply Co',
  'Green Valley Feeds',
  'Bujumbura Agro',
  'Local Cooperative',
];

// ─── Builders ────────────────────────────────────────────────────────────────

function buildCattle() {
  return Array.from({ length: COW_COUNT }, (_, i) => {
    // Mostly active, milking females so the reports have real signal.
    const isFemale = i % 10 !== 0;

    return {
      tag_number: `GB${String(i + 1).padStart(4, '0')}`,
      name: `${COW_NAMES[i % COW_NAMES.length]}${i >= COW_NAMES.length ? ` ${i}` : ''}`,
      breed: pick(BREEDS),
      date_of_birth: new Date(randInt(2018, 2023), randInt(0, 11), randInt(1, 28)),
      gender: isFemale ? 'Female' : 'Male',
      weight: Math.round(randFloat(350, 700)),
      health_status: i % 7 === 0 ? pick(HEALTH_STATUSES) : 'Healthy',
      location: pick(CATTLE_LOCATIONS),
      purchase_date: new Date(randInt(2023, 2025), randInt(0, 11), randInt(1, 28)),
      // BIF scale: a dairy cow is on the order of millions of francs.
      purchase_price: randInt(800, 2500) * 1000,
      current_status: i % 11 === 0 ? 'Sold' : 'Active',
      notes: pick(['High milk producer', 'Good breeding stock', 'Steady yield', null]),
    };
  });
}

/**
 * One record per cow per day — the unique (cattle_id, date_recorded) index
 * rejects anything else, and it matches how the farm actually books a day's
 * total per animal.
 */
function buildMilk(herd) {
  const records = [];

  for (const cow of herd) {
    if (cow.current_status !== 'Active' || cow.gender !== 'Female') continue;

    // A per-cow baseline makes the "top producer" ranking meaningful.
    const baseline = randFloat(12, 28);

    for (let daysBack = 0; daysBack < MILK_DAYS; daysBack += 1) {
      // Occasional gap, like a real logbook.
      if (Math.random() < 0.08) continue;

      records.push({
        cattle_id: cow._id,
        date_recorded: dayOffset(daysBack),
        quantity_liters: round1(Math.max(1, baseline + randFloat(-3, 3))),
        quality_score: randInt(6, 10),
        notes: Math.random() < 0.1 ? pick(['Good quality', 'High fat content']) : undefined,
      });
    }
  }

  return records;
}

function buildFeeding(herd) {
  const records = [];

  for (const cow of herd) {
    if (cow.current_status !== 'Active') continue;

    for (let daysBack = 0; daysBack < FEEDING_DAYS; daysBack += 1) {
      if (Math.random() < 0.3) continue;

      const quantity = round1(randFloat(5, 15));
      const costPerUnit = randInt(400, 1200);

      records.push({
        cattle_id: cow._id,
        date_recorded: dayOffset(daysBack),
        feed_type: pick(FEED_TYPES),
        quantity_kg: quantity,
        cost_per_unit: costPerUnit,
        total_cost: quantity * costPerUnit,
        supplier: pick(SUPPLIERS),
      });
    }
  }

  return records;
}

/** BIF-scale amounts per category, matching the farm's real bookkeeping. */
const EXPENSE_PROFILE = {
  Concentrates: { min: 150000, max: 600000, description: 'Concentrate purchase' },
  Protein: { min: 100000, max: 400000, description: 'Protein supplement' },
  Medical: { min: 30000, max: 250000, description: 'Veterinary treatment' },
  'Salary - Manager': { min: 300000, max: 500000, description: 'Manager salary' },
  'Salary - Workers': { min: 150000, max: 400000, description: 'Worker wages' },
  'Cattle Tax': { min: 50000, max: 150000, description: 'Cattle tax payment' },
  Insurance: { min: 80000, max: 200000, description: 'Insurance premium' },
  Bedding: { min: 40000, max: 120000, description: 'Bedding materials' },
  'Other Operations': { min: 20000, max: 200000, description: 'General operations' },
};

function buildExpenses() {
  return Array.from({ length: EXPENSE_COUNT }, () => {
    const category = pick(EXPENSE_CATEGORIES);
    const profile = EXPENSE_PROFILE[category];

    // Half the rows are line items with quantity × unit cost, like the app's form.
    const useLineItem = Math.random() < 0.5;
    const quantity = useLineItem ? randInt(5, 60) : undefined;
    const costPerUnit = useLineItem ? randInt(1000, 6000) : undefined;
    const amount = useLineItem
      ? quantity * costPerUnit
      : randInt(profile.min, profile.max);

    return {
      date_recorded: dayOffset(randInt(0, 89)),
      category,
      description: profile.description,
      quantity,
      cost_per_unit: costPerUnit,
      amount,
      supplier: pick(SUPPLIERS),
      receipt_number: `RCP${randInt(1000, 9999)}`,
    };
  });
}

function buildRevenue() {
  return Array.from({ length: REVENUE_COUNT }, () => {
    const source = pick(REVENUE_SOURCES);
    const amounts = {
      'Cattle Sale': [800000, 2500000],
      'Breeding Services': [50000, 200000],
      'Manure Sales': [20000, 100000],
      Other: [30000, 300000],
    };
    const [min, max] = amounts[source];

    return {
      date_recorded: dayOffset(randInt(0, 59)),
      source,
      description: `${source} income`,
      amount: randInt(min, max),
    };
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function populate() {
  const uri = process.env.MONGODB_URI;

  if (db.isUnusableUri(uri)) {
    console.error(
      '\n❌  MONGODB_URI is not set. Copy .env.example to .env and set it first.\n'
    );
    process.exit(1);
  }

  await db.connect(uri, { required: true });
  console.log(`Connected to "${db.mongoose.connection.name}"`);

  console.log('Clearing existing data...');
  await Promise.all([
    Cattle.deleteMany({}),
    MilkProduction.deleteMany({}),
    Feeding.deleteMany({}),
    Expense.deleteMany({}),
    Revenue.deleteMany({}),
  ]);

  // Ensure indexes exist before bulk inserts so constraints are enforced.
  await db.syncIndexes([Cattle, MilkProduction, Feeding, Expense, Revenue, Settings]);

  console.log('Seeding...');
  const herd = await Cattle.insertMany(buildCattle());
  const milk = await MilkProduction.insertMany(buildMilk(herd));
  const feeding = await Feeding.insertMany(buildFeeding(herd));
  const expenses = await Expense.insertMany(buildExpenses());
  const revenue = await Revenue.insertMany(buildRevenue());
  const settings = await Settings.getSingleton();

  const totalLiters = milk.reduce((sum, r) => sum + r.quantity_liters, 0);

  console.log('\n✅  Seed complete');
  console.log(`   cattle:   ${herd.length}`);
  console.log(`   milk:     ${milk.length} records over ${MILK_DAYS} days`);
  console.log(`   feeding:  ${feeding.length}`);
  console.log(`   expenses: ${expenses.length}`);
  console.log(`   revenue:  ${revenue.length}`);
  console.log(
    `   total milk: ${Math.round(totalLiters)} L ` +
      `(~${Math.round(totalLiters * settings.milk_price_per_liter).toLocaleString()} ` +
      `${settings.currency})`
  );
  console.log(
    `\n   Note: ${milk.length} milk records exceeds the ${50}-record page size, ` +
      'so the dashboard aggregation is genuinely exercised.\n'
  );

  await db.disconnect();
}

// Only auto-run when invoked directly, so tests can import the builders.
if (require.main === module) {
  populate().catch(async (error) => {
    console.error('Seed failed:', error.message);
    await db.disconnect();
    process.exit(1);
  });
}

module.exports = {
  populate,
  buildCattle,
  buildMilk,
  buildFeeding,
  buildExpenses,
  buildRevenue,
};
