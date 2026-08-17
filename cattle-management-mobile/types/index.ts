import type {
  Breed,
  CattleStatus,
  ExpenseCategory,
  FeedType,
  Gender,
  HealthStatus,
  RevenueSource,
} from './domain';

export * from './domain';

// ─── API envelope ────────────────────────────────────────────────────────────

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
  has_next: boolean;
  has_previous: boolean;
}

/** Result of a list endpoint, already unwrapped by the API layer. */
export interface Paged<T> {
  items: T[];
  pagination: Pagination;
}

export interface FieldError {
  field: string;
  message: string;
}

// ─── Records ─────────────────────────────────────────────────────────────────

interface Timestamped {
  created_at: string;
  updated_at: string;
}

export interface Cattle extends Timestamped {
  _id: string;
  tag_number: string;
  name: string;
  breed: Breed;
  date_of_birth: string;
  gender: Gender;
  weight?: number;
  health_status: HealthStatus;
  location?: string;
  purchase_date?: string;
  purchase_price?: number;
  current_status: CattleStatus;
  notes?: string;
  /** Virtual supplied by the API. */
  age_in_months?: number;
}

/**
 * `cattle_id` is a plain id on write, but list endpoints populate it with a
 * summary object. Screens should use `resolveCattleRef` rather than assuming.
 */
export type CattleRef =
  | string
  | { _id: string; tag_number: string; name: string; breed?: Breed };

export interface MilkProduction extends Timestamped {
  _id: string;
  cattle_id: CattleRef;
  date_recorded: string;
  quantity_liters: number;
  quality_score?: number;
  notes?: string;
}

export interface Feeding extends Timestamped {
  _id: string;
  cattle_id: CattleRef;
  date_recorded: string;
  feed_type: FeedType;
  quantity_kg: number;
  cost_per_unit?: number;
  total_cost?: number;
  supplier?: string;
  notes?: string;
}

export interface Expense extends Timestamped {
  _id: string;
  date_recorded: string;
  category: ExpenseCategory;
  description: string;
  quantity?: number;
  cost_per_unit?: number;
  amount: number;
  supplier?: string;
  receipt_number?: string;
  notes?: string;
}

export interface Revenue extends Timestamped {
  _id: string;
  date_recorded: string;
  source: RevenueSource;
  description: string;
  amount: number;
  notes?: string;
}

export interface FarmSettings extends Timestamped {
  _id: string;
  milk_price_per_liter: number;
  currency: string;
}

// ─── Form payloads ───────────────────────────────────────────────────────────

export interface CattleFormData {
  tag_number: string;
  name: string;
  breed: Breed;
  date_of_birth: string;
  gender: Gender;
  weight?: number;
  health_status: HealthStatus;
  location?: string;
  purchase_date?: string;
  purchase_price?: number;
  current_status: CattleStatus;
  notes?: string;
}

export interface MilkFormData {
  cattle_id: string;
  date_recorded: string;
  quantity_liters: number;
  quality_score?: number;
  notes?: string;
}

export interface FeedingFormData {
  cattle_id: string;
  date_recorded: string;
  feed_type: FeedType;
  quantity_kg: number;
  cost_per_unit?: number;
  supplier?: string;
  notes?: string;
}

export interface ExpenseFormData {
  date_recorded: string;
  category: ExpenseCategory;
  description: string;
  quantity?: number;
  cost_per_unit?: number;
  amount?: number;
  supplier?: string;
  receipt_number?: string;
  notes?: string;
}

export interface RevenueFormData {
  date_recorded: string;
  source: RevenueSource;
  description: string;
  amount: number;
  notes?: string;
}

// ─── Aggregate responses ─────────────────────────────────────────────────────

export interface DashboardSummary {
  cattle: {
    total_cattle: number;
    active_cattle: number;
    healthy_cattle: number;
    pregnant_cattle: number;
  };
  milk_production: {
    total_liters: number;
    average_quality: number;
    production_records: number;
    average_daily_liters: number;
    recording_days: number;
  };
  financial: {
    milk_revenue: number;
    other_revenue: number;
    total_revenue: number;
    total_expenses: number;
    net_profit: number;
    milk_price_per_liter: number;
    currency: string;
  };
  feeding: {
    total_feed_cost: number;
    total_feed_quantity: number;
  };
  period_days: number;
}

export interface CattleSummary {
  cattle: Cattle;
  summary: {
    milk_production: {
      total_liters_30_days: number;
      average_daily_liters: number;
      average_quality: number;
      record_count: number;
    };
    feeding: {
      total_cost_7_days: number;
      total_quantity_kg_7_days: number;
      record_count: number;
    };
  };
  recent_milk_records: MilkProduction[];
  recent_feeding_records: Feeding[];
}

export interface MonthlyGridCow {
  cattle_id: string;
  name: string;
  tag: string;
  /** Length equals days_in_month. */
  daily: number[];
  total: number;
  average: number;
}

export interface MonthlyGrid {
  month: string;
  days_in_month: number;
  cows: MonthlyGridCow[];
  daily_totals: number[];
  grand_total: number;
}

export interface MonthlyIncomeCow {
  cattle_id: string;
  name: string;
  tag: string;
  total_liters: number;
  income: number;
  record_count: number;
}

export interface MonthlyIncome {
  month: string;
  milk_price_per_liter: number;
  currency: string;
  cows: MonthlyIncomeCow[];
  total_liters: number;
  total_income: number;
  average_per_head: number;
}

export interface FinancialSummary {
  summary: {
    total_revenue: number;
    total_expenses: number;
    net_profit: number;
    revenue_count: number;
    expense_count: number;
  };
  expense_by_category: Array<{ _id: string; total_amount: number; count: number }>;
  revenue_by_source: Array<{ _id: string; total_amount: number; count: number }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalizes a possibly-populated cattle reference to its id. */
export function cattleIdOf(ref: CattleRef): string {
  return typeof ref === 'string' ? ref : ref._id;
}

/** Display label for a possibly-populated cattle reference. */
export function cattleLabelOf(ref: CattleRef, fallback = 'Unknown'): string {
  if (typeof ref === 'string') return fallback;
  return `${ref.tag_number} — ${ref.name}`;
}
