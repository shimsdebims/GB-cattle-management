/**
 * Single source of truth for the farm's domain vocabulary.
 *
 * Every model enum, validator, route and the seeder must import from here.
 * The mobile app mirrors this file at `types/domain.ts` — if you change a list
 * here, change it there too.
 */

const BREEDS = [
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
];

const GENDERS = ['Male', 'Female'];

const HEALTH_STATUSES = ['Healthy', 'Sick', 'Injured', 'Pregnant', 'Recovering'];

const CATTLE_STATUSES = ['Active', 'Sold', 'Deceased', 'Quarantined'];

const FEED_TYPES = [
  'Hay',
  'Corn Silage',
  'Barley',
  'Wheat',
  'Alfalfa',
  'Grass Pellets',
  'Protein Supplement',
  'Concentrates',
  'Other',
];

// Farm-specific expense categories (mirrors the farm's existing bookkeeping).
const EXPENSE_CATEGORIES = [
  'Concentrates',
  'Protein',
  'Medical',
  'Salary - Manager',
  'Salary - Workers',
  'Cattle Tax',
  'Insurance',
  'Bedding',
  'Other Operations',
];

// Milk revenue is derived from production × farm price, so it is NOT a manual
// revenue source. Only non-milk income is entered by hand.
const REVENUE_SOURCES = [
  'Cattle Sale',
  'Breeding Services',
  'Manure Sales',
  'Other',
];

const CATTLE_LOCATIONS = [
  'Barn A',
  'Barn B',
  'Pasture 1',
  'Pasture 2',
  'Quarantine Area',
  'Other',
];

// Numeric bounds shared by schema validation and request validation.
const LIMITS = {
  TAG_NUMBER_MIN: 3,
  TAG_NUMBER_MAX: 20,
  NAME_MAX: 100,
  DESCRIPTION_MAX: 200,
  NOTES_MAX: 1000,
  MILK_QUANTITY_MAX: 100,
  QUALITY_SCORE_MIN: 1,
  QUALITY_SCORE_MAX: 10,
  CATTLE_WEIGHT_MAX: 2000,
  FEED_QUANTITY_MAX: 5000,
  PAGE_SIZE_DEFAULT: 50,
  PAGE_SIZE_MAX: 200,
};

const DEFAULTS = {
  MILK_PRICE_PER_LITER: 1700,
  CURRENCY: 'BIF',
};

module.exports = {
  BREEDS,
  GENDERS,
  HEALTH_STATUSES,
  CATTLE_STATUSES,
  FEED_TYPES,
  EXPENSE_CATEGORIES,
  REVENUE_SOURCES,
  CATTLE_LOCATIONS,
  LIMITS,
  DEFAULTS,
};
