/**
 * Format a number as BIF (Burundian Franc) with thousands separators.
 * e.g.  1700  →  "1,700 FBu"
 *       250000 →  "250,000 FBu"
 * BIF has no sub-unit, so we always round to the nearest integer.
 */
export function formatCurrency(amount: number): string {
  const rounded = Math.round(amount);
  // Use Intl for locale-aware thousands separators (comma style)
  const formatted = rounded.toLocaleString('en-US');
  return `${formatted} FBu`;
}

/**
 * Format liters with one decimal place.
 */
export function formatLiters(liters: number): string {
  return `${liters.toFixed(1)} L`;
}
