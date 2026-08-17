/**
 * Date helpers for month-scoped reporting.
 *
 * All record dates are stored as UTC midnight, so every boundary must also be
 * built in UTC. Using `new Date(year, month, 1)` (local time) would shift the
 * window by the machine's UTC offset and leak edge days from the adjacent month
 * — a real bug for a farm in UTC+2.
 */

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

const isValidMonth = (month) => typeof month === 'string' && MONTH_PATTERN.test(month);

/** Midnight UTC on the same calendar day as `value`. */
function startOfUtcDay(value) {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * @param {string} month  "YYYY-MM"
 * @returns {{ year: number, mon: number, start: Date, end: Date, daysInMonth: number }}
 *          `start` inclusive, `end` exclusive.
 */
function utcMonthRange(month) {
  const [year, mon] = month.split('-').map(Number);
  return {
    year,
    mon,
    start: new Date(Date.UTC(year, mon - 1, 1)),
    end: new Date(Date.UTC(year, mon, 1)),
    daysInMonth: new Date(Date.UTC(year, mon, 0)).getUTCDate(),
  };
}

/** Start of the day `days` ago, used by rolling-window stats. */
function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

const round1 = (n) => Math.round(n * 10) / 10;
const roundInt = (n) => Math.round(n);

module.exports = {
  MONTH_PATTERN,
  isValidMonth,
  startOfUtcDay,
  utcMonthRange,
  daysAgo,
  round1,
  roundInt,
};
