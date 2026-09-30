import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Alert } from '../utils/alert';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import MilkConflicts from '../components/MilkConflicts';
import SyncStatus from '../components/SyncStatus';
import { ApiError } from '../services/api';
import { offlineApi } from '../services/offlineApi';
import { useOfflineAPI } from '../hooks/useOfflineAPI';
import { formatLiters } from '../utils/formatCurrency';
import { formatDate } from '../utils/date';
import { colors, radius, spacing } from '../constants/theme';
import { LIMITS, type Cattle, type MilkProduction } from '../types';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = StackNavigationProp<RootStackParamList>;

const MilkProductionScreen = () => {
  const navigation = useNavigation<Nav>();
  const { forceSync } = useOfflineAPI();

  const [records, setRecords] = useState<MilkProduction[]>([]);
  const [herd, setHerd] = useState<Cattle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [milk, cattle] = await Promise.all([
        offlineApi.getMilk(),
        offlineApi.getCattle(),
      ]);
      setRecords(milk);
      setHerd(cattle);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const nameFor = useCallback(
    (ref: MilkProduction['cattle_id']) => {
      if (typeof ref !== 'string') return `${ref.tag_number} — ${ref.name}`;
      const cow = herd.find((c) => c._id === ref);
      return cow ? `${cow.tag_number} — ${cow.name}` : 'Unknown';
    },
    [herd]
  );

  const totalLiters = useMemo(
    () => records.reduce((sum, record) => sum + record.quantity_liters, 0),
    [records]
  );

  /** Tapping a record opens its whole day, where any cow can be corrected. */
  const openDay = (record?: MilkProduction) =>
    navigation.navigate('MilkDay', record ? { date: String(record.date_recorded).slice(0, 10) } : undefined);

  const confirmDelete = (record: MilkProduction) => {
    Alert.alert('Delete milk record?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await offlineApi.deleteMilk(record._id);
          } catch (error) {
            Alert.alert(
              'Could not delete',
              error instanceof ApiError ? error.displayMessage : 'Please try again.'
            );
          }
          await load();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Milk Production</Text>
          <Text style={styles.subtitle}>
            {records.length} records · {formatLiters(totalLiters)}
          </Text>
        </View>
        <SyncStatus />
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => openDay()}
          accessibilityLabel="Record today's milk"
        >
          <MaterialIcons name="add" size={24} color={colors.background} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={records}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <MilkConflicts onResolved={load} />
            <TouchableOpacity style={styles.dayButton} onPress={() => openDay()}>
              <MaterialIcons name="playlist-add" size={20} color={colors.background} />
              <Text style={styles.dayButtonText}>Record today's milk</Text>
            </TouchableOpacity>
          </>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await forceSync();
              await load();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="opacity" size={52} color={colors.borderStrong} />
            <Text style={styles.emptyText}>No milk records yet</Text>
            <Text style={styles.emptyHint}>Tap "Record today's milk" to start.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => openDay(item)}
            onLongPress={() => confirmDelete(item)}
            delayLongPress={400}
            accessibilityHint="Tap to edit this day, press and hold to delete"
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {nameFor(item.cattle_id)}
              </Text>
              <Text style={styles.cardDate}>{formatDate(item.date_recorded)}</Text>
            </View>
            <View style={styles.cardBottom}>
              <View style={styles.metric}>
                <MaterialIcons name="opacity" size={16} color={colors.cyan} />
                <Text style={styles.metricText}>{formatLiters(item.quantity_liters)}</Text>
              </View>
              {item.morning_liters != null || item.evening_liters != null ? (
                <Text style={styles.metricText}>
                  AM {item.morning_liters ?? '–'} · PM {item.evening_liters ?? '–'}
                </Text>
              ) : null}
              {item.quality_score != null && (
                <View style={styles.metric}>
                  <MaterialIcons name="star" size={16} color="#FFD700" />
                  <Text style={styles.metricText}>
                    {item.quality_score.toFixed(1)}/{LIMITS.QUALITY_SCORE_MAX}
                  </Text>
                </View>
              )}
            </View>
            {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: 56,
    paddingBottom: spacing.md,
  },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  cardDate: { color: colors.textFaint, fontSize: 12 },
  cardBottom: { flexDirection: 'row', gap: spacing.xl },
  metric: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metricText: { color: colors.textMuted, fontSize: 13 },
  notes: {
    color: colors.textFaint,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },

  empty: { alignItems: 'center', paddingTop: 80, gap: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 16 },
  emptyHint: { color: colors.textDisabled, fontSize: 13 },

  dayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  dayButtonText: { color: colors.background, fontSize: 15, fontWeight: '700' },
});

export default MilkProductionScreen;
