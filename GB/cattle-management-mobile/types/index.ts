export interface Cattle {
  _id: string;
  tag_number: string;
  name: string;
  breed: string;
  date_of_birth: string;
  gender: 'Male' | 'Female';
  weight?: number;
  health_status: string;
  location?: string;
  purchase_date?: string;
  purchase_price?: number;
  current_status: 'Active' | 'Sold' | 'Deceased' | 'Quarantined';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface MilkProduction {
  _id: string;
  cattle_id: string;
  date_recorded: string;
  quantity_liters: number;
  quality_score?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Feeding {
  _id: string;
  cattle_id: string;
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

export interface MilkSummary {
  cattle_id: string;
  cattle_name: string;
  tag_number: string;
  total_liters: number;
  average_daily_liters: number;
  record_count: number;
  period_days: number;
}

export interface FinancialSummary {
  total_expenses: number;
  total_revenue: number;
  net_income: number;
  start_date?: string;
  end_date?: string;
}

export interface CattleFormData {
  tag_number: string;
  name: string;
  breed: string;
  date_of_birth: string;
  gender: 'Male' | 'Female';
  weight?: number;
  health_status: string;
  location?: string;
  purchase_date?: string;
  purchase_price?: number;
  current_status: 'Active' | 'Sold' | 'Deceased' | 'Quarantined';
  notes?: string;
}
