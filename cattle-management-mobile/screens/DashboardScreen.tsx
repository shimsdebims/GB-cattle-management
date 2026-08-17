import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import SyncStatus from '../components/SyncStatus';
import { ApiError, analyticsAPI } from '../services/api';
import { useOfflineAPI } from '../hooks/useOfflineAPI';
import { formatCurrency, formatLiters } from '../utils/formatCurrency';
import { colors, radius, spacing } from '../constants/theme';
import type { DashboardSummary } from '../types';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = StackNavigationProp<RootStackParamList>;

/**
 * All figures come from `/api/analytics/dashboard`.
 *
 * The previous version downloaded cattle, milk and expense records and summed
 * them on the device. Those endpoints paginate at 50 records, so the totals
 * were silently wrong for any farm with more than a few weeks of data.
 */
const DashboardScreen = () => {
  const navigation = useNavigation<Nav>();
  const { isOnline, forceSync } = useOfflineAPI();

  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await analyticsAPI.dashboard({ days: 30 }));
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.displayMessage : 'Could not load the dashboard.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh on focus so figures reflect records added on other tabs.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await forceSync();
    await load();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const cattle = data?.cattle;
  const milk = data?.milk_production;
  const money = data?.financial;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Farm Dashboard</Text>
          <Text style={styles.subtitle}>Last 30 days</Text>
        </View>
        <View style={styles.headerRight}>
          <SyncStatus />
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Settings')}
            accessibilityLabel="Farm settings"
          >
            <MaterialIcons name="settings" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.errorBanner}>
            <MaterialIcons name="cloud-off" size={18} color={colors.text} />
            <Text style={styles.errorText}>
              {isOnline ? error : 'Offline — showing the last figures loaded.'}
            </Text>
          </View>
        )}

        <Section title="Herd">
          <Stat label="Total" value={cattle?.total_cattle ?? 0} icon="pets" color={colors.success} />
          <Stat label="Active" value={cattle?.active_cattle ?? 0} icon="check-circle" color={colors.info} />
          <Stat label="Healthy" value={cattle?.healthy_cattle ?? 0} icon="favorite" color={colors.primary} />
          <Stat label="Pregnant" value={cattle?.pregnant_cattle ?? 0} icon="child-care" color={colors.warning} />
        </Section>

        <Section title="Milk Production">
          <Stat
            label="Total"
            value={formatLiters(milk?.total_liters ?? 0)}
            icon="opacity"
            color={colors.cyan}
            hint={`${milk?.production_records ?? 0} records`}
          />
          <Stat
            label="Daily average"
            value={formatLiters(milk?.average_daily_liters ?? 0)}
            icon="trending-up"
            color={colors.purple}
            hint={`${milk?.recording_days ?? 0} days recorded`}
          />
        </Section>

        <Section title="Financial">
          <Stat
            label="Milk revenue"
            value={formatCurrency(money?.milk_revenue ?? 0)}
            icon="opacity"
            color={colors.cyan}
            hint={`@ ${formatCurrency(money?.milk_price_per_liter ?? 0)}/L`}
          />
          <Stat
            label="Other revenue"
            value={formatCurrency(money?.other_revenue ?? 0)}
            icon="sell"
            color={colors.purple}
          />
          <Stat
            label="Expenses"
            value={formatCurrency(money?.total_expenses ?? 0)}
            icon="receipt"
            color={colors.danger}
          />
          <Stat
            label="Net profit"
            value={formatCurrency(money?.net_profit ?? 0)}
            icon={(money?.net_profit ?? 0) >= 0 ? 'trending-up' : 'trending-down'}
            color={(money?.net_profit ?? 0) >= 0 ? colors.success : colors.danger}
          />
        </Section>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actions}>
            <Action
              label="Add Cattle"
              icon="add"
              onPress={() => navigation.navigate('AddCattle')}
            />
            <Action
              label="Record Milk"
              icon="opacity"
              onPress={() => navigation.navigate('MainTabs', { screen: 'Milk' })}
            />
            <Action
              label="Add Feeding"
              icon="restaurant"
              onPress={() => navigation.navigate('MainTabs', { screen: 'Feeding' })}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Pieces ──────────────────────────────────────────────────────────────────

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.grid}>{children}</View>
  </View>
);

const Stat = ({
  label,
  value,
  icon,
  color,
  hint,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  hint?: string;
}) => (
  <View style={[styles.card, { borderLeftColor: color }]}>
    <View style={styles.cardHeader}>
      <MaterialIcons name={icon} size={20} color={color} />
      <Text style={styles.cardLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
    <Text style={styles.cardValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
      {value}
    </Text>
    {hint ? <Text style={styles.cardHint}>{hint}</Text> : null}
  </View>
);

const Action = ({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.actionButton} onPress={onPress}>
    <MaterialIcons name={icon} size={22} color={colors.text} />
    <Text style={styles.actionText}>{label}</Text>
  </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.xl,
    paddingTop: 60,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: { padding: spacing.xs },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  content: { paddingBottom: spacing.xl },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
  },
  errorText: { color: colors.text, fontSize: 13, flex: 1 },
  section: { paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    width: '48%',
    borderLeftWidth: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  cardLabel: { fontSize: 13, color: colors.textMuted, flex: 1 },
  cardValue: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  cardHint: { fontSize: 11, color: colors.textFaint, marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  actionButton: {
    flex: 1,
    backgroundColor: colors.header,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: { color: colors.text, fontSize: 12, fontWeight: '600' },
});

export default DashboardScreen;
