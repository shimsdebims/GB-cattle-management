/**
 * COMPREHENSIVE TEST SUITE FOR CATTLE & MILK PRODUCTION ROUTES
 * 
 * Run with: npm test
 * 
 * Tests:
 * - Cattle CRUD operations
 * - Milk Production CRUD operations
 * - Validation & error handling
 * - Edge cases
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Cattle = require('../models/Cattle');
const MilkProduction = require('../models/MilkProduction');
const { errorHandler } = require('../middleware');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/cattle', require('../routes/cattle'));
app.use('/api/milk', require('../routes/milk'));
app.use(errorHandler);

// Test data
let testCattleId;
let testMilkRecordId;

describe('CATTLE ROUTES', () => {
  // Setup: Connect to test database
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_TEST_URI || process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }
  });

  // Cleanup: Clear collections before each test
  beforeEach(async () => {
    await Cattle.deleteMany({});
    await MilkProduction.deleteMany({});
  });

  // Cleanup: Disconnect after all tests
  afterAll(async () => {
    await Cattle.deleteMany({});
    await MilkProduction.deleteMany({});
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  // ============================================================================
  // POST /api/cattle - Create cattle
  // ============================================================================
  describe('POST /api/cattle', () => {
    test('Should create cattle with valid data', async () => {
      const res = await request(app)
        .post('/api/cattle')
        .send({
          tag_number: 'COW-001',
          name: 'Bessie',
          breed: 'Holstein',
          gender: 'Female',
          date_of_birth: '2020-01-15',
          status: 'Active',
          health_status: 'Healthy',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBeDefined();
      expect(res.body.data.tag_number).toBe('COW-001');
      expect(res.body.data.name).toBe('Bessie');
      testCattleId = res.body.data._id;
    });

    test('Should reject duplicate tag_number', async () => {
      // Create first cattle
      await request(app)
        .post('/api/cattle')
        .send({
          tag_number: 'COW-002',
          name: 'Daisy',
          breed: 'Jersey',
          gender: 'Female',
          date_of_birth: '2019-06-20',
          status: 'Active',
          health_status: 'Healthy',
        });

      // Try to create with same tag_number
      const res = await request(app)
        .post('/api/cattle')
        .send({
          tag_number: 'COW-002',
          name: 'Another Daisy',
          breed: 'Guernsey',
          gender: 'Female',
          date_of_birth: '2021-03-10',
          status: 'Active',
          health_status: 'Healthy',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Conflict');
    });

    test('Should validate required fields', async () => {
      const res = await request(app)
        .post('/api/cattle')
        .send({
          name: 'Bessie',
          breed: 'Holstein',
          // Missing tag_number, gender, date_of_birth, status, health_status
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    test('Should validate tag_number length', async () => {
      const res = await request(app)
        .post('/api/cattle')
        .send({
          tag_number: 'C', // Too short
          name: 'Bessie',
          breed: 'Holstein',
          gender: 'Female',
          date_of_birth: '2020-01-15',
          status: 'Active',
          health_status: 'Healthy',
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test('Should reject future date_of_birth', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const res = await request(app)
        .post('/api/cattle')
        .send({
          tag_number: 'COW-003',
          name: 'Bessie',
          breed: 'Holstein',
          gender: 'Female',
          date_of_birth: futureDate.toISOString().split('T')[0],
          status: 'Active',
          health_status: 'Healthy',
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test('Should validate enum values', async () => {
      const res = await request(app)
        .post('/api/cattle')
        .send({
          tag_number: 'COW-004',
          name: 'Bessie',
          breed: 'Holstein',
          gender: 'InvalidGender',
          date_of_birth: '2020-01-15',
          status: 'Active',
          health_status: 'Healthy',
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  // ============================================================================
  // GET /api/cattle - List cattle
  // ============================================================================
  describe('GET /api/cattle', () => {
    beforeEach(async () => {
      // Create test cattle
      await Cattle.create([
        {
          tag_number: 'COW-001',
          name: 'Bessie',
          breed: 'Holstein',
          gender: 'Female',
          date_of_birth: '2020-01-15',
          status: 'Active',
          health_status: 'Healthy',
        },
        {
          tag_number: 'COW-002',
          name: 'Daisy',
          breed: 'Jersey',
          gender: 'Female',
          date_of_birth: '2019-06-20',
          status: 'Active',
          health_status: 'Healthy',
        },
        {
          tag_number: 'COW-003',
          name: 'Molly',
          breed: 'Guernsey',
          gender: 'Female',
          date_of_birth: '2021-03-10',
          status: 'Sold',
          health_status: 'Healthy',
        },
      ]);
    });

    test('Should list all cattle', async () => {
      const res = await request(app).get('/api/cattle');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(3);
      expect(res.body.data.pagination.total).toBe(3);
    });

    test('Should filter by status', async () => {
      const res = await request(app)
        .get('/api/cattle')
        .query({ status: 'Sold' });

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].status).toBe('Sold');
    });

    test('Should filter by health_status', async () => {
      await Cattle.findOneAndUpdate(
        { tag_number: 'COW-002' },
        { health_status: 'Sick' }
      );

      const res = await request(app)
        .get('/api/cattle')
        .query({ health_status: 'Sick' });

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].health_status).toBe('Sick');
    });

    test('Should support pagination', async () => {
      const res = await request(app)
        .get('/api/cattle')
        .query({ limit: 2, page: 1 });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeLessThanOrEqual(2);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.has_next).toBe(true);
    });
  });

  // ============================================================================
  // GET /api/cattle/:id - Get single cattle
  // ============================================================================
  describe('GET /api/cattle/:id', () => {
    let cattleId;

    beforeEach(async () => {
      const cattle = await Cattle.create({
        tag_number: 'COW-001',
        name: 'Bessie',
        breed: 'Holstein',
        gender: 'Female',
        date_of_birth: '2020-01-15',
        status: 'Active',
        health_status: 'Healthy',
      });
      cattleId = cattle._id;
    });

    test('Should retrieve cattle by ID', async () => {
      const res = await request(app).get(`/api/cattle/${cattleId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(cattleId.toString());
      expect(res.body.data.tag_number).toBe('COW-001');
    });

    test('Should return 404 for non-existent ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/cattle/${fakeId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test('Should reject invalid ObjectId format', async () => {
      const res = await request(app).get('/api/cattle/invalid-id');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ============================================================================
  // PUT /api/cattle/:id - Update cattle
  // ============================================================================
  describe('PUT /api/cattle/:id', () => {
    let cattleId;

    beforeEach(async () => {
      const cattle = await Cattle.create({
        tag_number: 'COW-001',
        name: 'Bessie',
        breed: 'Holstein',
        gender: 'Female',
        date_of_birth: '2020-01-15',
        status: 'Active',
        health_status: 'Healthy',
      });
      cattleId = cattle._id;
    });

    test('Should update cattle', async () => {
      const res = await request(app)
        .put(`/api/cattle/${cattleId}`)
        .send({
          name: 'Bessie Updated',
          health_status: 'Sick',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Bessie Updated');
      expect(res.body.data.health_status).toBe('Sick');
    });

    test('Should not allow updating tag_number', async () => {
      const res = await request(app)
        .put(`/api/cattle/${cattleId}`)
        .send({
          tag_number: 'COW-NEW',
          name: 'Bessie',
        });

      const cattle = await Cattle.findById(cattleId);
      expect(cattle.tag_number).toBe('COW-001'); // Should not change
    });

    test('Should return 404 for non-existent ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/cattle/${fakeId}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(404);
    });
  });

  // ============================================================================
  // DELETE /api/cattle/:id - Delete cattle
  // ============================================================================
  describe('DELETE /api/cattle/:id', () => {
    let cattleId;

    beforeEach(async () => {
      const cattle = await Cattle.create({
        tag_number: 'COW-001',
        name: 'Bessie',
        breed: 'Holstein',
        gender: 'Female',
        date_of_birth: '2020-01-15',
        status: 'Active',
        health_status: 'Healthy',
      });
      cattleId = cattle._id;
    });

    test('Should soft delete cattle (mark as Deceased)', async () => {
      const res = await request(app).delete(`/api/cattle/${cattleId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('Deceased');

      const cattle = await Cattle.findById(cattleId);
      expect(cattle.status).toBe('Deceased');
    });

    test('Should return 404 for non-existent ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).delete(`/api/cattle/${fakeId}`);

      expect(res.status).toBe(404);
    });
  });
});

// ============================================================================
// MILK PRODUCTION ROUTES
// ============================================================================
describe('MILK PRODUCTION ROUTES', () => {
  let testCattleId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_TEST_URI || process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }
  });

  beforeEach(async () => {
    await Cattle.deleteMany({});
    await MilkProduction.deleteMany({});

    // Create test cattle
    const cattle = await Cattle.create({
      tag_number: 'COW-001',
      name: 'Bessie',
      breed: 'Holstein',
      gender: 'Female',
      date_of_birth: '2020-01-15',
      status: 'Active',
      health_status: 'Healthy',
    });
    testCattleId = cattle._id.toString();
  });

  afterAll(async () => {
    await Cattle.deleteMany({});
    await MilkProduction.deleteMany({});
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  // ============================================================================
  // POST /api/milk/record - Create record
  // ============================================================================
  describe('POST /api/milk/record', () => {
    test('Should create milk record with valid data', async () => {
      const res = await request(app)
        .post('/api/milk/record')
        .send({
          cattle_id: testCattleId,
          date_recorded: '2024-07-18',
          quantity_liters: 15.5,
          quality_score: 4,
          notes: 'Good quality',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cattle_tag).toBe('COW-001');
      expect(res.body.data.quantity_liters).toBe(15.5);
    });

    test('Should reject duplicate record for same date', async () => {
      // Create first record
      await request(app)
        .post('/api/milk/record')
        .send({
          cattle_id: testCattleId,
          date_recorded: '2024-07-18',
          quantity_liters: 15.5,
          quality_score: 4,
        });

      // Try to create duplicate
      const res = await request(app)
        .post('/api/milk/record')
        .send({
          cattle_id: testCattleId,
          date_recorded: '2024-07-18',
          quantity_liters: 16.0,
          quality_score: 4,
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Conflict');
    });

    test('Should validate quantity_liters range', async () => {
      const res = await request(app)
        .post('/api/milk/record')
        .send({
          cattle_id: testCattleId,
          date_recorded: '2024-07-18',
          quantity_liters: 75.0, // Too high (>50)
          quality_score: 4,
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test('Should validate quality_score range', async () => {
      const res = await request(app)
        .post('/api/milk/record')
        .send({
          cattle_id: testCattleId,
          date_recorded: '2024-07-18',
          quantity_liters: 15.5,
          quality_score: 10, // Invalid (should be 1-5)
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test('Should return 404 if cattle not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post('/api/milk/record')
        .send({
          cattle_id: fakeId.toString(),
          date_recorded: '2024-07-18',
          quantity_liters: 15.5,
          quality_score: 4,
        });

      expect(res.status).toBe(404);
    });
  });

  // ============================================================================
  // GET /api/milk/day/:date - Daily records
  // ============================================================================
  describe('GET /api/milk/day/:date', () => {
    beforeEach(async () => {
      // Create multiple records for same day
      await MilkProduction.create([
        {
          cattle_id: testCattleId,
          cattle_tag: 'COW-001',
          date_recorded: '2024-07-18',
          quantity_liters: 15.5,
          quality_score: 4,
        },
        {
          cattle_id: testCattleId,
          cattle_tag: 'COW-001',
          date_recorded: '2024-07-18',
          quantity_liters: 14.0,
          quality_score: 3,
        },
      ]);
    });

    test('Should retrieve daily milk totals', async () => {
      const res = await request(app).get('/api/milk/day/2024-07-18');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.date).toBe('2024-07-18');
      expect(res.body.data.records_count).toBe(2);
      expect(res.body.data.total_liters).toBe(29.5);
    });

    test('Should validate date format', async () => {
      const res = await request(app).get('/api/milk/day/18-07-2024');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('Should handle empty result set', async () => {
      const res = await request(app).get('/api/milk/day/2024-01-01');

      expect(res.status).toBe(200);
      expect(res.body.data.records_count).toBe(0);
      expect(res.body.data.total_liters).toBe(0);
    });
  });

  // ============================================================================
  // GET /api/milk/cattle/:cattle_id/month/:yyyy-mm - Monthly per cow
  // ============================================================================
  describe('GET /api/milk/cattle/:cattle_id/month/:yyyy-mm', () => {
    beforeEach(async () => {
      // Create records for entire month
      for (let day = 1; day <= 5; day++) {
        await MilkProduction.create({
          cattle_id: testCattleId,
          cattle_tag: 'COW-001',
          date_recorded: `2024-07-${String(day).padStart(2, '0')}`,
          quantity_liters: 15 + day,
          quality_score: 4,
        });
      }
    });

    test('Should retrieve monthly data for cattle', async () => {
      const res = await request(app).get(
        `/api/milk/cattle/${testCattleId}/month/2024-07`
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.year_month).toBe('2024-07');
      expect(res.body.data.record_count).toBe(5);
      expect(res.body.data.cattle_tag).toBe('COW-001');
    });

    test('Should validate cattle ID format', async () => {
      const res = await request(app).get(
        `/api/milk/cattle/invalid-id/month/2024-07`
      );

      expect(res.status).toBe(400);
    });

    test('Should return 404 if cattle not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).get(
        `/api/milk/cattle/${fakeId}/month/2024-07`
      );

      expect(res.status).toBe(404);
    });
  });

  // ============================================================================
  // GET /api/milk/month/:yyyy-mm - Monthly all cows
  // ============================================================================
  describe('GET /api/milk/month/:yyyy-mm', () => {
    beforeEach(async () => {
      // Create records
      await MilkProduction.create([
        {
          cattle_id: testCattleId,
          cattle_tag: 'COW-001',
          date_recorded: '2024-07-01',
          quantity_liters: 15.0,
          quality_score: 4,
        },
        {
          cattle_id: testCattleId,
          cattle_tag: 'COW-001',
          date_recorded: '2024-07-02',
          quantity_liters: 16.0,
          quality_score: 4,
        },
      ]);
    });

    test('Should retrieve monthly summary for all cows', async () => {
      const res = await request(app).get('/api/milk/month/2024-07');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.year_month).toBe('2024-07');
      expect(res.body.data.cows_count).toBe(1);
      expect(res.body.data.total_liters).toBe(31.0);
    });
  });

  // ============================================================================
  // PUT /api/milk/:id - Update record
  // ============================================================================
  describe('PUT /api/milk/:id', () => {
    let recordId;

    beforeEach(async () => {
      const record = await MilkProduction.create({
        cattle_id: testCattleId,
        cattle_tag: 'COW-001',
        date_recorded: '2024-07-18',
        quantity_liters: 15.5,
        quality_score: 4,
      });
      recordId = record._id.toString();
    });

    test('Should update milk record', async () => {
      const res = await request(app)
        .put(`/api/milk/${recordId}`)
        .send({
          quantity_liters: 16.0,
          quality_score: 5,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.quantity_liters).toBe(16.0);
      expect(res.body.data.quality_score).toBe(5);
    });

    test('Should not allow changing cattle_id or date_recorded', async () => {
      const newCattleId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/milk/${recordId}`)
        .send({
          cattle_id: newCattleId,
          date_recorded: '2024-07-19',
          quantity_liters: 16.0,
        });

      const record = await MilkProduction.findById(recordId);
      expect(record.cattle_id.toString()).toBe(testCattleId);
      expect(record.date_recorded.toISOString().split('T')[0]).toBe('2024-07-18');
    });
  });

  // ============================================================================
  // DELETE /api/milk/:id - Delete record
  // ============================================================================
  describe('DELETE /api/milk/:id', () => {
    let recordId;

    beforeEach(async () => {
      const record = await MilkProduction.create({
        cattle_id: testCattleId,
        cattle_tag: 'COW-001',
        date_recorded: '2024-07-18',
        quantity_liters: 15.5,
        quality_score: 4,
      });
      recordId = record._id.toString();
    });

    test('Should delete milk record', async () => {
      const res = await request(app).delete(`/api/milk/${recordId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const record = await MilkProduction.findById(recordId);
      expect(record).toBeNull();
    });
  });
});

module.exports = app;
