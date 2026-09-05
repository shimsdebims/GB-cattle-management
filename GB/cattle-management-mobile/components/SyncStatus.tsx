import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useOfflineAPI } from '../hooks/useOfflineAPI';

const SyncStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const { syncStatus, forceSync } = useOfflineAPI();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });

    return () => unsubscribe();
  }, []);

  const handleSync = async () => {
    if (isOnline) {
      await forceSync();
    }
  };

  const getStatusColor = () => {
    if (!isOnline) return '#FF5722';
    if (syncStatus.pendingCount > 0) return '#FF9800';
    return '#4CAF50';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (syncStatus.pendingCount > 0) return `${syncStatus.pendingCount} pending`;
    return 'Synced';
  };

  const getStatusIcon = () => {
    if (!isOnline) return 'cloud-off';
    if (syncStatus.pendingCount > 0) return 'cloud-sync';
    return 'cloud-done';
  };

  return (
    <TouchableOpacity 
      style={[styles.container, { backgroundColor: getStatusColor() }]}
      onPress={handleSync}
      disabled={!isOnline}
    >
      <MaterialIcons name={getStatusIcon()} size={16} color="#FFFFFF" />
      <Text style={styles.text}>{getStatusText()}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    margin: 10,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default SyncStatus;
