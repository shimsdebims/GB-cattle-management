import axios, { AxiosError, AxiosRequestConfig } from 'axios';

import { API_BASE_URL, API_TIMEOUT_MS } from './apiConfig';
import { clearSession, getToken, type AuthUser } from './authStore';
import type {
  Cattle,
  CattleFormData,
  CattleSummary,
  DashboardSummary,
  Expense,
  ExpenseFormData,
  FarmSettings,
  Feeding,
  FeedingFormData,
  FieldError,
  FinancialSummary,
  MilkPriceEntry,
  MilkFormData,
  MilkProduction,
  MonthlyGrid,
  MonthlyIncome,
  Paged,
  Pagination,
  Revenue,
  RevenueFormData,
  SaleFormData,
} from '../types';

// ─── Envelope ────────────────────────────────────────────────────────────────

interface Envelope<T> {
  success: boolean;
  data: T;
  pagination?: Pagination;
  message?: string;
  error?: string;
  code?: string;
  errors?: FieldError[];
}

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: API_TIMEOUT_MS,
});

// A key baked into the app bundle is public, so auth is a per-user session token.
client.interceptors.request.use((config) => {
  const token = getToken();
  if (token && !config.headers?.Authorization) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// An expired or revoked session sends the user back to the login screen.
client.interceptors.response.use(undefined, (error: AxiosError<{ code?: string }>) => {
  if (error.response?.status === 401 && error.response.data?.code === 'AUTH_REQUIRED') {
    void clearSession();
  }
  return Promise.reject(error);
});

/**
 * A normalized error the UI can present directly.
 *
 * The API returns field-level validation details; surfacing them beats a
 * generic "Failed to save" alert.
 */
export class ApiError extends Error {
  status: number;
  fieldErrors: FieldError[];
  isNetworkError: boolean;

  /** Machine-readable reason from the API, e.g. CATTLE_HAS_HISTORY. */
  code?: string;

  /** Extra payload on some errors, e.g. the record a 409 clashed with. */
  data?: unknown;

  constructor(
    message: string,
    {
      status = 0,
      fieldErrors = [],
      isNetworkError = false,
      code,
      data,
    }: {
      status?: number;
      fieldErrors?: FieldError[];
      isNetworkError?: boolean;
      code?: string;
      data?: unknown;
    } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.isNetworkError = isNetworkError;
    this.code = code;
    this.data = data;
  }

  /** Single string suitable for an Alert body. */
  get displayMessage(): string {
    if (this.fieldErrors.length > 0) {
      return this.fieldErrors.map((e) => `• ${e.message}`).join('\n');
    }
    return this.message;
  }
}

function toApiError(error: unknown): ApiError {
  const axiosError = error as AxiosError<Envelope<unknown>>;

  if (axiosError?.isAxiosError && !axiosError.response) {
    return new ApiError(
      'Cannot reach the server. Check that the backend is running and you are on the same network.',
      { isNetworkError: true }
    );
  }

  const response = axiosError?.response;
  const body = response?.data;

  return new ApiError(body?.message || body?.error || 'Something went wrong.', {
    status: response?.status ?? 0,
    fieldErrors: body?.errors ?? [],
    code: body?.code,
    data: body?.data,
  });
}

/** Unwraps `{ success, data }` and normalizes failures into ApiError. */
async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await client.request<Envelope<T>>(config);
    return response.data.data;
  } catch (error) {
    throw toApiError(error);
  }
}

/** Unwraps a list response into `{ items, pagination }`. */
async function requestList<T>(config: AxiosRequestConfig): Promise<Paged<T>> {
  try {
    const response = await client.request<Envelope<T[]>>(config);
    return {
      items: response.data.data ?? [],
      pagination:
        response.data.pagination ??
        {
          total: response.data.data?.length ?? 0,
          page: 1,
          limit: response.data.data?.length ?? 0,
          pages: 1,
          has_next: false,
          has_previous: false,
        },
    };
  } catch (error) {
    throw toApiError(error);
  }
}

// ─── Query param types ───────────────────────────────────────────────────────

interface DateRangeParams {
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

export const authAPI = {
  login: (username: string, password: string) =>
    request<{ token: string; user: AuthUser }>({
      method: 'POST',
      url: '/auth/login',
      data: { username, password },
    }),

  /** `auth_required: false` means the server has login switched off. */
  me: () => request<{ user: AuthUser | null; auth_required: boolean }>({ method: 'GET', url: '/auth/me' }),

  changePassword: (current_password: string, new_password: string) =>
    request<{ token: string; user: AuthUser }>({
      method: 'POST',
      url: '/auth/change-password',
      data: { current_password, new_password },
    }),
};

export const cattleAPI = {
  list: (params?: {
    status?: string;
    health?: string;
    breed?: string;
    search?: string;
    /** exclude = working herd, only = sold/deceased archive */
    archived?: 'include' | 'exclude' | 'only';
    page?: number;
    limit?: number;
  }) => requestList<Cattle>({ method: 'GET', url: '/cattle', params }),

  sell: (id: string, data: SaleFormData) =>
    request<{ cattle: Cattle; revenue: Revenue }>({ method: 'POST', url: `/cattle/${id}/sell`, data }),

  undoSale: (id: string) =>
    request<{ cattle: Cattle }>({ method: 'DELETE', url: `/cattle/${id}/sale` }),

  get: (id: string) => request<Cattle>({ method: 'GET', url: `/cattle/${id}` }),

  summary: (id: string) =>
    request<CattleSummary>({ method: 'GET', url: `/cattle/${id}/summary` }),

  create: (data: CattleFormData) =>
    request<Cattle>({ method: 'POST', url: '/cattle', data }),

  update: (id: string, data: Partial<CattleFormData>) =>
    request<Cattle>({ method: 'PUT', url: `/cattle/${id}`, data }),

  remove: (id: string) =>
    request<{ _id: string }>({ method: 'DELETE', url: `/cattle/${id}` }),
};

export const milkAPI = {
  list: (params?: DateRangeParams & { cattle_id?: string }) =>
    requestList<MilkProduction>({ method: 'GET', url: '/milk', params }),

  create: (data: MilkFormData) =>
    request<MilkProduction>({ method: 'POST', url: '/milk', data }),

  update: (id: string, data: Partial<MilkFormData>) =>
    request<MilkProduction>({ method: 'PUT', url: `/milk/${id}`, data }),

  remove: (id: string) =>
    request<{ _id: string }>({ method: 'DELETE', url: `/milk/${id}` }),

  monthlyGrid: (month: string) =>
    request<MonthlyGrid>({ method: 'GET', url: '/milk/monthly-grid', params: { month } }),
};

export const feedingAPI = {
  list: (params?: DateRangeParams & { cattle_id?: string; feed_type?: string }) =>
    requestList<Feeding>({ method: 'GET', url: '/feeding', params }),

  create: (data: FeedingFormData) =>
    request<Feeding>({ method: 'POST', url: '/feeding', data }),

  update: (id: string, data: Partial<FeedingFormData>) =>
    request<Feeding>({ method: 'PUT', url: `/feeding/${id}`, data }),

  remove: (id: string) =>
    request<{ _id: string }>({ method: 'DELETE', url: `/feeding/${id}` }),
};

export const financialAPI = {
  listExpenses: (params?: DateRangeParams & { category?: string }) =>
    requestList<Expense>({ method: 'GET', url: '/financial/expenses', params }),

  createExpense: (data: ExpenseFormData) =>
    request<Expense>({ method: 'POST', url: '/financial/expenses', data }),

  updateExpense: (id: string, data: Partial<ExpenseFormData>) =>
    request<Expense>({ method: 'PUT', url: `/financial/expenses/${id}`, data }),

  removeExpense: (id: string) =>
    request<{ _id: string }>({ method: 'DELETE', url: `/financial/expenses/${id}` }),

  listRevenue: (params?: DateRangeParams & { source?: string }) =>
    requestList<Revenue>({ method: 'GET', url: '/financial/revenue', params }),

  createRevenue: (data: RevenueFormData) =>
    request<Revenue>({ method: 'POST', url: '/financial/revenue', data }),

  updateRevenue: (id: string, data: Partial<RevenueFormData>) =>
    request<Revenue>({ method: 'PUT', url: `/financial/revenue/${id}`, data }),

  removeRevenue: (id: string) =>
    request<{ _id: string }>({ method: 'DELETE', url: `/financial/revenue/${id}` }),

  summary: (params?: DateRangeParams & { days?: number }) =>
    request<FinancialSummary>({ method: 'GET', url: '/financial/summary', params }),
};

export const analyticsAPI = {
  dashboard: (params?: { days?: number }) =>
    request<DashboardSummary>({ method: 'GET', url: '/analytics/dashboard', params }),

  monthlyIncome: (month: string) =>
    request<MonthlyIncome>({
      method: 'GET',
      url: '/analytics/monthly-income',
      params: { month },
    }),
};

export const settingsAPI = {
  get: () => request<FarmSettings>({ method: 'GET', url: '/settings' }),

  /** `effective_from` (YYYY-MM-DD) schedules the price from that day; default today. */
  update: (data: { milk_price_per_liter?: number; currency?: string; effective_from?: string }) =>
    request<FarmSettings>({ method: 'PUT', url: '/settings', data }),

  milkPrices: () => request<MilkPriceEntry[]>({ method: 'GET', url: '/settings/milk-prices' }),

  deleteMilkPrice: (id: string) =>
    request<{ _id: string }>({ method: 'DELETE', url: `/settings/milk-prices/${id}` }),
};

export const healthAPI = {
  /** Resolves false instead of throwing — used for connectivity probes. */
  check: async (): Promise<boolean> => {
    try {
      await client.get('/health', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  },
};

export { API_BASE_URL };
export default client;
