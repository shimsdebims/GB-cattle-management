import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  Cattle, 
  MilkProduction, 
  Feeding, 
  Expense, 
  Revenue, 
  MilkSummary, 
  FinancialSummary,
  CattleFormData 
} from '../types';

// You'll need to replace this with your actual backend URL when deployed
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3001/api'  // MongoDB backend for development
  : 'https://your-deployed-backend.herokuapp.com/api';  // For production

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Add request interceptor for authentication if needed
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Cattle API
export const cattleAPI = {
  getAll: () => api.get<{data: Cattle[], pagination: any}>('/cattle'),
  getById: (id: string) => api.get<Cattle>(`/cattle/${id}`),
  create: (data: CattleFormData) => api.post<Cattle>('/cattle', data),
  update: (id: string, data: Partial<CattleFormData>) => api.put<Cattle>(`/cattle/${id}`, data),
  delete: (id: string) => api.delete(`/cattle/${id}`),
};

// Milk Production API
export const milkAPI = {
  getAll: (params?: { cattle_id?: string; date_from?: string; date_to?: string }) => 
    api.get<{data: MilkProduction[], pagination: any}>('/milk', { params }),
  getById: (id: string) => api.get<MilkProduction>(`/milk/${id}`),
  create: (data: Partial<MilkProduction>) => api.post<MilkProduction>('/milk', data),
  update: (id: string, data: Partial<MilkProduction>) => api.put<MilkProduction>(`/milk/${id}`, data),
  delete: (id: string) => api.delete(`/milk/${id}`),
  getSummary: (params?: { cattle_id?: string; days?: number }) => 
    api.get<any>('/milk/summary/stats', { params }),
};

// Feeding API
export const feedingAPI = {
  getAll: (params?: { cattle_id?: string; date_from?: string; date_to?: string }) => 
    api.get<{data: Feeding[], pagination: any}>('/feeding', { params }),
  create: (data: Partial<Feeding>) => api.post<Feeding>('/feeding', data),
  update: (id: string, data: Partial<Feeding>) => api.put<Feeding>(`/feeding/${id}`, data),
  delete: (id: string) => api.delete(`/feeding/${id}`),
  getSummary: (params?: { days?: number }) => 
    api.get<any>('/feeding/summary/stats', { params }),
};

// Financial API
export const financialAPI = {
  getExpenses: (params?: { date_from?: string; date_to?: string }) => 
    api.get<{data: Expense[], pagination: any}>('/financial/expenses', { params }),
  getRevenue: (params?: { date_from?: string; date_to?: string }) => 
    api.get<{data: Revenue[], pagination: any}>('/financial/revenue', { params }),
  createExpense: (data: Partial<Expense>) => api.post<Expense>('/financial/expenses', data),
  createRevenue: (data: Partial<Revenue>) => api.post<Revenue>('/financial/revenue', data),
  updateExpense: (id: string, data: Partial<Expense>) => api.put<Expense>(`/financial/expenses/${id}`, data),
  updateRevenue: (id: string, data: Partial<Revenue>) => api.put<Revenue>(`/financial/revenue/${id}`, data),
  deleteExpense: (id: string) => api.delete(`/financial/expenses/${id}`),
  deleteRevenue: (id: string) => api.delete(`/financial/revenue/${id}`),
  getSummary: (params?: { days?: number }) => 
    api.get<any>('/financial/summary', { params }),
};

// Analytics API
export const analyticsAPI = {
  getDashboard: (params?: { days?: number }) => 
    api.get<any>('/analytics/dashboard', { params }),
  getMilkTrends: (params?: { days?: number; cattle_id?: string }) => 
    api.get<any>('/analytics/milk-production-trends', { params }),
  getFeedingAnalysis: (params?: { days?: number }) => 
    api.get<any>('/analytics/feeding-analysis', { params }),
};

// Health check
export const healthAPI = {
  check: () => api.get('/health'),
};

export default api;
