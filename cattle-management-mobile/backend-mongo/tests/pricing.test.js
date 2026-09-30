const request = require('supertest');

const { app, cattlePayload } = require('./helpers');
const Cattle = require('../models/Cattle');
const MilkProduction = require('../models/MilkProduction');
const MilkPrice = require('../models/MilkPrice');
const { resolvePrice } = require('../utils/pricing');

describe('resolvePrice (unit)', () => {
  const prices = [
    { effective_from: '1970-01-01', price_per_liter: 1700 },
    { effective_from: '2026-10-15', price_per_liter: 1800 },
    { effective_from: '2026-11-01', price_per_liter: 1750 },
  ];

  test('picks the latest entry on or before the date', () => {
    expect(resolvePrice(prices, '2026-10-14', 0)).toBe(1700);
    expect(resolvePrice(prices, '2026-10-15', 0)).toBe(1800);
    expect(resolvePrice(prices, '2026-10-31T23:00:00Z', 0)).toBe(1800);
    expect(resolvePrice(prices, '2026-11-20', 0)).toBe(1750);
  });

  test('falls back when nothing covers the date', () => {
    expect(resolvePrice([], '2026-10-01', 1234)).toBe(1234);
  });
});

describe('milk price history', () => {
  let cowId;

  const milk = (date, litres) =>
    request(app)
      .post('/api/milk')
      .send({ cattle_id: cowId, date_recorded: date, quantity_liters: litres });

  const income = async (month) =>
    (await request(app).get('/api/analytics/monthly-income').query({ month })).body.data;

  const setPrice = (price, from) =>
    request(app)
      .put('/api/settings')
      .send({ milk_price_per_liter: price, ...(from && { effective_from: from }) });

  beforeEach(async () => {
    cowId = String((await Cattle.create(cattlePayload()))._id);
  });

  test('stores the day price on each new record', async () => {
    const res = await milk('2026-09-10', 10);
    expect(res.body.data.price_per_liter).toBe(1700);
  });

  test('a price change leaves earlier months unchanged (H5)', async () => {
    await milk('2026-09-10', 10);
    expect((await income('2026-09')).total_income).toBe(17000);

    const res = await setPrice(2000, '2026-09-20');
    expect(res.status).toBe(200);

    expect((await income('2026-09')).total_income).toBe(17000);

    await milk('2026-09-25', 10);
    expect((await income('2026-09')).total_income).toBe(17000 + 20000);
  });

  test('a mid-month change values each day at its own price', async () => {
    await milk('2026-09-10', 10);
    await milk('2026-09-25', 10);

    await setPrice(2000, '2026-09-20');

    const data = await income('2026-09');
    expect(data.total_income).toBe(17000 + 20000);
    expect(data.cows[0].income).toBe(37000);
  });

  test('records saved before prices were stored keep the old price on first change', async () => {
    // Simulates data written by the previous version (no price stored).
    await MilkProduction.create({ cattle_id: cowId, date_recorded: '2026-08-05', quantity_liters: 10 });

    await setPrice(2500); // from today

    expect((await income('2026-08')).total_income).toBe(17000);
  });

  test('a price scheduled ahead does not change today’s price', async () => {
    const res = await setPrice(9999, '2099-01-01');
    expect(res.status).toBe(200);
    expect(res.body.data.milk_price_per_liter).toBe(1700);
  });

  test('moving a record to another day re-prices it', async () => {
    const created = await milk('2026-09-10', 10);
    await setPrice(2000, '2026-09-20');

    const moved = await request(app)
      .put(`/api/milk/${created.body.data._id}`)
      .send({ date_recorded: '2026-09-22' });
    expect(moved.body.data.price_per_liter).toBe(2000);
  });

  test('a client cannot set the price on a record', async () => {
    const created = await milk('2026-09-10', 10);
    const res = await request(app)
      .put(`/api/milk/${created.body.data._id}`)
      .send({ price_per_liter: 1 });
    expect(res.body.data.price_per_liter).toBe(1700);
  });

  test('deleting a mistaken change restores the previous price', async () => {
    await milk('2026-09-25', 10);
    await setPrice(2000, '2026-09-20');
    expect((await income('2026-09')).total_income).toBe(20000);

    const list = await request(app).get('/api/settings/milk-prices');
    const change = list.body.data.find((p) => p.price_per_liter === 2000);
    const del = await request(app).delete(`/api/settings/milk-prices/${change._id}`);
    expect(del.status).toBe(200);

    expect((await income('2026-09')).total_income).toBe(17000);
  });

  test('refuses to delete the baseline', async () => {
    await setPrice(2000, '2026-09-20');
    const baseline = await MilkPrice.findOne().sort({ effective_from: 1 });
    const res = await request(app).delete(`/api/settings/milk-prices/${baseline._id}`);
    expect(res.status).toBe(400);
  });

  test('the dashboard uses stored prices too', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await setPrice(2000, today);
    await milk(today, 10);

    const res = await request(app).get('/api/analytics/dashboard');
    expect(res.body.data.financial.milk_revenue).toBe(20000);
  });
});
