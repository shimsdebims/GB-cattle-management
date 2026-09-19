const request = require('supertest');
const mongoose = require('mongoose');

const { app, cattlePayload, milkPayload } = require('./helpers');
const Cattle = require('../models/Cattle');
const MilkProduction = require('../models/MilkProduction');
const Feeding = require('../models/Feeding');

describe('POST /api/cattle', () => {
  test('creates cattle and returns the standard envelope', async () => {
    const res = await request(app).post('/api/cattle').send(cattlePayload());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBeDefined();
    expect(res.body.data.tag_number).toBe('GB0001');
    expect(res.body.data.name).toBe('Bessie');
  });

  test('exposes the age_in_months virtual', async () => {
    const res = await request(app).post('/api/cattle').send(cattlePayload());
    expect(res.body.data.age_in_months).toBeGreaterThan(0);
  });

  test('rejects a duplicate tag_number with 409', async () => {
    await request(app).post('/api/cattle').send(cattlePayload());
    const res = await request(app)
      .post('/api/cattle')
      .send(cattlePayload({ name: 'Impostor' }));

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Conflict');
  });

  test('normalizes tag_number to uppercase, so case cannot bypass uniqueness', async () => {
    await request(app).post('/api/cattle').send(cattlePayload({ tag_number: 'gb0009' }));
    const res = await request(app)
      .post('/api/cattle')
      .send(cattlePayload({ tag_number: 'GB0009', name: 'Other' }));

    expect(res.status).toBe(409);
  });

  test('reports every missing required field at once', async () => {
    const res = await request(app).post('/api/cattle').send({ name: 'Bessie' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);

    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toContain('tag_number');
    expect(fields).toContain('breed');
    expect(fields).toContain('gender');
    expect(fields).toContain('date_of_birth');
  });

  test('rejects a too-short tag_number', async () => {
    const res = await request(app)
      .post('/api/cattle')
      .send(cattlePayload({ tag_number: 'G' }));

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'tag_number')).toBe(true);
  });

  test('rejects a future date_of_birth', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);

    const res = await request(app)
      .post('/api/cattle')
      .send(cattlePayload({ date_of_birth: tomorrow.toISOString().slice(0, 10) }));

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'date_of_birth')).toBe(true);
  });

  test('rejects values outside the shared enums', async () => {
    const gender = await request(app)
      .post('/api/cattle')
      .send(cattlePayload({ gender: 'Unknown' }));
    expect(gender.status).toBe(400);

    const breed = await request(app)
      .post('/api/cattle')
      .send(cattlePayload({ tag_number: 'GB0002', breed: 'Dragon' }));
    expect(breed.status).toBe(400);

    const health = await request(app)
      .post('/api/cattle')
      .send(cattlePayload({ tag_number: 'GB0003', health_status: 'Resting' }));
    expect(health.status).toBe(400);
  });

  test('accepts Limousin, which the Add Cattle picker offers', async () => {
    const res = await request(app)
      .post('/api/cattle')
      .send(cattlePayload({ breed: 'Limousin' }));
    expect(res.status).toBe(201);
  });
});

describe('GET /api/cattle', () => {
  beforeEach(async () => {
    await Cattle.create([
      cattlePayload({ tag_number: 'GB0001', name: 'Bessie' }),
      cattlePayload({ tag_number: 'GB0002', name: 'Daisy', breed: 'Jersey' }),
      cattlePayload({ tag_number: 'GB0003', name: 'Molly', current_status: 'Sold' }),
    ]);
  });

  test('returns all cattle with pagination metadata', async () => {
    const res = await request(app).get('/api/cattle');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.pagination.page).toBe(1);
  });

  test('filters by status, health and breed', async () => {
    const sold = await request(app).get('/api/cattle').query({ status: 'Sold' });
    expect(sold.body.data).toHaveLength(1);
    expect(sold.body.data[0].current_status).toBe('Sold');

    const jersey = await request(app).get('/api/cattle').query({ breed: 'Jersey' });
    expect(jersey.body.data).toHaveLength(1);
  });

  test('searches by name or tag', async () => {
    const byName = await request(app).get('/api/cattle').query({ search: 'dais' });
    expect(byName.body.data).toHaveLength(1);
    expect(byName.body.data[0].name).toBe('Daisy');

    const byTag = await request(app).get('/api/cattle').query({ search: 'GB0003' });
    expect(byTag.body.data).toHaveLength(1);
  });

  test('does not crash on regex metacharacters in search', async () => {
    const res = await request(app).get('/api/cattle').query({ search: 'GB(1[' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test('paginates and reports has_next', async () => {
    const res = await request(app).get('/api/cattle').query({ limit: 2, page: 1 });

    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.has_next).toBe(true);
    expect(res.body.pagination.has_previous).toBe(false);
    expect(res.body.pagination.pages).toBe(2);
  });

  test('clamps an oversized limit instead of scanning everything', async () => {
    const res = await request(app).get('/api/cattle').query({ limit: 100000 });
    expect(res.body.pagination.limit).toBeLessThanOrEqual(200);
  });

  test('falls back to page 1 for garbage pagination input', async () => {
    const res = await request(app).get('/api/cattle').query({ page: 'abc', limit: '-5' });
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBeGreaterThan(0);
  });
});

describe('GET /api/cattle/:id', () => {
  let cattleId;

  beforeEach(async () => {
    const cattle = await Cattle.create(cattlePayload());
    cattleId = cattle._id.toString();
  });

  test('returns the cattle', async () => {
    const res = await request(app).get(`/api/cattle/${cattleId}`);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(cattleId);
  });

  test('404s for a well-formed but unknown id', async () => {
    const res = await request(app).get(`/api/cattle/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('400s for a malformed id', async () => {
    const res = await request(app).get('/api/cattle/not-an-id');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid ID format');
  });
});

describe('GET /api/cattle/:id/summary', () => {
  test('aggregates recent milk and feeding activity', async () => {
    const cattle = await Cattle.create(cattlePayload());

    // Two recent days of milk, one feeding record.
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await MilkProduction.create([
      { cattle_id: cattle._id, date_recorded: today, quantity_liters: 10 },
      { cattle_id: cattle._id, date_recorded: yesterday, quantity_liters: 12 },
    ]);
    await Feeding.create({
      cattle_id: cattle._id,
      date_recorded: today,
      feed_type: 'Hay',
      quantity_kg: 10,
      cost_per_unit: 500,
    });

    const res = await request(app).get(`/api/cattle/${cattle._id}/summary`);

    expect(res.status).toBe(200);
    expect(res.body.data.cattle._id).toBe(cattle._id.toString());
    expect(res.body.data.summary.milk_production.total_liters_30_days).toBe(22);
    expect(res.body.data.summary.milk_production.record_count).toBe(2);
    expect(res.body.data.summary.feeding.total_cost_7_days).toBe(5000);
    expect(res.body.data.recent_milk_records).toHaveLength(2);
  });

  test('returns zeroed totals when there is no activity', async () => {
    const cattle = await Cattle.create(cattlePayload());
    const res = await request(app).get(`/api/cattle/${cattle._id}/summary`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.milk_production.total_liters_30_days).toBe(0);
    expect(res.body.data.summary.feeding.total_cost_7_days).toBe(0);
  });
});

describe('PUT /api/cattle/:id', () => {
  let cattleId;

  beforeEach(async () => {
    const cattle = await Cattle.create(cattlePayload());
    cattleId = cattle._id.toString();
  });

  test('applies a partial update without requiring every field', async () => {
    const res = await request(app)
      .put(`/api/cattle/${cattleId}`)
      .send({ name: 'Bessie II', health_status: 'Sick' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Bessie II');
    expect(res.body.data.health_status).toBe('Sick');
    // Untouched fields survive.
    expect(res.body.data.breed).toBe('Holstein');
  });

  test('still validates the fields that are provided', async () => {
    const res = await request(app)
      .put(`/api/cattle/${cattleId}`)
      .send({ health_status: 'Vibing' });

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'health_status')).toBe(true);
  });

  test('404s for an unknown id', async () => {
    const res = await request(app)
      .put(`/api/cattle/${new mongoose.Types.ObjectId()}`)
      .send({ name: 'Ghost' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/cattle/:id', () => {
  test('removes the animal and cascades to its records', async () => {
    const cattle = await Cattle.create(cattlePayload());
    await MilkProduction.create(milkPayload(cattle._id));
    await Feeding.create({
      cattle_id: cattle._id,
      date_recorded: '2026-07-01',
      feed_type: 'Hay',
      quantity_kg: 5,
    });

    const res = await request(app).delete(`/api/cattle/${cattle._id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.deleted_milk_records).toBe(1);
    expect(res.body.data.deleted_feeding_records).toBe(1);

    expect(await Cattle.countDocuments()).toBe(0);
    expect(await MilkProduction.countDocuments()).toBe(0);
    expect(await Feeding.countDocuments()).toBe(0);
  });

  test('404s for an unknown id', async () => {
    const res = await request(app).delete(
      `/api/cattle/${new mongoose.Types.ObjectId()}`
    );
    expect(res.status).toBe(404);
  });
});

describe('unknown routes', () => {
  test('404s with the standard error envelope', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Not Found');
  });
});
