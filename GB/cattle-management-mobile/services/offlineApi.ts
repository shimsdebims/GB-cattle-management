import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { 
  Cattle, 
  MilkProduction, 
  Feeding, 
  Expense, 
  Revenue,
  CattleFormData 
} from '../types';
import { cattleAPI, milkAPI, feedingAPI, financialAPI } from './api';

const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3001/api'  // MongoDB backend for development
  : 'https://your-deployed-backend.herokuapp.com/api';  // Replace with your production URL

// Storage keys
const STORAGE_KEYS = {
  CATTLE: 'offline_cattle',
  MILK: 'offline_milk',
  FEEDING: 'offline_feeding',
  EXPENSES: 'offline_expenses',
  REVENUE: 'offline_revenue',
  PENDING_SYNC: 'pending_sync_operations',
  LAST_SYNC: 'last_sync_timestamp',
};

// Pending operation types
interface PendingOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'cattle' | 'milk' | 'feeding' | 'expense' | 'revenue';
  data: any;
  timestamp: number;
}

class OfflineAPI {
  private isOnline: boolean = true;

  constructor() {
    this.initializeNetworkListener();
  }

  private initializeNetworkListener() {
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected ?? false;
      if (this.isOnline) {
        this.syncPendingOperations();
      }
    });
  }

  // Generic storage methods
  private async getFromStorage<T>(key: string): Promise<T[]> {
    try {
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error(`Error reading from storage (${key}):`, error);
      return [];
    }
  }

  private async saveToStorage<T>(key: string, data: T[]): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Error saving to storage (${key}):`, error);
    }
  }

  private async addPendingOperation(operation: Omit<PendingOperation, 'id' | 'timestamp'>): Promise<void> {
    const pendingOps = await this.getFromStorage<PendingOperation>(STORAGE_KEYS.PENDING_SYNC);
    const newOp: PendingOperation = {
      ...operation,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };
    pendingOps.push(newOp);
    await this.saveToStorage(STORAGE_KEYS.PENDING_SYNC, pendingOps);
  }

  // Cattle methods
  async getCattle(): Promise<Cattle[]> {
    if (this.isOnline) {
      try {
        const response = await cattleAPI.getAll();
        const cattleData = response.data.data || response.data;
        await this.saveToStorage(STORAGE_KEYS.CATTLE, cattleData);
        return cattleData;
      } catch (error) {
        console.log('Online fetch failed, using offline data');
        return await this.getFromStorage<Cattle>(STORAGE_KEYS.CATTLE);
      }
    }
    return await this.getFromStorage<Cattle>(STORAGE_KEYS.CATTLE);
  }

  async createCattle(data: CattleFormData): Promise<Cattle> {
    const tempId = `temp_${Date.now()}`;
    const newCattle: Cattle = {
      _id: tempId,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save locally immediately
    const cattle = await this.getFromStorage<Cattle>(STORAGE_KEYS.CATTLE);
    cattle.unshift(newCattle);
    await this.saveToStorage(STORAGE_KEYS.CATTLE, cattle);

    if (this.isOnline) {
      try {
        const response = await cattleAPI.create(data);
        // Replace temp record with real one
        const updatedCattle = cattle.map(c => c._id === tempId ? response.data : c);
        await this.saveToStorage(STORAGE_KEYS.CATTLE, updatedCattle);
        return response.data;
      } catch (error) {
        // Add to pending operations
        await this.addPendingOperation({
          type: 'CREATE',
          entity: 'cattle',
          data,
        });
      }
    } else {
      await this.addPendingOperation({
        type: 'CREATE',
        entity: 'cattle',
        data,
      });
    }

    return newCattle;
  }

  async updateCattle(id: string, data: Partial<CattleFormData>): Promise<Cattle> {
    // Update locally first
    const cattle = await this.getFromStorage<Cattle>(STORAGE_KEYS.CATTLE);
    const index = cattle.findIndex(c => c._id === id);
    if (index !== -1) {
      cattle[index] = { ...cattle[index], ...data, updated_at: new Date().toISOString() };
      await this.saveToStorage(STORAGE_KEYS.CATTLE, cattle);
    }

    if (this.isOnline) {
      try {
        const response = await cattleAPI.update(id, data);
        return response.data;
      } catch (error) {
        await this.addPendingOperation({
          type: 'UPDATE',
          entity: 'cattle',
          data: { id, ...data },
        });
      }
    } else {
      await this.addPendingOperation({
        type: 'UPDATE',
        entity: 'cattle',
        data: { id, ...data },
      });
    }

    return cattle[index];
  }

  async deleteCattle(id: string): Promise<void> {
    // Remove locally first
    const cattle = await this.getFromStorage<Cattle>(STORAGE_KEYS.CATTLE);
    const filteredCattle = cattle.filter(c => c._id !== id);
    await this.saveToStorage(STORAGE_KEYS.CATTLE, filteredCattle);

    if (this.isOnline) {
      try {
        await cattleAPI.delete(id);
      } catch (error) {
        await this.addPendingOperation({
          type: 'DELETE',
          entity: 'cattle',
          data: { id },
        });
      }
    } else {
      await this.addPendingOperation({
        type: 'DELETE',
        entity: 'cattle',
        data: { id },
      });
    }
  }

  // Milk Production methods
  async getMilkProduction(): Promise<MilkProduction[]> {
    if (this.isOnline) {
      try {
        const response = await milkAPI.getAll();
        const milkData = response.data.data || response.data;
        await this.saveToStorage(STORAGE_KEYS.MILK, milkData);
        return milkData;
      } catch (error) {
        return await this.getFromStorage<MilkProduction>(STORAGE_KEYS.MILK);
      }
    }
    return await this.getFromStorage<MilkProduction>(STORAGE_KEYS.MILK);
  }

  async createMilkProduction(data: Partial<MilkProduction>): Promise<MilkProduction> {
    const tempId = `temp_${Date.now()}`;
    const newMilk: MilkProduction = {
      _id: tempId,
      cattle_id: data.cattle_id!,
      date_recorded: data.date_recorded || new Date().toISOString(),
      quantity_liters: data.quantity_liters || 0,
      quality_score: data.quality_score,
      notes: data.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save locally
    const milk = await this.getFromStorage<MilkProduction>(STORAGE_KEYS.MILK);
    milk.unshift(newMilk);
    await this.saveToStorage(STORAGE_KEYS.MILK, milk);

    if (this.isOnline) {
      try {
        const response = await milkAPI.create(data);
        const updatedMilk = milk.map(m => m._id === tempId ? response.data : m);
        await this.saveToStorage(STORAGE_KEYS.MILK, updatedMilk);
        return response.data;
      } catch (error) {
        await this.addPendingOperation({
          type: 'CREATE',
          entity: 'milk',
          data,
        });
      }
    } else {
      await this.addPendingOperation({
        type: 'CREATE',
        entity: 'milk',
        data,
      });
    }

    return newMilk;
  }

  // Feeding methods
  async getFeeding(): Promise<Feeding[]> {
    if (this.isOnline) {
      try {
        const response = await feedingAPI.getAll();
        const feedingData = response.data.data || response.data;
        await this.saveToStorage(STORAGE_KEYS.FEEDING, feedingData);
        return feedingData;
      } catch (error) {
        return await this.getFromStorage<Feeding>(STORAGE_KEYS.FEEDING);
      }
    }
    return await this.getFromStorage<Feeding>(STORAGE_KEYS.FEEDING);
  }

  async createFeeding(data: Partial<Feeding>): Promise<Feeding> {
    const tempId = `temp_${Date.now()}`;
    const newFeeding: Feeding = {
      _id: tempId,
      cattle_id: data.cattle_id!,
      date_recorded: data.date_recorded || new Date().toISOString(),
      feed_type: data.feed_type || '',
      quantity_kg: data.quantity_kg || 0,
      cost_per_unit: data.cost_per_unit,
      total_cost: data.total_cost,
      supplier: data.supplier,
      notes: data.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save locally
    const feeding = await this.getFromStorage<Feeding>(STORAGE_KEYS.FEEDING);
    feeding.unshift(newFeeding);
    await this.saveToStorage(STORAGE_KEYS.FEEDING, feeding);

    if (this.isOnline) {
      try {
        const response = await feedingAPI.create(data);
        const updatedFeeding = feeding.map(f => f._id === tempId ? response.data : f);
        await this.saveToStorage(STORAGE_KEYS.FEEDING, updatedFeeding);
        return response.data;
      } catch (error) {
        await this.addPendingOperation({
          type: 'CREATE',
          entity: 'feeding',
          data,
        });
      }
    } else {
      await this.addPendingOperation({
        type: 'CREATE',
        entity: 'feeding',
        data,
      });
    }

    return newFeeding;
  }

  // Financial methods
  async getExpenses(): Promise<Expense[]> {
    if (this.isOnline) {
      try {
        const response = await financialAPI.getExpenses();
        const expenseData = response.data.data || response.data;
        await this.saveToStorage(STORAGE_KEYS.EXPENSES, expenseData);
        return expenseData;
      } catch (error) {
        return await this.getFromStorage<Expense>(STORAGE_KEYS.EXPENSES);
      }
    }
    return await this.getFromStorage<Expense>(STORAGE_KEYS.EXPENSES);
  }

  async createExpense(data: Partial<Expense>): Promise<Expense> {
    const tempId = `temp_${Date.now()}`;
    const newExpense: Expense = {
      _id: tempId,
      date_recorded: data.date_recorded || new Date().toISOString(),
      category: data.category || '',
      description: data.description || '',
      amount: data.amount || 0,
      supplier: data.supplier,
      receipt_number: data.receipt_number,
      notes: data.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save locally
    const expenses = await this.getFromStorage<Expense>(STORAGE_KEYS.EXPENSES);
    expenses.unshift(newExpense);
    await this.saveToStorage(STORAGE_KEYS.EXPENSES, expenses);

    if (this.isOnline) {
      try {
        const response = await financialAPI.createExpense(data);
        const updatedExpenses = expenses.map(e => e._id === tempId ? response.data : e);
        await this.saveToStorage(STORAGE_KEYS.EXPENSES, updatedExpenses);
        return response.data;
      } catch (error) {
        await this.addPendingOperation({
          type: 'CREATE',
          entity: 'expense',
          data,
        });
      }
    } else {
      await this.addPendingOperation({
        type: 'CREATE',
        entity: 'expense',
        data,
      });
    }

    return newExpense;
  }

  // Sync pending operations
  async syncPendingOperations(): Promise<void> {
    if (!this.isOnline) return;

    const pendingOps = await this.getFromStorage<PendingOperation>(STORAGE_KEYS.PENDING_SYNC);
    const successfulOps: string[] = [];

    for (const op of pendingOps) {
      try {
        switch (op.entity) {
          case 'cattle':
            if (op.type === 'CREATE') {
              await cattleAPI.create(op.data);
            } else if (op.type === 'UPDATE') {
              await cattleAPI.update(op.data.id, op.data);
            } else if (op.type === 'DELETE') {
              await cattleAPI.delete(op.data.id);
            }
            break;
          case 'milk':
            if (op.type === 'CREATE') {
              await milkAPI.create(op.data);
            }
            break;
          case 'feeding':
            if (op.type === 'CREATE') {
              await feedingAPI.create(op.data);
            }
            break;
          case 'expense':
            if (op.type === 'CREATE') {
              await financialAPI.createExpense(op.data);
            }
            break;
        }
        successfulOps.push(op.id);
      } catch (error) {
        console.error(`Failed to sync operation ${op.id}:`, error);
      }
    }

    // Remove successful operations
    const remainingOps = pendingOps.filter(op => !successfulOps.includes(op.id));
    await this.saveToStorage(STORAGE_KEYS.PENDING_SYNC, remainingOps);

    // Update last sync timestamp
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
  }

  // Get sync status
  async getSyncStatus(): Promise<{ pendingCount: number; lastSync: Date | null }> {
    const pendingOps = await this.getFromStorage<PendingOperation>(STORAGE_KEYS.PENDING_SYNC);
    const lastSyncStr = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    const lastSync = lastSyncStr ? new Date(parseInt(lastSyncStr)) : null;

    return {
      pendingCount: pendingOps.length,
      lastSync,
    };
  }

  // Force sync
  async forceSync(): Promise<void> {
    await this.syncPendingOperations();
    // Refresh all data
    await this.getCattle();
    await this.getMilkProduction();
    await this.getFeeding();
    await this.getExpenses();
  }
}

export const offlineAPI = new OfflineAPI();
export default offlineAPI;
