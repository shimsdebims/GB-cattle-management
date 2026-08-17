const request = require('supertest');
const mongoose = require('mongoose');

const { app, cattlePayload, milkPayload } = require('./helpers');
const Cattle = require('../models/Cattle');
const MilkProduction = require('../models/MilkProduction');

let cattleId;
let secondCattleId;

beforeEach(async () => {
  const [first, second] = await Cattle.create([
    cattlePayload({ tag_number: 'GB0001', name: 'Bessie' }),
    cattlePayload({ tag_number: 'GB0002', name: 'Daisy' }),
  ]);
  cattleId = first._id.toString();
  secondCattleId = second._id.toString();
});

describe('POST /api/milk', () => {
  test('creates a record and populates the animal', async () => {
    const res = await request(app).post('/api/milk').send(milkPayload(cattleId));

    expect(res.status).toBe(201);
    expect(res.body.data.quantity_liters).toBe(15.5);
    expect(res.body.data.cattle_id.tag_number).toBe('GB0001');
  });

  test('rejects a second record for the same cow on the same day', async () => {
    await request(app).post('/api/milk').send(milkPayload(cattleId));

    const res = await request(app)
      .post('/api/milk')
      .send(milkPayload(cattleId, { quantity_liters: 20 }));

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
    expect(res.body.message).toMatch(/already exists for this animal/i);
  });

  test('allows the same day for a different cow', async () => {
    await request(app).post('/api/milk').send(milkPayload(cattleId));
    const res = await request(app).post('/api/milk').send(milkPayload(secondCattleId));
    expect(res.status).toBe(201);
  });

  test('normalizes the stored date to UTC midnight', async () => {
    await request(app).post('/api/milk').send(milkPayload(cattleId));

    const record = await MilkProduction.findOne({ cattle_id: cattleId });
    expect(record.date_recorded.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  test('treats a timestamp on the same day as a duplicate', async () => {
    await request(app).post('/api/milk').send(milkPayload(cattleId));

    const res = await request(app)
      .post('/api/milk')
      .send(milkPayload(cattleId, { date_recorded: '2026-07-01T14:30:00.000Z' }));

    expect(res.status).toBe(409);
  });

  test('404s when the animal does not exist', async () => {
    const res = await request(app)
      .post('/api/milk')
      .send(milkPayload(new mongoose.Types.ObjectId().toString()));
    expect(res.status).toBe(404);
  });

  test('validates quantity and quality bounds', async () => {
    const tooMuch = await request(app)
      .post('/api/milk')
      .send(milkPayload(cattleId, { quantity_liters: 500 }));
    expect(tooMuch.status).toBe(400);

    const badQuality = await request(app)
      .post('/api/milk')
      .send(milkPayload(cattleId, { quality_score: 99 }));
    expect(badQuality.status).toBe(400);
  });

  test('rejects a future date', async () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);

    const res = await request(app)
      .post('/api/milk')
      .send(milkPayload(cattleId, { date_recorded: future.toISOString().slice(0, 10) }));

    expect(res.status).toBe(400);
  });

  test('rejects a malformed cattle_id', async () => {
    const res = await request(app).post('/api/milk').send(milkPayload('nope'));
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'cattle_id')).toBe(true);
  });
});

describe('GET /api/milk', () => {
  beforeEach(async () => {
    await MilkProduction.create([
      { cattle_id: cattleId, date_recorded: '2026-07-01', quantity_liters: 10 },
      { cattle_id: cattleId, date_recorded: '2026-07-02', quantity_liters: 12 },
      { cattle_id: secondCattleId, date_recorded: '2026-07-01', quantity_liters: 8 },
    ]);
  });

  test('lists newest first with pagination', async () => {
    const res = await request(app).get('/api/milk');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.pagination.total).toBe(3);
  });

  test('filters by cattle_id', async () => {
    const res = await request(app).get('/api/milk').query({ cattle_id: cattleId });
    expect(res.body.data).toHaveLength(2);
  });

  test('filters by date range', async () => {
    const res = await request(app)
      .get('/api/milk')
      .query({ date_from: '2026-07-02', date_to: '2026-07-02' });

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].quantity_liters).toBe(12);
  });
});

describe('GET /api/milk/monthly-grid', () => {
  test('builds a cow × day grid with correct totals', async () => {
    await MilkProduction.create([
      { cattle_id: cattleId, date_recorded: '2026-07-01', quantity_liters: 10 },
      { cattle_id: cattleId, date_recorded: '2026-07-02', quantity_liters: 12 },
      { cattle_id: secondCattleId, date_recorded: '2026-07-01', quantity_liters: 8 },
    ]);

    const res = await request(app).get('/api/milk/monthly-grid').query({ month: '2026-07' });

    expect(res.status).toBe(200);
    expect(res.body.data.days_in_month).toBe(31);
    expect(res.body.data.cows).toHaveLength(2);

    // Sorted by total descending, so Bessie (22 L) leads.
    const [bessie, daisy] = res.body.data.cows;
    expect(bessie.name).toBe('Bessie');
    expect(bessie.total).toBe(22);
    expect(bessie.daily[0]).toBe(10); // day 1
    expect(bessie.daily[1]).toBe(12); // day 2
    expect(bessie.daily[2]).toBe(0); // day 3, no record
    expect(bessie.average).toBe(11); // 22 L over 2 recorded days

    expect(daisy.total).toBe(8);

    expect(res.body.data.daily_totals[0]).toBe(18);
    expect(res.body.data.grand_total).toBe(30);
  });

  test('excludes records from adjacent months', async () => {
    await MilkProduction.create([
      { cattle_id: cattleId, date_recorded: '2026-06-30', quantity_liters: 99 },
      { cattle_id: cattleId, date_recorded: '2026-07-01', quantity_liters: 10 },
      { cattle_id: cattleId, date_recorded: '2026-08-01', quantity_liters: 77 },
    ]);

    const res = await request(app).get('/api/milk/monthly-grid').query({ month: '2026-07' });

    expect(res.body.data.grand_total).toBe(10);
  });

  test('handles February and leap years', async () => {
    const feb2026 = await request(app)
      .get('/api/milk/monthly-grid')
      .query({ month: '2026-02' });
    expect(feb2026.body.data.days_in_month).toBe(28);

    const feb2024 = await request(app)
      .get('/api/milk/monthly-grid')
      .query({ month: '2024-02' });
    expect(feb2024.body.data.days_in_month).toBe(29);
  });

  test('returns an empty grid for a month with no records', async () => {
    const res = await request(app).get('/api/milk/monthly-grid').query({ month: '2026-01' });
    expect(res.status).toBe(200);
    expect(res.body.data.cows).toHaveLength(0);
    expect(res.body.data.grand_total).toBe(0);
  });

  test('rejects a malformed or missing month', async () => {
    expect((await request(app).get('/api/milk/monthly-grid')).status).toBe(400);
    expect(
      (await request(app).get('/api/milk/monthly-grid').query({ month: '07-2026' })).status
    ).toBe(400);
  });

  test('is not shadowed by the /:id route', async () => {
    const res = await request(app).get('/api/milk/monthly-grid').query({ month: '2026-07' });
    expect(res.status).toBe(200);
    expect(res.body.data.month).toBe('2026-07');
  });
});

describe('GET /api/milk/summary/stats', () => {
  test('summarizes the rolling window', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await MilkProduction.create([
      { cattle_id: cattleId, date_recorded: today, quantity_liters: 10, quality_score: 8 },
      {
        cattle_id: secondCattleId,
        date_recorded: today,
        quantity_liters: 20,
        quality_score: 6,
      },
    ]);

    const res = await request(app).get('/api/milk/summary/stats').query({ days: 30 });

    expect(res.status).toBe(200);
    expect(res.body.data.summary.total_quantity).toBe(30);
    expect(res.body.data.summary.record_count).toBe(2);
    expect(res.body.data.summary.average_quality).toBe(7);
    expect(res.body.data.daily_production).toHaveLength(1);
  });
});

describe('PUT and DELETE /api/milk/:id', () => {
  let recordId;

  beforeEach(async () => {
    const record = await MilkProduction.create(milkPayload(cattleId));
    recordId = record._id.toString();
  });

  test('updates quantity', async () => {
    const res = await request(app)
      .put(`/api/milk/${recordId}`)
      .send({ quantity_liters: 18 });

    expect(res.status).toBe(200);
    expect(res.body.data.quantity_liters).toBe(18);
  });

  test('rejects an out-of-range update', async () => {
    const res = await request(app)
      .put(`/api/milk/${recordId}`)
      .send({ quantity_liters: -5 });
    expect(res.status).toBe(400);
  });

  test('deletes the record', async () => {
    const res = await request(app).delete(`/api/milk/${recordId}`);
    expect(res.status).toBe(200);
    expect(await MilkProduction.countDocuments()).toBe(0);
  });

  test('404s deleting a already-removed record', async () => {
    await request(app).delete(`/api/milk/${recordId}`);
    const res = await request(app).delete(`/api/milk/${recordId}`);
    expect(res.status).toBe(404);
  });
});
