const request = require('supertest');

const {
  app,
  cattlePayload,
  feedingPayload,
  expensePayload,
  revenuePayload,
} = require('./helpers');
const Cattle = require('../models/Cattle');
const MilkProduction = require('../models/MilkProduction');
const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');
const Feeding = require('../models/Feeding');
const Settings = require('../models/Settings');

describe('expenses', () => {
  test('creates an expense with an explicit amount', async () => {
    const res = await request(app).post('/api/financial/expenses').send(expensePayload());

    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(170000);
    expect(res.body.data.category).toBe('Concentrates');
  });

  test('derives amount from quantity × cost_per_unit', async () => {
    const res = await request(app)
      .post('/api/financial/expenses')
      .send(
        expensePayload({ quantity: 50, cost_per_unit: 3400, amount: undefined })
      );

    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(170000);
  });

  test('derived amount wins over a contradictory explicit amount', async () => {
    const res = await request(app)
      .post('/api/financial/expenses')
      .send(expensePayload({ quantity: 10, cost_per_unit: 100, amount: 999999 }));

    expect(res.body.data.amount).toBe(1000);
  });

  test('requires either amount or both line-item parts', async () => {
    const res = await request(app)
      .post('/api/financial/expenses')
      .send(expensePayload({ amount: undefined, quantity: 10 }));

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'amount')).toBe(true);
  });

  test('rejects a category outside the farm vocabulary', async () => {
    const res = await request(app)
      .post('/api/financial/expenses')
      .send(expensePayload({ category: 'Veterinary' }));

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'category')).toBe(true);
  });

  test('recomputes amount on a partial update', async () => {
    const created = await request(app)
      .post('/api/financial/expenses')
      .send(expensePayload({ quantity: 10, cost_per_unit: 100, amount: undefined }));

    const res = await request(app)
      .put(`/api/financial/expenses/${created.body.data._id}`)
      .send({ quantity: 20 });

    // 20 × stored cost_per_unit (100)
    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(2000);
  });

  test('filters by month via date range', async () => {
    await Expense.create([
      expensePayload({ date_recorded: '2026-07-05', amount: 100 }),
      expensePayload({ date_recorded: '2026-08-05', amount: 200 }),
    ]);

    const res = await request(app)
      .get('/api/financial/expenses')
      .query({ date_from: '2026-07-01', date_to: '2026-07-31' });

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].amount).toBe(100);
  });

  test('deletes an expense', async () => {
    const created = await request(app)
      .post('/api/financial/expenses')
      .send(expensePayload());

    const res = await request(app).delete(
      `/api/financial/expenses/${created.body.data._id}`
    );
    expect(res.status).toBe(200);
    expect(await Expense.countDocuments()).toBe(0);
  });
});

describe('revenue', () => {
  test('accepts "Cattle Sale", the value the app actually sends', async () => {
    const res = await request(app).post('/api/financial/revenue').send(revenuePayload());
    expect(res.status).toBe(201);
    expect(res.body.data.source).toBe('Cattle Sale');
  });

  test('rejects milk as a manual revenue source, since it is derived', async () => {
    const res = await request(app)
      .post('/api/financial/revenue')
      .send(revenuePayload({ source: 'Milk Sales' }));

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'source')).toBe(true);
  });

  test('requires a positive amount', async () => {
    const res = await request(app)
      .post('/api/financial/revenue')
      .send(revenuePayload({ amount: undefined }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/financial/summary', () => {
  test('nets recorded revenue against expenses for a date window', async () => {
    await Expense.create([
      expensePayload({ date_recorded: '2026-07-05', amount: 100000 }),
      expensePayload({ date_recorded: '2026-07-06', amount: 50000, category: 'Medical' }),
    ]);
    await Revenue.create(revenuePayload({ date_recorded: '2026-07-10', amount: 500000 }));

    const res = await request(app)
      .get('/api/financial/summary')
      .query({ date_from: '2026-07-01', date_to: '2026-07-31' });

    expect(res.status).toBe(200);
    expect(res.body.data.summary.total_expenses).toBe(150000);
    expect(res.body.data.summary.total_revenue).toBe(500000);
    expect(res.body.data.summary.net_profit).toBe(350000);
    expect(res.body.data.expense_by_category).toHaveLength(2);
  });
});

describe('GET /api/analytics/dashboard', () => {
  test('computes milk revenue from production × farm price', async () => {
    const cattle = await Cattle.create(cattlePayload());
    const today = new Date().toISOString().slice(0, 10);

    await MilkProduction.create({
      cattle_id: cattle._id,
      date_recorded: today,
      quantity_liters: 100,
    });
    await Expense.create(expensePayload({ date_recorded: today, amount: 70000 }));
    await Revenue.create(revenuePayload({ date_recorded: today, amount: 30000 }));

    const res = await request(app).get('/api/analytics/dashboard');

    expect(res.status).toBe(200);
    // 100 L × 1700 BIF default
    expect(res.body.data.financial.milk_revenue).toBe(170000);
    expect(res.body.data.financial.other_revenue).toBe(30000);
    expect(res.body.data.financial.total_revenue).toBe(200000);
    expect(res.body.data.financial.total_expenses).toBe(70000);
    expect(res.body.data.financial.net_profit).toBe(130000);
    expect(res.body.data.cattle.total_cattle).toBe(1);
    expect(res.body.data.milk_production.total_liters).toBe(100);
  });

  test('honours an updated milk price', async () => {
    const cattle = await Cattle.create(cattlePayload());
    const today = new Date().toISOString().slice(0, 10);

    await MilkProduction.create({
      cattle_id: cattle._id,
      date_recorded: today,
      quantity_liters: 10,
    });
    await Settings.create({ milk_price_per_liter: 2000, currency: 'BIF' });

    const res = await request(app).get('/api/analytics/dashboard');
    expect(res.body.data.financial.milk_revenue).toBe(20000);
    expect(res.body.data.financial.milk_price_per_liter).toBe(2000);
  });

  test('is not capped by pagination — counts well beyond 50 records', async () => {
    // The old client-side dashboard silently truncated at the 50-record page
    // size, under-reporting production. This proves the aggregation does not.
    const herd = await Cattle.create(
      Array.from({ length: 5 }, (_, i) =>
        cattlePayload({ tag_number: `GB10${i}`, name: `Cow ${i}` })
      )
    );

    const records = [];
    for (const cow of herd) {
      for (let day = 1; day <= 20; day += 1) {
        const date = new Date();
        date.setDate(date.getDate() - day);
        records.push({
          cattle_id: cow._id,
          date_recorded: date,
          quantity_liters: 10,
        });
      }
    }
    await MilkProduction.insertMany(records);

    expect(records).toHaveLength(100);

    const res = await request(app).get('/api/analytics/dashboard').query({ days: 30 });

    expect(res.body.data.milk_production.production_records).toBe(100);
    expect(res.body.data.milk_production.total_liters).toBe(1000);
    expect(res.body.data.financial.milk_revenue).toBe(1700000);
  });

  test('returns zeroes on an empty database', async () => {
    const res = await request(app).get('/api/analytics/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.data.cattle.total_cattle).toBe(0);
    expect(res.body.data.financial.net_profit).toBe(0);
  });
});

describe('GET /api/analytics/monthly-income', () => {
  test('reports per-cow income and totals', async () => {
    const [bessie, daisy] = await Cattle.create([
      cattlePayload({ tag_number: 'GB0001', name: 'Bessie' }),
      cattlePayload({ tag_number: 'GB0002', name: 'Daisy' }),
    ]);

    await MilkProduction.create([
      { cattle_id: bessie._id, date_recorded: '2026-07-01', quantity_liters: 20 },
      { cattle_id: bessie._id, date_recorded: '2026-07-02', quantity_liters: 10 },
      { cattle_id: daisy._id, date_recorded: '2026-07-01', quantity_liters: 10 },
    ]);

    const res = await request(app)
      .get('/api/analytics/monthly-income')
      .query({ month: '2026-07' });

    expect(res.status).toBe(200);
    expect(res.body.data.total_liters).toBe(40);
    expect(res.body.data.total_income).toBe(68000); // 40 × 1700
    expect(res.body.data.cows).toHaveLength(2);
    expect(res.body.data.cows[0].name).toBe('Bessie');
    expect(res.body.data.cows[0].income).toBe(51000); // 30 × 1700
    expect(res.body.data.average_per_head).toBe(34000);
  });

  test('rejects a malformed month', async () => {
    const res = await request(app)
      .get('/api/analytics/monthly-income')
      .query({ month: 'nope' });
    expect(res.status).toBe(400);
  });
});

describe('feeding', () => {
  let cattleId;

  beforeEach(async () => {
    const cattle = await Cattle.create(cattlePayload());
    cattleId = cattle._id.toString();
  });

  test('derives total_cost on create', async () => {
    const res = await request(app).post('/api/feeding').send(feedingPayload(cattleId));

    expect(res.status).toBe(201);
    expect(res.body.data.total_cost).toBe(5000); // 10 kg × 500
  });

  test('recomputes total_cost on update, which findByIdAndUpdate used to skip', async () => {
    const created = await request(app).post('/api/feeding').send(feedingPayload(cattleId));

    const res = await request(app)
      .put(`/api/feeding/${created.body.data._id}`)
      .send({ quantity_kg: 20 });

    expect(res.status).toBe(200);
    expect(res.body.data.quantity_kg).toBe(20);
    expect(res.body.data.total_cost).toBe(10000);
  });

  test('rejects an unknown feed type', async () => {
    const res = await request(app)
      .post('/api/feeding')
      .send(feedingPayload(cattleId, { feed_type: 'Pizza' }));
    expect(res.status).toBe(400);
  });

  test('summarizes cost by feed type', async () => {
    const today = new Date();
    await Feeding.create([
      {
        cattle_id: cattleId,
        date_recorded: today,
        feed_type: 'Hay',
        quantity_kg: 10,
        cost_per_unit: 500,
        total_cost: 5000,
      },
      {
        cattle_id: cattleId,
        date_recorded: today,
        feed_type: 'Barley',
        quantity_kg: 5,
        cost_per_unit: 1000,
        total_cost: 5000,
      },
    ]);

    const res = await request(app).get('/api/feeding/summary/stats');

    expect(res.status).toBe(200);
    expect(res.body.data.summary.total_cost).toBe(10000);
    expect(res.body.data.feed_type_breakdown).toHaveLength(2);
  });
});

describe('settings', () => {
  test('creates the singleton on first read', async () => {
    const res = await request(app).get('/api/settings');

    expect(res.status).toBe(200);
    expect(res.body.data.milk_price_per_liter).toBe(1700);
    expect(res.body.data.currency).toBe('BIF');
    expect(await Settings.countDocuments()).toBe(1);
  });

  test('does not create a second document on repeated reads', async () => {
    await request(app).get('/api/settings');
    await request(app).get('/api/settings');
    expect(await Settings.countDocuments()).toBe(1);
  });

  test('updates the milk price', async () => {
    const res = await request(app).put('/api/settings').send({ milk_price_per_liter: 1850 });

    expect(res.status).toBe(200);
    expect(res.body.data.milk_price_per_liter).toBe(1850);
  });

  test('rejects a negative price', async () => {
    const res = await request(app).put('/api/settings').send({ milk_price_per_liter: -5 });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/health', () => {
  test('reports status and database state', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.database).toBe('connected');
  });
});
