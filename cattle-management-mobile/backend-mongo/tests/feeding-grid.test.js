const request = require('supertest');

const { app, cattlePayload, feedingPayload } = require('./helpers');

const addCow = async (overrides) =>
  (await request(app).post('/api/cattle').send(cattlePayload(overrides)).expect(201)).body.data;
const feed = (cattleId, overrides) =>
  request(app).post('/api/feeding').send(feedingPayload(cattleId, overrides)).expect(201);
const grid = (month) => request(app).get('/api/feeding/monthly-grid').query({ month });

describe('feed per cow / per day / per month', () => {
  test('rows per cow, columns per day, totals both ways, kg and FBu', async () => {
    const a = await addCow({ tag_number: 'GBA1', name: 'Amani' });
    const b = await addCow({ tag_number: 'GBB2', name: 'Bella' });

    // Amani: 1 Jul hay 10 kg × 500, 1 Jul silage 5 kg × 200 (same day adds up), 3 Jul 8 kg, no price
    await feed(a._id, { date_recorded: '2026-07-01', quantity_kg: 10, cost_per_unit: 500 });
    await feed(a._id, { date_recorded: '2026-07-01', feed_type: 'Silage', quantity_kg: 5, cost_per_unit: 200 });
    await feed(a._id, { date_recorded: '2026-07-03', quantity_kg: 8, cost_per_unit: undefined });
    // Bella: 1 Jul 4 kg × 500
    await feed(b._id, { date_recorded: '2026-07-01', quantity_kg: 4, cost_per_unit: 500 });
    // Another month, must not count
    await feed(b._id, { date_recorded: '2026-08-01', quantity_kg: 99 });

    const res = await grid('2026-07');
    expect(res.status).toBe(200);
    const g = res.body.data;

    expect(g.days_in_month).toBe(31);
    expect(g.cows.map((c) => c.tag)).toEqual(['GBA1', 'GBB2']); // most fed first

    const amani = g.cows[0];
    expect(amani.daily_kg).toHaveLength(31);
    expect(amani.daily_kg[0]).toBe(15);
    expect(amani.daily_kg[1]).toBeNull();
    expect(amani.daily_kg[2]).toBe(8);
    expect(amani.daily_cost[0]).toBe(6000);
    expect(amani.daily_cost[2]).toBe(0); // fed, but no price entered
    expect(amani.total_kg).toBe(23);
    expect(amani.total_cost).toBe(6000);
    expect(amani.fed_days).toBe(2);
    expect(amani.average_kg).toBe(11.5);

    // All cows, per day
    expect(g.daily_totals_kg[0]).toBe(19);
    expect(g.daily_totals_cost[0]).toBe(8000);
    expect(g.daily_totals_kg[2]).toBe(8);
    expect(g.daily_totals_kg[1]).toBeNull();

    // All cows, whole month
    expect(g.grand_total_kg).toBe(27);
    expect(g.grand_total_cost).toBe(8000);
    expect(g.fed_days).toBe(2);

    expect(g.by_feed_type).toEqual([
      { feed_type: 'Hay', total_kg: 22, total_cost: 7000 },
      { feed_type: 'Silage', total_kg: 5, total_cost: 1000 },
    ]);
  });

  test('an empty month is an empty sheet, not an error', async () => {
    const g = (await grid('2026-02')).body.data;
    expect(g.days_in_month).toBe(28);
    expect(g.cows).toEqual([]);
    expect(g.grand_total_kg).toBe(0);
    expect(g.daily_totals_kg.every((v) => v === null)).toBe(true);
  });

  test('a bad month is refused', async () => {
    expect((await grid('July')).status).toBe(400);
    expect((await grid()).status).toBe(400);
  });

  test('the grid route is not mistaken for a record id', async () => {
    const res = await grid('2026-07');
    expect(res.status).toBe(200);
  });
});
