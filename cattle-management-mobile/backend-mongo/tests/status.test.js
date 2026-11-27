const request = require('supertest');

const { app, cattlePayload, milkPayload } = require('./helpers');
const Cattle = require('../models/Cattle');

const put = (id, body) => request(app).put(`/api/cattle/${id}`).send(body);

describe('inactive cows (too young, dry, … in his own words)', () => {
  test('a cow can be added as Inactive with a reason, and the history starts there', async () => {
    const res = await request(app)
      .post('/api/cattle')
      .send(cattlePayload({ current_status: 'Inactive', inactive_reason: 'Trop jeune' }));

    expect(res.status).toBe(201);
    expect(res.body.data.current_status).toBe('Inactive');
    expect(res.body.data.inactive_reason).toBe('Trop jeune');
    expect(res.body.data.status_history).toHaveLength(1);
    expect(res.body.data.status_history[0]).toMatchObject({ status: 'Inactive', reason: 'Trop jeune' });
  });

  test('a new cow defaults to Active, with history', async () => {
    const res = await request(app).post('/api/cattle').send(cattlePayload());
    expect(res.body.data.current_status).toBe('Active');
    expect(res.body.data.status_history[0].status).toBe('Active');
  });

  test('Active → Inactive → Active, each change kept in order with its reason', async () => {
    const cow = (await request(app).post('/api/cattle').send(cattlePayload())).body.data;

    const off = await put(cow._id, { current_status: 'Inactive', inactive_reason: 'Tarie' });
    expect(off.status).toBe(200);
    expect(off.body.data.current_status).toBe('Inactive');
    expect(off.body.data.inactive_reason).toBe('Tarie');

    const on = await put(cow._id, { current_status: 'Active' });
    expect(on.body.data.current_status).toBe('Active');
    expect(on.body.data.inactive_reason).toBeUndefined();
    expect(on.body.data.status_history.map((h) => h.status)).toEqual(['Active', 'Inactive', 'Active']);
    expect(on.body.data.status_history[1].reason).toBe('Tarie');
  });

  test('the reason is optional, and can be changed while inactive', async () => {
    const cow = (await request(app).post('/api/cattle').send(cattlePayload())).body.data;
    await put(cow._id, { current_status: 'Inactive' });
    const edited = await put(cow._id, { inactive_reason: 'Malade' });
    expect(edited.body.data.inactive_reason).toBe('Malade');
    expect(edited.body.data.status_history).toHaveLength(2); // a reason edit is not a status change
  });

  test('editing other fields leaves status and history alone', async () => {
    const cow = (await request(app).post('/api/cattle').send(cattlePayload())).body.data;
    const res = await put(cow._id, { name: 'Bella', status_history: [] });
    expect(res.body.data.name).toBe('Bella');
    expect(res.body.data.status_history).toHaveLength(1);
  });

  test('a status cannot be switched to Sold or Deceased by a plain edit', async () => {
    const cow = (await request(app).post('/api/cattle').send(cattlePayload())).body.data;
    const sold = await put(cow._id, { current_status: 'Sold' });
    expect(sold.status).toBe(409);
    expect(sold.body.code).toBe('STATUS_CHANGE_NOT_ALLOWED');
    expect((await Cattle.findById(cow._id)).current_status).toBe('Active');
  });

  test('a sold cow cannot be reactivated by a plain edit (undo the sale instead)', async () => {
    const cow = (await request(app).post('/api/cattle').send(cattlePayload())).body.data;
    await request(app).post(`/api/cattle/${cow._id}/sell`).send({ sale_date: '2026-07-01', sale_price: 900000 });
    const res = await put(cow._id, { current_status: 'Active' });
    expect(res.status).toBe(409);
    expect((await Cattle.findById(cow._id)).current_status).toBe('Sold');
  });

  test('an inactive cow can still have milk recorded (records are never refused for status)', async () => {
    const cow = (await request(app).post('/api/cattle').send(cattlePayload({ current_status: 'Inactive' }))).body.data;
    const milk = await request(app).post('/api/milk').send(milkPayload(cow._id));
    expect(milk.status).toBe(201);
  });
});

describe('dashboard herd counts', () => {
  test('count the working herd only, with inactive cows shown separately', async () => {
    await request(app).post('/api/cattle').send(cattlePayload({ tag_number: 'GB0001' }));
    await request(app).post('/api/cattle').send(cattlePayload({ tag_number: 'GB0002', current_status: 'Inactive' }));
    const sold = (await request(app).post('/api/cattle').send(cattlePayload({ tag_number: 'GB0003' }))).body.data;
    await request(app).post(`/api/cattle/${sold._id}/sell`).send({ sale_date: '2026-07-01', sale_price: 1 });

    const res = await request(app).get('/api/analytics/dashboard');
    expect(res.body.data.cattle.total_cattle).toBe(2);
    expect(res.body.data.cattle.active_cattle).toBe(1);
    expect(res.body.data.cattle.inactive_cattle).toBe(1);
  });
});
