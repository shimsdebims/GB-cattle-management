const request = require('supertest');

const { app, cattlePayload, milkPayload } = require('./helpers');
const Cattle = require('../models/Cattle');
const MilkProduction = require('../models/MilkProduction');
const Feeding = require('../models/Feeding');
const Revenue = require('../models/Revenue');

const income = async (month) =>
  (await request(app).get('/api/analytics/monthly-income').query({ month })).body.data
    .total_income;

describe('selling and archiving a cow (B2)', () => {
  let cow;

  beforeEach(async () => {
    cow = await Cattle.create(cattlePayload());
    await request(app).post('/api/milk').send(milkPayload(String(cow._id), { quantity_liters: 20 }));
  });

  const sell = (overrides = {}) =>
    request(app)
      .post(`/api/cattle/${cow._id}/sell`)
      .send({ sale_date: '2026-07-20', sale_price: 900000, buyer: 'Jean', ...overrides });

  test('marks the cow sold, books the sale and keeps its milk history', async () => {
    const before = await income('2026-07');

    const res = await sell();
    expect(res.status).toBe(200);
    expect(res.body.data.cattle.current_status).toBe('Sold');
    expect(res.body.data.cattle.sale_price).toBe(900000);
    expect(res.body.data.revenue.source).toBe('Cattle Sale');
    expect(String(res.body.data.revenue.cattle_id)).toBe(String(cow._id));

    expect(await MilkProduction.countDocuments({ cattle_id: cow._id })).toBe(1);
    expect(await income('2026-07')).toBe(before);
  });

  test('refuses to sell twice', async () => {
    await sell();
    const res = await sell();
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_SOLD');
    expect(await Revenue.countDocuments()).toBe(1);
  });

  test('requires a sale date and price', async () => {
    const res = await request(app).post(`/api/cattle/${cow._id}/sell`).send({});
    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['sale_date', 'sale_price']));
  });

  test('undoing a sale restores the cow and removes the sale income', async () => {
    await sell();
    const res = await request(app).delete(`/api/cattle/${cow._id}/sale`);
    expect(res.status).toBe(200);
    expect(res.body.data.cattle.current_status).toBe('Active');
    expect(res.body.data.cattle.sale_price).toBeUndefined();
    expect(await Revenue.countDocuments()).toBe(0);
  });

  test('the archive filter separates the working herd from sold cows', async () => {
    await Cattle.create(cattlePayload({ tag_number: 'GB0002', name: 'Daisy' }));
    await sell();

    const working = await request(app).get('/api/cattle').query({ archived: 'exclude' });
    const archive = await request(app).get('/api/cattle').query({ archived: 'only' });
    const all = await request(app).get('/api/cattle');

    expect(working.body.data.map((c) => c.name)).toEqual(['Daisy']);
    expect(archive.body.data.map((c) => c.name)).toEqual(['Bessie']);
    expect(all.body.data).toHaveLength(2);

    const bad = await request(app).get('/api/cattle').query({ archived: 'maybe' });
    expect(bad.status).toBe(400);
  });

  test('the cow card shows lifetime milk, feed, sale and net', async () => {
    await Feeding.create({
      cattle_id: cow._id,
      date_recorded: '2026-07-02',
      feed_type: 'Hay',
      quantity_kg: 10,
      cost_per_unit: 500,
    });
    await sell();

    const res = await request(app).get(`/api/cattle/${cow._id}/summary`);
    expect(res.status).toBe(200);
    const life = res.body.data.lifetime;
    expect(life.total_liters).toBe(20);
    expect(life.milk_income).toBe(34000);
    expect(life.feed_cost).toBe(5000);
    expect(life.sale_income).toBe(900000);
    expect(life.net).toBe(34000 + 900000 - 5000);
    expect(res.body.data.sale_revenue).toHaveLength(1);
  });
});

describe('DELETE /api/cattle/:id is only for mistakes', () => {
  test('refuses a cow with history, and deletes nothing', async () => {
    const cow = await Cattle.create(cattlePayload());
    await MilkProduction.create(milkPayload(cow._id));

    const res = await request(app).delete(`/api/cattle/${cow._id}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CATTLE_HAS_HISTORY');
    expect(await Cattle.countDocuments()).toBe(1);
    expect(await MilkProduction.countDocuments()).toBe(1);
  });

  test('deletes a cow entered by mistake with no history', async () => {
    const cow = await Cattle.create(cattlePayload());
    const res = await request(app).delete(`/api/cattle/${cow._id}`);
    expect(res.status).toBe(200);
    expect(await Cattle.countDocuments()).toBe(0);
  });
});

describe('clearing a field on edit (H3)', () => {
  test('null clears an optional field', async () => {
    const cow = await Cattle.create(cattlePayload({ weight: 420, location: 'Barn A' }));

    const res = await request(app)
      .put(`/api/cattle/${cow._id}`)
      .send({ weight: null, location: null });
    expect(res.status).toBe(200);

    const stored = await Cattle.findById(cow._id).lean();
    expect(stored.weight ?? null).toBeNull();
    expect(stored.location ?? null).toBeNull();
  });
});
