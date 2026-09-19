/**
 * End-to-end smoke test.
 *
 * Boots the real Express app against a throwaway in-memory MongoDB, seeds a
 * dataset larger than one page, and exercises the endpoints the app calls.
 * Proves the stack works without needing Atlas configured.
 *
 * Usage: node scripts/smoke-test.js
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const { createApp } = require('../app');
const Cattle = require('../models/Cattle');
const MilkProduction = require('../models/MilkProduction');
const Feeding = require('../models/Feeding');
const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');
const Settings = require('../models/Settings');
const {
  buildCattle,
  buildMilk,
  buildFeeding,
  buildExpenses,
  buildRevenue,
} = require('./populate-mock-data');

const PORT = 8099;
const BASE = `http://127.0.0.1:${PORT}/api`;

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function get(path) {
  const response = await fetch(`${BASE}${path}`);
  return { status: response.status, body: await response.json() };
}

async function post(path, payload) {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: response.status, body: await response.json() };
}

async function main() {
  const memory = await MongoMemoryServer.create();
  await mongoose.connect(memory.getUri());
  await Promise.all(
    [Cattle, MilkProduction, Feeding, Expense, Revenue, Settings].map((m) =>
      m.createIndexes()
    )
  );

  const server = createApp({ enableLogging: false }).listen(PORT);
  console.log(`\nSmoke test on ${BASE}\n`);

  try {
    // ── Seed ────────────────────────────────────────────────────────────────
    const herd = await Cattle.insertMany(buildCattle());
    const milk = await MilkProduction.insertMany(buildMilk(herd));
    await Feeding.insertMany(buildFeeding(herd));
    await Expense.insertMany(buildExpenses());
    await Revenue.insertMany(buildRevenue());

    console.log(`Seeded ${herd.length} cattle, ${milk.length} milk records\n`);

    console.log('Health & settings');
    const health = await get('/health');
    check('health is healthy', health.body.status === 'healthy');
    check('database connected', health.body.database === 'connected');

    const settings = await get('/settings');
    check('settings default price is 1700', settings.body.data.milk_price_per_liter === 1700);

    console.log('\nPagination');
    const page1 = await get('/cattle?limit=5&page=1');
    check('returns 5 rows', page1.body.data.length === 5);
    check('reports full total', page1.body.pagination.total === herd.length);
    check('has_next is true', page1.body.pagination.has_next === true);

    const capped = await get('/cattle?limit=99999');
    check('limit is clamped', capped.body.pagination.limit <= 200);

    console.log('\nDashboard aggregation (the old 50-record ceiling)');
    const expectedLiters =
      Math.round(milk.reduce((sum, r) => sum + r.quantity_liters, 0) * 10) / 10;

    const dashboard = await get('/analytics/dashboard?days=90');
    const reported = dashboard.body.data.milk_production;

    check(
      `counts all ${milk.length} milk records, not just a page`,
      reported.production_records === milk.length,
      `got ${reported.production_records}`
    );
    check(
      `total litres match the seeded data (${expectedLiters} L)`,
      Math.abs(reported.total_liters - expectedLiters) < 1,
      `got ${reported.total_liters}`
    );
    check(
      'milk revenue = litres × price',
      Math.abs(
        dashboard.body.data.financial.milk_revenue - expectedLiters * 1700
      ) < 2000
    );
    check('herd count correct', dashboard.body.data.cattle.total_cattle === herd.length);

    console.log('\nMonthly grid');
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const grid = await get(`/milk/monthly-grid?month=${month}`);

    check('grid returns cows', grid.body.data.cows.length > 0);
    check(
      'cow names resolve (not "Unknown")',
      grid.body.data.cows.every((cow) => cow.name !== 'Unknown'),
      'the $lookup collection name regression'
    );
    check(
      'daily array length matches days in month',
      grid.body.data.cows[0].daily.length === grid.body.data.days_in_month
    );
    check(
      'grand total equals the sum of daily totals',
      Math.abs(
        grid.body.data.grand_total -
          grid.body.data.daily_totals.reduce((a, b) => a + b, 0)
      ) < 0.5
    );

    console.log('\nMonthly income');
    const income = await get(`/analytics/monthly-income?month=${month}`);
    check('income returns cows', income.body.data.cows.length > 0);
    check(
      'cow names resolve here too',
      income.body.data.cows.every((cow) => cow.name !== 'Unknown')
    );
    check(
      'income = litres × price',
      Math.abs(
        income.body.data.total_income - income.body.data.total_liters * 1700
      ) < 2
    );

    console.log('\nValidation');
    const badCattle = await post('/cattle', { name: 'Nameless' });
    check('missing fields rejected with 400', badCattle.status === 400);
    check('field errors returned', Array.isArray(badCattle.body.errors));

    const dupTag = await post('/cattle', {
      tag_number: herd[0].tag_number,
      name: 'Copy',
      breed: 'Holstein',
      gender: 'Female',
      date_of_birth: '2021-01-01',
    });
    check('duplicate tag rejected with 409', dupTag.status === 409);

    const badCategory = await post('/financial/expenses', {
      date_recorded: '2026-01-05',
      category: 'Veterinary',
      description: 'Old category',
      amount: 1000,
    });
    check('legacy expense category rejected', badCategory.status === 400);

    const milkSource = await post('/financial/revenue', {
      date_recorded: '2026-01-05',
      source: 'Milk Sales',
      description: 'Should not be allowed',
      amount: 1000,
    });
    check('milk rejected as manual revenue', milkSource.status === 400);

    console.log('\nDuplicate milk protection');
    const cow = herd.find((c) => c.gender === 'Female' && c.current_status === 'Active');
    const day = '2025-01-15';
    const first = await post('/milk', {
      cattle_id: cow._id.toString(),
      date_recorded: day,
      quantity_liters: 12,
    });
    check('first record accepted', first.status === 201);

    const second = await post('/milk', {
      cattle_id: cow._id.toString(),
      date_recorded: day,
      quantity_liters: 14,
    });
    check('same cow + same day rejected with 409', second.status === 409);

    console.log('\nExpense amount derivation');
    const derived = await post('/financial/expenses', {
      date_recorded: '2025-01-10',
      category: 'Concentrates',
      description: '50 kg concentrates',
      quantity: 50,
      cost_per_unit: 3400,
    });
    check('amount derived as 170000', derived.body.data.amount === 170000);

    console.log('\nNot found handling');
    const missing = await get('/cattle/507f1f77bcf86cd799439011');
    check('unknown id returns 404', missing.status === 404);

    const malformed = await get('/cattle/not-an-id');
    check('malformed id returns 400', malformed.status === 400);
  } finally {
    server.close();
    await mongoose.disconnect();
    await memory.stop();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Smoke test crashed:', error);
  process.exit(1);
});
