/**
 * Date helpers for month-scoped reporting.
 *
 * All record dates are stored as UTC midnight, so every boundary must also be
 * built in UTC. Using `new Date(year, month, 1)` (local time) would shift the
 * window by the machine's UTC offset and leak edge days from the adjacent month
 * — a real bug for a farm in UTC+2.
 */

const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const DAY_PATTERN = /^(\d{4}-\d{2}-\d{2})/;

/**
 * The farm is in Bujumbura: UTC+2 all year (Burundi has no daylight saving),
 * so a fixed offset is exact and needs no time-zone database.
 */
const FARM_UTC_OFFSET_HOURS = 2;

/**
 * The farm's calendar date right now, "YYYY-MM-DD".
 *
 * The server runs on UTC. Between 00:00 and 02:00 in Bujumbura the server's
 * date is still yesterday, so "today" by the server clock rejected milk dated
 * the farm's today as being in the future.
 */
function farmToday(now = new Date()) {
  return new Date(now.getTime() + FARM_UTC_OFFSET_HOURS * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
}

/**
 * The calendar date a record will be stored under, "YYYY-MM-DD": the date as
 * written for "YYYY-MM-DD…" strings, else the UTC date (records are stored at
 * UTC midnight). Null when the value is not a date.
 */
function calendarDay(value) {
  if (typeof value === 'string') {
    const match = DAY_PATTERN.exec(value);
    if (match) return match[1];
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

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
  FARM_UTC_OFFSET_HOURS,
  farmToday,
  calendarDay,
  isValidMonth,
  startOfUtcDay,
  utcMonthRange,
  daysAgo,
  round1,
  roundInt,
};
