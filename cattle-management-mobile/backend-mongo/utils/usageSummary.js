/**
 * "Is he using it?" in numbers: per farm collection, how many records exist,
 * how many were added in the last 7 days, and the date of the newest one.
 *
 * Counts and dates only — never names, amounts or notes — because it is
 * printed in GitHub Actions logs, which are public for this repository.
 * Read-only. Ages come from the ObjectId, so it also works for records
 * written before timestamps were stored.
 */
const mongoose = require('mongoose');

const Cattle = require('../models/Cattle');
const MilkProduction = require('../models/MilkProduction');
const Feeding = require('../models/Feeding');
const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');

const TRACKED = [
  ['Cows', Cattle],
  ['Milk records', MilkProduction],
  ['Feeding records', Feeding],
  ['Expenses', Expense],
  ['Other revenue', Revenue],
];

const DAY_MS = 24 * 3600 * 1000;
const day = (date) => (date ? date.toISOString().slice(0, 10) : '—');

async function usageSummary({ now = new Date(), days = 7 } = {}) {
  const since = mongoose.Types.ObjectId.createFromTime(
    Math.floor((now.getTime() - days * DAY_MS) / 1000)
  );

  const rows = [];
  for (const [label, Model] of TRACKED) {
    const [total, recent, newest] = await Promise.all([
      Model.countDocuments(),
      Model.countDocuments({ _id: { $gte: since } }),
      Model.findOne().sort({ _id: -1 }).select('_id').lean(),
    ]);
    rows.push({
      what: label,
      total,
      [`added last ${days} days`]: recent,
      'last added': day(newest?._id.getTimestamp()),
    });
  }

  // Which milk days were filled in recently: the clearest sign of daily use.
  const milkDays = await MilkProduction.distinct('date_recorded', {
    date_recorded: { $gte: new Date(now.getTime() - days * DAY_MS) },
  });

  return {
    generated_at: now.toISOString(),
    rows,
    milk_days_recorded_last_period: milkDays.length,
    period_days: days,
  };
}

/** Plain console table plus, inside GitHub Actions, the run's summary page. */
function printUsageSummary(summary) {
  console.log(`\nActivity (counts and dates only), ${summary.generated_at}:`);
  console.table(summary.rows);
  console.log(
    `Milk filled in on ${summary.milk_days_recorded_last_period} of the last ${summary.period_days} days.`
  );

  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  const keys = Object.keys(summary.rows[0]);
  const lines = [
    '### Farm activity',
    '',
    `| ${keys.join(' | ')} |`,
    `| ${keys.map(() => '---').join(' | ')} |`,
    ...summary.rows.map((r) => `| ${keys.map((k) => r[k]).join(' | ')} |`),
    '',
    `Milk filled in on **${summary.milk_days_recorded_last_period} of the last ${summary.period_days} days**.`,
    '',
  ];
  require('fs').appendFileSync(file, lines.join('\n'));
}

module.exports = { usageSummary, printUsageSummary };
