import axios, { AxiosError } from 'axios';
import {
  Cattle,
  MilkProduction,
  Feeding,
  Expense,
  Revenue,
  DashboardSummary,
  MilkTrends,
  FinancialSummary,
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://gb-cattle-management.onrender.com/api';
const API_KEY = process.env.REACT_APP_API_KEY;

// The API paginates lists (default 50). A farm herd and a few months of records
// fit comfortably under the server maximum, so ask for the full page.
const LIST_LIMIT = 200;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Render's free tier cold-starts in ~30-50s; don't give up before it wakes.
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  if (API_KEY && !config.headers?.Authorization) {
    const headers = config.headers ?? {};

    config.headers = {
      ...headers,
      Authorization: `Bearer ${API_KEY}`,
    } as typeof headers;
  }

  return config;
});

/**
 * The Express API wraps every response as { success, data, pagination?, timestamp }.
 * Unwrap it here so pages can keep reading `response.data` as the payload itself
 * (e.g. an array of cattle) instead of every call site dealing with the envelope.
 */
api.interceptors.response.use((response) => {
  const body = response.data;
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    response.data = body.data;
  }
  return response;
});

interface ApiErrorBody {
  message?: string;
  error?: string;
  errors?: { field: string; message: string }[];
}

/** Human-readable message for an alert/snackbar, including field validation errors. */
export function describeApiError(error: unknown, fallback = 'Something went wrong.'): string {
  const axiosError = error as AxiosError<ApiErrorBody>;

  if (axiosError?.isAxiosError && !axiosError.response) {
    if (axiosError.code === 'ECONNABORTED') {
      return 'The server took too long to respond. It may be waking up — please try again.';
    }
    return 'Cannot reach the server. Check your internet connection and try again.';
  }

  const body = axiosError?.response?.data;
  if (body?.errors?.length) {
    return body.errors.map((e) => e.message).join(' · ');
  }
  return body?.message || body?.error || axiosError?.message || fallback;
}

// Cattle API
export const cattleAPI = {
  getAll: () => api.get<Cattle[]>('/cattle', { params: { limit: LIST_LIMIT } }),
  getById: (id: string) => api.get<Cattle>(`/cattle/${id}`),
  create: (data: Partial<Cattle>) => api.post<Cattle>('/cattle', data),
  update: (id: string, data: Partial<Cattle>) => api.put<Cattle>(`/cattle/${id}`, data),
  delete: (id: string) => api.delete(`/cattle/${id}`),
};

// Milk Production API
export const milkAPI = {
  getAll: (params?: { cattle_id?: string; date_from?: string; date_to?: string }) =>
    api.get<MilkProduction[]>('/milk', { params: { limit: LIST_LIMIT, ...params } }),
  getById: (id: string) => api.get<MilkProduction>(`/milk/${id}`),
  create: (data: Record<string, unknown>) => api.post<MilkProduction>('/milk', data),
  update: (id: string, data: Record<string, unknown>) => api.put<MilkProduction>(`/milk/${id}`, data),
  delete: (id: string) => api.delete(`/milk/${id}`),
};

// Feeding API
export const feedingAPI = {
  getAll: (params?: { cattle_id?: string; date_from?: string; date_to?: string }) =>
    api.get<Feeding[]>('/feeding', { params: { limit: LIST_LIMIT, ...params } }),
  create: (data: Partial<Feeding>) => api.post<Feeding>('/feeding', data),
  update: (id: string, data: Partial<Feeding>) => api.put<Feeding>(`/feeding/${id}`, data),
  delete: (id: string) => api.delete(`/feeding/${id}`),
};

// Financial API
export const financialAPI = {
  getExpenses: (params?: { date_from?: string; date_to?: string }) =>
    api.get<Expense[]>('/financial/expenses', { params: { limit: LIST_LIMIT, ...params } }),
  getRevenue: (params?: { date_from?: string; date_to?: string }) =>
    api.get<Revenue[]>('/financial/revenue', { params: { limit: LIST_LIMIT, ...params } }),
  createExpense: (data: Partial<Expense>) => api.post<Expense>('/financial/expenses', data),
  createRevenue: (data: Partial<Revenue>) => api.post<Revenue>('/financial/revenue', data),
  getSummary: (params?: { date_from?: string; date_to?: string; days?: number }) =>
    api.get<FinancialSummary>('/financial/summary', { params }),
};

// Analytics API (endpoints served by the Express API)
export const analyticsAPI = {
  dashboard: (params?: { days?: number }) =>
    api.get<DashboardSummary>('/analytics/dashboard', { params }),
  milkTrends: (params?: { days?: number; cattle_id?: string }) =>
    api.get<MilkTrends>('/analytics/milk-production-trends', { params }),
};

export default api;
