const { createApp } = require('../app');

const app = createApp({ enableLogging: false });

/** Valid cattle payload; override any field per test. */
const cattlePayload = (overrides = {}) => ({
  tag_number: 'GB0001',
  name: 'Bessie',
  breed: 'Holstein',
  gender: 'Female',
  date_of_birth: '2020-01-15',
  health_status: 'Healthy',
  current_status: 'Active',
  ...overrides,
});

const milkPayload = (cattleId, overrides = {}) => ({
  cattle_id: cattleId,
  date_recorded: '2026-07-01',
  quantity_liters: 15.5,
  quality_score: 8,
  ...overrides,
});

const feedingPayload = (cattleId, overrides = {}) => ({
  cattle_id: cattleId,
  date_recorded: '2026-07-01',
  feed_type: 'Hay',
  quantity_kg: 10,
  cost_per_unit: 500,
  ...overrides,
});

const expensePayload = (overrides = {}) => ({
  date_recorded: '2026-07-01',
  category: 'Concentrates',
  description: 'Bought concentrates',
  amount: 170000,
  ...overrides,
});

const revenuePayload = (overrides = {}) => ({
  date_recorded: '2026-07-01',
  source: 'Cattle Sale',
  description: 'Sold a bull',
  amount: 500000,
  ...overrides,
});

module.exports = {
  app,
  cattlePayload,
  milkPayload,
  feedingPayload,
  expensePayload,
  revenuePayload,
};
