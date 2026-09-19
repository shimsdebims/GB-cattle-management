import { useCallback, useEffect, useState } from 'react';

import { offlineApi } from '../services/offlineApi';
import {
  SyncState,
  getSyncState,
  subscribeToSyncState,
} from '../services/offlineStore';

/**
 * Subscribes to the single shared sync state.
 *
 * Every consumer sees the same values; previously each call site kept its own
 * copy and reported `isOnline: true` unconditionally.
 */
export function useSyncState(): SyncState {
  const [state, setState] = useState<SyncState>(getSyncState);

  useEffect(() => subscribeToSyncState(setState), []);

  return state;
}

/** Offline-aware data access plus live sync status. */
export function useOfflineAPI() {
  const syncState = useSyncState();

  const forceSync = useCallback(async () => {
    await offlineApi.synchronize();
  }, []);

  return {
    ...syncState,
    api: offlineApi,
    forceSync,
  };
}

export default useOfflineAPI;
