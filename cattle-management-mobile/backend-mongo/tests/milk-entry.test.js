const request = require('supertest');

const { app, cattlePayload, milkPayload, expensePayload, feedingPayload } = require('./helpers');
const Cattle = require('../models/Cattle');
const MilkProduction = require('../models/MilkProduction');
const Expense = require('../models/Expense');
const Feeding = require('../models/Feeding');

let cattleId;

beforeEach(async () => {
  const cow = await Cattle.create(cattlePayload());
  cattleId = cow._id.toString();
});

const split = (overrides = {}) => {
  const payload = milkPayload(cattleId, overrides);
  delete payload.quantity_liters;
  return payload;
};

describe('morning and evening milk', () => {
  test('morning 8 + evening 6 stores a day total of 14', async () => {
    const res = await request(app)
      .post('/api/milk')
      .send(split({ morning_liters: 8, evening_liters: 6 }));

    expect(res.status).toBe(201);
    expect(res.body.data.quantity_liters).toBe(14);
    expect(res.body.data.morning_liters).toBe(8);
    expect(res.body.data.evening_liters).toBe(6);
  });

  test('one milking only is allowed', async () => {
    const res = await request(app).post('/api/milk').send(split({ morning_liters: 9.5 }));
    expect(res.status).toBe(201);
    expect(res.body.data.quantity_liters).toBe(9.5);
  });

  test('decimals add up without floating-point noise', async () => {
    const res = await request(app)
      .post('/api/milk')
      .send(split({ morning_liters: 8.1, evening_liters: 6.2 }));
    expect(res.body.data.quantity_liters).toBe(14.3);
  });

  test('the split wins over a contradicting total', async () => {
    const res = await request(app)
      .post('/api/milk')
      .send(milkPayload(cattleId, { morning_liters: 8, evening_liters: 6, quantity_liters: 99 }));
    expect(res.body.data.quantity_liters).toBe(14);
  });

  test('a day total alone still works', async () => {
    const res = await request(app).post('/api/milk').send(milkPayload(cattleId));
    expect(res.status).toBe(201);
    expect(res.body.data.quantity_liters).toBe(15.5);
  });

  test('a 0 L day is accepted', async () => {
    const res = await request(app)
      .post('/api/milk')
      .send(milkPayload(cattleId, { quantity_liters: 0 }));
    expect(res.status).toBe(201);
    expect(res.body.data.quantity_liters).toBe(0);
  });

  test('needs a total or at least one milking', async () => {
    const res = await request(app).post('/api/milk').send(split());
    expect(res.status).toBe(400);
  });

  test('rejects a split that sums above the daily limit', async () => {
    const res = await request(app)
      .post('/api/milk')
      .send(split({ morning_liters: 60, evening_liters: 60 }));
    expect(res.status).toBe(400);
  });

  test('editing the evening recomputes the total with the stored morning', async () => {
    const created = await request(app)
      .post('/api/milk')
      .send(split({ morning_liters: 8, evening_liters: 6 }));

    const res = await request(app)
      .put(`/api/milk/${created.body.data._id}`)
      .send({ evening_liters: 7 });

    expect(res.status).toBe(200);
    expect(res.body.data.quantity_liters).toBe(15);
  });

  test('clearing the morning leaves the evening as the total', async () => {
    const created = await request(app)
      .post('/api/milk')
      .send(split({ morning_liters: 8, evening_liters: 6 }));

    const res = await request(app)
      .put(`/api/milk/${created.body.data._id}`)
      .send({ morning_liters: null });

    expect(res.body.data.quantity_liters).toBe(6);
    expect(res.body.data.morning_liters).toBeNull();
  });

  test('replacing a split with a plain total', async () => {
    const created = await request(app)
      .post('/api/milk')
      .send(split({ morning_liters: 8, evening_liters: 6 }));

    const res = await request(app)
      .put(`/api/milk/${created.body.data._id}`)
      .send({ morning_liters: null, evening_liters: null, quantity_liters: 12 });

    expect(res.body.data.quantity_liters).toBe(12);
  });
});

describe('same-day clash', () => {
  test('a second record for the day returns 409 with the existing record', async () => {
    const first = await request(app)
      .post('/api/milk')
      .send(milkPayload(cattleId, { quantity_liters: 10 }));

    const res = await request(app)
      .post('/api/milk')
      .send(milkPayload(cattleId, { quantity_liters: 14 }));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('MILK_DAY_EXISTS');
    expect(res.body.data._id).toBe(first.body.data._id);
    expect(res.body.data.quantity_liters).toBe(10);
    expect(res.body.data.cattle_id.tag_number).toBe('GB0001');
  });

  test('an edit based on an old version returns 409 with the current record', async () => {
    const created = await request(app).post('/api/milk').send(milkPayload(cattleId));
    const loaded = created.body.data;

    // Another phone edits it first.
    await request(app).put(`/api/milk/${loaded._id}`).send({ quantity_liters: 11 });

    const res = await request(app)
      .put(`/api/milk/${loaded._id}`)
      .send({ quantity_liters: 20, expected_updated_at: loaded.updated_at });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('MILK_CHANGED');
    expect(res.body.data.quantity_liters).toBe(11);
    expect((await MilkProduction.findById(loaded._id)).quantity_liters).toBe(11);
  });

  test('an edit based on the current version saves', async () => {
    const created = await request(app).post('/api/milk').send(milkPayload(cattleId));

    const res = await request(app)
      .put(`/api/milk/${created.body.data._id}`)
      .send({ quantity_liters: 20, expected_updated_at: created.body.data.updated_at });

    expect(res.status).toBe(200);
    expect(res.body.data.quantity_liters).toBe(20);
  });
});

describe('retried saves are never doubled', () => {
  test('the same milk save sent twice creates one record', async () => {
    const payload = milkPayload(cattleId, { client_id: 'phone-1-abc' });

    const first = await request(app).post('/api/milk').send(payload);
    const retry = await request(app).post('/api/milk').send(payload);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.data._id).toBe(first.body.data._id);
    expect(await MilkProduction.countDocuments()).toBe(1);
  });

  test('two retries arriving together still create one record', async () => {
    const payload = expensePayload({ client_id: 'phone-1-race' });

    const results = await Promise.all([
      request(app).post('/api/financial/expenses').send(payload),
      request(app).post('/api/financial/expenses').send(payload),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(await Expense.countDocuments()).toBe(1);
  });

  test('expenses, feeding and cattle replay too', async () => {
    const expense = expensePayload({ client_id: 'e-1' });
    await request(app).post('/api/financial/expenses').send(expense);
    await request(app).post('/api/financial/expenses').send(expense);
    expect(await Expense.countDocuments()).toBe(1);

    const feeding = feedingPayload(cattleId, { client_id: 'f-1' });
    await request(app).post('/api/feeding').send(feeding);
    await request(app).post('/api/feeding').send(feeding);
    expect(await Feeding.countDocuments()).toBe(1);

    const cow = cattlePayload({ tag_number: 'GB0009', client_id: 'c-1' });
    const first = await request(app).post('/api/cattle').send(cow);
    const retry = await request(app).post('/api/cattle').send(cow);
    expect(retry.status).toBe(200);
    expect(retry.body.data._id).toBe(first.body.data._id);
  });

  test('records without a client id never collide with each other', async () => {
    await request(app).post('/api/financial/expenses').send(expensePayload());
    await request(app).post('/api/financial/expenses').send(expensePayload({ client_id: null }));
    await request(app).post('/api/financial/expenses').send(expensePayload({ client_id: '' }));
    expect(await Expense.countDocuments()).toBe(3);
  });

  test('an edit cannot change a record\'s client id', async () => {
    const created = await request(app)
      .post('/api/financial/expenses')
      .send(expensePayload({ client_id: 'e-keep' }));

    await request(app)
      .put(`/api/financial/expenses/${created.body.data._id}`)
      .send({ client_id: 'e-other', description: 'Edited' });

    const stored = await Expense.findById(created.body.data._id);
    expect(stored.client_id).toBe('e-keep');
    expect(stored.description).toBe('Edited');
  });
});

describe('monthly grid tells "no record" from "0 L"', () => {
  test('a 0 L day is 0, a day with no record is null', async () => {
    await MilkProduction.create([
      { cattle_id: cattleId, date_recorded: '2026-07-01', quantity_liters: 0 },
      { cattle_id: cattleId, date_recorded: '2026-07-02', quantity_liters: 12 },
    ]);

    const res = await request(app).get('/api/milk/monthly-grid').query({ month: '2026-07' });
    const [cow] = res.body.data.cows;

    expect(cow.daily[0]).toBe(0);
    expect(cow.daily[1]).toBe(12);
    expect(cow.daily[2]).toBeNull();
    expect(res.body.data.daily_totals[0]).toBe(0);
    expect(res.body.data.daily_totals[2]).toBeNull();
  });
});
