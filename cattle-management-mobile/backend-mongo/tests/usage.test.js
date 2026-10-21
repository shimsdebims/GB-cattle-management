const mongoose = require('mongoose');

const Cattle = require('../models/Cattle');
const MilkProduction = require('../models/MilkProduction');
const { cattlePayload } = require('./helpers');
const { usageSummary } = require('../utils/usageSummary');

const NOW = new Date('2026-10-21T12:00:00Z');
const idAt = (iso) => mongoose.Types.ObjectId.createFromTime(Date.parse(iso) / 1000);

test('reports totals, recent additions and the newest record, without names or amounts', async () => {
  const cow = await Cattle.create({ ...cattlePayload(), _id: idAt('2026-10-01T08:00:00Z') });
  await MilkProduction.create([
    { _id: idAt('2026-10-02T08:00:00Z'), cattle_id: cow._id, date_recorded: '2026-10-02', quantity_liters: 9 },
    { _id: idAt('2026-10-19T08:00:00Z'), cattle_id: cow._id, date_recorded: '2026-10-19', quantity_liters: 11 },
    { _id: idAt('2026-10-20T08:00:00Z'), cattle_id: cow._id, date_recorded: '2026-10-20', quantity_liters: 12 },
  ]);

  const summary = await usageSummary({ now: NOW, days: 7 });
  const row = (what) => summary.rows.find((r) => r.what === what);

  expect(row('Cows')).toEqual({ what: 'Cows', total: 1, 'added last 7 days': 0, 'last added': '2026-10-01' });
  expect(row('Milk records')).toEqual({
    what: 'Milk records',
    total: 3,
    'added last 7 days': 2,
    'last added': '2026-10-20',
  });
  expect(row('Expenses')['last added']).toBe('—');
  expect(summary.milk_days_recorded_last_period).toBe(2);

  // Nothing identifying or financial leaks into the public log.
  const text = JSON.stringify(summary.rows);
  expect(text).not.toMatch(/Bessie|GB0001|quantity|liters|price|amount/i);
});
