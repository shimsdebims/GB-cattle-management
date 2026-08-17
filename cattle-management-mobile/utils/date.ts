/**
 * Date helpers for record entry and month navigation.
 *
 * IMPORTANT: record dates must be sent as plain calendar dates ("YYYY-MM-DD"),
 * never as `Date.toISOString()`.
 *
 * A date picked as 5 August in Burundi (UTC+2) becomes "2026-08-04T22:00:00Z"
 * via toISOString(), and the server — which normalizes to UTC midnight — would
 * store it as 4 August. Sending the calendar date keeps what the user picked.
 */

/** Local calendar date as "YYYY-MM-DD". */
export function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today as "YYYY-MM-DD". */
export const todayDateOnly = (): string => toDateOnly(new Date());

/**
 * Parses "YYYY-MM-DD" (or an ISO timestamp) into a Date positioned at local
 * midnight, so display never drifts to the previous day.
 */
export function fromDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(value);
}

/** Short, human-readable date for list rows. */
export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? fromDateOnly(value) : value;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Month helpers ───────────────────────────────────────────────────────────

/** Current month as "YYYY-MM". */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** "2026-08" -> "August 2026" */
export function monthLabel(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

/** Shifts a "YYYY-MM" string by whole months. */
export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number);
  const date = new Date(year, mon - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Inclusive first/last calendar dates of a month, as "YYYY-MM-DD". */
export function monthRange(month: string): { date_from: string; date_to: string } {
  const [year, mon] = month.split('-').map(Number);
  const first = new Date(year, mon - 1, 1);
  const last = new Date(year, mon, 0);
  return { date_from: toDateOnly(first), date_to: toDateOnly(last) };
}

/** True when `month` is the current month or later — used to cap navigation. */
export function isFutureMonth(month: string): boolean {
  return month > currentMonth();
}
