import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useOfflineAPI } from '../hooks/useOfflineAPI';

/**
 * Compact connectivity / queue indicator.
 * Tapping it retries the queue when there is something to send.
 */
const SyncStatus = () => {
  const { isOnline, isSyncing, pendingCount, failedCount, forceSync } = useOfflineAPI();

  const status = (() => {
    if (isSyncing) return { color: '#2196F3', icon: 'sync' as const, label: 'Syncing…' };
    if (!isOnline) {
      return {
        color: '#FF5722',
        icon: 'cloud-off' as const,
        label: pendingCount > 0 ? `Offline · ${pendingCount}` : 'Offline',
      };
    }
    if (failedCount > 0) {
      return {
        color: '#F44336',
        icon: 'error-outline' as const,
        label: `${failedCount} failed`,
      };
    }
    if (pendingCount > 0) {
      return {
        color: '#FF9800',
        icon: 'cloud-upload' as const,
        label: `${pendingCount} pending`,
      };
    }
    return { color: '#4CAF50', icon: 'cloud-done' as const, label: 'Synced' };
  })();

  const canRetry = isOnline && !isSyncing && (pendingCount > 0 || failedCount > 0);

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: status.color }]}
      onPress={canRetry ? forceSync : undefined}
      disabled={!canRetry}
      accessibilityRole="button"
      accessibilityLabel={`Sync status: ${status.label}`}
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <MaterialIcons name={status.icon} size={16} color="#FFFFFF" />
      )}
      <Text style={styles.text}>{status.label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default SyncStatus;
