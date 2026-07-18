import { useState, useEffect } from 'react';
import { offlineAPI } from '../services/offlineApi';
import { Cattle, MilkProduction, Feeding, Expense, CattleFormData } from '../types';

export const useOfflineAPI = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState({ pendingCount: 0, lastSync: null as Date | null });

  useEffect(() => {
    updateSyncStatus();
  }, []);

  const updateSyncStatus = async () => {
    const status = await offlineAPI.getSyncStatus();
    setSyncStatus(status);
  };

  const forceSync = async () => {
    await offlineAPI.forceSync();
    await updateSyncStatus();
  };

  return {
    isOnline,
    syncStatus,
    forceSync,
    updateSyncStatus,
    
    // Cattle methods
    getCattle: () => offlineAPI.getCattle(),
    createCattle: (data: CattleFormData) => offlineAPI.createCattle(data),
    updateCattle: (id: string, data: Partial<CattleFormData>) => offlineAPI.updateCattle(id, data),
    deleteCattle: (id: string) => offlineAPI.deleteCattle(id),
    
    // Milk methods
    getMilkProduction: () => offlineAPI.getMilkProduction(),
    createMilkProduction: (data: Partial<MilkProduction>) => offlineAPI.createMilkProduction(data),
    
    // Feeding methods
    getFeeding: () => offlineAPI.getFeeding(),
    createFeeding: (data: Partial<Feeding>) => offlineAPI.createFeeding(data),
    
    // Financial methods
    getExpenses: () => offlineAPI.getExpenses(),
    createExpense: (data: Partial<Expense>) => offlineAPI.createExpense(data),
  };
};

export default useOfflineAPI;
