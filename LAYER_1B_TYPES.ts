/**
 * LAYER 1B: TypeScript Interfaces & Types
 * 
 * These interfaces are the source of truth for all data across the entire app.
 * Used in: Backend models, Frontend components, API requests/responses, local storage
 * 
 * Keep these synchronized with LAYER_1_DATA_MODEL.md
 */

// ============================================================================
// 1. CATTLE (Animal Records)
// ============================================================================

export enum CattleStatus {
  Active = 'Active',
  Sold = 'Sold',
  Deceased = 'Deceased',
}

export enum HealthStatus {
  Healthy = 'Healthy',
  Sick = 'Sick',
  Resting = 'Resting',
}

export interface Cattle {
  // Identity
  _id?: string; // MongoDB ObjectId (optional on client before sync)
  tag_number: string; // Unique: "COW-001"
  name: string; // "Cow A"
  
  // Basic Info
  breed: string; // "Friesian", "Jersey"
  gender: 'Male' | 'Female';
  date_of_birth: Date | string; // ISO string or Date object
  
  // Status
  status: CattleStatus;
  health_status?: HealthStatus;
  
  // Metadata
  notes?: string;
  created_at: Date | string;
  updated_at: Date | string;
  
  // Sync Fields (internal use)
  _synced_at?: Date | string;
  _local_only?: boolean;
}

// For API responses
export interface CattleDTO extends Cattle {
  _id: string; // Always populated from DB
}

// ============================================================================
// 2. MILK PRODUCTION (Daily Records)
// ============================================================================

export interface MilkProduction {
  // Identity
  _id?: string;
  cattle_id: string; // Reference to Cattle._id
  cattle_tag: string; // Denormalized for offline queries: "COW-001"
  
  // Production Data
  date_recorded: Date | string; // Date only (not datetime)
  quantity_liters: number; // 0-50
  quality_score?: number; // 1-5 (optional MVP)
  
  // Metadata
  notes?: string;
  created_at: Date | string;
  updated_at: Date | string;
  
  // Sync Fields
  _synced_at?: Date | string;
  _local_only?: boolean;
}

export interface MilkProductionDTO extends MilkProduction {
  _id: string;
}

// Aggregated data for displays
export interface DailyMilkSummary {
  date: Date | string;
  total_liters: number;
  records: MilkProductionDTO[];
  average_per_cow: number;
  number_of_cows: number;
}

export interface MonthlMilkSummary {
  year_month: string; // "2024-07"
  total_liters: number;
  average_per_cow: number;
  records_by_cow: {
    [cattle_tag: string]: {
      total: number;
      average: number;
      count: number;
    };
  };
  daily_breakdown: DailyMilkSummary[];
}

// ============================================================================
// 3. EXPENSES (Spending Tracker)
// ============================================================================

export enum ExpenseCategory {
  Feed = 'Feed',
  Staff = 'Staff',
  Medical = 'Medical',
  Tax = 'Tax',
  Insurance = 'Insurance',
  Other = 'Other',
}

export interface Expense {
  // Identity
  _id?: string;
  
  // Classification
  category: ExpenseCategory;
  description: string;
  
  // Amount
  amount: number; // In BIF
  currency: 'BIF';
  
  // Date & Tracking
  date_recorded: Date | string;
  supplier?: string;
  receipt_number?: string;
  
  // Metadata
  notes?: string;
  created_at: Date | string;
  updated_at: Date | string;
  
  // Sync Fields
  _synced_at?: Date | string;
  _local_only?: boolean;
}

export interface ExpenseDTO extends Expense {
  _id: string;
}

export interface MonthlyExpenseSummary {
  year_month: string; // "2024-07"
  total: number;
  by_category: {
    [key in ExpenseCategory]?: number;
  };
  records: ExpenseDTO[];
  daily_average: number;
}

// ============================================================================
// 4. REVENUE (Income Tracking)
// ============================================================================

export enum RevenueSource {
  Milk = 'Milk',
  CattleSale = 'Cattle_Sale',
  Subsidy = 'Subsidy',
  Other = 'Other',
}

export interface Revenue {
  // Identity
  _id?: string;
  
  // Classification
  source: RevenueSource;
  description: string;
  
  // Amount
  amount: number; // In BIF
  currency: 'BIF';
  
  // Metadata
  date_recorded: Date | string;
  notes?: string;
  created_at: Date | string;
  updated_at: Date | string;
  
  // Sync Fields
  _synced_at?: Date | string;
  _local_only?: boolean;
}

export interface RevenueDTO extends Revenue {
  _id: string;
}

export interface MonthlyRevenueSummary {
  year_month: string; // "2024-07"
  total: number;
  milk_revenue: number; // Auto-calculated from MilkProduction
  manual_revenue: number; // From manual entries
  by_source: {
    [key in RevenueSource]?: number;
  };
  records: RevenueDTO[];
}

// ============================================================================
// 5. SETTINGS (Farm Configuration)
// ============================================================================

export interface FarmSettings {
  _id?: string;
  
  // Configuration
  farm_name: string;
  farm_id: string;
  
  // Financial
  milk_price_per_liter: number; // 1700 BIF (default)
  currency: 'BIF';
  
  // Metadata
  created_at: Date | string;
  updated_at: Date | string;
  last_sync?: Date | string;
}

export interface FarmSettingsDTO extends FarmSettings {
  _id: string;
}

// ============================================================================
// 6. FINANCIAL SUMMARY (Dashboard Data)
// ============================================================================

export interface FinancialSummary {
  year_month: string; // "2024-07"
  
  // Production
  total_milk_liters: number;
  milk_per_cow_average: number;
  
  // Income
  total_revenue: number;
  milk_revenue: number;
  other_revenue: number;
  
  // Expenses
  total_expenses: number;
  expenses_by_category: {
    [key in ExpenseCategory]?: number;
  };
  
  // Profitability
  gross_profit: number; // revenue - expenses
  profit_per_cow: number;
  profit_margin: number; // profit / revenue * 100
}

// ============================================================================
// 7. SYNC & SYNC METADATA
// ============================================================================

export interface SyncMetadata {
  _id?: string;
  
  device_id: string;
  last_sync: Date | string;
  pending_count: number;
  conflict_strategy: 'client_wins' | 'server_wins' | 'manual';
  queue_size_bytes: number;
  
  created_at: Date | string;
  updated_at: Date | string;
}

export interface SyncMetadataDTO extends SyncMetadata {
  _id: string;
}

// Sync payload (what's sent to server)
export interface SyncPayload {
  device_id: string;
  last_sync?: Date | string;
  changes: {
    cattle?: Cattle[];
    milk_productions?: MilkProduction[];
    expenses?: Expense[];
    revenue?: Revenue[];
  };
}

// Sync response from server
export interface SyncResponse {
  success: boolean;
  timestamp: Date | string;
  synced_count: number;
  server_data?: {
    cattle: CattleDTO[];
    milk_productions: MilkProductionDTO[];
    expenses: ExpenseDTO[];
    revenue: RevenueDTO[];
  };
  errors?: SyncError[];
}

export interface SyncError {
  record_id: string;
  record_type: 'cattle' | 'milk_production' | 'expense' | 'revenue';
  error: string;
  code: string;
}

// ============================================================================
// 8. API REQUEST/RESPONSE TYPES
// ============================================================================

// Generic API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date | string;
}

// Pagination
export interface PaginationParams {
  page: number; // 1-based
  limit: number; // Records per page
  sort?: string; // "-created_at"
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ============================================================================
// 9. DASHBOARD DATA
// ============================================================================

export interface DashboardData {
  date: Date | string; // Current date
  
  // Today's data
  today: {
    milk_total: number;
    milk_records_count: number;
    milk_per_cow: number;
    daily_revenue: number;
    daily_expenses: number;
    daily_profit: number;
  };
  
  // Month to date
  month_to_date: FinancialSummary;
  
  // Quick stats
  stats: {
    active_cattle_count: number;
    sync_status: 'synced' | 'syncing' | 'offline' | 'error';
    last_sync: Date | string;
    pending_changes: number;
  };
}

// ============================================================================
// 10. LOCAL STORAGE SCHEMA (Mobile App)
// ============================================================================

export interface LocalStorageSchema {
  // Data tables
  cattle: Cattle[];
  milk_productions: MilkProduction[];
  expenses: Expense[];
  revenue: Revenue[];
  settings: FarmSettings;
  
  // Sync tracking
  sync_metadata: SyncMetadata;
  sync_queue: {
    pending: SyncPayload[];
    failed: Array<SyncPayload & { error: string; retry_count: number }>;
  };
  
  // Cache
  cache: {
    dashboard_data?: DashboardData;
    last_cache_update?: Date | string;
  };
}

// ============================================================================
// 11. VALIDATION SCHEMAS (Errors)
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  received: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// 12. FORM DATA TYPES (For UI forms)
// ============================================================================

// Used when creating/editing cattle
export interface CattleFormData {
  tag_number: string;
  name: string;
  breed: string;
  gender: 'Male' | 'Female';
  date_of_birth: Date | string;
  status: CattleStatus;
  health_status?: HealthStatus;
  notes?: string;
}

// Used when recording milk
export interface MilkRecordFormData {
  cattle_id: string;
  cattle_tag?: string; // Populated from dropdown
  quantity_liters: number;
  quality_score?: number;
  date_recorded?: Date | string; // Auto-filled with today
  notes?: string;
}

// Used when recording expense
export interface ExpenseFormData {
  category: ExpenseCategory;
  description: string;
  amount: number;
  date_recorded?: Date | string; // Auto-filled with today
  supplier?: string;
  receipt_number?: string;
  notes?: string;
}

// Used when recording manual revenue
export interface RevenueFormData {
  source: RevenueSource;
  description: string;
  amount: number;
  date_recorded?: Date | string; // Auto-filled with today
  notes?: string;
}

// ============================================================================
// END OF TYPES
// ============================================================================

export default {
  // Enums
  CattleStatus,
  HealthStatus,
  ExpenseCategory,
  RevenueSource,
  
  // Interfaces exported for reference
  Cattle,
  MilkProduction,
  Expense,
  Revenue,
  FarmSettings,
  FinancialSummary,
  SyncMetadata,
  DashboardData,
};
