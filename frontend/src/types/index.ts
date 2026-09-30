// Shapes returned by the Express/Mongoose API (cattle-management-mobile/backend-mongo).
// MongoDB ids are strings (`_id`), and dates arrive as ISO strings.

export interface CattleRef {
  _id: string;
  tag_number: string;
  name: string;
  breed?: string;
}

export interface Cattle {
  _id: string;
  tag_number: string;
  name: string;
  breed: string;
  date_of_birth: string;
  gender: string;
  weight?: number;
  health_status: string;
  location?: string;
  purchase_date?: string;
  purchase_price?: number;
  current_status: string;
  notes?: string;
  age_in_months?: number;
  created_at: string;
  updated_at: string;
}

export interface MilkProduction {
  _id: string;
  /** Populated with the cow's tag/name on list and detail responses. */
  cattle_id: string | CattleRef;
  date_recorded: string;
  quantity_liters: number;
  quality_score?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Feeding {
  _id: string;
  cattle_id: string | CattleRef;
  date_recorded: string;
  feed_type: string;
  quantity_kg: number;
  cost_per_unit?: number;
  total_cost?: number;
  supplier?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  _id: string;
  date_recorded: string;
  category: string;
  description: string;
  quantity?: number;
  cost_per_unit?: number;
  amount: number;
  supplier?: string;
  receipt_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Revenue {
  _id: string;
  date_recorded: string;
  source: string;
  description: string;
  amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/** GET /api/analytics/dashboard */
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
  period_days: number;
}

/** GET /api/analytics/milk-production-trends */
export interface MilkTrends {
  daily_trends: { _id: string; total_quantity: number; record_count: number }[];
  cattle_performance: {
    cattle_id: string;
    tag_number: string;
    name: string;
    total_quantity: number;
    average_quantity: number;
    record_count: number;
  }[];
  period_days: number;
}

/** GET /api/financial/summary (manual revenue only; milk income is derived) */
export interface FinancialSummary {
  summary: {
    total_revenue: number;
    total_expenses: number;
    net_profit: number;
    revenue_count: number;
    expense_count: number;
  };
}

/** Resolve a possibly-populated cattle reference to its id. */
export const cattleIdOf = (ref: string | CattleRef | null | undefined): string =>
  !ref ? '' : typeof ref === 'string' ? ref : ref._id;
