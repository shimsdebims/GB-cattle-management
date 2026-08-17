/**
 * Guards the seeder against silently drifting away from the schemas.
 * The previous seeder threw on every run because its expense categories were
 * not in the model enum.
 */
const {
  buildCattle,
  buildMilk,
  buildFeeding,
  buildExpenses,
  buildRevenue,
} = require('../scripts/populate-mock-data');

const Cattle = require('../models/Cattle');
const MilkProduction = require('../models/MilkProduction');
const Feeding = require('../models/Feeding');
const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');

test('seeded cattle are valid and insertable', async () => {
  const herd = await Cattle.insertMany(buildCattle());
  expect(herd.length).toBeGreaterThan(0);
  expect(await Cattle.countDocuments()).toBe(herd.length);
});

test('seeded expenses use only valid categories and BIF-scale amounts', async () => {
  const expenses = await Expense.insertMany(buildExpenses());

  expect(expenses.length).toBeGreaterThan(0);
  for (const expense of expenses) {
    expect(expense.amount).toBeGreaterThan(1000);
    if (expense.quantity != null && expense.cost_per_unit != null) {
      expect(expense.amount).toBe(expense.quantity * expense.cost_per_unit);
    }
  }
});

test('seeded revenue never uses milk as a manual source', async () => {
  const revenue = await Revenue.insertMany(buildRevenue());
  for (const row of revenue) {
    expect(row.source).not.toMatch(/milk/i);
  }
});

test('seeded milk respects one record per cow per day', async () => {
  const herd = await Cattle.insertMany(buildCattle());
  const records = buildMilk(herd);

  // Would throw a duplicate-key error if the seeder generated same-day dupes.
  const inserted = await MilkProduction.insertMany(records);
  expect(inserted.length).toBe(records.length);

  const keys = new Set(
    records.map((r) => `${r.cattle_id}-${r.date_recorded.toISOString()}`)
  );
  expect(keys.size).toBe(records.length);
});

test('seeded milk exceeds one page, exercising the aggregations', async () => {
  const herd = await Cattle.insertMany(buildCattle());
  const records = buildMilk(herd);
  expect(records.length).toBeGreaterThan(50);
});

test('seeded feeding is valid and total_cost is consistent', async () => {
  const herd = await Cattle.insertMany(buildCattle());
  const records = await Feeding.insertMany(buildFeeding(herd));

  expect(records.length).toBeGreaterThan(0);
  for (const record of records) {
    expect(record.total_cost).toBeCloseTo(record.quantity_kg * record.cost_per_unit, 5);
  }
});
