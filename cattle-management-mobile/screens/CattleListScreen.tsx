import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import SyncStatus from '../components/SyncStatus';
import { offlineApi } from '../services/offlineApi';
import { useOfflineAPI } from '../hooks/useOfflineAPI';
import { colors, healthColor, radius, spacing, statusColor } from '../constants/theme';
import { CATTLE_STATUSES, type Cattle, type CattleStatus } from '../types';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = StackNavigationProp<RootStackParamList>;

const CattleListScreen = () => {
  const navigation = useNavigation<Nav>();
  const { forceSync } = useOfflineAPI();

  const [herd, setHerd] = useState<Cattle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CattleStatus | 'All'>('All');

  const load = useCallback(async () => {
    try {
      setHerd(await offlineApi.getCattle());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload on focus so a newly added animal appears without a manual pull.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  /**
   * Filtering happens locally against the cached herd. That is appropriate
   * here: a herd is tens of animals, and it keeps search working offline.
   */
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return herd.filter((cow) => {
      if (statusFilter !== 'All' && cow.current_status !== statusFilter) return false;
      if (!term) return true;
      return (
        cow.name.toLowerCase().includes(term) ||
        cow.tag_number.toLowerCase().includes(term)
      );
    });
  }, [herd, search, statusFilter]);

  const ageLabel = (cow: Cattle) => {
    const months =
      cow.age_in_months ??
      (() => {
        const birth = new Date(cow.date_of_birth);
        const now = new Date();
        return (
          (now.getFullYear() - birth.getFullYear()) * 12 +
          (now.getMonth() - birth.getMonth())
        );
      })();

    if (months < 12) return `${months} mo`;
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return rest > 0 ? `${years}y ${rest}m` : `${years}y`;
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
          <Text style={styles.title}>My Cattle</Text>
          <Text style={styles.subtitle}>
            {visible.length === herd.length
              ? `${herd.length} animals`
              : `${visible.length} of ${herd.length}`}
          </Text>
        </View>
        <SyncStatus />
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddCattle')}
          accessibilityLabel="Add cattle"
        >
          <MaterialIcons name="add" size={24} color={colors.background} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <MaterialIcons name="search" size={20} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or tag"
          placeholderTextColor={colors.textDisabled}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialIcons name="close" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {(['All', ...CATTLE_STATUSES] as const).map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filter, statusFilter === status && styles.filterActive]}
            onPress={() => setStatusFilter(status)}
          >
            <Text
              style={[
                styles.filterText,
                statusFilter === status && styles.filterTextActive,
              ]}
            >
              {status}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={visible}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
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
            <MaterialIcons name="pets" size={52} color={colors.borderStrong} />
            <Text style={styles.emptyText}>
              {herd.length === 0 ? 'No cattle yet' : 'No matches'}
            </Text>
            <Text style={styles.emptyHint}>
              {herd.length === 0 ? 'Tap + to add your first animal.' : 'Try another search.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('CattleDetail', { cattleId: item._id })}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardIdentity}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.tag}>{item.tag_number}</Text>
              </View>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: statusColor[item.current_status] ?? colors.borderStrong },
                ]}
              >
                <Text style={styles.badgeText}>{item.current_status}</Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <Meta icon="pets" text={item.breed} />
              <Meta icon="wc" text={item.gender} />
              <Meta icon="cake" text={ageLabel(item)} />
              {item.weight != null && <Meta icon="fitness-center" text={`${item.weight} kg`} />}
            </View>

            <View style={styles.cardFooter}>
              <View
                style={[
                  styles.healthBadge,
                  { backgroundColor: healthColor[item.health_status] ?? colors.borderStrong },
                ]}
              >
                <Text style={styles.healthText}>{item.health_status}</Text>
              </View>
              {item.location ? (
                <Text style={styles.location}>{item.location}</Text>
              ) : null}
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={colors.primary}
                style={styles.chevron}
              />
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const Meta = ({
  icon,
  text,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  text: string;
}) => (
  <View style={styles.meta}>
    <MaterialIcons name={icon} size={14} color={colors.textFaint} />
    <Text style={styles.metaText}>{text}</Text>
  </View>
);

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
  title: { fontSize: 24, fontWeight: 'bold', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, paddingVertical: spacing.md, fontSize: 15 },

  filterScroll: { maxHeight: 52 },
  filterRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    height: 30,
    justifyContent: 'center',
  },
  filterActive: { backgroundColor: colors.header, borderColor: colors.primary },
  filterText: { color: colors.textMuted, fontSize: 12 },
  filterTextActive: { color: colors.primary, fontWeight: '700' },

  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.header,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  cardIdentity: { flex: 1 },
  name: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  tag: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 2 },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
  },
  badgeText: { color: colors.text, fontSize: 11, fontWeight: '700' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { color: colors.textMuted, fontSize: 12 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  healthBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.lg,
  },
  healthText: { color: colors.text, fontSize: 11, fontWeight: '600' },
  location: { color: colors.textFaint, fontSize: 12 },
  chevron: { marginLeft: 'auto' },

  empty: { alignItems: 'center', paddingTop: 60, gap: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 16 },
  emptyHint: { color: colors.textDisabled, fontSize: 13 },
});

export default CattleListScreen;
