const request = require('supertest');

const { app, cattlePayload, milkPayload, expensePayload, revenuePayload, feedingPayload } =
  require('./helpers');
const User = require('../models/User');
const Settings = require('../models/Settings');
const Cattle = require('../models/Cattle');
const MilkPrice = require('../models/MilkPrice');
const { countFarmData, resetFarmData } = require('../utils/resetFarmData');
const { hashPassword } = require('../utils/auth');

test('empties every farm record and keeps his login and the settings', async () => {
  await User.create({ username: 'gabriel', password_hash: hashPassword('secret-pass') });
  const cow = await request(app).post('/api/cattle').send(cattlePayload());
  const cattleId = cow.body.data._id;
  await request(app).post('/api/milk').send(milkPayload(cattleId));
  await request(app).post('/api/feeding').send(feedingPayload(cattleId));
  await request(app).post('/api/financial/expenses').send(expensePayload());
  await request(app).post('/api/financial/revenue').send(revenuePayload());
  await request(app).put('/api/settings').send({ milk_price_per_liter: 1800 });

  const before = await countFarmData();
  expect(Object.values(before).every((n) => n > 0)).toBe(true);
  expect(before[Cattle.collection.name]).toBe(1);

  await resetFarmData();

  const after = await countFarmData();
  expect(Object.values(after).every((n) => n === 0)).toBe(true);
  expect(await MilkPrice.countDocuments()).toBe(0);
  expect(await User.countDocuments()).toBe(1);
  expect((await Settings.findOne()).milk_price_per_liter).toBe(1800);
});

test('the app keeps working after a reset: price history rebuilds from settings', async () => {
  await request(app).put('/api/settings').send({ milk_price_per_liter: 1800 });
  await resetFarmData();

  const cow = await request(app).post('/api/cattle').send(cattlePayload());
  const milk = await request(app).post('/api/milk').send(milkPayload(cow.body.data._id));
  expect(milk.status).toBe(201);
  expect(milk.body.data.price_per_liter).toBe(1800);

  const prices = await request(app).get('/api/settings/milk-prices');
  expect(prices.body.data).toHaveLength(1);
  expect(prices.body.data[0].price_per_liter).toBe(1800);
});
