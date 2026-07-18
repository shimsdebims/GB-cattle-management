import axios from 'axios';
import { 
  Cattle, 
  MilkProduction, 
  Feeding, 
  Expense, 
  Revenue, 
  MilkSummary, 
  FinancialSummary,
  ChartData 
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Cattle API
export const cattleAPI = {
  getAll: () => api.get<Cattle[]>('/cattle'),
  getById: (id: number) => api.get<Cattle>(`/cattle/${id}`),
  create: (data: Partial<Cattle>) => api.post<Cattle>('/cattle', data),
  update: (id: number, data: Partial<Cattle>) => api.put<Cattle>(`/cattle/${id}`, data),
  delete: (id: number) => api.delete(`/cattle/${id}`),
};

// Milk Production API
export const milkAPI = {
  getAll: (params?: { cattle_id?: number; start_date?: string; end_date?: string }) => 
    api.get<MilkProduction[]>('/milk', { params }),
  getById: (id: number) => api.get<MilkProduction>(`/milk/${id}`),
  create: (data: Partial<MilkProduction>) => api.post<MilkProduction>('/milk', data),
  update: (id: number, data: Partial<MilkProduction>) => api.put<MilkProduction>(`/milk/${id}`, data),
  delete: (id: number) => api.delete(`/milk/${id}`),
  getSummary: (params?: { cattle_id?: number; days?: number }) => 
    api.get<MilkSummary[]>('/milk/summary', { params }),
};

// Feeding API
export const feedingAPI = {
  getAll: (params?: { cattle_id?: number; start_date?: string; end_date?: string }) => 
    api.get<Feeding[]>('/feeding', { params }),
  create: (data: Partial<Feeding>) => api.post<Feeding>('/feeding', data),
  update: (id: number, data: Partial<Feeding>) => api.put<Feeding>(`/feeding/${id}`, data),
  delete: (id: number) => api.delete(`/feeding/${id}`),
};

// Financial API
export const financialAPI = {
  getExpenses: (params?: { start_date?: string; end_date?: string }) => 
    api.get<Expense[]>('/financial/expenses', { params }),
  getRevenue: (params?: { start_date?: string; end_date?: string }) => 
    api.get<Revenue[]>('/financial/revenue', { params }),
  createExpense: (data: Partial<Expense>) => api.post<Expense>('/financial/expenses', data),
  createRevenue: (data: Partial<Revenue>) => api.post<Revenue>('/financial/revenue', data),
  getSummary: (params?: { start_date?: string; end_date?: string }) => 
    api.get<FinancialSummary>('/financial/summary', { params }),
};

// Analytics API
export const analyticsAPI = {
  getMilkProductionChart: (params?: { cattle_id?: number; days?: number; chart_type?: string }) => 
    api.get<ChartData>('/analytics/milk-production-chart', { params }),
  getCattleComparison: (params?: { days?: number }) => 
    api.get<ChartData>('/analytics/cattle-comparison', { params }),
  getFinancialOverview: (params?: { days?: number }) => 
    api.get<ChartData>('/analytics/financial-overview', { params }),
  getFeedingCostAnalysis: (params?: { cattle_id?: number; days?: number }) => 
    api.get<ChartData>('/analytics/feeding-cost-analysis', { params }),
};

export default api;
