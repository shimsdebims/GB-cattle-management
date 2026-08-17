/**
 * Mirror of `backend-mongo/constants/domain.js`.
 *
 * These arrays are the single source of truth for the app's dropdowns AND for
 * the union types in `types/index.ts`, so a value can never appear in a picker
 * without also being accepted by the API.
 *
 * If you change a list here, change it in the backend constants file too.
 */

export const BREEDS = [
  'Holstein',
  'Jersey',
  'Angus',
  'Hereford',
  'Brahman',
  'Simmental',
  'Charolais',
  'Limousin',
  'Guernsey',
  'Ankole',
  'Other',
] as const;

export const GENDERS = ['Male', 'Female'] as const;

export const HEALTH_STATUSES = [
  'Healthy',
  'Sick',
  'Injured',
  'Pregnant',
  'Recovering',
] as const;

export const CATTLE_STATUSES = [
  'Active',
  'Sold',
  'Deceased',
  'Quarantined',
] as const;

export const FEED_TYPES = [
  'Hay',
  'Corn Silage',
  'Barley',
  'Wheat',
  'Alfalfa',
  'Grass Pellets',
  'Protein Supplement',
  'Concentrates',
  'Other',
] as const;

export const EXPENSE_CATEGORIES = [
  'Concentrates',
  'Protein',
  'Medical',
  'Salary - Manager',
  'Salary - Workers',
  'Cattle Tax',
  'Insurance',
  'Bedding',
  'Other Operations',
] as const;

/**
 * Milk income is derived from production × farm price, so it is never entered
 * manually. Only non-milk income uses these sources.
 */
export const REVENUE_SOURCES = [
  'Cattle Sale',
  'Breeding Services',
  'Manure Sales',
  'Other',
] as const;

export const CATTLE_LOCATIONS = [
  'Barn A',
  'Barn B',
  'Pasture 1',
  'Pasture 2',
  'Quarantine Area',
  'Other',
] as const;

export const LIMITS = {
  TAG_NUMBER_MIN: 3,
  TAG_NUMBER_MAX: 20,
  NAME_MAX: 100,
  DESCRIPTION_MAX: 200,
  MILK_QUANTITY_MAX: 100,
  QUALITY_SCORE_MIN: 1,
  QUALITY_SCORE_MAX: 10,
} as const;

export const DEFAULTS = {
  MILK_PRICE_PER_LITER: 1700,
  CURRENCY: 'BIF',
} as const;

// ─── Derived union types ─────────────────────────────────────────────────────

export type Breed = (typeof BREEDS)[number];
export type Gender = (typeof GENDERS)[number];
export type HealthStatus = (typeof HEALTH_STATUSES)[number];
export type CattleStatus = (typeof CATTLE_STATUSES)[number];
export type FeedType = (typeof FEED_TYPES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type RevenueSource = (typeof REVENUE_SOURCES)[number];
export type CattleLocation = (typeof CATTLE_LOCATIONS)[number];
